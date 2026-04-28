import assert from "node:assert/strict";
import test from "node:test";

import { buildKnowledgeBase } from "../../../src/build/build-knowledge-base.js";
import { lookupKnowledge } from "../../../src/query/query-knowledge-base.js";
import { withTempFixture } from "../../helpers/temp-project.js";

test("builds and queries the example AKP knowledge base", async () => {
  await withTempFixture("code-repo", async (exampleRoot) => {
    const result = await buildKnowledgeBase(exampleRoot);

    assert.equal(result.artifact, "example-code-repo");
    assert.equal(result.object_count, 3);
    assert.equal(result.relationship_count, 2);

    const lookup = await lookupKnowledge("checkout", 5, exampleRoot);
    assert.ok(lookup.some((item) => item.object.id === "module.checkout"));
  });
});
