import assert from "node:assert/strict";
import { mkdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import { loadProject } from "../../../src/core/config/load-project.js";
import { tsRepoExtractor } from "../../../src/extraction/extractors/ts-repo/index.js";

import type { KnowledgeObject, Manifest } from "../../../src/core/protocol/types.js";
import type { Dirent } from "node:fs";

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

test("ts-repo extractor attaches a `uses` relationship from each use-case factory to every imported `<Name>Port`", async () => {
  const project = await loadProject(FIXTURE_ROOT);
  const extractor = tsRepoExtractor();

  const useCases: KnowledgeObject[] = [];
  for await (const object of extractor.extract({
    rootDir: project.rootDir,
    manifest: project.manifest,
    schema: project.schema,
  })) {
    if (object.type === "use_case") useCases.push(object);
  }

  assert.ok(useCases.length > 0, "fixture must yield at least one use_case");
  for (const useCase of useCases) {
    const usesPort = useCase.relationships.some(
      (relationship) =>
        relationship.type === "uses" &&
        relationship.category === "dependency" &&
        relationship.target === "port.clock",
    );
    assert.ok(
      usesPort,
      `use_case ${useCase.id} must have a uses->port.clock relationship; got ${JSON.stringify(useCase.relationships)}`,
    );
  }
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

test("ts-repo extractor deduplicates port emissions when the same <Name>Port appears in multiple files", async () => {
  const fakeFs = makeFakeSrcTree({
    [path.posix.join("src", "alpha", "ports.ts")]:
      "export interface ClockPort {\n  now(): Date;\n}\n",
    [path.posix.join("src", "beta", "ports.ts")]:
      "export interface ClockPort {\n  now(): Date;\n}\n",
  });

  const project = await loadProject(FIXTURE_ROOT);
  const extractor = tsRepoExtractor({ readdir: fakeFs.readdir, readFile: fakeFs.readFile });

  const ports: KnowledgeObject[] = [];
  for await (const object of extractor.extract({
    rootDir: fakeFs.rootDir,
    manifest: project.manifest,
    schema: project.schema,
  })) {
    if (object.type === "port") ports.push(object);
  }

  const ids = ports.map((object) => object.id);
  assert.equal(
    new Set(ids).size,
    ids.length,
    `port ids must be unique, got ${JSON.stringify(ids)}`,
  );
  assert.deepEqual(ids, ["port.clock"]);
});

test("ts-repo extractor recognizes aliased port imports (`import { FooPort as Foo }`)", async () => {
  const fakeFs = makeFakeSrcTree({
    [path.posix.join("src", "alpha", "use-cases", "index.ts")]:
      'import type { ClockPort, LoggerPort as Logger } from "../ports.js";\n' +
      "export function makeGreet() {\n  return { execute() { return ''; } };\n}\n",
  });

  const project = await loadProject(FIXTURE_ROOT);
  const extractor = tsRepoExtractor({ readdir: fakeFs.readdir, readFile: fakeFs.readFile });

  const useCases: KnowledgeObject[] = [];
  for await (const object of extractor.extract({
    rootDir: fakeFs.rootDir,
    manifest: project.manifest,
    schema: project.schema,
  })) {
    if (object.type === "use_case") useCases.push(object);
  }

  assert.equal(useCases.length, 1);
  const targets = useCases[0]!.relationships.map((relationship) => relationship.target).sort();
  // Both ports must be captured — the alias on LoggerPort must not hide it.
  assert.deepEqual(targets, ["port.clock", "port.logger"]);
});

test("ts-repo extractor deduplicates use_case emissions when the same make<Name> appears in multiple files", async () => {
  const fakeFs = makeFakeSrcTree({
    [path.posix.join("src", "alpha", "use-cases", "index.ts")]:
      "export function makeGreet() {\n  return { execute() { return ''; } };\n}\n",
    [path.posix.join("src", "beta", "use-cases", "index.ts")]:
      "export function makeGreet() {\n  return { execute() { return ''; } };\n}\n",
  });

  const project = await loadProject(FIXTURE_ROOT);
  const extractor = tsRepoExtractor({ readdir: fakeFs.readdir, readFile: fakeFs.readFile });

  const useCases: KnowledgeObject[] = [];
  for await (const object of extractor.extract({
    rootDir: fakeFs.rootDir,
    manifest: project.manifest,
    schema: project.schema,
  })) {
    if (object.type === "use_case") useCases.push(object);
  }

  const ids = useCases.map((object) => object.id);
  assert.equal(
    new Set(ids).size,
    ids.length,
    `use_case ids must be unique, got ${JSON.stringify(ids)}`,
  );
  assert.deepEqual(ids, ["use_case.greet"]);
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

interface FakeSrcTree {
  rootDir: string;
  readdir: (target: string, opts: { withFileTypes: true }) => Promise<Dirent[]>;
  readFile: (target: string, encoding: "utf8") => Promise<string>;
}

// Builds a synthetic in-memory src tree from {relativePath: fileContent}.
// Directory listings are derived; missing paths throw ENOENT. Used to test
// the extractor against shapes that would be awkward to express on a real
// filesystem (cross-file duplicate identifier names, etc.).
function makeFakeSrcTree(files: Record<string, string>): FakeSrcTree {
  const ROOT = path.join("/", "synthetic-ts-repo-fixture");
  const fileMap = new Map<string, string>();
  const dirMap = new Map<string, Map<string, "file" | "dir">>();

  for (const [rel, content] of Object.entries(files)) {
    const abs = path.join(ROOT, ...rel.split("/"));
    fileMap.set(abs, content);

    const segments = rel.split("/");
    let cursor = ROOT;
    for (let i = 0; i < segments.length - 1; i++) {
      const segment = segments[i]!;
      const child = path.join(cursor, segment);
      if (!dirMap.has(cursor)) dirMap.set(cursor, new Map());
      dirMap.get(cursor)!.set(segment, "dir");
      cursor = child;
    }
    const fileName = segments[segments.length - 1]!;
    if (!dirMap.has(cursor)) dirMap.set(cursor, new Map());
    dirMap.get(cursor)!.set(fileName, "file");
  }

  // Test fake — only the methods the extractor actually calls (name + isDirectory + isFile)
  // need realistic behavior. Cast through `unknown` because Dirent has many other methods
  // (isSymbolicLink, isBlockDevice, ...) that the extractor never invokes.
  const direntFor = (name: string, kind: "file" | "dir"): Dirent =>
    ({
      name,
      isDirectory: () => kind === "dir",
      isFile: () => kind === "file",
      isSymbolicLink: () => false,
    }) as unknown as Dirent;

  return {
    rootDir: ROOT,
    async readdir(target: string, _opts: { withFileTypes: true }): Promise<Dirent[]> {
      const entries = dirMap.get(target);
      if (!entries) {
        const error = Object.assign(new Error(`ENOENT: ${target}`), { code: "ENOENT" });
        throw error;
      }
      return [...entries.entries()].map(([name, kind]) => direntFor(name, kind));
    },
    async readFile(target: string, _encoding: "utf8"): Promise<string> {
      const content = fileMap.get(target);
      if (content === undefined) {
        const error = Object.assign(new Error(`ENOENT: ${target}`), { code: "ENOENT" });
        throw error;
      }
      return content;
    },
  };
}
