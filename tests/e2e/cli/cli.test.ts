import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import path from "node:path";
import test from "node:test";
import { promisify } from "node:util";

import { buildKnowledgeBase } from "../../../src/build/build-knowledge-base.js";
import { withTempFixture } from "../../helpers/temp-project.js";

const execFileAsync = promisify(execFile);

test("CLI rejects invalid lookup limits", async () => {
  await withTempFixture("code-repo", async (projectRoot) => {
    await buildKnowledgeBase(projectRoot);
    const cliPath = path.resolve("dist-tests/src/cli/index.js");

    await assert.rejects(
      () =>
        execFileAsync(process.execPath, [cliPath, "lookup", "checkout", "--limit", "abc"], {
          cwd: projectRoot,
        }),
      /must be a positive integer/,
    );

    await assert.rejects(
      () =>
        execFileAsync(process.execPath, [cliPath, "lookup", "checkout", "--limit", "0"], {
          cwd: projectRoot,
        }),
      /must be a positive integer/,
    );
  });
});

test("CLI: akp extractors list returns an empty array when no extractors are registered", async () => {
  await withTempFixture("code-repo", async (projectRoot) => {
    const cliPath = path.resolve("dist-tests/src/cli/index.js");
    const { stdout } = await execFileAsync(process.execPath, [cliPath, "extractors", "list"], {
      cwd: projectRoot,
    });
    const parsed: unknown = JSON.parse(stdout);
    assert.deepEqual(parsed, []);
  });
});

test("CLI: akp refresh exits with AKP_NO_EXTRACTORS_REGISTERED when no extractors are wired", async () => {
  await withTempFixture("code-repo", async (projectRoot) => {
    const cliPath = path.resolve("dist-tests/src/cli/index.js");
    await assert.rejects(
      () =>
        execFileAsync(process.execPath, [cliPath, "refresh"], {
          cwd: projectRoot,
        }),
      /AKP_NO_EXTRACTORS_REGISTERED/,
    );
  });
});
