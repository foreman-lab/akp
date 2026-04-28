# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.1.0-alpha.26] - 2026-04-28

### Fixed

- **`ts-repo` extractor now matches `export async function make<Name>` factories.** The regex previously required the literal token `function` immediately after `export`, silently skipping async factories — an idiomatic shape for I/O-touching use cases. Pattern updated to `/^export\s+(?:async\s+)?function\s+make([A-Z]\w*)\b/gm`.
- Stale JSDoc on `tsRepoExtractor` listed `use_case` under "future TDD cycles" even though it shipped in `0.1.0-alpha.24`. Comment now reflects the three currently-emitted types and trims `use_case` from the future-work list.

### Internal

- Reviewer-pass follow-up on the alpha.24 cycle. Adds two new fixture factories: `makeAsyncOperation` (covers the regex fix) and `makeHTTPClient` (locks in already-correct consecutive-caps `kebabCase` behavior). 47/47 tests still pass.

## [0.1.0-alpha.25] - 2026-04-28

### Changed

- Self-pack schema (`.akp/schemas/code.yaml`) declares the new `use_case` object_type so `npm run dev -- refresh -e ts-repo` no longer fails with `AKP_OBJECT_TYPE_UNKNOWN` when the extractor emits use_case objects for this repo's own `src/{init,build,query,extraction}/use-cases/` factories. Pure data/schema patch — no code change.

## [0.1.0-alpha.24] - 2026-04-28

### Added

- **`ts-repo` extractor now emits `use_case` objects** for every exported `make<Name>` factory found under `src/**/use-cases/*.ts`. The id is the kebab-case of the factory's PascalName tail (`makeBuildKnowledgeBase` → `use_case.build-knowledge-base`, `makeRefresh` → `use_case.refresh`). Non-exported factories are skipped. Each emitted object carries `attributes.factory` (the factory name), a `file://` source URI to the defining file, `provenance.generated_by: "ts-repo"`, and `confidence: "mechanical"`. `produces_types` advertises `use_case` alongside `module` and `command`.

### Internal

- Phase 3 cycle 4 first increment. Dogfoods the hex refactor: every `make*UseCase` factory in this repo's own `src/{init,build,query,extraction}/use-cases/` becomes mechanically discoverable through the same path the TS extractor exposes. 47/47 tests pass (2 new integration tests in `tests/integration/extraction/ts-repo-extractor.test.ts`; fixture extended with `tests/fixtures/ts-tiny-repo/src/alpha/use-cases/index.ts` and a `use_case` object_type in `code.yaml`).

## [0.1.0-alpha.23] - 2026-04-28

### Fixed

- **`refresh` now fails-closed with `AKP_OBJECT_ID_COLLISION` when an extractor emits an id already owned by a preserved (non-extractor) canonical object.** Previously the use case would happily merge the two rows and pass them to `canonical.writeAll` + `indexed.replaceAll`, corrupting the JSONL canonical with duplicate ids and crashing the SQLite primary key. The error now lists each colliding id with its preserved owner so the user can resolve manually (delete the conflicting object or rename one). Both eager and `--dry-run` paths fail at the same point — no writes happen on collision.
- **`makeJsonlCanonicalStore.writeAll` now rejects duplicate-id inputs with `AKP_OBJECT_DUPLICATE` before the temp-file write begins.** Defense in depth: even if a future caller sidesteps the refresh-level check, the canonical adapter no longer trusts its input blindly. The atomic temp+rename guarantee is preserved — validation runs before any disk I/O.

### Discovered via

- Self-pack dogfood (`npm run dev -- refresh -e ts-repo`) on this repo, where `ts-repo` would emit `module.query`, `module.cli`, etc. — colliding with human-authored canonical entries describing the same modules. Adds three regression tests (45 total; previously 42).

## [0.1.0-alpha.22] - 2026-04-28

### Fixed

- `tolerateExisting` in `src/init/use-cases/index.ts` now narrows the caught value with `instanceof Error` before reading `.code`, replacing a bare `as NodeJS.ErrnoException` cast that bypassed the type system. Same behavior — only `EEXIST` is swallowed — but no longer relies on a structural cast to a Node-only interface.
- Comment in `src/mcp/server.ts` around `transport.onclose` now scopes the WAL-recovery claim to "read-only server." If a write verb is ever added through MCP, the comment instructs the next contributor to add a SIGTERM/SIGINT dispose handler instead of inheriting the WAL fallback.

### Internal

- Both fixes from the typescript-reviewer pass on the alpha.13–alpha.21 hex refactor cycle. 42/42 tests still pass.

## [0.1.0-alpha.21] - 2026-04-28

### Changed

- **Renamed `AkpError` to `AppError`** and the source file `src/core/errors/akp-error.ts` to `src/core/errors/app-error.ts`, completing the naming-neutral cleanup started in `0.1.0-alpha.20`. The class name carried the project brand into every throw site; `AppError` is the saved-memory canonical example of the rule (`feedback_naming_neutral_class_types`). Error `code` strings (`AKP_*`) are constants — they stay branded per the rule. 11 source/test files updated; CLI/MCP behavior unchanged.

### Internal

- Pure rename, no behavior change. 42/42 tests still pass. Historical `AkpError` references in this CHANGELOG are preserved as accurate history.

## [0.1.0-alpha.20] - 2026-04-28

### Changed

- **Renamed `InitAkp*` to `InitKnowledgeBase*`** to comply with the project's naming-neutral rule (saved memory: `feedback_naming_neutral_class_types`). Affected symbols in `src/init/use-cases/index.ts`: `makeInitAkp` → `makeInitKnowledgeBase`, `InitAkpInput` → `InitKnowledgeBaseInput`, `InitAkpResult` → `InitKnowledgeBaseResult`, `InitAkpUseCase` → `InitKnowledgeBaseUseCase`. Matches the existing siblings `BuildKnowledgeBase` / `CheckKnowledgeBase` / `LookupKnowledge` / `BriefKnowledge`. Constants (`AKP_DIR`) and CLI verbs (`akp init`) keep the brand per the rule.

### Internal

- Pure rename, no behavior change. 42/42 tests still pass. Open follow-up: same rule applies to `AkpError` (saved memory's canonical example) — landing as `0.1.0-alpha.21` in a separate commit since it touches ~30 throw sites.

## [0.1.0-alpha.19] - 2026-04-28

### Added

- `tests/helpers/fakes.ts` — shared in-memory test fakes consolidating `makeFakeProject`, `makeFakeSchema`, `makeFakeIndexed`, `makeFakeCanonical`, `fakeObject` from across the unit test suite. All synthetic — uses literal absolute path `/synthetic-akp-test-fixture` that never resolves to a real filesystem location and fixed ISO 8601 dates `2026-04-27T00:00:00.000Z`.

### Changed

- `tests/unit/query/use-cases.test.ts` and `tests/unit/build/use-cases.test.ts` now import the shared fakes instead of defining local copies. `tests/unit/extraction/refresh.test.ts` and `tests/unit/store/sqlite-store.test.ts` keep their existing local helpers — they exercise real adapters (`SqliteStore` against tmp files) and don't fit the fake shape.
- `src/extraction/extractors/ts-repo/index.ts` switches from a module-scope global-flag regex (`COMMAND_PATTERN.exec` loop) to a function-local regex with `String.prototype.matchAll`. Removes a latent footgun: stateful `lastIndex` carrying across calls if iteration ever exits early.

### Internal

- This commit closes the Tier 1+2 cleanup batch from the typescript-reviewer pass on the hex refactor. **Skipped from the original plan:** the SqliteStore "constructor doesn't open SQLite" refactor — re-evaluated as busywork without the deferred `buildIntrospectionContext` variant; the constructor-side-effect concern only matters in code paths that don't exist yet.
- Test count unchanged at 42/42; both consolidation and `matchAll` are pure refactors with characterization tests carrying the load.

## [0.1.0-alpha.18] - 2026-04-28

### Fixed

- Prettier formatting catch-up on `tests/unit/init/use-cases.test.ts`. Prettier's auto-fix ran after the RED commit (`df09ee7`) and reformatted a multi-line `writeFile` signature to fit on one line, but the GREEN impl commit (`42de555`) didn't include that change. CI would have failed `format:check` on either commit. This commit aligns the committed file with the working-tree formatting. Process note: when split-committing TDD pairs, run `format:check` between commits and fold any formatting catch-ups into whichever commit owns the file.

## [0.1.0-alpha.17] - 2026-04-28

### Added

- **`init` CLI verb migrated to the use-case + port pattern.** The last legacy free-function verb is gone. New `FileSystemPort` interface in `src/init/use-cases/index.ts` (`mkdir` + `writeFile`); `makeInitAkp(fs)` factory consumes the port. Production adapter `nodeFileSystem()` in `src/init/adapters/node-fs.ts` delegates to `node:fs/promises`.
- 3 unit tests in `tests/unit/init/use-cases.test.ts` exercising `init` against an in-memory `FakeFileSystem` — **zero production filesystem access**. Tests run against the literal synthetic path `/synthetic-akp-init-fixture` which never resolves to a real fs location.

### Changed

- `akp init` CLI action no longer calls a free function; it constructs the use case with the production `FileSystemPort` adapter and executes against `path.resolve(process.cwd())`.

### Removed

- `src/init/init-akp.ts` — the legacy free function with direct `mkdir`/`writeFile` calls.

### Internal

- **First strict-TDD pair commit on the project**, applying the rule adopted in `0.1.0-alpha.16`: the failing test commit (`df09ee7`) lands separately from the impl commit. Red is now auditable in the commit graph (`npm run check` against `df09ee7` shows TS2307; same against this commit shows green). Test count 39 → 42.
- Every CLI verb now flows through either `buildContainer` (for ProjectContext-bound verbs) or a use-case + port adapter (for `init`). No verb constructs adapters inline anymore.

## [0.1.0-alpha.16] - 2026-04-28

### Fixed

- **`CLAUDE.md` Architecture section was stale yet again** — third occurrence of this drift pattern (caught at alpha.2 for kysely, alpha.4 + alpha.7 for ports, now alpha.16 for the use-case migration). The Operation Surface paragraph still claimed verbs map to `src/check/` and a `query/` module of free functions; both were removed in the alpha.14/alpha.15 hex refactor. Now describes the actual shape: thin CLI + MCP inbound adapters → `buildContainer` → use cases.
- Added a JSDoc note on `Container.dispose()` documenting that it is idempotent.
- Added a comment in `src/mcp/server.ts` explaining that `transport.onclose` only fires on a clean protocol shutdown — abrupt termination relies on OS handle reclamation, which better-sqlite3 in WAL mode recovers from cleanly.

### Internal

- Driven by an independent typescript-reviewer pass on the alpha.13/14/15 hex refactor commits. Reviewer also flagged: (a) `describe`/`check` open SQLite when they don't need it (deferred — needs a `buildIntrospectionContext` variant; substantive enough for its own cycle); (b) the `briefKnowledge` summary regex `/Found 2/` is too loose to catch format regressions (logged for a docs/tightening pass).
- **Process improvement adopted for future strict-TDD claims:** to make red→green sequencing auditable from the commit graph, future TDD cycles should split into a test-only commit and an impl-only commit. The reviewer correctly pointed out that landing both in one commit makes the "TS2307 was the red signal" claim unverifiable from outside the working session.

## [0.1.0-alpha.15] - 2026-04-28

### Added

- `makeBuildKnowledgeBase({project, canonical, indexed})` and `makeCheckKnowledgeBase({project, canonical})` factories in `src/build/use-cases/index.ts`. Build orchestrates `canonical.readAll()` → `indexed.replaceAll()` → `indexed.stats()`. Check is the same minus the indexed write. Both result types exported.
- 2 fakes-based unit tests in `tests/unit/build/use-cases.test.ts` (TDD red→green: TS2307 was the failing-import red signal).
- `Container.useCases.build` and `Container.useCases.check`.

### Changed

- `akp build` and `akp check` actions migrate to the container + use-case pattern (same as the read verbs in `0.1.0-alpha.14`).
- `tests/integration/build/build-knowledge-base.test.ts` and `tests/e2e/cli/cli.test.ts` no longer import the legacy free function — both now use `buildContainer` and call `useCases.build.execute()`.

### Removed

- `src/build/build-knowledge-base.ts` (replaced by `makeBuildKnowledgeBase`).
- `src/check/check-knowledge-base.ts` (replaced by `makeCheckKnowledgeBase`). The empty `src/check/` directory is gone — check now lives under `src/build/use-cases/` since the two operations share the same dep set minus the indexed write.

### Internal

- This is **step 6** (the final step) of the pre-cycle-4 hex-architecture refactor. Every CLI verb except `init` (deferred — it doesn't need ports today) now flows through the composition root. Test count 37 → 39.
- After this commit the project has a single uniform pattern: ports declared next to adapters, use cases injecting ports as deps, a single composition root, two thin inbound adapters (CLI + MCP) consuming use cases via the container.

## [0.1.0-alpha.14] - 2026-04-28

### Added

- **Six read use-case factories** in `src/query/use-cases/index.ts`: `makeDescribeKnowledgeBase`, `makeGetObject`, `makeLookupKnowledge`, `makeGetNeighbors`, `makeGetFreshness`, `makeBriefKnowledge`. Each takes ports as constructor deps and returns a typed `{execute(input?): result}` object. Result types and inputs all exported.
- 7 use-case unit tests in `tests/unit/query/use-cases.test.ts` exercising each factory against fake `IndexedStore` / `ProjectContext` ports (TDD red→green: TS2307 was the failing-import red signal before the factories were written).
- `Container.useCases` now exposes the six read use cases plus the existing `refresh`.

### Changed

- **`akp` CLI** verbs `describe`, `lookup`, `get`, `neighbors`, `brief`, `freshness` no longer call legacy free functions; each now `await buildContainer(cwd, {requireBuiltStore})` then `useCases.<verb>.execute(...)` inside a try/finally that disposes. Read verbs preserve `AKP_STORE_NOT_BUILT` via `requireBuiltStore: true`; `describe` doesn't (works without a build, like before).
- **MCP server** holds **one** container for the lifetime of the stdio process — built once at `startMcpServer` start, disposed on `transport.onclose`. Previously the legacy free functions opened/closed a fresh SQLite handle per tool call.
- E2E test `tests/integration/query/query-before-build.test.ts` now exercises the migration target (`buildContainer` with `requireBuiltStore: true`) instead of the deleted legacy `lookupKnowledge`.

### Removed

- `src/query/query-knowledge-base.ts` — the 79-line god-file with six functions sharing a copy-pasted `new SqliteStore → initialize → try → method → finally close` template. All six callers (CLI + MCP + 2 tests) migrated to the use-case + container pattern.

### Internal

- This is **steps 2 + 3 + 4 + 5** of the pre-cycle-4 hex-architecture refactor (started in `0.1.0-alpha.13`). `build/`, `check/`, `init/` migration is the remaining step (`0.1.0-alpha.15`).
- Test count 30 → 37.

## [0.1.0-alpha.13] - 2026-04-28

### Added

- **Composition root** at `src/runtime/build-container.ts`. `buildContainer(cwd, opts?)` loads `ProjectContext`, wires `CanonicalStore` + `IndexedStore` + extractors + use cases, and returns a single `Container` with `dispose()` for resource cleanup. The optional `requireBuiltStore` flag preserves the `AKP_STORE_NOT_BUILT` fail-fast for read paths.

### Changed

- `akp refresh` action no longer inlines its own wiring; uses `buildContainer(...)` and calls `container.useCases.refresh.execute(...)` inside a `try/finally` that disposes the container. Behaviorally identical (`refresh --dry-run` against the AKP self-pack still reports identity-based merge counts), but now the SQLite handle is tracked through one well-defined lifetime instead of being opened/closed inline.

### Internal

- This is **step 1 of the Phase 3 hex-architecture refactor** (pre-cycle-4 consolidation). Steps 2–6 will migrate the read verbs (`lookup`/`get`/`neighbors`/`brief`/`describe`/`freshness`) and the build/check verbs onto the same composition root + use-case pattern, then delete the legacy `src/query/query-knowledge-base.ts` god-file. The 11 module count under `src/` ticked from 10 → 11 because `src/runtime/` is now a top-level module — visible in the dogfood `refresh --dry-run` output (11 modules + 12 commands = 23 candidates added).

## [0.1.0-alpha.12] - 2026-04-28

### Fixed

- **Commander argument syntax produced malformed command ids** (caught by the fourth self-review pass). `program.command("get <id>")` was previously captured verbatim, yielding `command.get <id>` (literal space + angle brackets in the id). Fixed by stripping the captured string to its first whitespace-separated token. Closed via strict TDD: added `program.command("echo <message>")` to the fixture, watched the existing strict-equality test fail with `'command.echo <message>'` (red), then added the `.split(/\s+/)[0]` post-processing in the extractor (green).
- **`CLAUDE.md` was stale again** — the Architecture section still described command extraction as "future TDD cycles extend it to symbol level (`command`, `function`, ...)" even though command extraction shipped in `0.1.0-alpha.11`. Same staleness pattern caught at alpha.2 and alpha.4. Now describes the actual shipped behavior including the argument-syntax normalization.

### Internal

- Mostly strict-TDD: failing assertion → minimum impl change → green. The fix is one-line (`captured.split(/\s+/)[0]`) but bracketed by a real red-green cycle.

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
