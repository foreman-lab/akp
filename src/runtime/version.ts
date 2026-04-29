import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

// Walk upward from this module's directory until a `package.json` is found.
// Robust across all three layouts this file ships in:
//   - src/runtime/version.ts        (tsx dev)
//   - dist/runtime/version.js       (compiled bin, two levels deep)
//   - dist-tests/src/runtime/version.js  (compiled tests, three levels deep)
function findPackageJson(startUrl: string): string {
  let dir = path.dirname(fileURLToPath(startUrl));
  for (let i = 0; i < 10; i += 1) {
    const candidate = path.join(dir, "package.json");
    if (existsSync(candidate)) return candidate;
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  throw new Error(`Could not locate package.json upward from ${startUrl}`);
}

const pkg = JSON.parse(readFileSync(findPackageJson(import.meta.url), "utf8")) as {
  version: string;
};

export const VERSION: string = pkg.version;
