import assert from "node:assert/strict";
import test from "node:test";

import {
  makeBuildKnowledgeBase,
  makeCheckKnowledgeBase,
} from "../../../src/build/use-cases/index.js";

import type {
  KnowledgeObject,
  PackSchema,
  ProjectContext,
} from "../../../src/core/protocol/types.js";
import type { CanonicalStore } from "../../../src/knowledge/read-objects.js";
import type { IndexedStore, StoreStats } from "../../../src/store/sqlite/sqlite-store.js";

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
    schema: {
      object_types: { module: { kind: "fact" }, command: { kind: "fact" } },
      relationship_types: { uses: { category: "dependency" }, owns: { category: "containment" } },
    } satisfies PackSchema,
  };
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

function makeFakeCanonical(objects: KnowledgeObject[]): CanonicalStore {
  return {
    readAll: async () => objects,
    writeAll: async () => {
      /* noop */
    },
  };
}

function makeFakeIndexed(stats: StoreStats, captured: KnowledgeObject[]): IndexedStore {
  const noop = () => {
    /* fake */
  };
  return {
    initialize: noop,
    upsertMany: noop,
    deleteMany: noop,
    replaceAll: (objs) => {
      captured.length = 0;
      captured.push(...objs);
    },
    getObject: () => null,
    lookup: () => [],
    neighbors: () => [],
    stats: () => stats,
    close: noop,
  };
}

test("build use case reads canonical, replaces indexed, returns stats with artifact + db path", async () => {
  const project = makeFakeProject();
  const objects = [fakeObject("module.alpha"), fakeObject("module.beta")];
  const captured: KnowledgeObject[] = [];
  const canonical = makeFakeCanonical(objects);
  const indexed = makeFakeIndexed(
    { object_count: 2, relationship_count: 0, stale_count: 0 },
    captured,
  );

  const build = makeBuildKnowledgeBase({ project, canonical, indexed });
  const result = await build.execute();

  assert.deepEqual(captured, objects);
  assert.equal(result.artifact, "test-artifact");
  assert.equal(result.database_path, "/test/.akp-local/akp.sqlite");
  assert.equal(result.object_count, 2);
  assert.equal(result.relationship_count, 0);
  assert.equal(result.stale_count, 0);
});

test("check use case reads canonical and reports counts plus schema types", async () => {
  const project = makeFakeProject();
  const objects = [fakeObject("module.alpha"), fakeObject("module.beta")];
  const canonical = makeFakeCanonical(objects);

  const check = makeCheckKnowledgeBase({ project, canonical });
  const result = await check.execute();

  assert.equal(result.artifact, "test-artifact");
  assert.equal(result.object_count, 2);
  assert.deepEqual(result.schema_types.sort(), ["command", "module"]);
  assert.deepEqual(result.relationship_types.sort(), ["owns", "uses"]);
});
