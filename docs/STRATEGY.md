# AKP Strategy

The position, the principles, and the reasoning behind major decisions.
This is the anchor document — when future sessions debate "should we
build X?", the answer should be derivable from here.

## What AKP is

**AKP is agent-agnostic infrastructure for typed knowledge bases.**

Concretely: a protocol contract (typed envelope, schema, relationships,
classification) plus standard consumption surfaces (CLI, MCP) that any
AI agent — Claude, Codex, Copilot, Cursor, whatever ships next — can
read from, with stronger guarantees than markdown-only or RAG-based
alternatives provide.

It is **not** a competing product against codegraph, Notion, Confluence,
NotebookLM, Mintlify, or any specific tool. It is the substrate on top
of which such tools' equivalents can be built as modules.

## What AKP is not

- **Not a code-intelligence tool.** That lane is well-served by codegraph
  and similar AST-based indexers. AKP composes with them; it does not
  replace them.
- **Not an agent.** It does not call LLMs to answer questions. It
  exposes typed knowledge to whatever agent calls it.
- **Not RAG.** It does not chunk and embed. Knowledge is typed objects
  with explicit relationships, not similarity-ranked text chunks.
- **Not a wiki UI.** No web frontend, no editor. The substrate is
  markdown + YAML frontmatter, browseable in any markdown tool
  (Obsidian, GitHub, plain editor). AKP doesn't ship a UI of its own.
- **Not vendor-locked to any agent.** Standard CLI + MCP are the only
  surfaces. AKP must never auto-modify any agent-specific config file
  (e.g. `~/.claude/CLAUDE.md`) on install.

## Core principles

1. **Generic core, specialized modules.** The protocol stays domain-
   neutral. Modules (extractors + schemas) handle domain specifics.
   A codegraph-equivalent code-intelligence module sits at the same
   level as a docs module, an ADR module, a runbook module.

2. **Agent-agnostic by construction.** The CLI is shellable from any
   agent. The MCP server speaks the standard protocol. No agent-
   specific tool naming, no agent-specific config injection. AKP must
   work the day a brand-new MCP-speaking agent ships, with zero
   AKP-side changes.

3. **Infrastructure value, not feature value.** AKP wins on guarantees
   that no popular alternative provides — provenance, freshness,
   classification, exposure, review-state, schema-validated typed
   relationships. Not on UX features that depend on a particular
   agent's affordances.

4. **Read-only consumption.** Authoring goes through the operation
   surface (CLI + reviewed pipelines). The consumption surface (MCP)
   never mutates accepted knowledge. This is a security primitive,
   not a feature.

5. **Honest about gaps.** First-class "I don't know" — `gaps` field on
   responses, `review_state`, `freshness.status`, `verified_against`.
   The system can declare absence; it does not hallucinate to fill it.

## Why typed envelope is the differentiator

Compared to the popular alternatives:

| Capability                                  | RAG       | Karpathy Wiki         | Codegraph                     | AKP                |
| ------------------------------------------- | --------- | --------------------- | ----------------------------- | ------------------ |
| Typed envelope                              | ✗         | ✗                     | partial (file freshness only) | ✓                  |
| Provenance contract                         | ✗         | weak (file links)     | weak                          | ✓                  |
| Classification / exposure                   | ✗         | ✗                     | ✗                             | ✓                  |
| Review state (proposed/accepted/deprecated) | ✗         | ✗                     | ✗                             | ✓                  |
| `verified_against` for trust drilling       | ✗         | ✗                     | ✗                             | ✓                  |
| Schema-validated relationships              | ✗         | weak (markdown links) | strong (call graph)           | ✓                  |
| Read-only security boundary                 | ✗         | ✗                     | ✗                             | ✓                  |
| `gaps` / "I don't know" primitive           | ✗         | ✗                     | ✗                             | ✓                  |
| Domain neutrality                           | code+docs | any                   | code only                     | any                |
| Human-readable substrate                    | source    | markdown              | ✗                             | markdown (planned) |
| Agent-readable                              | yes       | yes                   | yes (MCP)                     | yes (MCP)          |
| Natural-language search                     | strong    | strong (qmd)          | strong                        | weak (FTS5 only)   |
| Synthesis/accumulation loop                 | ✗         | ✓                     | ✗                             | planned            |

AKP wins the **infrastructure guarantees** column. It does not yet
win on natural-language retrieval or synthesis — those are real gaps
captured in the roadmap below.

## Why RAG is structurally inadequate

Recorded in detail because the question "should AKP just be a RAG
wrapper?" will keep coming up. The answer is no, for these reasons:

- **Stateless re-derivation.** No accumulation; each query starts from
  zero. Subtly different chunks every run. Not auditable.
- **No provenance, classification, exposure, or review-state.** Vector
  similarity has no notion of trust, jurisdiction, or freshness.
- **Chunking destroys structure.** Splits the very relationships that
  make knowledge useful. "Why is X dangerous? → Because Y." routinely
  end up in different chunks; retriever returns one, never both.
- **No graph traversal.** Cosine similarity isn't transitive the way
  knowledge dependencies are.
- **No "I don't know" signal.** When retrieval returns nothing
  relevant, RAG systems still answer — they hallucinate. There is no
  protocol-level mechanism to refuse the absence.
- **Bad at enumeration questions.** Top-k similar is wrong for "list
  every X."
- **No update/supersession semantics.** Adding/updating a source =
  re-embed. There's no first-class fact-replaces-fact relation.
- **Non-deterministic.** Same query, same docs, same model can yield
  different output across runs. Disqualifying for auditable contexts
  (compliance, financial, medical, security review).

These are **structural** mismatches, not implementation gaps. Patching
them individually (rerankers, hybrid search, metadata filters) yields
workarounds for the deeper category error: **knowledge is a typed graph
with provenance and trust boundaries; RAG is similarity search**.

## Substrate decision: markdown + YAML frontmatter

The canonical format will migrate from JSONL to markdown + YAML
frontmatter. Reasoning:

- **Human readability** without an AKP-specific tool. Open in any
  editor, browse in Obsidian, render on GitHub.
- **Agent readability** without an AKP-specific format library.
  Markdown is in every LLM's training set. `Read` on a `.md` is
  universal across agent toolchains.
- **Frontmatter carries the typed envelope** — provenance, freshness,
  classification, exposure, review_state, relationships, sources.
  YAML is mature, validatable, and compatible with Obsidian's Dataview,
  GitHub Action workflows, and editor tooling.
- **Body holds the human-readable narrative** that mechanical
  extraction currently leaves empty and that the synthesis loop will
  fill.

The SQLite + FTS5 layer becomes a **derived index**, rebuilt from
the markdown corpus. It is not the canonical.

This is the Karpathy-Wiki direction: the wiki is the artifact;
the index is bookkeeping.

## What v0.1 actually was

v0.1 (`0.1.0-alpha.1` through `0.1.0-alpha.33`) was **a working
protocol shell** — typed envelope in JSONL, validation, refresh,
build, MCP read-only surface, one reference module (`ts-repo`),
self-pack as evidence, ~56 tests, dogfood loop closed.

It was **not** a shippable knowledge product. The dogfood (running
the full stack against AKP itself) revealed:

- Mechanical extraction is shallow; most value comes from human
  curation. Fine for a demo, not enough for a product.
- FTS5 keyword search misses on natural-language queries (no
  stemming, no embeddings).
- JSONL is not human-readable; adoption is gated on a substrate
  change.
- Six cycles refining the `ts-repo` extractor's regex was
  overinvesting in one demo module while the protocol contract
  remained under-specified.

The right framing: v0.1 proved the protocol _can_ hold typed
knowledge end-to-end. It did not prove the protocol _is right_
for anyone other than its author, on anything other than its
own source code.

## Roadmap shape (post-v0.1)

Not a release plan; a sequencing of the work.

### Phase A — Lock the protocol

1. Author `docs/PROTOCOL.md` as the authoritative spec for the
   envelope, schema, extractor port, and MCP consumption contract.
   Stable enough that arbitrary modules can target it without
   re-reading source.
2. Migrate canonical from JSONL to markdown + YAML frontmatter.
   SQLite/FTS5 becomes a derived index.
3. Slim `ts-repo` to a thin reference module — its job is to
   demonstrate the protocol, not to compete with codegraph.
4. Validate on a non-code corpus. Pick one: ADRs, runbooks, the
   project's own `docs/` directory. If AKP can't represent that
   corpus well, the protocol is wrong and needs revision before
   (First pass done 2026-04-29 against this repo's `docs/`. Findings
   recorded in [`docs/PROTOCOL-GAPS.md`](./PROTOCOL-GAPS.md) — read
   that file before drafting `PROTOCOL.md`.)
   anything else is built.

### Phase B — Adoption ergonomics

5. One-command bootstrap (`npx @foreman-lab/akp init`).
6. File watcher with debounced auto-refresh. Manual `refresh`
   becomes the exception.
7. Task-shaped MCP tools (`akp.explore`, `akp.trace`, etc.)
   layered on the primitive verbs. Tools should answer tasks,
   not expose graph operations.
8. Benchmark suite: tool-call count, token consumption,
   time-to-answer on a basket of real corpora (code AND non-code).
   Match the standard codegraph established.

### Phase C — Closing the natural-language gap

9. Hybrid search: FTS5 + embeddings + reranking, behind a
   pluggable retrieval interface. Stemming and morphological
   expansion as a baseline; embeddings for semantic match.
10. Synthesis loop: an agent-driven workflow where the LLM reads
    sources and writes/updates markdown pages, with provenance
    and freshness updated automatically. The `answers→knowledge`
    loop Karpathy describes becomes operational.

### Phase D — Module ecosystem

11. Reference modules: code (tree-sitter-based, possibly wrapping
    codegraph), docs, ADRs, runbooks. At least three working,
    composable in one AKB.
12. Module discovery and registration protocol. Domain packs ship
    independently of AKP core.

## Reference: codegraph

[Codegraph](https://github.com/colbymchenry/codegraph) is the
canonical example of a well-executed agent-agnostic infrastructure
tool in an adjacent space (semantic code intelligence). Treat it as
**a module-quality reference**, not as competition.

### What AKP adopts from codegraph's methodology

When module-building starts (Phase D), the code-intelligence module
should follow codegraph's pattern:

- **Tree-sitter for AST extraction** across many languages, not
  language-specific regex.
- **File watcher with native OS events** (FSEvents/inotify/
  ReadDirectoryChangesW) for live freshness.
- **Task-shaped MCP tools** that return integrated answers in one
  call — not primitive graph operations the agent has to compose.
- **Benchmark-first validation** — quantify tool calls, tokens,
  latency on real codebases before claiming value.
- **One-command install** (`npx <package>`).

These should arrive in AKP at the protocol layer (Phase B) so all
modules inherit them, not just the code module.

### What AKP does not adopt

- **Code-only scope.** AKP is generic by design.
- **Thin envelope.** Codegraph has freshness; AKP needs all of
  provenance/freshness/classification/exposure/review-state/sources
  as first-class.
- **Auto-injection into agent config files.** Codegraph writes to
  `~/.claude/CLAUDE.md` and `~/.claude.json` during install for
  adoption velocity. AKP must not — that breaks agent-agnostic
  positioning. The MCP server is discoverable but never
  installs itself into a specific agent.
- **"Trust the index, never read files."** Codegraph's pitch is
  the agent stops reading source. AKP's `verified_against` and
  `freshness.status` give the agent a contract for _when_ to trust
  the cache vs drill to source. More honest for infrastructure
  others depend on.

### Possible composition

A future `code-intelligence-module` for AKP could wrap codegraph
directly — read its index, lift its symbols/calls into AKP's
typed envelope (provenance: codegraph, freshness: from codegraph
file watcher, classification inherited from manifest), and surface
the unified knowledge through AKP's MCP. Demonstrates "compose
with best-of-breed" rather than "rebuild everything."

## Non-goals

Things explicitly outside AKP's scope:

- A web UI or hosted service. Markdown + git is the substrate;
  any UI is somebody else's module/integration.
- An LLM-calling API. AKP exposes knowledge; agents bring their
  own LLM.
- Replacing IDE search, grep, or file-reading tools. AKP
  augments the agent's toolchain with _trustworthy structured
  knowledge_; it doesn't try to be the only retrieval surface.
- Real-time collaboration / multi-writer concurrency. Git is the
  collaboration model.
- A hosted vector index. Local SQLite is the substrate; embeddings
  (when added) are local.

## Open questions

Tracked here so they don't get lost:

- **What's the right unit of "module"?** Today an extractor is
  one factory function. Should modules also bring their own schema
  fragments, MCP tool extensions, lint rules?
- **How are conflicts between modules handled?** Two modules
  emitting the same `id` is currently a hard error. Is there a
  multi-owner or merge model worth designing?
- **Should AKP support remote sources?** All current sources are
  local files. Pulling from Notion, Confluence, GitHub Issues
  expands scope significantly. Is that AKP's job or a module's?
- **How does the synthesis loop avoid drift?** If the LLM rewrites
  pages on every ingest, how do we keep `verified_against` and
  the human-author trust lineage intact?

These get answered as the work in Phases A–D surfaces evidence.

## Decision-making heuristic

When evaluating a proposed feature or refactor, ask:

1. Does it serve the protocol contract, or does it serve one
   specific module's needs? _Protocol changes are expensive;
   module changes are not._
2. Does it work for non-code knowledge as well as code? _If not,
   it belongs in a module, not the core._
3. Does it preserve agent-agnostic operation? _Anything that
   couples to one agent's idioms is wrong._
4. Does it strengthen the typed-envelope guarantees, or weaken
   them? _Weakening is a non-starter; strengthening earns
   priority._
5. Is there a benchmark that quantifies the value? _Without one,
   the feature is speculative._

If a proposed change fails on (1)–(4), reject. If it passes (1)–(4)
but fails (5), it's research, not roadmap.
