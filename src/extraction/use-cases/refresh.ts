import { AppError } from "../../core/errors/app-error.js";
import { knowledgeObjectSchema } from "../../core/protocol/schema.js";
import {
  validateObjectAgainstPack,
  validateRelationshipTargets,
} from "../../knowledge/read-objects.js";
import { isOwnedByExtractor } from "../source-extractor.js";

import type { Manifest, PackSchema, KnowledgeObject } from "../../core/protocol/types.js";
import type { CanonicalStore } from "../../knowledge/read-objects.js";
import type { IndexedStore } from "../../store/sqlite/sqlite-store.js";
import type { ExtractorDescriptor, SourceExtractor } from "../source-extractor.js";

export interface RefreshOptions {
  extractorId?: string | undefined;
  dryRun?: boolean | undefined;
}

export interface RefreshResult {
  extractor: ExtractorDescriptor;
  added_count: number;
  replaced_count: number;
  removed_count: number;
  preserved_count: number;
  dry_run: boolean;
}

export interface RefreshDependencies {
  canonical: CanonicalStore;
  indexed: IndexedStore;
  extractors: readonly SourceExtractor[];
  context: {
    rootDir: string;
    manifest: Manifest;
    schema: PackSchema;
  };
}

export interface RefreshUseCase {
  execute(options?: RefreshOptions): Promise<RefreshResult>;
}

export function makeRefresh(deps: RefreshDependencies): RefreshUseCase {
  return {
    async execute(options: RefreshOptions = {}): Promise<RefreshResult> {
      const extractor = pickExtractor(deps.extractors, options.extractorId);
      const descriptor = extractor.describe();

      const extracted: KnowledgeObject[] = [];
      for await (const candidate of extractor.extract({
        rootDir: deps.context.rootDir,
        manifest: deps.context.manifest,
        schema: deps.context.schema,
      })) {
        const parsed = knowledgeObjectSchema.safeParse(candidate);
        if (!parsed.success) {
          throw new AppError(
            "AKP_EXTRACTOR_PRODUCED_INVALID_OBJECT",
            `Extractor ${descriptor.id} produced an object that fails the AKP envelope schema`,
            parsed.error.format(),
          );
        }
        validateObjectAgainstPack(parsed.data, deps.context.schema);
        extracted.push(parsed.data);
      }

      const existing = await deps.canonical.readAll();
      const ownedExisting = existing.filter((object) => isOwnedByExtractor(object, descriptor.id));
      const otherExisting = existing.filter((object) => !isOwnedByExtractor(object, descriptor.id));

      const extractedIds = new Set(extracted.map((object) => object.id));
      const ownedExistingIds = new Set(ownedExisting.map((object) => object.id));

      const otherById = new Map(otherExisting.map((object) => [object.id, object] as const));
      const collisions = extracted
        .filter((object) => otherById.has(object.id))
        .map((object) => ({
          id: object.id,
          preserved_owner: otherById.get(object.id)!.provenance.generated_by,
          extractor_id: descriptor.id,
        }));
      if (collisions.length > 0) {
        throw new AppError(
          "AKP_OBJECT_ID_COLLISION",
          `Extractor ${descriptor.id} emitted ${collisions.length} id(s) already owned by other (preserved) objects. Resolve by deleting the conflicting canonical object or renaming one of them.`,
          { collisions },
        );
      }

      const added_count = extracted.filter((object) => !ownedExistingIds.has(object.id)).length;
      const replaced_count = extracted.length - added_count;
      const removed_count = ownedExisting.filter((object) => !extractedIds.has(object.id)).length;
      const preserved_count = otherExisting.length;

      const merged = [...otherExisting, ...extracted];
      validateRelationshipTargets(merged);

      const dry_run = Boolean(options.dryRun);
      if (!dry_run) {
        await deps.canonical.writeAll(merged);
        deps.indexed.replaceAll(merged);
      }

      return {
        extractor: descriptor,
        added_count,
        replaced_count,
        removed_count,
        preserved_count,
        dry_run,
      };
    },
  };
}

function pickExtractor(
  extractors: readonly SourceExtractor[],
  requestedId: string | undefined,
): SourceExtractor {
  if (extractors.length === 0) {
    throw new AppError(
      "AKP_NO_EXTRACTORS_REGISTERED",
      "No extractors are registered. Install a domain pack or register one in the CLI before running `akp refresh`.",
    );
  }

  if (requestedId !== undefined) {
    const match = extractors.find((extractor) => extractor.describe().id === requestedId);
    if (!match) {
      throw new AppError(
        "AKP_EXTRACTOR_UNKNOWN",
        `No extractor registered with id "${requestedId}".`,
        { available: extractors.map((extractor) => extractor.describe().id) },
      );
    }
    return match;
  }

  if (extractors.length > 1) {
    throw new AppError(
      "AKP_EXTRACTOR_AMBIGUOUS",
      "Multiple extractors are registered; pass --extractor <id> to choose one.",
      { available: extractors.map((extractor) => extractor.describe().id) },
    );
  }

  return extractors[0]!;
}
