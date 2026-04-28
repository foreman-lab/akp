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
import { fakeObject, makeFakeIndexed, makeFakeProject } from "../../helpers/fakes.js";

import type { LookupResult, Neighbor } from "../../../src/store/sqlite/sqlite-store.js";

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
