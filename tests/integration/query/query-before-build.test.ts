import assert from "node:assert/strict";
import test from "node:test";
import { AkpError } from "../../../src/core/errors/akp-error.js";
import { lookupKnowledge } from "../../../src/query/query-knowledge-base.js";
import { withTempFixture } from "../../helpers/temp-project.js";

test("lookup fails clearly before local store is built", async () => {
  await withTempFixture("code-repo", async (projectRoot) => {
    await assert.rejects(() => lookupKnowledge("checkout", 5, projectRoot), (error) => {
      assert.ok(error instanceof AkpError);
      assert.equal(error.code, "AKP_STORE_NOT_BUILT");
      return true;
    });
  });
});
