import type { KnowledgeObject, PackSchema, ProjectContext } from "../../src/core/protocol/types.js";
import type { CanonicalStore } from "../../src/knowledge/read-objects.js";
import type { IndexedStore, StoreStats } from "../../src/store/sqlite/sqlite-store.js";

/**
 * Synthetic ProjectContext for unit tests. The literal path
 * `/synthetic-akp-test-fixture` never resolves to a real filesystem
 * location — tests should not touch production fs.
 */
export function makeFakeProject(overrides: Partial<ProjectContext> = {}): ProjectContext {
  return {
    rootDir: "/synthetic-akp-test-fixture",
    akpDir: "/synthetic-akp-test-fixture/.akp",
    localDir: "/synthetic-akp-test-fixture/.akp-local",
    manifestPath: "/synthetic-akp-test-fixture/.akp/manifest.yaml",
    schemaPath: "/synthetic-akp-test-fixture/.akp/schemas/code.yaml",
    objectsPath: "/synthetic-akp-test-fixture/.akp/objects.jsonl",
    databasePath: "/synthetic-akp-test-fixture/.akp-local/akp.sqlite",
    manifest: {
      version: "0.1",
      artifact: { name: "test-artifact", kind: "software_repo" },
      schema: "schemas/code.yaml",
      security: { default_classification: "internal", default_exposure: "committed" },
    },
    schema: makeFakeSchema(),
    ...overrides,
  };
}

export function makeFakeSchema(overrides: Partial<PackSchema> = {}): PackSchema {
  return {
    object_types: { module: { kind: "fact" } },
    relationship_types: { uses: { category: "dependency" } },
    ...overrides,
  };
}

/**
 * In-memory IndexedStore with no-op defaults. Override any subset of methods
 * to assert specific call patterns.
 */
export function makeFakeIndexed(overrides: Partial<IndexedStore> = {}): IndexedStore {
  const noop = () => {
    /* fake */
  };
  const base: IndexedStore = {
    initialize: noop,
    upsertMany: noop,
    deleteMany: noop,
    replaceAll: noop,
    getObject: () => null,
    lookup: () => [],
    neighbors: () => [],
    stats: (): StoreStats => ({ object_count: 0, relationship_count: 0, stale_count: 0 }),
    close: noop,
  };
  return { ...base, ...overrides };
}

/**
 * In-memory CanonicalStore. `readAll` returns the supplied object list;
 * `writeAll` defaults to a no-op (override to capture writes).
 */
export function makeFakeCanonical(
  objects: KnowledgeObject[] = [],
  writeAll: (objects: KnowledgeObject[]) => Promise<void> = async () => {
    /* noop */
  },
): CanonicalStore {
  return {
    readAll: async () => objects,
    writeAll,
  };
}

/**
 * Synthetic KnowledgeObject envelope with fixed ISO 8601 dates so tests are
 * deterministic. Override any subset of fields.
 */
export function fakeObject(id: string, overrides: Partial<KnowledgeObject> = {}): KnowledgeObject {
  return {
    id,
    type: "module",
    kind: "fact",
    title: id,
    summary: "test",
    attributes: {},
    relationships: [],
    sources: [],
    classification: "internal",
    exposure: "committed",
    provenance: {
      generated_by: "human:test",
      generated_at: "2026-04-27T00:00:00.000Z",
      confidence: "human-authored",
      verified_against: [],
    },
    freshness: { last_verified: "2026-04-27T00:00:00.000Z", status: "fresh" },
    review_state: "accepted",
    ...overrides,
  };
}
