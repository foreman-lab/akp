import { readdir as fsReaddir } from "node:fs/promises";
import path from "node:path";

import type { KnowledgeObject, Manifest } from "../../../core/protocol/types.js";
import type {
  ExtractorDescriptor,
  SourceExtractor,
  SourceExtractorContext,
} from "../../source-extractor.js";
import type { Dirent } from "node:fs";

const EXTRACTOR_ID = "ts-repo";

/**
 * Filesystem operations the extractor depends on. Injected so tests can
 * exercise edge cases (e.g. EACCES propagation) that are awkward to trigger
 * against the real filesystem on every platform.
 */
export interface TsRepoDependencies {
  /** Defaults to `node:fs/promises.readdir` with `{withFileTypes: true}`. */
  readdir?: (path: string, options: { withFileTypes: true }) => Promise<Dirent[]>;
}

/**
 * Extractor for TypeScript repositories. Today it emits one `module` object
 * per top-level directory under `<rootDir>/src/`. Future TDD cycles add
 * `command`, `function`, `class`, `port`, `use_case` and the corresponding
 * relationships.
 */
export function tsRepoExtractor(deps: TsRepoDependencies = {}): SourceExtractor {
  const readdir = deps.readdir ?? defaultReaddir;
  return {
    describe(): ExtractorDescriptor {
      return {
        id: EXTRACTOR_ID,
        description:
          "Extracts module objects from top-level directories under src/ in a TypeScript repo.",
        produces_types: ["module"],
      };
    },
    extract(context: SourceExtractorContext): AsyncIterable<KnowledgeObject> {
      return extractModules(context, readdir);
    },
  };
}

async function defaultReaddir(
  pathArg: string,
  options: { withFileTypes: true },
): Promise<Dirent[]> {
  return fsReaddir(pathArg, options);
}

async function* extractModules(
  context: SourceExtractorContext,
  readdir: NonNullable<TsRepoDependencies["readdir"]>,
): AsyncIterable<KnowledgeObject> {
  const srcDir = path.join(context.rootDir, "src");

  let entries: Dirent[];
  try {
    entries = await readdir(srcDir, { withFileTypes: true });
  } catch (error: unknown) {
    const nodeError = error as NodeJS.ErrnoException;
    if (nodeError.code === "ENOENT") {
      return;
    }
    throw error;
  }

  const now = new Date().toISOString();
  const moduleEntries = entries
    .filter(
      (entry) => entry.isDirectory() && !entry.name.startsWith(".") && !entry.name.startsWith("_"),
    )
    .sort((a, b) => a.name.localeCompare(b.name));

  for (const entry of moduleEntries) {
    yield buildModuleObject(entry.name, context.manifest, now);
  }
}

function buildModuleObject(name: string, manifest: Manifest, now: string): KnowledgeObject {
  return {
    id: `module.${name}`,
    type: "module",
    kind: "fact",
    title: capitalize(name),
    summary: `Module at src/${name}/.`,
    attributes: {
      paths: [`src/${name}/**`],
      purpose: `Source module at src/${name}/.`,
    },
    relationships: [],
    sources: [
      {
        source_kind: "directory",
        uri: `file://src/${name}`,
      },
    ],
    classification: manifest.security.default_classification,
    exposure: manifest.security.default_exposure,
    provenance: {
      generated_by: EXTRACTOR_ID,
      generated_at: now,
      confidence: "mechanical",
      verified_against: [],
    },
    freshness: {
      last_verified: now,
      status: "fresh",
    },
    review_state: "accepted",
  };
}

function capitalize(value: string): string {
  if (value.length === 0) return value;
  return value.charAt(0).toUpperCase() + value.slice(1);
}
