import { cp, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { fixturePath } from "./fixtures.js";

export async function withTempFixture<T>(
  fixtureName: string,
  run: (projectRoot: string) => Promise<T>,
): Promise<T> {
  const tempRoot = await mkdtemp(path.join(tmpdir(), "akp-fixture-"));
  const projectRoot = path.join(tempRoot, fixtureName);

  try {
    await cp(fixturePath(fixtureName), projectRoot, { recursive: true });
    return await run(projectRoot);
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
}
