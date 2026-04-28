# Security By Design

AKP treats artifact knowledge as potentially sensitive. The default posture is local-first, read-only consumption, least privilege, explicit classification, provenance-backed trust, and fail-closed access when exposure is unclear.

## Core Security Principles

- Consumption MCP is read-only by default.
- Authoring and mutation require explicit operation workflows.
- Artifact content is not uploaded by default.
- Objects carry classification and exposure metadata.
- Secret and PII protection are part of build and validation.
- Provenance and freshness are required for operational trust.
- Agents propose knowledge updates; reviewed workflows accept them.

## Classification

```text
public:
  safe to expose openly

internal:
  safe inside the organization or project team

restricted:
  limited to specific roles, teams, or environments

confidential:
  highest sensitivity; expose only with explicit policy
```

## Exposure

```text
committed:
  allowed in source-controlled .akp files

local-only:
  generated or stored locally; not committed

ephemeral:
  temporary runtime result; not persisted
```
