import assert from "node:assert/strict";
import { mkdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import { loadProject } from "../../../src/core/config/load-project.js";
import { tsRepoExtractor } from "../../../src/extraction/extractors/ts-repo/index.js";

import type { KnowledgeObject, Manifest } from "../../../src/core/protocol/types.js";

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

  assert.deepEqual(ids, ["module.alpha", "module.beta", "module.cli"]);
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

test("ts-repo extractor sets a non-empty attributes.purpose on every emitted module", async () => {
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

  assert.ok(modules.length > 0, "fixture should yield at least one module");
  for (const module of modules) {
    const purpose = module.attributes["purpose"];
    assert.equal(
      typeof purpose,
      "string",
      `module ${module.id} must have string attributes.purpose`,
    );
    assert.ok(
      typeof purpose === "string" && purpose.length > 0,
      `module ${module.id} must have non-empty attributes.purpose`,
    );
  }
});

test("ts-repo extractor emits each module with a parseable file:/// URI in sources", async () => {
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
    const source = module.sources[0];
    assert.ok(source, `module ${module.id} must have at least one source`);
    const url = new URL(source.uri);
    assert.equal(url.protocol, "file:", `source URI must use file: scheme, got ${source.uri}`);
    // Authority must be empty (file:///path...) — `file://src/...` wrongly treats `src` as a network host.
    assert.equal(
      url.host,
      "",
      `source URI must have empty authority (use file:///), got host="${url.host}" for ${source.uri}`,
    );
  }
});

test("ts-repo extractor returns no objects when <rootDir>/src does not exist", async () => {
  const emptyRoot = path.join(tmpdir(), `akp-ts-repo-no-src-${Date.now()}-${Math.random()}`);
  await mkdir(emptyRoot, { recursive: true });

  try {
    const project = await loadProject(FIXTURE_ROOT);
    const manifest: Manifest = {
      ...project.manifest,
      artifact: { ...project.manifest.artifact, name: "no-src-fixture" },
    };

    const extractor = tsRepoExtractor();
    const objects: KnowledgeObject[] = [];
    for await (const object of extractor.extract({
      rootDir: emptyRoot,
      manifest,
      schema: project.schema,
    })) {
      objects.push(object);
    }

    assert.equal(objects.length, 0);
  } finally {
    await rm(emptyRoot, { recursive: true, force: true });
  }
});

test("ts-repo extractor emits one 'command' object per program.command(...) call in src/cli", async () => {
  const project = await loadProject(FIXTURE_ROOT);
  const extractor = tsRepoExtractor();

  const commands: KnowledgeObject[] = [];
  for await (const object of extractor.extract({
    rootDir: project.rootDir,
    manifest: project.manifest,
    schema: project.schema,
  })) {
    if (object.type === "command") {
      commands.push(object);
    }
  }

  const ids = commands.map((object) => object.id).sort();
  assert.deepEqual(ids, ["command.echo", "command.farewell", "command.greet"]);

  for (const command of commands) {
    assert.equal(command.kind, "fact");
    assert.ok(
      command.provenance.generated_by === "ts-repo" ||
        command.provenance.generated_by.startsWith("ts-repo:"),
    );
    assert.equal(command.provenance.confidence, "mechanical");
    const commandAttr = command.attributes["command"];
    assert.equal(typeof commandAttr, "string");
    assert.ok(typeof commandAttr === "string" && commandAttr.length > 0);
  }
});

test("ts-repo extractor emits one 'use_case' object per exported make<Name> factory under src/**/use-cases/*.ts", async () => {
  const project = await loadProject(FIXTURE_ROOT);
  const extractor = tsRepoExtractor();

  const useCases: KnowledgeObject[] = [];
  for await (const object of extractor.extract({
    rootDir: project.rootDir,
    manifest: project.manifest,
    schema: project.schema,
  })) {
    if (object.type === "use_case") {
      useCases.push(object);
    }
  }

  const ids = useCases.map((object) => object.id).sort();
  // Fixture has src/alpha/use-cases/index.ts with four exported factories:
  //   makeGreet              — sync
  //   makeFarewellMessage    — sync
  //   makeAsyncOperation     — `export async function` (must match)
  //   makeHTTPClient         — consecutive caps (must kebab to "http-client")
  // and one non-exported (makeInternalHelper) that must be skipped.
  assert.deepEqual(ids, [
    "use_case.async-operation",
    "use_case.farewell-message",
    "use_case.greet",
    "use_case.http-client",
  ]);

  for (const useCase of useCases) {
    assert.equal(useCase.kind, "fact");
    assert.ok(
      useCase.provenance.generated_by === "ts-repo" ||
        useCase.provenance.generated_by.startsWith("ts-repo:"),
    );
    assert.equal(useCase.provenance.confidence, "mechanical");
    const factory = useCase.attributes["factory"];
    assert.equal(typeof factory, "string");
    assert.ok(typeof factory === "string" && factory.startsWith("make"));
  }
});

test("ts-repo extractor advertises 'use_case' in produces_types", () => {
  const descriptor = tsRepoExtractor().describe();
  assert.ok(
    descriptor.produces_types.includes("use_case"),
    `produces_types must include 'use_case', got ${JSON.stringify(descriptor.produces_types)}`,
  );
});

test("ts-repo extractor emits one 'port' object per exported `<Name>Port` interface under src/**/*.ts", async () => {
  const project = await loadProject(FIXTURE_ROOT);
  const extractor = tsRepoExtractor();

  const ports: KnowledgeObject[] = [];
  for await (const object of extractor.extract({
    rootDir: project.rootDir,
    manifest: project.manifest,
    schema: project.schema,
  })) {
    if (object.type === "port") {
      ports.push(object);
    }
  }

  const ids = ports.map((object) => object.id).sort();
  // Fixture src/alpha/ports.ts has:
  //   ClockPort        (exported, suffix matches)       -> port.clock
  //   LoggerPort       (exported, suffix matches)       -> port.logger
  //   PlainInterface   (exported, no Port suffix)       -> skipped
  //   InternalPort     (not exported)                   -> skipped
  assert.deepEqual(ids, ["port.clock", "port.logger"]);

  for (const port of ports) {
    assert.equal(port.kind, "fact");
    assert.ok(
      port.provenance.generated_by === "ts-repo" ||
        port.provenance.generated_by.startsWith("ts-repo:"),
    );
    assert.equal(port.provenance.confidence, "mechanical");
    const interfaceName = port.attributes["interface_name"];
    assert.equal(typeof interfaceName, "string");
    assert.ok(typeof interfaceName === "string" && interfaceName.endsWith("Port"));
  }
});

test("ts-repo extractor advertises 'port' in produces_types", () => {
  const descriptor = tsRepoExtractor().describe();
  assert.ok(
    descriptor.produces_types.includes("port"),
    `produces_types must include 'port', got ${JSON.stringify(descriptor.produces_types)}`,
  );
});

test("ts-repo extractor propagates non-ENOENT readdir failures (e.g. EACCES)", async () => {
  const project = await loadProject(FIXTURE_ROOT);

  const eacces = Object.assign(new Error("permission denied"), { code: "EACCES" });
  const failingReaddir = async () => {
    throw eacces;
  };

  const extractor = tsRepoExtractor({ readdir: failingReaddir });

  await assert.rejects(async () => {
    for await (const _object of extractor.extract({
      rootDir: project.rootDir,
      manifest: project.manifest,
      schema: project.schema,
    })) {
      // intentionally empty — should never execute
    }
  }, /permission denied|EACCES/);
});
