import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { AkpError } from "../../../src/core/errors/akp-error.js";
import type { KnowledgeObject, PackSchema } from "../../../src/core/protocol/types.js";
import { readKnowledgeObjects } from "../../../src/knowledge/read-objects.js";

const schema: PackSchema = {
  object_types: {
    module: { kind: "fact" },
    recipe: { kind: "procedure" },
  },
  relationship_types: {
    tested_by: { category: "evidence" },
  },
};

test("rejects relationship category mismatches", async () => {
  const file = await writeObjects([
    object("module.checkout", {
      relationships: [{ type: "tested_by", category: "dependency", target: "recipe.checkout-test" }],
    }),
    object("recipe.checkout-test", { type: "recipe", kind: "procedure" }),
  ]);

  await assert.rejects(() => readKnowledgeObjects(file, schema), (error) => {
    assert.ok(error instanceof AkpError);
    assert.equal(error.code, "AKP_RELATIONSHIP_CATEGORY_MISMATCH");
    return true;
  });
});

test("rejects relationships that point to missing objects", async () => {
  const file = await writeObjects([
    object("module.checkout", {
      relationships: [{ type: "tested_by", category: "evidence", target: "recipe.missing" }],
    }),
  ]);

  await assert.rejects(() => readKnowledgeObjects(file, schema), (error) => {
    assert.ok(error instanceof AkpError);
    assert.equal(error.code, "AKP_RELATIONSHIP_TARGET_MISSING");
    return true;
  });
});

async function writeObjects(objects: KnowledgeObject[]): Promise<string> {
  const dir = await mkdir(path.join(tmpdir(), `akp-read-objects-${Date.now()}-${Math.random()}`), {
    recursive: true,
  });
  assert.ok(dir);
  const file = path.join(dir, "objects.jsonl");
  await writeFile(file, objects.map((item) => JSON.stringify(item)).join("\n"));
  return file;
}

function object(
  id: string,
  overrides: Partial<KnowledgeObject> = {},
): KnowledgeObject {
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
