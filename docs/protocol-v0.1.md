# AKP Protocol v0.1 Draft

## Object Kinds

AKP has three protocol-level object kinds:

```text
fact:
  extracted or attestable knowledge about the artifact

convention:
  authored prescriptive guidance scoped to the artifact

procedure:
  structured instructions for performing work with the artifact
```

Domain packs define specific object types under these kinds.

## Universal Object Envelope

```json
{
  "id": "module.checkout",
  "type": "module",
  "kind": "fact",
  "title": "Checkout",
  "summary": "Handles cart validation, order creation, and payment authorization.",
  "attributes": {},
  "relationships": [],
  "sources": [],
  "classification": "internal",
  "exposure": "committed",
  "provenance": {
    "generated_by": "human:unknown",
    "generated_at": "2026-04-27T00:00:00.000Z",
    "confidence": "human-authored",
    "verified_against": []
  },
  "freshness": {
    "last_verified": "2026-04-27T00:00:00.000Z",
    "status": "fresh"
  },
  "review_state": "accepted"
}
```

## Universal Read Verbs

```text
akp.describe()
akp.lookup(intent, scope?, limit?, kinds?)
akp.get(id)
akp.neighbors(id, categories?, depth?, limit?)
akp.brief(scope, budget_tokens?)
akp.freshness(scope?)
```

## Authoring Operations

Authoring is performed by CLI, skills, or reviewed proposal workflows. The consumption MCP server is read-only by default.

```text
akp.propose(object_draft)
akp.report_observation(object_id, observation)
akp.accept(proposal_id)
akp.reject(proposal_id)
```
