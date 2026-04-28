import { makeBuildKnowledgeBase, makeCheckKnowledgeBase } from "../build/use-cases/index.js";
import { loadProject } from "../core/config/load-project.js";
import { defaultExtractors } from "../extraction/registry.js";
import { makeRefresh } from "../extraction/use-cases/refresh.js";
import { makeJsonlCanonicalStore } from "../knowledge/read-objects.js";
import {
  makeBriefKnowledge,
  makeDescribeKnowledgeBase,
  makeGetFreshness,
  makeGetNeighbors,
  makeGetObject,
  makeLookupKnowledge,
} from "../query/use-cases/index.js";
import { ensureStoreBuilt } from "../store/ensure-store-built.js";
import { SqliteStore } from "../store/sqlite/sqlite-store.js";

import type {
  BuildKnowledgeBaseUseCase,
  CheckKnowledgeBaseUseCase,
} from "../build/use-cases/index.js";
import type { ProjectContext } from "../core/protocol/types.js";
import type { SourceExtractor } from "../extraction/source-extractor.js";
import type { RefreshUseCase } from "../extraction/use-cases/refresh.js";
import type { CanonicalStore } from "../knowledge/read-objects.js";
import type {
  BriefKnowledgeUseCase,
  DescribeKnowledgeBaseUseCase,
  GetFreshnessUseCase,
  GetNeighborsUseCase,
  GetObjectUseCase,
  LookupKnowledgeUseCase,
} from "../query/use-cases/index.js";
import type { IndexedStore } from "../store/sqlite/sqlite-store.js";

/**
 * The set of use cases the inbound adapters (CLI, MCP) consume.
 */
export interface UseCases {
  describe: DescribeKnowledgeBaseUseCase;
  get: GetObjectUseCase;
  lookup: LookupKnowledgeUseCase;
  neighbors: GetNeighborsUseCase;
  freshness: GetFreshnessUseCase;
  brief: BriefKnowledgeUseCase;
  build: BuildKnowledgeBaseUseCase;
  check: CheckKnowledgeBaseUseCase;
  refresh: RefreshUseCase;
}

/**
 * Wired runtime: project context, ports, adapters, and use cases. Holds
 * resources (the SQLite handle) for the lifetime of the inbound adapter
 * — call `dispose()` to release them.
 */
export interface Container {
  project: ProjectContext;
  canonical: CanonicalStore;
  indexed: IndexedStore;
  extractors: readonly SourceExtractor[];
  useCases: UseCases;
  dispose(): void;
}

export interface BuildContainerOptions {
  /**
   * If true, fail fast with `AKP_STORE_NOT_BUILT` when the local SQLite
   * file does not yet exist. Read verbs (lookup, get, neighbors, brief,
   * freshness) want this; build/refresh do not.
   */
  requireBuiltStore?: boolean | undefined;
}

/**
 * Composition root for AKP's inbound adapters. Loads the project, wires
 * canonical and indexed stores, registers extractors, and constructs the
 * use cases that CLI and MCP consume. The caller is responsible for
 * calling `dispose()` when done (typically inside a try/finally).
 */
export async function buildContainer(
  cwd: string,
  options: BuildContainerOptions = {},
): Promise<Container> {
  const project = await loadProject(cwd);

  if (options.requireBuiltStore) {
    await ensureStoreBuilt(project.databasePath);
  }

  const canonical = makeJsonlCanonicalStore(project.objectsPath, project.schema);
  const indexed = new SqliteStore(project.databasePath);
  let initialized = false;
  try {
    indexed.initialize();
    initialized = true;
  } catch (error: unknown) {
    indexed.close();
    throw error;
  }

  const extractors = defaultExtractors();
  const refresh = makeRefresh({
    canonical,
    indexed,
    extractors,
    context: {
      rootDir: project.rootDir,
      manifest: project.manifest,
      schema: project.schema,
    },
  });

  const useCases: UseCases = {
    describe: makeDescribeKnowledgeBase(project),
    get: makeGetObject(indexed),
    lookup: makeLookupKnowledge(indexed),
    neighbors: makeGetNeighbors(indexed),
    freshness: makeGetFreshness(project, indexed),
    brief: makeBriefKnowledge(indexed),
    build: makeBuildKnowledgeBase({ project, canonical, indexed }),
    check: makeCheckKnowledgeBase({ project, canonical }),
    refresh,
  };

  return {
    project,
    canonical,
    indexed,
    extractors,
    useCases,
    dispose() {
      if (initialized) {
        indexed.close();
        initialized = false;
      }
    },
  };
}
