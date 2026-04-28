import assert from "node:assert/strict";
import test from "node:test";

import { AkpError } from "../../../src/core/errors/akp-error.js";
import { buildContainer } from "../../../src/runtime/build-container.js";
import { withTempFixture } from "../../helpers/temp-project.js";

test("buildContainer with requireBuiltStore fails clearly before the local store is built", async () => {
  await withTempFixture("code-repo", async (projectRoot) => {
    await assert.rejects(
      () => buildContainer(projectRoot, { requireBuiltStore: true }),
      (error) => {
        assert.ok(error instanceof AkpError);
        assert.equal(error.code, "AKP_STORE_NOT_BUILT");
        return true;
      },
    );
  });
});
