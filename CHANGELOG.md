# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.1.0-alpha.11] - 2026-04-28

### Added

- **`tsRepoExtractor` now emits `command` objects** in addition to `module` objects. Scans `<rootDir>/src/cli/index.ts` and regex-matches commander-style `program.command("...")` calls; each match yields one `command` knowledge object with `attributes.command` set to the command name.
- `TsRepoDependencies.readFile` injection seam (mirrors the existing `readdir` seam) so future tests can exercise CLI-file read failures without filesystem permission gymnastics.
- Fixture `tests/fixtures/ts-tiny-repo/src/cli/index.ts` declaring `greet` and `farewell` commands; existing module-level strict-equality test updated to include the resulting `module.cli`.
- Schema entry for `command` in the fixture's `code.yaml` (`required_attributes: [command]`).

### Internal

- **Second strict-TDD cycle on the project.** Red: failing assertion `deepEqual(ids, ["command.farewell", "command.greet"])` against zero-emitted commands. Green: minimum impl change — `extract()` is now an async generator that yields modules then commands; `extractCommands()` reads the CLI file once, regex-matches, dedupes, and yields. One mid-cycle false-positive surfaced and was fixed: my fixture's own comment contained the literal `program.command("...")` string, which the regex picked up; rewording the comment closed the loop without weakening the regex.
- Test count 29 → 30.
- Dogfood against the AKP self-pack: `akp refresh --dry-run` now reports `added_count: 22` (10 modules + 12 commands from the project's own CLI), `preserved_count: 17`, identity-based merge still leaving every human-authored object untouched.

## [0.1.0-alpha.10] - 2026-04-28

### Fixed

- **Malformed `file://` URI in extracted module sources** (independent code review finding). `file://src/${name}` parses per RFC 3986 as `authority=src` (a network host), not a path under `src/`. Now uses `pathToFileURL(path.join(rootDir, "src", name)).href` to produce a proper absolute `file:///` URI. Closed via TDD: failing test asserted `URL(uri).host === ""` (red) before the impl change (green).
- **Resource leak when SQLite `initialize()` throws** during `akp refresh` (independent code review finding). Moved `indexed.initialize()` inside the existing `try/finally` block in `src/cli/index.ts` so the `close()` call always runs, even on initialize-time errors.
- **Tmp directory leak in the ENOENT extractor test** — added `rm({recursive: true, force: true})` in a `finally` to remove the per-test temp dir after each run.

### Added

- Test for proper `file:///` URI shape on every emitted module's `sources[0].uri`. Asserts `protocol === "file:"` and `host === ""`.
- Doc comment in `extractModules` explaining the `.` and `_` directory-prefix filter rationale (independent code review finding — was undocumented).

### Internal

- Test count 28 → 29. Independent typescript-reviewer pass (separate session) caught two medium-severity bugs and several low-severity items; the medium bugs and the easy lows are addressed in this commit. Deferred (broader change): tightening `tests/fixtures/**` ESLint ignore by extending `tsconfig.test.json` `include`.

## [0.1.0-alpha.9] - 2026-04-28

### Added

- `TsRepoDependencies` injection seam on `tsRepoExtractor()` — accepts an optional `readdir` function so tests can exercise filesystem edge cases (EACCES, EMFILE) without touching real filesystem permissions.
- Test for non-ENOENT `readdir` propagation: a fake `readdir` throws EACCES; the extractor must propagate the error rather than swallow it. Closes the last untested branch in `src/extraction/extractors/ts-repo/index.ts`.

### Internal

- **First strict-TDD cycle on this project.** Failing test landed first (red: `TS2554 Expected 0 arguments, but got 1` because the factory didn't yet accept dependencies). Then the minimum impl change to make the test pass (green: optional `deps` param defaulting to the real `readdir`). Test count 27 → 28.

## [0.1.0-alpha.8] - 2026-04-28

### Added

- Adversarial fixture inputs in `tests/fixtures/ts-tiny-repo/src/`: a hidden directory (`.hidden/`), an underscore-prefixed directory (`_internal/`), and a top-level file (`README.md`). Their presence makes the existing strict-equality test on emitted module ids (`["module.alpha", "module.beta"]`) double as a regression guard for the extractor's directory filters.
- Explicit test for `attributes.purpose`: every emitted module now has its `purpose` attribute asserted non-empty. Closes the post-hoc fix that landed in `0.1.0-alpha.7` without test coverage.
- Explicit test for the ENOENT branch: when `<rootDir>/src/` does not exist, the extractor yields zero objects (no error).
- ESLint `ignores` now includes `tests/fixtures/**` (fixtures are test data, not project source — type-checked rules can't parse stray fixture `.ts` files).

### Internal

- Test count 25 → 27. Phase 3 first-cycle test gaps closed.
- Honest note for the project's process backlog: this fixup was tests-after, not strict TDD. The earlier "TDD" claim for `0.1.0-alpha.7` was partial — the failing-test-first discipline only held for the initial cycle and slipped during the dogfood-driven `purpose` fix.

## [0.1.0-alpha.7] - 2026-04-28

### Added

- **`tsRepoExtractor` — first working domain-pack extractor**, in `src/extraction/extractors/ts-repo/index.ts`. Walks `<rootDir>/src/` and emits one `module` object per top-level directory with `provenance.generated_by: "ts-repo"` and `confidence: "mechanical"`. Built strict-TDD style (red → green): the failing test landed first, then the minimum impl to pass.
- `defaultExtractors()` now returns `[tsRepoExtractor()]` so `akp refresh` and `akp extractors list` are functionally meaningful out of the box.
- `tests/fixtures/ts-tiny-repo/` — minimal AKP project fixture (manifest, schema, two stub `src/` directories) used by the integration test.
- 4 integration tests in `tests/integration/extraction/ts-repo-extractor.test.ts` covering descriptor shape, module-id derivation, provenance stamping, and required-attribute coverage.

### Changed

- E2E tests for `akp extractors list` and `akp refresh` now assert the populated-registry paths (list contains `ts-repo`; `--extractor unknown-id` fails with `AKP_EXTRACTOR_UNKNOWN`). The previous empty-registry assertions are no longer reachable from the CLI.

### Fixed

- CLI `--version` was at `0.1.0-alpha.5` while `package.json` had advanced to `0.1.0-alpha.6` — the version drift fix in `0.1.0-alpha.5` only updated the CLI string once. Both now report `0.1.0-alpha.7`.

### Internal

- Dogfood result against the AKP self-pack (`akp refresh --dry-run`): would add 10 ts-repo `module.*` objects (one per src/ directory), replace 0, remove 0, preserve all 17 human-authored objects intact. Identity-based merge confirmed: extractor only owns objects whose `provenance.generated_by` starts with `ts-repo`.
- Test count 21 → 25.
- Phase 3 first TDD cycle complete. Future cycles extend ts-repo to symbol level (`command`, `function`, `class`, `port`, `use_case`).

## [0.1.0-alpha.6] - 2026-04-28

### Added

- Test for `AKP_EXTRACTOR_PRODUCED_INVALID_OBJECT`: malformed-extractor case in `tests/unit/extraction/refresh.test.ts` confirms refresh aborts before any write when an extractor yields a non-conforming object.
- Test for `AKP_OBJECTS_WRITE_FAILED`: unwritable target path in `tests/unit/store/sqlite-store.test.ts` exercises the atomic-write failure branch on `JsonlCanonicalStore.writeAll`.
- E2E tests in `tests/e2e/cli/cli.test.ts` for the new CLI surface: `akp extractors list` returns `[]`, and `akp refresh` exits non-zero with `AKP_NO_EXTRACTORS_REGISTERED` when no extractors are wired.

### Internal

- Fills the test-coverage gap from `0.1.0-alpha.5`: every error code introduced for the refresh surface (`AKP_EXTRACTOR_*`, `AKP_OBJECTS_WRITE_FAILED`) now has at least one test, and the two new CLI verbs are covered end-to-end. Test count 17 → 21.

## [0.1.0-alpha.5] - 2026-04-28

### Added

- `SourceExtractor` port in `src/extraction/source-extractor.ts` — the plug-in surface domain packs implement to populate canonical knowledge from sources. Includes `ExtractorDescriptor`, `SourceExtractorContext`, and an `isOwnedByExtractor` helper.
- `makeRefresh` use case in `src/extraction/use-cases/refresh.ts` — orchestrates extraction, validation, and identity-based merge: an extractor only replaces canonical objects whose `provenance.generated_by` matches its own id (exact match or `${id}:` prefix); human-authored objects and objects from other extractors are preserved untouched.
- `defaultExtractors()` registry in `src/extraction/registry.ts` — returns `[]` for now; Phase 3 wires the TypeScript code-repo extractor here.
- `CanonicalStore.writeAll(objects)` — atomic temp-file + rename write, with `AKP_OBJECTS_WRITE_FAILED` on failure. Implemented on `JsonlCanonicalStore`.
- CLI verbs: `akp refresh [--extractor <id>] [--dry-run]` and `akp extractors list`.
- New `AkpError` codes: `AKP_NO_EXTRACTORS_REGISTERED`, `AKP_EXTRACTOR_AMBIGUOUS`, `AKP_EXTRACTOR_UNKNOWN`, `AKP_EXTRACTOR_PRODUCED_INVALID_OBJECT`, `AKP_OBJECTS_WRITE_FAILED`.
- 7 unit tests in `tests/unit/extraction/refresh.test.ts` covering registry edge cases, identity-based merge, orphan removal, and `--dry-run`.
- `validateObjectAgainstPack` and `validateRelationshipTargets` are now exported from `src/knowledge/read-objects.ts` so the refresh use case can validate extractor output before writing.

### Fixed

- CLI `--version` output (was hard-coded to `0.1.0-alpha.0` since the original commit and never updated as `package.json` advanced through `alpha.1`–`alpha.4`). Now reports `0.1.0-alpha.5`.

### Internal

- ESLint test override now also disables `@typescript-eslint/require-await` (fake AsyncIterables in test extractors don't await anything).

## [0.1.0-alpha.4] - 2026-04-28

### Fixed

- `CLAUDE.md` Architecture section now describes the `IndexedStore` and `CanonicalStore` interfaces shipped in `0.1.0-alpha.3`. The previous wording referred to `SqliteStore` directly with no mention of the new ports — same staleness pattern as the kysely fix in `0.1.0-alpha.2`.

## [0.1.0-alpha.3] - 2026-04-28

### Added

- `IndexedStore` interface in `src/store/sqlite/sqlite-store.ts` with `upsertMany`, `deleteMany`, and `replaceAll` write methods plus the existing read surface. `SqliteStore` now declares `implements IndexedStore`.
- `CanonicalStore` interface in `src/knowledge/read-objects.ts` plus a `makeJsonlCanonicalStore(objectsPath, schema)` factory that wraps the existing JSONL reader.
- `StoreStats` type alias on the public surface.
- Unit tests for `upsertMany`, `deleteMany`, and `makeJsonlCanonicalStore` in `tests/unit/store/sqlite-store.test.ts`.

### Internal

- `upsertMany` uses `INSERT … ON CONFLICT(id) DO UPDATE` for the `objects` table; clears `object_fts` and outgoing `relationships` rows for each replaced object before re-inserting (FTS5 has no native upsert).
- `deleteMany` removes objects, their outgoing **and** incoming relationships, and their FTS rows in a single transaction.
- No callers migrated to the new ports yet — that lands with the query/build slice in a later patch.

## [0.1.0-alpha.2] - 2026-04-28

### Fixed

- `CLAUDE.md` no longer claims `kysely` is part of the storage stack (it was removed in `0.1.0-alpha.1` but the architecture section was not updated).

### Added

- `npm run format` / `npm run format:check` and `npm run lint` (with `--max-warnings=0`) documented in `CLAUDE.md`.

## [0.1.0-alpha.1] - 2026-04-28

### Added

- Prettier configuration (`.prettierrc.json`, `.prettierignore`).
- ESLint flat config (`eslint.config.js`) with type-checked TypeScript rules and import-order enforcement.
- `format` and `format:check` npm scripts.
- CI now runs `lint`, `format:check`, and `test` in addition to `check` and `build`.

### Removed

- Unused `kysely` dependency.
- Unused `pino` dependency and dead `src/core/logging/logger.ts`.

## [0.1.0-alpha.0] - 2026-04-27

- Initial v0.1-alpha scaffold of the Artifact Knowledge Protocol.
- Typed knowledge envelope (`fact` / `convention` / `procedure`) with classification, exposure, provenance, and freshness.
- CLI verbs: `init`, `check`, `build`, `describe`, `lookup`, `get`, `neighbors`, `brief`, `freshness`.
- Read-only MCP server exposing the same read verbs.
- SQLite + FTS5 query store with a JSONL canonical store split.
