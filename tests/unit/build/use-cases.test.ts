import assert from "node:assert/strict";
import test from "node:test";

import {
  makeBuildKnowledgeBase,
  makeCheckKnowledgeBase,
} from "../../../src/build/use-cases/index.js";
import {
  fakeObject,
  makeFakeCanonical,
  makeFakeIndexed,
  makeFakeProject,
  makeFakeSchema,
} from "../../helpers/fakes.js";

import type { KnowledgeObject } from "../../../src/core/protocol/types.js";

const projectWithCommandSchema = makeFakeProject({
  schema: makeFakeSchema({
    object_types: { module: { kind: "fact" }, command: { kind: "fact" } },
    relationship_types: { uses: { category: "dependency" }, owns: { category: "containment" } },
  }),
});

test("build use case reads canonical, replaces indexed, returns stats with artifact + db path", async () => {
  const project = projectWithCommandSchema;
  const objects = [fakeObject("module.alpha"), fakeObject("module.beta")];
  const captured: KnowledgeObject[] = [];
  const canonical = makeFakeCanonical(objects);
  const indexed = makeFakeIndexed({
    replaceAll: (objs) => {
      captured.length = 0;
      captured.push(...objs);
    },
    stats: () => ({ object_count: 2, relationship_count: 0, stale_count: 0 }),
  });

  const build = makeBuildKnowledgeBase({ project, canonical, indexed });
  const result = await build.execute();

  assert.deepEqual(captured, objects);
  assert.equal(result.artifact, "test-artifact");
  assert.equal(result.database_path, project.databasePath);
  assert.equal(result.object_count, 2);
  assert.equal(result.relationship_count, 0);
  assert.equal(result.stale_count, 0);
});

test("check use case reads canonical and reports counts plus schema types", async () => {
  const project = projectWithCommandSchema;
  const objects = [fakeObject("module.alpha"), fakeObject("module.beta")];
  const canonical = makeFakeCanonical(objects);

  const check = makeCheckKnowledgeBase({ project, canonical });
  const result = await check.execute();

  assert.equal(result.artifact, "test-artifact");
  assert.equal(result.object_count, 2);
  assert.deepEqual(result.schema_types.sort(), ["command", "module"]);
  assert.deepEqual(result.relationship_types.sort(), ["owns", "uses"]);
});
