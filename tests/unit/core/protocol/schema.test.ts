import assert from "node:assert/strict";
import test from "node:test";
import { knowledgeObjectSchema } from "../../../../src/core/protocol/schema.js";

test("validates a minimal AKP object envelope", () => {
  const parsed = knowledgeObjectSchema.parse({
    id: "note.example",
    type: "note",
    kind: "fact",
    title: "Example",
    summary: "Example object.",
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
  });

  assert.equal(parsed.id, "note.example");
  assert.equal(parsed.kind, "fact");
});
