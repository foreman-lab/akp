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
