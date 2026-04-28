import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";

import { makeInitAkp } from "../../../src/init/use-cases/index.js";

import type { FileSystemPort } from "../../../src/init/use-cases/index.js";

/**
 * In-memory FileSystemPort implementation for tests. Captures writes to a
 * Map and tracks created directories. NEVER touches the production
 * filesystem — the use case is fully exercised through the port.
 */
class FakeFileSystem implements FileSystemPort {
  readonly files = new Map<string, string>();
  readonly directories = new Set<string>();

  async mkdir(target: string, opts?: { recursive?: boolean }): Promise<void> {
    this.directories.add(target);
    if (opts?.recursive) {
      let current = target;
      while (true) {
        const parent = path.dirname(current);
        if (parent === current) break;
        this.directories.add(parent);
        current = parent;
      }
    }
  }

  async writeFile(target: string, content: string, opts?: { flag?: "wx" | "w" }): Promise<void> {
    if (opts?.flag === "wx" && this.files.has(target)) {
      const error = new Error(`EEXIST: file already exists, open '${target}'`);
      (error as NodeJS.ErrnoException).code = "EEXIST";
      throw error;
    }
    this.files.set(target, content);
  }
}

const SYNTHETIC_ROOT = path.join("/", "synthetic-akp-init-fixture");

test("init scaffolds manifest.yaml, schemas/base.yaml, and objects.jsonl under .akp/", async () => {
  const fs = new FakeFileSystem();
  const init = makeInitAkp(fs);

  const result = await init.execute({ rootDir: SYNTHETIC_ROOT });

  const akpDir = path.join(SYNTHETIC_ROOT, ".akp");
  const schemasDir = path.join(akpDir, "schemas");
  const manifestPath = path.join(akpDir, "manifest.yaml");
  const schemaPath = path.join(schemasDir, "base.yaml");
  const objectsPath = path.join(akpDir, "objects.jsonl");

  assert.equal(result.akp_dir, akpDir);
  assert.equal(result.manifest_path, manifestPath);
  assert.equal(result.schema_path, schemaPath);
  assert.equal(result.objects_path, objectsPath);

  assert.ok(fs.directories.has(schemasDir), "schemas dir must be created");
  assert.ok(fs.files.has(manifestPath), "manifest.yaml must be written");
  assert.ok(fs.files.has(schemaPath), "schemas/base.yaml must be written");
  assert.ok(fs.files.has(objectsPath), "objects.jsonl must be written");

  const manifest = fs.files.get(manifestPath) ?? "";
  assert.match(manifest, /version: 0\.1/);
  assert.match(manifest, /name: synthetic-akp-init-fixture/);
});

test("init is idempotent — pre-existing files are preserved and not overwritten", async () => {
  const fs = new FakeFileSystem();
  const akpDir = path.join(SYNTHETIC_ROOT, ".akp");
  const manifestPath = path.join(akpDir, "manifest.yaml");
  const objectsPath = path.join(akpDir, "objects.jsonl");

  await fs.writeFile(manifestPath, "PRE-EXISTING-USER-CONTENT", { flag: "w" });
  await fs.writeFile(objectsPath, '{"id":"module.preexisting"}', { flag: "w" });

  const init = makeInitAkp(fs);
  await init.execute({ rootDir: SYNTHETIC_ROOT });

  assert.equal(fs.files.get(manifestPath), "PRE-EXISTING-USER-CONTENT");
  assert.equal(fs.files.get(objectsPath), '{"id":"module.preexisting"}');
});

test("init writes the manifest with the rootDir's basename as the artifact name", async () => {
  const fs = new FakeFileSystem();
  const init = makeInitAkp(fs);

  await init.execute({ rootDir: path.join("/", "tmp", "my-special-project") });

  const manifestPath = path.join("/", "tmp", "my-special-project", ".akp", "manifest.yaml");
  const manifest = fs.files.get(manifestPath) ?? "";
  assert.match(manifest, /name: my-special-project/);
});
