# AKP Architecture v0.1

AKP defines an Artifact Knowledge Base: a governed, provenance-backed reference system about an artifact, with safe read access for AI agents and controlled authoring/update workflows for humans and tools.

## High-Level Flow

```text
Artifact sources
  -> AKP operation tools
  -> canonical structured knowledge store
  -> local indexes and rendered views
  -> read-only MCP reference interface
  -> AI agents
```

## Canonical Knowledge

Canonical knowledge is represented as typed objects and typed relationships. Each object carries provenance, freshness, classification, exposure, and review state.

## Operation Surface

The operation surface is responsible for setup, build, refresh, review, restructure, validation, rendering, and audit.

## Consumption Surface

The consumption surface is a read-only MCP server. It exposes schema discovery, intent-based retrieval, object lookup, relationship traversal, scoped overview, and freshness checks.

## Lifecycle Modes

```text
refresh:
  mechanical, frequent, automatic where possible

review:
  human-in-loop, scoped, used for proposals and drift

restructure:
  schema or organization migration, rare and deliberate
```
