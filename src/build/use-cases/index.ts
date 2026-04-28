import type { ProjectContext } from "../../core/protocol/types.js";
import type { CanonicalStore } from "../../knowledge/read-objects.js";
import type { IndexedStore, StoreStats } from "../../store/sqlite/sqlite-store.js";

// ---------------------------------------------------------------------------
// build
// ---------------------------------------------------------------------------

export interface BuildKnowledgeBaseResult extends StoreStats {
  artifact: string;
  database_path: string;
}

export interface BuildKnowledgeBaseUseCase {
  execute(): Promise<BuildKnowledgeBaseResult>;
}

export interface BuildKnowledgeBaseDependencies {
  project: ProjectContext;
  canonical: CanonicalStore;
  indexed: IndexedStore;
}

export function makeBuildKnowledgeBase(
  deps: BuildKnowledgeBaseDependencies,
): BuildKnowledgeBaseUseCase {
  return {
    async execute(): Promise<BuildKnowledgeBaseResult> {
      const objects = await deps.canonical.readAll();
      deps.indexed.replaceAll(objects);
      return {
        artifact: deps.project.manifest.artifact.name,
        database_path: deps.project.databasePath,
        ...deps.indexed.stats(),
      };
    },
  };
}

// ---------------------------------------------------------------------------
// check
// ---------------------------------------------------------------------------

export interface CheckKnowledgeBaseResult {
  artifact: string;
  object_count: number;
  schema_types: string[];
  relationship_types: string[];
}

export interface CheckKnowledgeBaseUseCase {
  execute(): Promise<CheckKnowledgeBaseResult>;
}

export interface CheckKnowledgeBaseDependencies {
  project: ProjectContext;
  canonical: CanonicalStore;
}

export function makeCheckKnowledgeBase(
  deps: CheckKnowledgeBaseDependencies,
): CheckKnowledgeBaseUseCase {
  return {
    async execute(): Promise<CheckKnowledgeBaseResult> {
      const objects = await deps.canonical.readAll();
      return {
        artifact: deps.project.manifest.artifact.name,
        object_count: objects.length,
        schema_types: Object.keys(deps.project.schema.object_types),
        relationship_types: Object.keys(deps.project.schema.relationship_types ?? {}),
      };
    },
  };
}
