import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import { AkpError } from "../../../src/core/errors/akp-error.js";
import { makeRefresh } from "../../../src/extraction/use-cases/refresh.js";
import { makeJsonlCanonicalStore } from "../../../src/knowledge/read-objects.js";
import { SqliteStore } from "../../../src/store/sqlite/sqlite-store.js";

import type { KnowledgeObject, Manifest, PackSchema } from "../../../src/core/protocol/types.js";
import type { SourceExtractor } from "../../../src/extraction/source-extractor.js";

const schema: PackSchema = {
  object_types: {
    module: { kind: "fact" },
  },
  relationship_types: {
    uses: { category: "dependency" },
  },
};

const manifest: Manifest = {
  version: "0.1",
  artifact: { name: "test-artifact", kind: "software_repo" },
  schema: "schemas/test.yaml",
  security: {
    default_classification: "internal",
    default_exposure: "committed",
  },
};

test("refresh fails when no extractors are registered", async () => {
  const env = await setupEnv();
  try {
    const refresh = makeRefresh({
      canonical: env.canonical,
      indexed: env.indexed,
      extractors: [],
      context: { rootDir: env.rootDir, manifest, schema },
    });

    await assert.rejects(
      () => refresh.execute(),
      (error) => {
        assert.ok(error instanceof AkpError);
        assert.equal(error.code, "AKP_NO_EXTRACTORS_REGISTERED");
        return true;
      },
    );
  } finally {
    env.indexed.close();
  }
});

test("refresh fails with AKP_EXTRACTOR_UNKNOWN when --extractor id is not registered", async () => {
  const env = await setupEnv();
  try {
    const refresh = makeRefresh({
      canonical: env.canonical,
      indexed: env.indexed,
      extractors: [makeFakeExtractor("known", [])],
      context: { rootDir: env.rootDir, manifest, schema },
    });

    await assert.rejects(
      () => refresh.execute({ extractorId: "missing" }),
      (error) => {
        assert.ok(error instanceof AkpError);
        assert.equal(error.code, "AKP_EXTRACTOR_UNKNOWN");
        return true;
      },
    );
  } finally {
    env.indexed.close();
  }
});

test("refresh fails with AKP_EXTRACTOR_AMBIGUOUS when multiple extractors and no id given", async () => {
  const env = await setupEnv();
  try {
    const refresh = makeRefresh({
      canonical: env.canonical,
      indexed: env.indexed,
      extractors: [makeFakeExtractor("a", []), makeFakeExtractor("b", [])],
      context: { rootDir: env.rootDir, manifest, schema },
    });

    await assert.rejects(
      () => refresh.execute(),
      (error) => {
        assert.ok(error instanceof AkpError);
        assert.equal(error.code, "AKP_EXTRACTOR_AMBIGUOUS");
        return true;
      },
    );
  } finally {
    env.indexed.close();
  }
});

test("refresh adds new objects when canonical is empty", async () => {
  const env = await setupEnv();
  try {
    const extracted = [
      object("module.alpha", { generatedBy: "ts-repo" }),
      object("module.beta", { generatedBy: "ts-repo" }),
    ];
    const refresh = makeRefresh({
      canonical: env.canonical,
      indexed: env.indexed,
      extractors: [makeFakeExtractor("ts-repo", extracted)],
      context: { rootDir: env.rootDir, manifest, schema },
    });

    const result = await refresh.execute();

    assert.equal(result.added_count, 2);
    assert.equal(result.replaced_count, 0);
    assert.equal(result.removed_count, 0);
    assert.equal(result.preserved_count, 0);
    assert.equal(result.dry_run, false);

    const canonicalAfter = await env.canonical.readAll();
    assert.equal(canonicalAfter.length, 2);
    assert.equal(env.indexed.getObject("module.alpha")?.id, "module.alpha");
  } finally {
    env.indexed.close();
  }
});

test("refresh replaces own objects, preserves human-authored objects", async () => {
  const env = await setupEnv([
    object("module.legacy", { generatedBy: "ts-repo", summary: "old summary" }),
    object("module.handwritten", { generatedBy: "human:foreman-lab" }),
  ]);
  try {
    const extracted = [
      object("module.legacy", { generatedBy: "ts-repo", summary: "new summary" }),
      object("module.fresh", { generatedBy: "ts-repo" }),
    ];
    const refresh = makeRefresh({
      canonical: env.canonical,
      indexed: env.indexed,
      extractors: [makeFakeExtractor("ts-repo", extracted)],
      context: { rootDir: env.rootDir, manifest, schema },
    });

    const result = await refresh.execute();

    assert.equal(result.added_count, 1);
    assert.equal(result.replaced_count, 1);
    assert.equal(result.removed_count, 0);
    assert.equal(result.preserved_count, 1);

    const canonicalAfter = await env.canonical.readAll();
    const ids = canonicalAfter.map((o) => o.id).sort();
    assert.deepEqual(ids, ["module.fresh", "module.handwritten", "module.legacy"]);

    const legacy = canonicalAfter.find((o) => o.id === "module.legacy");
    assert.equal(legacy?.summary, "new summary");

    const handwritten = canonicalAfter.find((o) => o.id === "module.handwritten");
    assert.equal(handwritten?.provenance.generated_by, "human:foreman-lab");
  } finally {
    env.indexed.close();
  }
});

test("refresh removes own orphans (objects no longer emitted by the extractor)", async () => {
  const env = await setupEnv([
    object("module.kept", { generatedBy: "ts-repo" }),
    object("module.orphan", { generatedBy: "ts-repo" }),
    object("module.handwritten", { generatedBy: "human:foreman-lab" }),
  ]);
  try {
    const refresh = makeRefresh({
      canonical: env.canonical,
      indexed: env.indexed,
      extractors: [
        makeFakeExtractor("ts-repo", [object("module.kept", { generatedBy: "ts-repo" })]),
      ],
      context: { rootDir: env.rootDir, manifest, schema },
    });

    const result = await refresh.execute();

    assert.equal(result.added_count, 0);
    assert.equal(result.replaced_count, 1);
    assert.equal(result.removed_count, 1);
    assert.equal(result.preserved_count, 1);

    const canonicalAfter = await env.canonical.readAll();
    const ids = canonicalAfter.map((o) => o.id).sort();
    assert.deepEqual(ids, ["module.handwritten", "module.kept"]);
  } finally {
    env.indexed.close();
  }
});

test("refresh fails with AKP_EXTRACTOR_PRODUCED_INVALID_OBJECT when extractor yields a malformed object", async () => {
  const env = await setupEnv();
  try {
    const malformed: SourceExtractor = {
      describe() {
        return { id: "broken", description: "yields garbage", produces_types: ["module"] };
      },
      async *extract() {
        yield { not: "a knowledge object" } as unknown as KnowledgeObject;
      },
    };
    const refresh = makeRefresh({
      canonical: env.canonical,
      indexed: env.indexed,
      extractors: [malformed],
      context: { rootDir: env.rootDir, manifest, schema },
    });

    await assert.rejects(
      () => refresh.execute(),
      (error) => {
        assert.ok(error instanceof AkpError);
        assert.equal(error.code, "AKP_EXTRACTOR_PRODUCED_INVALID_OBJECT");
        return true;
      },
    );

    const canonicalAfter = await env.canonical.readAll();
    assert.equal(canonicalAfter.length, 0);
  } finally {
    env.indexed.close();
  }
});

test("refresh --dry-run computes counts but writes nothing", async () => {
  const env = await setupEnv([object("module.original", { generatedBy: "ts-repo" })]);
  try {
    const extracted = [
      object("module.original", { generatedBy: "ts-repo", summary: "would change" }),
      object("module.new", { generatedBy: "ts-repo" }),
    ];
    const refresh = makeRefresh({
      canonical: env.canonical,
      indexed: env.indexed,
      extractors: [makeFakeExtractor("ts-repo", extracted)],
      context: { rootDir: env.rootDir, manifest, schema },
    });

    const result = await refresh.execute({ dryRun: true });

    assert.equal(result.dry_run, true);
    assert.equal(result.added_count, 1);
    assert.equal(result.replaced_count, 1);

    const canonicalAfter = await env.canonical.readAll();
    assert.equal(canonicalAfter.length, 1);
    assert.equal(canonicalAfter[0]?.id, "module.original");
    assert.notEqual(canonicalAfter[0]?.summary, "would change");
    assert.equal(env.indexed.getObject("module.new"), null);
  } finally {
    env.indexed.close();
  }
});

interface TestEnv {
  canonical: ReturnType<typeof makeJsonlCanonicalStore>;
  indexed: SqliteStore;
  rootDir: string;
}

async function setupEnv(seed: KnowledgeObject[] = []): Promise<TestEnv> {
  const rootDir = path.join(tmpdir(), `akp-refresh-${Date.now()}-${Math.random()}`);
  await mkdir(rootDir, { recursive: true });

  const objectsPath = path.join(rootDir, "objects.jsonl");
  if (seed.length > 0) {
    await writeFile(objectsPath, seed.map((object) => JSON.stringify(object)).join("\n") + "\n");
  }

  const canonical = makeJsonlCanonicalStore(objectsPath, schema);
  const indexed = new SqliteStore(path.join(rootDir, "akp.sqlite"));
  indexed.initialize();
  if (seed.length > 0) {
    indexed.replaceAll(seed);
  }
  return { canonical, indexed, rootDir };
}

function makeFakeExtractor(id: string, objects: KnowledgeObject[]): SourceExtractor {
  return {
    describe() {
      return { id, description: `fake ${id} extractor`, produces_types: ["module"] };
    },
    async *extract() {
      for (const object of objects) {
        yield object;
      }
    },
  };
}

interface ObjectOverrides {
  generatedBy?: string;
  summary?: string;
  relationships?: KnowledgeObject["relationships"];
}

function object(id: string, overrides: ObjectOverrides = {}): KnowledgeObject {
  return {
    id,
    type: "module",
    kind: "fact",
    title: id,
    summary: overrides.summary ?? "Test object.",
    attributes: {},
    relationships: overrides.relationships ?? [],
    sources: [],
    classification: "internal",
    exposure: "committed",
    provenance: {
      generated_by: overrides.generatedBy ?? "human:test",
      generated_at: "2026-04-27T00:00:00.000Z",
      confidence: "human-authored",
      verified_against: [],
    },
    freshness: {
      last_verified: "2026-04-27T00:00:00.000Z",
      status: "fresh",
    },
    review_state: "accepted",
  };
}
