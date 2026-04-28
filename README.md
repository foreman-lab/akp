# AKP

AKP is the Artifact Knowledge Protocol: a protocol and local runtime for building Artifact Knowledge Bases and exposing them as secure, just-in-time reference layers to AI agents.

AKP lets an artifact ship with organization instructions, domain schemas, and knowledge-base operation rules. A local build compiles those instructions and artifact sources into typed objects, relationships, provenance, freshness metadata, indexes, and rendered human views. AI agents consume the accepted knowledge through a read-only MCP interface.

## Product Principles

- Security by design: local-first, least privilege, explicit classification, and read-only consumption by default.
- Structured objects are canonical; Markdown and diagrams are rendered views.
- The protocol defines the envelope, verbs, provenance contract, and lifecycle.
- Domain packs define the artifact-specific object types and extraction/authoring behavior.
- Agents query just-in-time instead of loading entire artifacts into context.

## Surfaces

```text
Knowledge Operation Surface
  CLI + skills + domain packs
  read/write, governed, reviewable

Knowledge Consumption Surface
  MCP server
  read-only, least privilege, agent-facing
```

## Planned CLI

```bash
akp init
akp build
akp inspect
akp lookup "payment authorization"
akp brief checkout
akp refresh
akp review
akp propose
akp accept <proposal-id>
akp reject <proposal-id>
akp restructure
akp check
akp render
akp mcp
akp audit
```

## v0.1 Working Slice

The current alpha supports a small but real AKP flow:

```bash
akp init
akp check
akp build
akp describe
akp lookup "checkout"
akp get module.checkout
akp neighbors module.checkout
akp brief checkout
akp freshness
akp mcp
```

For v0.1, `.akp/objects.jsonl` is the canonical authored object source and `.akp-local/akp.sqlite` is the generated local query store.

## Development

```bash
npm install
npm run build
npm run dev -- --help
```

This repository is currently a v0.1 alpha scaffold.
