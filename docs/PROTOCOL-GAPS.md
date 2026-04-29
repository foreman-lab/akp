# Protocol Gaps — Evidence from Non-Code Corpus Dogfood

Evidence trail for the validation step in `docs/STRATEGY.md` Phase A.4.
Captures what surfaces when v0.1's typed-envelope contract is asked to
represent knowledge that is **not** TypeScript source code.

This file is **input to `docs/PROTOCOL.md`** (Phase A.1) when that
spec is eventually drafted. The point is to ensure the spec is shaped
by two domains, not just the one v0.1 was built around.

## The exercise

Pick a non-code corpus already in the repository. For each document,
attempt to express it as a v0.1-shape AKP object — `id`, `type`,
`kind`, `summary`, `attributes`, `relationships`, `sources`,
`classification`, `exposure`, `provenance`, `freshness`,
`review_state`. Record where the protocol fits and where it strains.

**Corpus**: `docs/security.md` (42 lines), `docs/protocol-v0.1.md`
(68 lines), `docs/BACKLOG.md` (221 lines). Three different shapes:
a principles-and-definitions doc, a specification doc with embedded
examples, and a structured registry of deferred decisions.

**Date**: 2026-04-29 dogfood, post-`0.1.0-alpha.33`.

## Severity scale

- **Blocker**: the protocol cannot represent the corpus at all.
- **Major**: representable but the contract strains — likely produces
  inconsistent or lossy results across pack authors.
- **Minor**: small vocabulary or shape gaps that are easy to extend.

---

## Blockers

### B1 — No `body` field for prose

The envelope has `summary` (one-line string) and `attributes` (key-
value bag). Documents have **bodies** — paragraphs, bullet lists,
tables, embedded examples. There is nowhere for them to live.

`security.md` example: 7 principles, two definition tables, leading
paragraph. None of that fits in `summary`. Stuffing into `attributes`
defeats the typing.

This is fatal for any non-code corpus. v0.1's mechanical extractor
produces empty-body objects today (which is fine for "module at
src/foo/" placeholders); curated objects in the self-pack also have
empty bodies (their content is the _summary_ line, not real prose).
The whole repo has zero objects with substantial bodies because the
envelope makes them impossible.

**Fix direction**: add `body: string` (markdown) as a first-class
field. The substrate migration in STRATEGY.md (markdown + YAML
frontmatter) addresses this naturally — the markdown body of the
file IS the body of the object. The contract still needs explicit
documentation that `body` is canonical and may contain rendered
markdown including code fences.

### B2 — `kind` taxonomy is too narrow

v0.1 defines three kinds: `fact | convention | procedure`. The
corpus surfaced at least seven distinct shapes:

- **Definitions** — the 4 classification levels in `security.md`
  ("public means safe to expose openly").
- **Principles** — "Consumption MCP is read-only by default."
- **Specifications** — the JSON envelope in `protocol-v0.1.md` with
  field-level constraints.
- **Decisions** — each BACKLOG.md item documents a deferred decision
  with rationale, alternative paths, reopen triggers.
- **Explanations** — paragraphs that walk through _why_.
- **Runbooks** — "when X happens, do Y, then Z."
- **References** — citations to external resources.

Forcing these into three buckets is reductive. A spec is not a fact;
a decision-with-rationale is not a procedure.

**Fix directions** (no decision yet):

1. Expand to ~7-10 kinds. Risk: harder for pack authors to choose.
2. Make `kind` extensible per pack (each pack declares its kinds
   in its schema, AKP core only requires the field exists). Risk:
   loss of cross-pack uniformity.
3. Drop `kind` entirely; let `type` carry the full taxonomy. Risk:
   loses the cross-pack abstraction `kind` was meant to provide.

---

## Major

### M1 — No section-level addressing

An agent asking "what are the classification levels?" should land on
`security.md § Classification`, not the entire document. The protocol
has no way to address sub-objects.

Object-per-document is too coarse for non-trivial docs. Object-per-
section explodes object counts (BACKLOG.md alone would become 6
objects) and loses document-level coherence.

**Fix direction**: a `sections: [{anchor, title, body}]` substructure
on document-type objects, or first-class section objects linked to
their parent via a `part_of` relationship. Both have trade-offs;
either is workable; the contract needs a decision.

### M2 — No way to represent embedded examples / code blocks

`protocol-v0.1.md` contains a JSON envelope example and verb-signature
blocks. These are _part of the knowledge_, not separate objects.
v0.1's envelope has no `examples` or `snippets`, and no free-form
prose container that preserves code fences.

**Fix**: the markdown-body migration solves this directly — code
fences live inside the body. The contract needs to clarify that body
content is rendered markdown and may include fenced code, tables,
images, links, etc.

### M3 — Relationship vocabulary is code-shaped

v0.1 schema relationship types: `uses`, `tested_by`, `implements`,
`owns`, `exposes`, `governed_by`, `documents`. All code/architecture
flavored.

Docs need: `defines`, `references`, `supersedes`, `informs`,
`derived_from`, `cites`. None exist.

These can be added per-domain via the pack's schema, but the
**contract** has not clarified whether relationship types are:

- (a) scoped per pack (each pack declares its own vocabulary), or
- (b) shared globally (a curated registry every pack agrees on), or
- (c) hybrid (a small global core like `references`/`supersedes`,
  pack-specific extensions for the rest).

`docs/STRATEGY.md` says "schema-validated typed relationships" but
not which model. PROTOCOL.md must pick one.

### M4 — Lifecycle states are wrong for non-code

`review_state` values: `proposed | accepted | deprecated |
superseded`. Works for code-level knowledge and protocol decisions.
Misses document states:

- `draft` (being written)
- `in review` (waiting on reviewer)
- `current` (live, in use)
- `archived` (kept for history but not active)
- BACKLOG.md items: `deferred` with a reopen trigger — not in the
  vocabulary at all.

**Fix directions**:

1. Expand `review_state` values to a richer enum.
2. Add a separate `lifecycle` field with domain-specific values.
3. Make `review_state` per-pack (each pack declares its lifecycle
   states; AKP core requires the field).

### M5 — `verified_against` is code-shaped

Current shape: `[{kind: git_worktree, value: <commit-sha>}]`.

For docs, what does "verified" mean? Editorial review by whom?
Reviewed against what source-of-truth document? Under what
process?

Needs a richer verification vocabulary:

- `{kind: git_worktree, value: <sha>}` (existing — still valid for code)
- `{kind: editorial_review, reviewer: <handle>, reviewed_at: <ts>}`
- `{kind: source_doc, value: <uri>, version: <id>}`
- `{kind: external_authority, citation: <uri>}`

The contract today narrows verification to commit hashes; PROTOCOL.md
needs to broaden the vocabulary.

---

## Minor

### m1 — `provenance.confidence` is missing `synthesized`

Current values: `human-authored | mechanical | inferred`. The
Karpathy-style synthesis loop (LLM reads sources, writes a wiki page)
is a fourth distinct mode that deserves a name.

**Fix**: add `synthesized` to the enum. Trivial.

### m2 — `sources` shape is single-uri, single-role

Current shape: `[{source_kind, uri}]`. For docs that synthesize
from multiple inputs, each input has a different role:

- `primary` — the main thing this object describes
- `derived` — content was generated from this
- `citation` — referenced as evidence

**Fix**: add optional `role` and `range` fields:
`[{source_kind, uri, role?, range?}]`.

---

## What works in the current envelope

The exercise also validated that several v0.1 design choices are
right:

- **`classification` + `exposure`** map cleanly to docs.
  `security.md` is naturally `public/committed`; an internal runbook
  is `internal/committed`; a draft note is `internal/local-only`.
  These two fields are already domain-neutral.
- **`provenance.generated_by`** as a free-form string (e.g.
  `human:foreman-lab`, `ts-repo`, `synthesizer:gpt-x`) generalizes
  fine.
- **Typed `relationships`** — the _shape_ `[{type, category, target}]`
  is correct; the _vocabulary_ is what needs expansion.
- **`freshness.last_verified` + `status`** — the shape works if M5 is
  resolved; "verified" needs a doc-shaped meaning, then this field
  carries it.
- **`review_state`** — the _concept_ of an explicit lifecycle is
  right; the values are too narrow per M4.
- **`gaps` field on responses** (not on objects) — first-class "I
  don't know" stays valuable across all corpora.
- **Schema validation** — the pattern of "manifest declares pack
  schema, every object validates against it" is generic; the _specific_
  schema vocabulary is what differs per pack.

The structural backbone is right. The TS-shaped vocabulary baked
into specific fields is what needs revision.

---

## Implications for `docs/PROTOCOL.md`

When PROTOCOL.md gets drafted (Phase A.1), it must:

1. **Add `body: string` (markdown) as canonical.** Not optional.
   This is the single most important change.
2. **Decide the `kind` model**: expand, per-pack, or drop. State the
   choice and the rationale.
3. **Decide section-level addressing**: substructure-on-doc-objects
   vs first-class section objects with `part_of`. State the choice.
4. **Decide relationship vocabulary scoping**: pack-local vs global
   vs hybrid. State the choice.
5. **Expand `review_state`** to include doc lifecycle states (or
   introduce a separate `lifecycle` field).
6. **Generalize `verified_against`** beyond `git_worktree`.
7. **Add `synthesized` to `provenance.confidence`.**
8. **Add `role` to `sources`.**
9. **Document body content rules**: rendered markdown, allowed
   constructs (tables, fenced code, images), max size guidance.

PROTOCOL.md should also explicitly pick **two reference packs** for
its worked examples — code (a slimmed `ts-repo`) and a docs pack
that exercises body, sections, and the doc-shaped relationship and
lifecycle vocabularies. If the spec only shows code examples, it
will codify the same biases v0.1 carried.

## What this evidence does not yet cover

Things this dogfood didn't stress-test, that PROTOCOL.md drafting
should not assume are settled:

- **Multi-pack composition**: when two packs both contribute to one
  AKB, how do schemas merge, how are `id` namespaces partitioned,
  what happens on relationship-type collisions?
- **Remote sources**: AKP today reads local files only. A docs pack
  pulling from Notion or GitHub Issues introduces auth, caching,
  staleness semantics not present in the local case.
- **Synthesis loop integrity**: when an LLM rewrites a doc body
  during ingest, how does `verified_against` and human-author
  lineage stay intact? This is the biggest open design problem
  for the Karpathy-direction substrate.
- **Larger corpora**: the corpus tested here is ~700 lines total.
  Behavior at 10× and 100× scale (latency, ranking, brief budget
  exhaustion) is unmeasured.

These belong in PROTOCOL.md as explicit "v0.next deferred" or in
follow-up dogfood passes.

---

## Reopen / supersede

**Reopen**: when a third corpus (e.g. ADRs, runbooks, meeting notes)
is dogfooded and surfaces new gaps, append findings here rather than
in a new file.

**Supersede**: when `docs/PROTOCOL.md` lands and absorbs these
findings into the formal spec, mark this file as historical
(prepend a note pointing at the spec) but do not delete — it
remains the audit trail for _why_ the spec made the choices it did.
