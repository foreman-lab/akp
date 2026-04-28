#!/usr/bin/env node
import { Command } from "commander";

import { buildKnowledgeBase } from "../build/build-knowledge-base.js";
import { checkKnowledgeBase } from "../check/check-knowledge-base.js";
import { loadProject } from "../core/config/load-project.js";
import { AkpError } from "../core/errors/akp-error.js";
import { defaultExtractors } from "../extraction/registry.js";
import { makeRefresh } from "../extraction/use-cases/refresh.js";
import { initAkp } from "../init/init-akp.js";
import { makeJsonlCanonicalStore } from "../knowledge/read-objects.js";
import {
  briefKnowledge,
  describeKnowledgeBase,
  getFreshness,
  getNeighbors,
  getObject,
  lookupKnowledge,
} from "../query/query-knowledge-base.js";
import { SqliteStore } from "../store/sqlite/sqlite-store.js";

import { parsePositiveInt } from "./parse-options.js";

const program = new Command();

program
  .name("akp")
  .description("Artifact Knowledge Protocol command line tools")
  .version("0.1.0-alpha.5");

program
  .command("init")
  .description("Create a starter .akp knowledge-base definition")
  .action(async () => {
    printJson(await initAkp());
  });

program
  .command("build")
  .description("Compile .akp objects into the local AKP store")
  .action(async () => {
    printJson(await buildKnowledgeBase());
  });

program
  .command("check")
  .description("Validate the AKP manifest, schema, and objects")
  .action(async () => {
    printJson(await checkKnowledgeBase());
  });

program
  .command("describe")
  .description("Describe the active AKP artifact knowledge base")
  .action(async () => {
    printJson(await describeKnowledgeBase());
  });

program
  .command("lookup")
  .description("Find AKP knowledge objects for an intent")
  .argument("<intent>", "Natural-language lookup intent")
  .option(
    "-l, --limit <number>",
    "Maximum number of objects",
    (value) => parsePositiveInt(value, undefined, 50),
    5,
  )
  .action(async (intent: string, options: { limit: number }) => {
    printJson(await lookupKnowledge(intent, options.limit));
  });

program
  .command("get")
  .description("Get one AKP object by id")
  .argument("<id>", "AKP object id")
  .action(async (id: string) => {
    printJson(await getObject(id));
  });

program
  .command("neighbors")
  .description("Get objects related to an AKP object")
  .argument("<id>", "AKP object id")
  .option(
    "-l, --limit <number>",
    "Maximum number of neighbors",
    (value) => parsePositiveInt(value, undefined, 100),
    20,
  )
  .action(async (id: string, options: { limit: number }) => {
    printJson(await getNeighbors(id, options.limit));
  });

program
  .command("brief")
  .description("Get a compact AKP orientation for a scope or task")
  .argument("<scope>", "Scope or task")
  .option(
    "-l, --limit <number>",
    "Maximum number of primary objects",
    (value) => parsePositiveInt(value, undefined, 20),
    5,
  )
  .action(async (scope: string, options: { limit: number }) => {
    printJson(await briefKnowledge(scope, options.limit));
  });

program
  .command("freshness")
  .description("Summarize freshness status for the local AKP store")
  .action(async () => {
    printJson(await getFreshness());
  });

program
  .command("refresh")
  .description("Re-extract canonical knowledge from sources via a registered extractor")
  .option(
    "-e, --extractor <id>",
    "Extractor id to run (required if multiple extractors are registered)",
  )
  .option("--dry-run", "Compute the refresh plan without writing any changes", false)
  .action(async (options: { extractor?: string; dryRun?: boolean }) => {
    const project = await loadProject(process.cwd());
    const canonical = makeJsonlCanonicalStore(project.objectsPath, project.schema);
    const indexed = new SqliteStore(project.databasePath);
    indexed.initialize();
    try {
      const refresh = makeRefresh({
        canonical,
        indexed,
        extractors: defaultExtractors(),
        context: {
          rootDir: project.rootDir,
          manifest: project.manifest,
          schema: project.schema,
        },
      });
      const result = await refresh.execute({
        extractorId: options.extractor,
        dryRun: options.dryRun ?? false,
      });
      printJson(result);
    } finally {
      indexed.close();
    }
  });

const extractors = program.command("extractors").description("Manage AKP source extractors");

extractors
  .command("list")
  .description("List registered AKP source extractors")
  .action(() => {
    const list = defaultExtractors().map((extractor) => extractor.describe());
    printJson(list);
  });

program
  .command("mcp")
  .description("Start the read-only AKP MCP server")
  .action(async () => {
    const { startMcpServer } = await import("../mcp/server.js");
    await startMcpServer();
  });

program.parseAsync(process.argv).catch((error: unknown) => {
  if (error instanceof AkpError) {
    console.error(`${error.code}: ${error.message}`);
    if (error.details) {
      console.error(JSON.stringify(error.details, null, 2));
    }
  } else {
    console.error(error);
  }
  process.exitCode = 1;
});

function printJson(value: unknown): void {
  console.log(JSON.stringify(value, null, 2));
}
