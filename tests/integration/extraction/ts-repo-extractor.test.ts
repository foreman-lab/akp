import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";

import { loadProject } from "../../../src/core/config/load-project.js";
import { tsRepoExtractor } from "../../../src/extraction/extractors/ts-repo/index.js";

import type { KnowledgeObject } from "../../../src/core/protocol/types.js";

const FIXTURE_ROOT = path.resolve("tests/fixtures/ts-tiny-repo");

test("ts-repo extractor describes itself with id 'ts-repo' and produces 'module' objects", () => {
  const extractor = tsRepoExtractor();
  const descriptor = extractor.describe();

  assert.equal(descriptor.id, "ts-repo");
  assert.ok(descriptor.produces_types.includes("module"));
});

test("ts-repo extractor emits one 'module' object per top-level directory under src/", async () => {
  const project = await loadProject(FIXTURE_ROOT);
  const extractor = tsRepoExtractor();

  const objects: KnowledgeObject[] = [];
  for await (const object of extractor.extract({
    rootDir: project.rootDir,
    manifest: project.manifest,
    schema: project.schema,
  })) {
    objects.push(object);
  }

  const modules = objects.filter((object) => object.type === "module");
  const ids = modules.map((object) => object.id).sort();

  assert.deepEqual(ids, ["module.alpha", "module.beta"]);
});

test("ts-repo extractor stamps provenance.generated_by with the extractor id and confidence 'mechanical'", async () => {
  const project = await loadProject(FIXTURE_ROOT);
  const extractor = tsRepoExtractor();

  const objects: KnowledgeObject[] = [];
  for await (const object of extractor.extract({
    rootDir: project.rootDir,
    manifest: project.manifest,
    schema: project.schema,
  })) {
    objects.push(object);
  }

  assert.ok(objects.length > 0);
  for (const object of objects) {
    assert.ok(
      object.provenance.generated_by === "ts-repo" ||
        object.provenance.generated_by.startsWith("ts-repo:"),
      `expected provenance.generated_by to start with "ts-repo", got ${object.provenance.generated_by}`,
    );
    assert.equal(object.provenance.confidence, "mechanical");
  }
});

test("ts-repo extractor sets non-empty module.title and attributes.paths array", async () => {
  const project = await loadProject(FIXTURE_ROOT);
  const extractor = tsRepoExtractor();

  const modules: KnowledgeObject[] = [];
  for await (const object of extractor.extract({
    rootDir: project.rootDir,
    manifest: project.manifest,
    schema: project.schema,
  })) {
    if (object.type === "module") {
      modules.push(object);
    }
  }

  for (const module of modules) {
    assert.ok(typeof module.title === "string" && module.title.length > 0);
    const paths = module.attributes["paths"];
    assert.ok(Array.isArray(paths), `module ${module.id} must have attributes.paths array`);
    assert.ok(paths.length > 0, `module ${module.id} must list at least one path`);
  }
});
