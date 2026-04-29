# Backlog

Items deliberately deferred. Each entry pairs the original ask with the
reason it is _not_ in the current sprint, so future contributors can audit
the trade-off rather than re-derive it.

---

## Explicit ownership-transfer flag for `akp refresh` (e.g. `--adopt <id>`)

**Originated from:** Codex review 2026-04-29, Finding 2 (P2).

**Ask:** When `akp refresh` rejects an extractor emission because the id
already belongs to a preserved (human-authored or other-extractor) object,
expose a CLI affordance to deliberately transfer ownership — for example
`akp refresh --extractor ts-repo --adopt module.query`. Adoption must be
explicit, reviewable, and not automatic.

**Why deferred:** The protocol behavior in `0.1.0-alpha.23` (fail-closed
on collision via `AKP_OBJECT_ID_COLLISION`) is correct. The actual problem
the dogfood surfaced was a single content collision (`module.query`
curated vs mechanical), resolved as a content rename in
`0.1.0-alpha.32`'s self-pack patch (`module.query` →
`module.query-services`).

A general `--adopt` flag is well-scoped _as a feature_, but it is solving a
hypothetical multi-extractor / curated-vs-mechanical migration scenario
that has not materialized at v0.1's scale (one extractor, one collision in
the entire repo). Building it now means designing flag UX, deciding
whether adoption is recorded in canonical metadata, deciding whether
adoption is reversible, and adding tests for each pathway — substantial
surface for a problem with one historical occurrence.

**Reopen when:** A second collision shows up, or when a second extractor
ships and forces the multi-owner question.

**Related code:** `src/extraction/use-cases/refresh.ts` (collision detection),
`src/cli/index.ts` (would gain the flag).

---

## Read/write port split for the indexed store

**Originated from:** Codex review 2026-04-29, Finding 3 (P2).

**Ask:** Split the `IndexedStore` port into separate read and write
operations — e.g. `openExisting()` (read-only path used by CLI read
verbs and MCP) and `initializeForWrite()` (used by `build` and `refresh`).
Or split into two ports: `ReadableKnowledgeStore` and
`WritableKnowledgeStore`. Wire each container path to the appropriate
shape so type-level guarantees prevent accidental write-on-read.

**Why deferred:** `0.1.0-alpha.31` already closes the _behavioral_ gap by
making MCP refuse to start when the local store is unbuilt
(`requireBuiltStore: true`). After that fix, the actual security risk —
silent empty results being treated as authoritative absence of knowledge
— no longer exists. Codex's Finding 3 ask is for _type-level purity_ on
top of that, which is a real win but with zero observable behavior delta.

The split touches every CLI verb's container wiring (~10 call sites),
the `SqliteStore` constructor (currently does `mkdirSync` as a side
effect), and the `Container` type. Cost is several commits with no
test-observable behavior change.

**Reopen when:** A real bug occurs from an unintended write through a
read path, or before any extension of the protocol that introduces new
write surfaces (which would multiply the splits).

**Related code:** `src/runtime/build-container.ts` (Container shape),
`src/store/sqlite/sqlite-store.ts` (port + adapter), every CLI verb in
`src/cli/index.ts`.

---

## Default-plus-named import recognition in `extractImportedPortTargets`

**Originated from:** typescript-reviewer pass on `0.1.0-alpha.30`, second
finding.

**Ask:** Recognize `import Default, { BarPort } from "..."` so the named
port is captured. Today the regex requires `{` immediately after `import`
(plus optional `type`), so the default-plus-named form silently drops
the named imports.

**Why deferred:** Zero occurrences in the current codebase. False-negative
only — cannot produce phantom edges. Documented as a coarse-approximation
boundary; AST-aware per-factory dependency analysis is the long-term path.

**Reopen when:** A use-case file is added that uses
`import Default, { Port } from ...` shape and a `uses` edge is missed.

**Related code:** `src/extraction/extractors/ts-repo/index.ts`
(`extractImportedPortTargets`).

---

## ts-repo extractor imposes coding conventions on the host codebase

**Originated from:** Self-pack dogfood on 2026-04-29 + dialogue with the
project owner. After running `akp refresh -e ts-repo` for the first time,
only 1 of 4 actual ports in this repo were emitted (`port.file-system`).
The other three (`CanonicalStore`, `IndexedStore`, `SourceExtractor`) lack
the `<Name>Port` suffix and were silently skipped.

**Ask:** Decouple the `ts-repo` default extractor from any specific TS
coding style. Today it silently assumes:

- ports use the `<Name>Port` suffix
- use cases are `make<Name>` factory functions
- commands are commander-style `program.command(...)` calls
- use cases live under `src/**/use-cases/*.ts`

A team using `<Name>Repository`, class-based use cases, yargs/oclif/raw
`process.argv`, or any other idiom would silently get an empty AKB.
That's the inverse of "pluggable reference infrastructure for AI agents"
— it forces consumers to bend their codebase to the tool.

**Possible paths (no decision yet):**

1. **Manifest-driven config** — `extractors.ts-repo.port_suffixes:
[Port, Repository, Service]`, etc. Defaults match v0.1; teams override.
2. **Opt-in markers** — `// @akp:port`, `// @akp:use_case`, `// @akp:command`
   above declarations. Convention-free. Self-documenting in source.
3. **AST-based detection** — a port is whatever appears as a typed
   dependency of a use-case factory. More accurate, materially harder to
   implement than regex (needs `typescript` compiler API or `ts-morph`).
4. **Pack-per-ecosystem** — accept that `ts-repo` is one opinionated
   default and that other idioms ship their own extractors (the original
   AKP design intent). The cost is a heavy first-time bar for adopters
   whose codebase doesn't match any default.

**Why deferred:** v0.1 ts-repo is honest about its current limits — it
extracts what it claims to extract, no false positives. The 1-of-4 port
coverage on this repo is a true reflection of the suffix-only contract,
not a bug. Six cycles of regex iteration (alpha.24–30 + alpha.32) have
shown diminishing returns; each refinement adds heuristic complexity
without addressing the deeper question of which path above is right.
Real-user feedback ("my codebase doesn't match your defaults — what do I
do?") will sharpen the choice. Building for that feedback now is
anticipating instead of responding.

**Reopen when:** A real user (or a second internal codebase) reports that
their conventions don't match ts-repo's defaults. That signal tells us
which path is correct. Also reopen when a second built-in extractor is
added (Java/Go/Rust/Python), at which point shared infrastructure for
configurability vs per-extractor opinions becomes a real design question.

**Related code:** `src/extraction/extractors/ts-repo/index.ts` (every
detection regex), `tests/fixtures/ts-tiny-repo/` (would need
configuration-flag fixtures), `docs/protocol-v0.1.md` (would need an
"extractor configuration" section).
