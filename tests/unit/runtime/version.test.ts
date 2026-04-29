import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

import { VERSION } from "../../../src/runtime/version.js";

test("VERSION matches package.json's version field (single source of truth)", () => {
  const pkg = JSON.parse(readFileSync(path.resolve("package.json"), "utf8")) as {
    version: string;
  };
  assert.equal(VERSION, pkg.version);
  assert.match(VERSION, /^\d+\.\d+\.\d+(-[\w.]+)?$/, "VERSION must be a SemVer string");
});
