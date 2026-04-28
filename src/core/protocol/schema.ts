import { z } from "zod";

export const objectKindSchema = z.enum(["fact", "convention", "procedure"]);
export const classificationSchema = z.enum(["public", "internal", "restricted", "confidential"]);
export const exposureSchema = z.enum(["committed", "local-only", "ephemeral"]);
export const confidenceSchema = z.enum([
  "mechanical",
  "llm-generated",
  "agent-proposed",
  "human-reviewed",
  "human-authored",
]);
export const reviewStateSchema = z.enum(["proposed", "accepted", "rejected"]);
export const freshnessStatusSchema = z.enum(["fresh", "stale-pending", "stale", "superseded"]);
export const relationshipCategorySchema = z.enum([
  "containment",
  "dependency",
  "reference",
  "evidence",
  "succession",
]);

export const sourceSchema = z.object({
  source_kind: z.string().min(1),
  uri: z.string().min(1),
  range: z
    .object({ kind: z.string().min(1) })
    .catchall(z.unknown())
    .optional(),
  hash: z
    .object({
      algorithm: z.enum(["sha256", "sha1"]),
      value: z.string().min(1),
    })
    .optional(),
});

export const relationshipSchema = z.object({
  type: z.string().min(1),
  category: z.string().min(1),
  target: z.string().min(1),
  attributes: z.record(z.unknown()).optional(),
});

export const knowledgeObjectSchema = z.object({
  id: z.string().min(1),
  type: z.string().min(1),
  kind: objectKindSchema,
  title: z.string().min(1).max(120),
  summary: z.string().min(1).max(500),
  attributes: z.record(z.unknown()).default({}),
  relationships: z.array(relationshipSchema).default([]),
  sources: z.array(sourceSchema).default([]),
  classification: classificationSchema,
  exposure: exposureSchema,
  provenance: z.object({
    generated_by: z.string().min(1),
    generated_at: z.string().datetime(),
    confidence: confidenceSchema,
    verified_against: z.array(
      z.object({
        kind: z.string().min(1),
        value: z.string().min(1),
      }),
    ),
  }),
  freshness: z.object({
    last_verified: z.string().datetime(),
    status: freshnessStatusSchema,
    superseded_by: z.string().optional(),
  }),
  review_state: reviewStateSchema,
  tags: z.array(z.string()).optional(),
});

export const manifestSchema = z.object({
  version: z.union([z.string(), z.number()]).transform((value) => String(value)),
  artifact: z.object({
    name: z.string().min(1),
    kind: z.string().min(1),
    description: z.string().optional(),
  }),
  sources: z
    .object({
      include: z.array(z.string()).optional(),
      exclude: z.array(z.string()).optional(),
    })
    .optional(),
  schema: z.string().min(1),
  objects: z.string().min(1).optional(),
  security: z.object({
    default_classification: classificationSchema,
    default_exposure: exposureSchema,
  }),
});

export const typeDefinitionSchema = z.object({
  kind: objectKindSchema,
  description: z.string().optional(),
  required_attributes: z.array(z.string()).optional(),
});

export const relationshipDefinitionSchema = z.object({
  category: relationshipCategorySchema,
  inverse: z.string().optional(),
  description: z.string().optional(),
});

export const packSchemaSchema = z.object({
  object_types: z.record(typeDefinitionSchema),
  relationship_types: z.record(relationshipDefinitionSchema).default({}),
});

export type KnowledgeObjectInput = z.input<typeof knowledgeObjectSchema>;
