# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Common commands

- `npm run dev -- <subcommand>` — run the CLI from TypeScript sources via tsx (e.g. `npm run dev -- check`, `npm run dev -- lookup "checkout"`).
- `npm run build` — clean + `tsc -p tsconfig.json` into `dist/`. Required before `npm start:mcp` or running the published `akp` bin.
- `npm run check` — type-check both `tsconfig.json` (src) and `tsconfig.test.json` (src + tests) with `--noEmit`. CI runs this; run it locally before committing.
- `npm test` — `pretest` first compiles tests via `tsconfig.test.json` into `dist-tests/`, then `node --test "dist-tests/tests/**/*.test.js"`. Tests run against compiled JS, not TS sources.
- Single test: `npm run pretest && node --test dist-tests/tests/unit/core/protocol/<name>.test.js` (compile first, then point `node --test` at the compiled file).
- `npm run lint` — eslint over the repo.
- `npm start:mcp` — start the read-only MCP server from the built CLI (`node dist/cli/index.js mcp`). Must `npm run build` first.

Node >= 20 is required. `package.json` is `"type": "module"` with NodeNext resolution, so intra-repo imports use `.js` extensions even when authored as `.ts`.

## Architecture

AKP (Artifact Knowledge Protocol) has **two surfaces** over the same canonical store; the directory layout maps directly to protocol verbs.

**Operation surface (CLI, read/write).** `src/cli/index.ts` (commander) wires each verb to a module: `init/`, `build/`, `check/`, `query/` (which implements `describe`, `lookup`, `get`, `neighbors`, `brief`, `freshness`), and `mcp/`. Errors thrown as `AkpError` (`src/core/errors/akp-error.ts`) get formatted with their `code` and `details`; other errors fall through.

**Consumption surface (MCP, read-only).** `src/mcp/server.ts` exposes the same read verbs (`describe`, `lookup`, `get`, `neighbors`, `brief`, `freshness`) over `@modelcontextprotocol/sdk`. It is read-only by design — authoring/mutation never go through it.

**Canonical vs. local store.** A project is identified by `.akp/manifest.yaml` (see `findProjectRoot` in `src/core/config/paths.ts`, which walks up from cwd). For v0.1:

- `.akp/objects.jsonl` is the **canonical authored** object source (committed).
- `.akp/schemas/*.yaml` defines domain object/relationship types referenced by the manifest.
- `.akp-local/akp.sqlite` is the **generated** local query store (gitignored). All read verbs go through `src/store/sqlite/sqlite-store.ts` (better-sqlite3 + kysely). `src/store/ensure-store-built.ts` is the path query commands use to lazily (re)build the SQLite store from the canonical JSONL when stale.

**Protocol model.** Every knowledge object conforms to `KnowledgeObject` in `src/core/protocol/types.ts`: a typed envelope with `kind` (one of `fact | convention | procedure`), per-object `classification` (`public | internal | restricted | confidential`), `exposure` (`committed | local-only | ephemeral`), `provenance`, `freshness`, and `review_state`. Zod schemas in `src/core/protocol/schema.ts` validate this; the validator is shared between `check`, `build`, and ingest. When changing the envelope, update both `types.ts` and `schema.ts` together.

**Project context.** `src/core/config/load-project.ts` produces a `ProjectContext` (root dir, akp/local dirs, parsed manifest, parsed schema, resolved paths). Most modules accept or build this rather than re-reading manifest/schema themselves.

## TypeScript conventions

`strict`, `noUncheckedIndexedAccess`, and `exactOptionalPropertyTypes` are all on. In particular:

- Optional properties in interfaces are written as `field?: T | undefined` (see `types.ts`) — required because of `exactOptionalPropertyTypes`. Do not drop the explicit `| undefined`.
- Indexed access returns `T | undefined`; narrow before use.

## Tests

`tests/` mirrors `src/` and is split into `unit/`, `integration/` (build, query — exercise SQLite + manifest), and `e2e/cli/` (spawn the compiled CLI). Helpers in `tests/helpers/` (`temp-project.ts`, `fixtures.ts`) build throwaway AKP projects under temp dirs; integration/e2e fixtures may write `.akp-local/` which is excluded by the manifest. Because tests run from `dist-tests/`, edits to `.ts` will not affect the next `node --test` run until `npm run pretest` (or `npm test`) recompiles.

## Reference docs

`docs/protocol-v0.1.md` is the authoritative spec for object kinds, the universal envelope, and the read/authoring verbs. `docs/architecture.md` and `docs/security.md` cover the surface model and the classification/exposure posture (read-only by default, fail-closed when exposure is unclear). Consult these before changing protocol shapes or the MCP server's exposed verbs.
