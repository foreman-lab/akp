import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import path from "node:path";
import test from "node:test";
import { promisify } from "node:util";

import { buildContainer } from "../../../src/runtime/build-container.js";
import { withTempFixture } from "../../helpers/temp-project.js";

const execFileAsync = promisify(execFile);

test("CLI rejects invalid lookup limits", async () => {
  await withTempFixture("code-repo", async (projectRoot) => {
    const container = await buildContainer(projectRoot);
    try {
      await container.useCases.build.execute();
    } finally {
      container.dispose();
    }
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

test("CLI: akp extractors list reports the registered ts-repo extractor", async () => {
  await withTempFixture("code-repo", async (projectRoot) => {
    const cliPath = path.resolve("dist-tests/src/cli/index.js");
    const { stdout } = await execFileAsync(process.execPath, [cliPath, "extractors", "list"], {
      cwd: projectRoot,
    });
    const parsed = JSON.parse(stdout) as Array<{ id: string }>;
    const ids = parsed.map((entry) => entry.id);
    assert.ok(ids.includes("ts-repo"), `expected ts-repo in extractors list, got ${ids.join(",")}`);
  });
});

test("CLI: akp refresh exits with AKP_EXTRACTOR_UNKNOWN for an unregistered --extractor id", async () => {
  await withTempFixture("code-repo", async (projectRoot) => {
    const cliPath = path.resolve("dist-tests/src/cli/index.js");
    await assert.rejects(
      () =>
        execFileAsync(process.execPath, [cliPath, "refresh", "--extractor", "does-not-exist"], {
          cwd: projectRoot,
        }),
      /AKP_EXTRACTOR_UNKNOWN/,
    );
  });
});
