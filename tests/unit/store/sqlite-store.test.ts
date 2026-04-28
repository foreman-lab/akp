import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import { makeJsonlCanonicalStore } from "../../../src/knowledge/read-objects.js";
import { SqliteStore } from "../../../src/store/sqlite/sqlite-store.js";

import type { KnowledgeObject, PackSchema } from "../../../src/core/protocol/types.js";

const schema: PackSchema = {
  object_types: {
    module: { kind: "fact" },
  },
  relationship_types: {
    uses: { category: "dependency" },
  },
};

test("upsertMany inserts new objects retrievable via getObject", async () => {
  const store = await freshStore();
  try {
    store.upsertMany([object("module.alpha"), object("module.beta")]);

    assert.equal(store.getObject("module.alpha")?.id, "module.alpha");
    assert.equal(store.getObject("module.beta")?.id, "module.beta");
    assert.equal(store.getObject("module.missing"), null);
    assert.deepEqual(store.stats(), {
      object_count: 2,
      relationship_count: 0,
      stale_count: 0,
    });
  } finally {
    store.close();
  }
});

test("upsertMany replaces an existing object's row and relationships", async () => {
  const store = await freshStore();
  try {
    store.upsertMany([
      object("module.alpha", {
        summary: "first version",
        relationships: [{ type: "uses", category: "dependency", target: "module.beta" }],
      }),
      object("module.beta"),
    ]);

    store.upsertMany([
      object("module.alpha", {
        summary: "second version",
        relationships: [],
      }),
    ]);

    const reloaded = store.getObject("module.alpha");
    assert.equal(reloaded?.summary, "second version");
    assert.deepEqual(reloaded?.relationships, []);

    const neighbors = store.neighbors("module.alpha", 1, 20);
    assert.equal(neighbors.length, 0);
  } finally {
    store.close();
  }
});

test("deleteMany removes the object, its relationships in both directions, and FTS rows", async () => {
  const store = await freshStore();
  try {
    store.upsertMany([
      object("module.alpha", {
        relationships: [{ type: "uses", category: "dependency", target: "module.beta" }],
      }),
      object("module.beta"),
      object("module.gamma", {
        relationships: [{ type: "uses", category: "dependency", target: "module.beta" }],
      }),
    ]);

    store.deleteMany(["module.beta"]);

    assert.equal(store.getObject("module.beta"), null);
    assert.deepEqual(store.lookup("module.beta", 10), []);
    assert.deepEqual(store.stats(), {
      object_count: 2,
      relationship_count: 0,
      stale_count: 0,
    });
    assert.equal(store.neighbors("module.alpha", 1, 20).length, 0);
    assert.equal(store.neighbors("module.gamma", 1, 20).length, 0);
  } finally {
    store.close();
  }
});

test("makeJsonlCanonicalStore.readAll delegates to the JSONL reader", async () => {
  const file = await writeObjects([object("module.alpha"), object("module.beta")]);
  const canonical = makeJsonlCanonicalStore(file, schema);

  const objects = await canonical.readAll();

  assert.equal(objects.length, 2);
  assert.deepEqual(
    objects.map((o) => o.id),
    ["module.alpha", "module.beta"],
  );
});

async function freshStore(): Promise<SqliteStore> {
  const dir = await mkdir(path.join(tmpdir(), `akp-sqlite-${Date.now()}-${Math.random()}`), {
    recursive: true,
  });
  assert.ok(dir);
  const store = new SqliteStore(path.join(dir, "akp.sqlite"));
  store.initialize();
  return store;
}

async function writeObjects(objects: KnowledgeObject[]): Promise<string> {
  const dir = await mkdir(path.join(tmpdir(), `akp-canonical-${Date.now()}-${Math.random()}`), {
    recursive: true,
  });
  assert.ok(dir);
  const file = path.join(dir, "objects.jsonl");
  await writeFile(file, objects.map((item) => JSON.stringify(item)).join("\n"));
  return file;
}

function object(id: string, overrides: Partial<KnowledgeObject> = {}): KnowledgeObject {
  return {
    id,
    type: "module",
    kind: "fact",
    title: id,
    summary: "Test object.",
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
    freshness: {
      last_verified: "2026-04-27T00:00:00.000Z",
      status: "fresh",
    },
    review_state: "accepted",
    ...overrides,
  };
}
