import type {
  KnowledgeObject,
  Manifest,
  PackSchema,
  ProjectContext,
} from "../../core/protocol/types.js";
import type {
  IndexedStore,
  LookupResult,
  Neighbor,
  StoreStats,
} from "../../store/sqlite/sqlite-store.js";

// ---------------------------------------------------------------------------
// describe
// ---------------------------------------------------------------------------

export interface DescribeKnowledgeBaseResult {
  artifact: Manifest["artifact"];
  version: string;
  security: Manifest["security"];
  object_types: PackSchema["object_types"];
  relationship_types: NonNullable<PackSchema["relationship_types"]>;
}

export interface DescribeKnowledgeBaseUseCase {
  execute(): DescribeKnowledgeBaseResult;
}

export function makeDescribeKnowledgeBase(project: ProjectContext): DescribeKnowledgeBaseUseCase {
  return {
    execute(): DescribeKnowledgeBaseResult {
      return {
        artifact: project.manifest.artifact,
        version: project.manifest.version,
        security: project.manifest.security,
        object_types: project.schema.object_types,
        relationship_types: project.schema.relationship_types ?? {},
      };
    },
  };
}

// ---------------------------------------------------------------------------
// get
// ---------------------------------------------------------------------------

export interface GetObjectInput {
  id: string;
}

export interface GetObjectUseCase {
  execute(input: GetObjectInput): KnowledgeObject | null;
}

export function makeGetObject(indexed: IndexedStore): GetObjectUseCase {
  return {
    execute({ id }: GetObjectInput): KnowledgeObject | null {
      return indexed.getObject(id);
    },
  };
}

// ---------------------------------------------------------------------------
// lookup
// ---------------------------------------------------------------------------

export interface LookupKnowledgeInput {
  intent: string;
  limit: number;
}

export interface LookupKnowledgeUseCase {
  execute(input: LookupKnowledgeInput): LookupResult[];
}

export function makeLookupKnowledge(indexed: IndexedStore): LookupKnowledgeUseCase {
  return {
    execute({ intent, limit }: LookupKnowledgeInput): LookupResult[] {
      return indexed.lookup(intent, limit);
    },
  };
}

// ---------------------------------------------------------------------------
// neighbors
// ---------------------------------------------------------------------------

export interface GetNeighborsInput {
  id: string;
  limit: number;
}

export interface GetNeighborsUseCase {
  execute(input: GetNeighborsInput): Neighbor[];
}

export function makeGetNeighbors(indexed: IndexedStore): GetNeighborsUseCase {
  return {
    execute({ id, limit }: GetNeighborsInput): Neighbor[] {
      return indexed.neighbors(id, 1, limit);
    },
  };
}

// ---------------------------------------------------------------------------
// freshness
// ---------------------------------------------------------------------------

export interface FreshnessResult extends StoreStats {
  artifact: string;
}

export interface GetFreshnessUseCase {
  execute(): FreshnessResult;
}

export function makeGetFreshness(
  project: ProjectContext,
  indexed: IndexedStore,
): GetFreshnessUseCase {
  return {
    execute(): FreshnessResult {
      return {
        artifact: project.manifest.artifact.name,
        ...indexed.stats(),
      };
    },
  };
}

// ---------------------------------------------------------------------------
// brief
// ---------------------------------------------------------------------------

export interface BriefKnowledgeInput {
  scope: string;
  limit: number;
}

export interface BriefKnowledgeResult {
  scope: string;
  summary: string;
  primary_objects: KnowledgeObject[];
  gaps_known: boolean;
  gaps: string[];
}

export interface BriefKnowledgeUseCase {
  execute(input: BriefKnowledgeInput): BriefKnowledgeResult;
}

export function makeBriefKnowledge(indexed: IndexedStore): BriefKnowledgeUseCase {
  return {
    execute({ scope, limit }: BriefKnowledgeInput): BriefKnowledgeResult {
      const results = indexed.lookup(scope, limit);
      const primary_objects = results.map((result) => result.object);
      const summary = results.length
        ? `Found ${results.length} AKP reference object(s) related to "${scope}".`
        : `No AKP reference objects found for "${scope}".`;
      return {
        scope,
        summary,
        primary_objects,
        gaps_known: false,
        gaps: [],
      };
    },
  };
}

export type { LookupResult, Neighbor, StoreStats } from "../../store/sqlite/sqlite-store.js";
