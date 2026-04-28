import assert from "node:assert/strict";
import test from "node:test";

import {
  makeBriefKnowledge,
  makeDescribeKnowledgeBase,
  makeGetFreshness,
  makeGetNeighbors,
  makeGetObject,
  makeLookupKnowledge,
} from "../../../src/query/use-cases/index.js";

import type {
  KnowledgeObject,
  PackSchema,
  ProjectContext,
} from "../../../src/core/protocol/types.js";
import type {
  IndexedStore,
  LookupResult,
  Neighbor,
  StoreStats,
} from "../../../src/store/sqlite/sqlite-store.js";

function makeFakeProject(): ProjectContext {
  return {
    rootDir: "/test",
    akpDir: "/test/.akp",
    localDir: "/test/.akp-local",
    manifestPath: "/test/.akp/manifest.yaml",
    schemaPath: "/test/.akp/schemas/code.yaml",
    objectsPath: "/test/.akp/objects.jsonl",
    databasePath: "/test/.akp-local/akp.sqlite",
    manifest: {
      version: "0.1",
      artifact: { name: "test-artifact", kind: "software_repo" },
      schema: "schemas/code.yaml",
      security: { default_classification: "internal", default_exposure: "committed" },
    },
    schema: makeSchema(),
  };
}

function makeSchema(): PackSchema {
  return {
    object_types: { module: { kind: "fact" } },
    relationship_types: { uses: { category: "dependency" } },
  };
}

function makeFakeIndexed(overrides: Partial<IndexedStore> = {}): IndexedStore {
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

function fakeObject(id: string): KnowledgeObject {
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
  };
}

test("describe use case returns artifact + version + security + types from project context", () => {
  const project = makeFakeProject();
  const describe = makeDescribeKnowledgeBase(project);
  const result = describe.execute();
  assert.equal(result.artifact.name, "test-artifact");
  assert.equal(result.version, "0.1");
  assert.deepEqual(result.security, project.manifest.security);
  assert.deepEqual(result.object_types, project.schema.object_types);
  assert.deepEqual(result.relationship_types, project.schema.relationship_types);
});

test("getObject use case delegates to IndexedStore.getObject by id", () => {
  const expected = fakeObject("module.alpha");
  const indexed = makeFakeIndexed({ getObject: (id) => (id === "module.alpha" ? expected : null) });
  const get = makeGetObject(indexed);
  assert.deepEqual(get.execute({ id: "module.alpha" }), expected);
  assert.equal(get.execute({ id: "module.missing" }), null);
});

test("lookup use case delegates to IndexedStore.lookup with intent + limit", () => {
  const captured: { intent?: string; limit?: number } = {};
  const expected: LookupResult[] = [{ object: fakeObject("module.foo"), score: -1.5 }];
  const indexed = makeFakeIndexed({
    lookup: (intent, limit) => {
      captured.intent = intent;
      captured.limit = limit;
      return expected;
    },
  });
  const lookup = makeLookupKnowledge(indexed);
  const result = lookup.execute({ intent: "test query", limit: 7 });
  assert.deepEqual(result, expected);
  assert.equal(captured.intent, "test query");
  assert.equal(captured.limit, 7);
});

test("getNeighbors use case calls IndexedStore.neighbors with depth=1", () => {
  const captured: {
    id?: string | undefined;
    depth?: number | undefined;
    limit?: number | undefined;
  } = {};
  const expectedNeighbors: Neighbor[] = [];
  const indexed = makeFakeIndexed({
    neighbors: (id, depth, limit) => {
      captured.id = id;
      captured.depth = depth;
      captured.limit = limit;
      return expectedNeighbors;
    },
  });
  const neighbors = makeGetNeighbors(indexed);
  neighbors.execute({ id: "module.foo", limit: 9 });
  assert.equal(captured.id, "module.foo");
  assert.equal(captured.depth, 1);
  assert.equal(captured.limit, 9);
});

test("freshness use case combines artifact name with IndexedStore.stats", () => {
  const project = makeFakeProject();
  const indexed = makeFakeIndexed({
    stats: () => ({ object_count: 17, relationship_count: 31, stale_count: 0 }),
  });
  const freshness = makeGetFreshness(project, indexed);
  const result = freshness.execute();
  assert.equal(result.artifact, "test-artifact");
  assert.equal(result.object_count, 17);
  assert.equal(result.relationship_count, 31);
  assert.equal(result.stale_count, 0);
});

test("brief use case wraps lookup result with a summary string and primary_objects array", () => {
  const objects = [fakeObject("module.alpha"), fakeObject("module.beta")];
  const lookupResults: LookupResult[] = objects.map((object) => ({ object, score: 0 }));
  const indexed = makeFakeIndexed({ lookup: () => lookupResults });
  const brief = makeBriefKnowledge(indexed);
  const result = brief.execute({ scope: "checkout", limit: 5 });
  assert.equal(result.scope, "checkout");
  assert.deepEqual(result.primary_objects, objects);
  assert.match(result.summary, /Found 2/);
});

test("brief use case reports zero hits gracefully when lookup is empty", () => {
  const indexed = makeFakeIndexed({ lookup: () => [] });
  const brief = makeBriefKnowledge(indexed);
  const result = brief.execute({ scope: "no-such-thing", limit: 5 });
  assert.equal(result.primary_objects.length, 0);
  assert.match(result.summary, /No AKP reference objects/);
});
