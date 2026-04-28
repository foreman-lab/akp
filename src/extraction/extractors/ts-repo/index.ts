import { readdir as fsReaddir, readFile as fsReadFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

import type { KnowledgeObject, Manifest } from "../../../core/protocol/types.js";
import type {
  ExtractorDescriptor,
  SourceExtractor,
  SourceExtractorContext,
} from "../../source-extractor.js";
import type { Dirent } from "node:fs";

const EXTRACTOR_ID = "ts-repo";

/**
 * Filesystem operations the extractor depends on. Injected so tests can
 * exercise edge cases (e.g. EACCES propagation) that are awkward to trigger
 * against the real filesystem on every platform.
 */
export interface TsRepoDependencies {
  /** Defaults to `node:fs/promises.readdir` with `{withFileTypes: true}`. */
  readdir?: (path: string, options: { withFileTypes: true }) => Promise<Dirent[]>;
  /** Defaults to `node:fs/promises.readFile` with utf8 encoding. */
  readFile?: (path: string, encoding: "utf8") => Promise<string>;
}

/**
 * Extractor for TypeScript repositories. Today it emits:
 *  - one `module` object per top-level directory under `<rootDir>/src/`
 *  - one `command` object per `program.command("...")` call in
 *    `<rootDir>/src/cli/index.ts` (commander-style CLI declarations)
 *  - one `use_case` object per exported `make<Name>` factory under
 *    `<rootDir>/src/**\/use-cases/*.ts`
 *
 * Future TDD cycles add `function`, `class`, `port`, and the
 * corresponding relationships.
 */
export function tsRepoExtractor(deps: TsRepoDependencies = {}): SourceExtractor {
  const readdir = deps.readdir ?? defaultReaddir;
  const readFile = deps.readFile ?? defaultReadFile;
  return {
    describe(): ExtractorDescriptor {
      return {
        id: EXTRACTOR_ID,
        description:
          "Extracts module, command, and use_case objects from a TypeScript repo (src/ directories, src/cli/index.ts program.command() calls, and src/**/use-cases/*.ts make<Name> factories).",
        produces_types: ["module", "command", "use_case"],
      };
    },
    async *extract(context: SourceExtractorContext): AsyncIterable<KnowledgeObject> {
      yield* extractModules(context, readdir);
      yield* extractCommands(context, readFile);
      yield* extractUseCases(context, readdir, readFile);
    },
  };
}

async function defaultReaddir(
  pathArg: string,
  options: { withFileTypes: true },
): Promise<Dirent[]> {
  return fsReaddir(pathArg, options);
}

async function defaultReadFile(pathArg: string, encoding: "utf8"): Promise<string> {
  return fsReadFile(pathArg, encoding);
}

const CLI_FILE_RELATIVE = path.join("src", "cli", "index.ts");

async function* extractCommands(
  context: SourceExtractorContext,
  readFile: NonNullable<TsRepoDependencies["readFile"]>,
): AsyncIterable<KnowledgeObject> {
  const cliPath = path.join(context.rootDir, CLI_FILE_RELATIVE);

  let content: string;
  try {
    content = await readFile(cliPath, "utf8");
  } catch (error: unknown) {
    const nodeError = error as NodeJS.ErrnoException;
    if (nodeError.code === "ENOENT") {
      return;
    }
    throw error;
  }

  // Function-local regex avoids module-scope state on the global RegExp's
  // `lastIndex`. matchAll returns a fresh iterator per call.
  const commandPattern = /\bprogram\s*\.\s*command\s*\(\s*["']([^"']+)["']/g;

  const now = new Date().toISOString();
  const seen = new Set<string>();
  for (const match of content.matchAll(commandPattern)) {
    const captured = match[1];
    if (captured === undefined) {
      continue;
    }
    // Strip commander argument syntax: `program.command("get <id>")` should
    // yield `command.get`, not `command.get <id>`. Take only the first
    // whitespace-separated token of the captured string.
    const commandName = captured.split(/\s+/)[0];
    if (commandName === undefined || commandName.length === 0 || seen.has(commandName)) {
      continue;
    }
    seen.add(commandName);
    yield buildCommandObject(commandName, context.rootDir, context.manifest, now);
  }
}

function buildCommandObject(
  name: string,
  rootDir: string,
  manifest: Manifest,
  now: string,
): KnowledgeObject {
  return {
    id: `command.${name}`,
    type: "command",
    kind: "fact",
    title: name,
    summary: `CLI command: ${name}`,
    attributes: {
      command: name,
    },
    relationships: [],
    sources: [
      {
        source_kind: "file",
        uri: pathToFileURL(path.join(rootDir, CLI_FILE_RELATIVE)).href,
      },
    ],
    classification: manifest.security.default_classification,
    exposure: manifest.security.default_exposure,
    provenance: {
      generated_by: EXTRACTOR_ID,
      generated_at: now,
      confidence: "mechanical",
      verified_against: [],
    },
    freshness: {
      last_verified: now,
      status: "fresh",
    },
    review_state: "accepted",
  };
}

async function* extractModules(
  context: SourceExtractorContext,
  readdir: NonNullable<TsRepoDependencies["readdir"]>,
): AsyncIterable<KnowledgeObject> {
  const srcDir = path.join(context.rootDir, "src");

  let entries: Dirent[];
  try {
    entries = await readdir(srcDir, { withFileTypes: true });
  } catch (error: unknown) {
    const nodeError = error as NodeJS.ErrnoException;
    if (nodeError.code === "ENOENT") {
      return;
    }
    throw error;
  }

  const now = new Date().toISOString();
  // Filter prefixes: `.` for hidden directories (`.cache`, `.next`, ...);
  // `_` for conventionally private/generated directories (`_internal`,
  // `_generated`). Project-specific overrides are a future-cycle concern;
  // surfacing this here so anyone extending the policy sees the rationale.
  const moduleEntries = entries
    .filter(
      (entry) => entry.isDirectory() && !entry.name.startsWith(".") && !entry.name.startsWith("_"),
    )
    .sort((a, b) => a.name.localeCompare(b.name));

  for (const entry of moduleEntries) {
    yield buildModuleObject(entry.name, context.rootDir, context.manifest, now);
  }
}

function buildModuleObject(
  name: string,
  rootDir: string,
  manifest: Manifest,
  now: string,
): KnowledgeObject {
  return {
    id: `module.${name}`,
    type: "module",
    kind: "fact",
    title: capitalize(name),
    summary: `Module at src/${name}/.`,
    attributes: {
      paths: [`src/${name}/**`],
      purpose: `Source module at src/${name}/.`,
    },
    relationships: [],
    sources: [
      {
        source_kind: "directory",
        uri: pathToFileURL(path.join(rootDir, "src", name)).href,
      },
    ],
    classification: manifest.security.default_classification,
    exposure: manifest.security.default_exposure,
    provenance: {
      generated_by: EXTRACTOR_ID,
      generated_at: now,
      confidence: "mechanical",
      verified_against: [],
    },
    freshness: {
      last_verified: now,
      status: "fresh",
    },
    review_state: "accepted",
  };
}

async function* extractUseCases(
  context: SourceExtractorContext,
  readdir: NonNullable<TsRepoDependencies["readdir"]>,
  readFile: NonNullable<TsRepoDependencies["readFile"]>,
): AsyncIterable<KnowledgeObject> {
  const srcDir = path.join(context.rootDir, "src");
  const files: string[] = [];
  await collectUseCaseFiles(srcDir, readdir, files);

  // Function-local regex avoids global-RegExp lastIndex carry-over.
  const factoryPattern = /^export\s+(?:async\s+)?function\s+make([A-Z]\w*)\b/gm;
  const now = new Date().toISOString();

  for (const filePath of files.sort()) {
    const content = await readFile(filePath, "utf8");
    for (const match of content.matchAll(factoryPattern)) {
      const factoryName = `make${match[1]}`;
      const id = `use_case.${kebabCase(match[1]!)}`;
      yield buildUseCaseObject(id, factoryName, filePath, context, now);
    }
  }
}

async function collectUseCaseFiles(
  srcDir: string,
  readdir: NonNullable<TsRepoDependencies["readdir"]>,
  out: string[],
): Promise<void> {
  let entries: Dirent[];
  try {
    entries = await readdir(srcDir, { withFileTypes: true });
  } catch (error: unknown) {
    const nodeError = error as NodeJS.ErrnoException;
    if (nodeError.code === "ENOENT") return;
    throw error;
  }

  for (const entry of entries) {
    if (entry.name.startsWith(".") || entry.name.startsWith("_")) continue;
    const childPath = path.join(srcDir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "use-cases") {
        const useCaseEntries = await readdir(childPath, { withFileTypes: true });
        for (const file of useCaseEntries) {
          if (file.isFile() && file.name.endsWith(".ts")) {
            out.push(path.join(childPath, file.name));
          }
        }
      } else {
        await collectUseCaseFiles(childPath, readdir, out);
      }
    }
  }
}

function buildUseCaseObject(
  id: string,
  factoryName: string,
  filePath: string,
  context: SourceExtractorContext,
  now: string,
): KnowledgeObject {
  return {
    id,
    type: "use_case",
    kind: "fact",
    title: factoryName,
    summary: `Application use case factory ${factoryName}.`,
    attributes: {
      factory: factoryName,
    },
    relationships: [],
    sources: [
      {
        source_kind: "file",
        uri: pathToFileURL(filePath).href,
      },
    ],
    classification: context.manifest.security.default_classification,
    exposure: context.manifest.security.default_exposure,
    provenance: {
      generated_by: EXTRACTOR_ID,
      generated_at: now,
      confidence: "mechanical",
      verified_against: [],
    },
    freshness: {
      last_verified: now,
      status: "fresh",
    },
    review_state: "accepted",
  };
}

function kebabCase(pascal: string): string {
  return pascal
    .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
    .replace(/([A-Z]+)([A-Z][a-z])/g, "$1-$2")
    .toLowerCase();
}

function capitalize(value: string): string {
  if (value.length === 0) return value;
  return value.charAt(0).toUpperCase() + value.slice(1);
}
