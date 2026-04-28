# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Common commands

- `npm run dev -- <subcommand>` — run the CLI from TypeScript sources via tsx (e.g. `npm run dev -- check`, `npm run dev -- lookup "checkout"`).
- `npm run build` — clean + `tsc -p tsconfig.json` into `dist/`. Required before `npm start:mcp` or running the published `akp` bin.
- `npm run check` — type-check both `tsconfig.json` (src) and `tsconfig.test.json` (src + tests) with `--noEmit`. CI runs this; run it locally before committing.
- `npm test` — `pretest` first compiles tests via `tsconfig.test.json` into `dist-tests/`, then `node --test "dist-tests/tests/**/*.test.js"`. Tests run against compiled JS, not TS sources.
- Single test: `npm run pretest && node --test dist-tests/tests/unit/core/protocol/<name>.test.js` (compile first, then point `node --test` at the compiled file).
- `npm run lint` — `eslint . --max-warnings=0` (warnings-as-errors). Flat config in `eslint.config.js` uses typescript-eslint's type-checked rules + `import/order`.
- `npm run format` / `npm run format:check` — Prettier; rules in `.prettierrc.json`, ignores in `.prettierignore`.
- `npm start:mcp` — start the read-only MCP server from the built CLI (`node dist/cli/index.js mcp`). Must `npm run build` first.

Node >= 20 is required. `package.json` is `"type": "module"` with NodeNext resolution, so intra-repo imports use `.js` extensions even when authored as `.ts`.

## Architecture

AKP (Artifact Knowledge Protocol) has **two surfaces** over the same canonical store; the directory layout maps directly to protocol verbs.

**Operation surface (CLI, read/write).** `src/cli/index.ts` (commander) is a thin inbound adapter. Every verb except `init` builds the composition root (`buildContainer(cwd, opts?)` in `src/runtime/build-container.ts`) inside its action, calls one `useCase.execute(...)`, and disposes the container in `finally`. Read verbs (`describe`, `lookup`, `get`, `neighbors`, `brief`, `freshness`) live as factory functions in `src/query/use-cases/index.ts`; `build` and `check` live in `src/build/use-cases/index.ts`; `refresh` and `extractors list` live in `src/extraction/`. Errors thrown as `AppError` (`src/core/errors/app-error.ts`) get formatted with their `code` and `details`; other errors fall through. `init` is the lone exception — it stays a free function in `src/init/init-akp.ts` because it scaffolds an unbuilt project and has no port deps.

**Consumption surface (MCP, read-only).** `src/mcp/server.ts` exposes the same read verbs (`describe`, `lookup`, `get`, `neighbors`, `brief`, `freshness`) over `@modelcontextprotocol/sdk`. It is read-only by design — authoring/mutation never go through it. The MCP server builds **one** container at `startMcpServer` start and reuses it across all tool calls; the container is disposed when the stdio transport reports `onclose`. Note: `transport.onclose` only fires on a clean shutdown (graceful protocol close); on abrupt termination the SQLite handle is reclaimed by the OS — better-sqlite3 in WAL mode recovers cleanly on the next open, so this is not a data-integrity concern.

**Composition root.** `src/runtime/build-container.ts` is the single wiring location. `buildContainer(cwd, opts?)` returns `{project, canonical, indexed, extractors, useCases, dispose()}`. Use cases consume injected ports — they never construct adapters or read from `process.cwd()` directly. CLI and MCP are the only inbound adapters; both are thin and call into use cases via the container. Adding a new verb is: define a use case in the appropriate `*/use-cases/index.ts`, register it in `Container.useCases`, wire it from CLI (and MCP if read-only).

**Canonical vs. local store.** A project is identified by `.akp/manifest.yaml` (see `findProjectRoot` in `src/core/config/paths.ts`, which walks up from cwd). For v0.1:

- `.akp/objects.jsonl` is the **canonical authored** object source (committed).
- `.akp/schemas/*.yaml` defines domain object/relationship types referenced by the manifest.
- `.akp-local/akp.sqlite` is the **generated** local query store (gitignored). It is the SQLite-backed implementation of the `IndexedStore` interface declared in `src/store/sqlite/sqlite-store.ts` (better-sqlite3 + FTS5); the interface exposes `upsertMany` / `deleteMany` / `replaceAll` for write paths and `getObject` / `lookup` / `neighbors` / `stats` for reads. `src/store/ensure-store-built.ts` is the path query commands use to lazily (re)build the store from the canonical JSONL when stale.
- The canonical reader/writer exposes a `CanonicalStore` interface with `readAll(): Promise<KnowledgeObject[]>` and `writeAll(objects): Promise<void>` in `src/knowledge/read-objects.ts`; `makeJsonlCanonicalStore(objectsPath, schema)` is the JSONL-backed factory. `writeAll` is atomic (temp file + `rename`) so a partial failure can't leave the canonical store half-written.

**Extraction surface.** `src/extraction/source-extractor.ts` declares the `SourceExtractor` port — the plug-in surface domain packs implement to populate canonical knowledge from sources. `src/extraction/use-cases/refresh.ts` (`makeRefresh`) is the orchestrator: it runs an extractor, validates each emitted object via `knowledgeObjectSchema` + `validateObjectAgainstPack` + `validateRelationshipTargets`, then merges with **identity-based ownership** — an extractor only replaces canonical objects whose `provenance.generated_by` matches its own id (exact or `${id}:` prefix). Human-authored objects and other extractors' objects are preserved untouched. `src/extraction/registry.ts` (`defaultExtractors()`) is where the CLI picks up its built-in extractor list. Currently registers one: `tsRepoExtractor` from `src/extraction/extractors/ts-repo/`, which (a) walks `<rootDir>/src/` and emits one `module` object per top-level directory and (b) regex-scans `<rootDir>/src/cli/index.ts` for commander-style `program.command("...")` calls and emits one `command` object per match. The capture is normalized to its first whitespace-separated token, so `program.command("get <id>")` yields id `command.get`. All emitted objects carry `provenance.generated_by: "ts-repo"` and `confidence: "mechanical"`. Future TDD cycles extend it to `function`, `class`, `port`, `use_case` and the relationships between them.

**Protocol model.** Every knowledge object conforms to `KnowledgeObject` in `src/core/protocol/types.ts`: a typed envelope with `kind` (one of `fact | convention | procedure`), per-object `classification` (`public | internal | restricted | confidential`), `exposure` (`committed | local-only | ephemeral`), `provenance`, `freshness`, and `review_state`. Zod schemas in `src/core/protocol/schema.ts` validate this; the validator is shared between `check`, `build`, and ingest. When changing the envelope, update both `types.ts` and `schema.ts` together.

**Project context.** `src/core/config/load-project.ts` produces a `ProjectContext` (root dir, akp/local dirs, parsed manifest, parsed schema, resolved paths). Most modules accept or build this rather than re-reading manifest/schema themselves.

## TypeScript conventions

`strict`, `noUncheckedIndexedAccess`, and `exactOptionalPropertyTypes` are all on. In particular:

- Optional properties in interfaces are written as `field?: T | undefined` (see `types.ts`) — required because of `exactOptionalPropertyTypes`. Do not drop the explicit `| undefined`.
- Indexed access returns `T | undefined`; narrow before use.

## Tests

`tests/` mirrors `src/` and is split into `unit/`, `integration/` (build, query — exercise SQLite + manifest), and `e2e/cli/` (spawn the compiled CLI). Helpers in `tests/helpers/` (`temp-project.ts`, `fixtures.ts`) build throwaway AKP projects under temp dirs; integration/e2e fixtures may write `.akp-local/` which is excluded by the manifest. Because tests run from `dist-tests/`, edits to `.ts` will not affect the next `node --test` run until `npm run pretest` (or `npm test`) recompiles.

## Reference docs

`docs/protocol-v0.1.md` is the authoritative spec for object kinds, the universal envelope, and the read/authoring verbs. `docs/architecture.md` and `docs/security.md` cover the surface model and the classification/exposure posture (read-only by default, fail-closed when exposure is unclear). `CHANGELOG.md` (Keep-a-Changelog) records every shipped patch. Consult these before changing protocol shapes or the MCP server's exposed verbs.
