import assert from "node:assert/strict";
import test from "node:test";

import { buildKnowledgeBase } from "../../../src/build/build-knowledge-base.js";
import { buildContainer } from "../../../src/runtime/build-container.js";
import { withTempFixture } from "../../helpers/temp-project.js";

test("builds and queries the example AKP knowledge base", async () => {
  await withTempFixture("code-repo", async (exampleRoot) => {
    const result = await buildKnowledgeBase(exampleRoot);

    assert.equal(result.artifact, "example-code-repo");
    assert.equal(result.object_count, 3);
    assert.equal(result.relationship_count, 2);

    const container = await buildContainer(exampleRoot);
    try {
      const lookup = container.useCases.lookup.execute({ intent: "checkout", limit: 5 });
      assert.ok(lookup.some((item) => item.object.id === "module.checkout"));
    } finally {
      container.dispose();
    }
  });
});
