import { mkdir, writeFile } from "node:fs/promises";

import type { FileSystemPort } from "../use-cases/index.js";

/**
 * Production adapter for the init `FileSystemPort`. Delegates to
 * `node:fs/promises`. Direct fs use is appropriate here — this module
 * IS the adapter at the boundary, not a use case.
 */
export function nodeFileSystem(): FileSystemPort {
  return {
    async mkdir(target, opts) {
      await mkdir(target, opts);
    },
    async writeFile(target, content, opts) {
      await writeFile(target, content, opts);
    },
  };
}
