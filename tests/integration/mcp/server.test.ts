import assert from "node:assert/strict";
import test from "node:test";

import { AppError } from "../../../src/core/errors/app-error.js";
import { buildMcpServer } from "../../../src/mcp/server.js";
import { withTempFixture } from "../../helpers/temp-project.js";

test("MCP server fails with AKP_STORE_NOT_BUILT when .akp-local/akp.sqlite does not exist", async () => {
  await withTempFixture("code-repo", async (projectRoot) => {
    await assert.rejects(
      () => buildMcpServer(projectRoot),
      (error) => {
        assert.ok(error instanceof AppError);
        assert.equal(error.code, "AKP_STORE_NOT_BUILT");
        return true;
      },
    );
  });
});
