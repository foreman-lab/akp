export type ObjectKind = "fact" | "convention" | "procedure";

export type Classification = "public" | "internal" | "restricted" | "confidential";

export type Exposure = "committed" | "local-only" | "ephemeral";

export type Confidence =
  | "mechanical"
  | "llm-generated"
  | "agent-proposed"
  | "human-reviewed"
  | "human-authored";

export type ReviewState = "proposed" | "accepted" | "rejected";

export type FreshnessStatus = "fresh" | "stale-pending" | "stale" | "superseded";

export type RelationshipCategory =
  | "containment"
  | "dependency"
  | "reference"
  | "evidence"
  | "succession";

export interface SourceRange {
  kind: string;
  [key: string]: unknown;
}

export interface Source {
  source_kind: string;
  uri: string;
  range?: SourceRange | undefined;
  hash?:
    | {
        algorithm: "sha256" | "sha1";
        value: string;
      }
    | undefined;
}

export interface Relationship {
  type: string;
  category: RelationshipCategory | string;
  target: string;
  attributes?: Record<string, unknown> | undefined;
}

export interface Provenance {
  generated_by: string;
  generated_at: string;
  confidence: Confidence;
  verified_against: Array<{
    kind: string;
    value: string;
  }>;
}

export interface Freshness {
  last_verified: string;
  status: FreshnessStatus;
  superseded_by?: string | undefined;
}

export interface KnowledgeObject {
  id: string;
  type: string;
  kind: ObjectKind;
  title: string;
  summary: string;
  attributes: Record<string, unknown>;
  relationships: Relationship[];
  sources: Source[];
  classification: Classification;
  exposure: Exposure;
  provenance: Provenance;
  freshness: Freshness;
  review_state: ReviewState;
  tags?: string[] | undefined;
}

export interface Manifest {
  version: string;
  artifact: {
    name: string;
    kind: string;
    description?: string | undefined;
  };
  sources?:
    | {
        include?: string[] | undefined;
        exclude?: string[] | undefined;
      }
    | undefined;
  schema: string;
  objects?: string | undefined;
  security: {
    default_classification: Classification;
    default_exposure: Exposure;
  };
}

export interface TypeDefinition {
  kind: ObjectKind;
  description?: string | undefined;
  required_attributes?: string[] | undefined;
}

export interface RelationshipDefinition {
  category: RelationshipCategory;
  inverse?: string | undefined;
  description?: string | undefined;
}

export interface PackSchema {
  object_types: Record<string, TypeDefinition>;
  relationship_types?: Record<string, RelationshipDefinition>;
}

export interface ProjectContext {
  rootDir: string;
  akpDir: string;
  localDir: string;
  manifestPath: string;
  schemaPath: string;
  objectsPath: string;
  databasePath: string;
  manifest: Manifest;
  schema: PackSchema;
}
