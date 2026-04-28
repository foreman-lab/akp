import { readFile } from "node:fs/promises";

import { AkpError } from "../core/errors/akp-error.js";
import { knowledgeObjectSchema } from "../core/protocol/schema.js";

import type { KnowledgeObject, PackSchema } from "../core/protocol/types.js";

/**
 * Read-side surface over the canonical authored knowledge (today: a JSONL file
 * at `.akp/objects.jsonl`). The interface exists so the build, check, and
 * future refresh flows can depend on a port rather than the concrete reader.
 * A future writeAll method will land alongside the refresh use case in a later
 * patch; this commit ships the read-only slice only.
 */
export interface CanonicalStore {
  readAll(): Promise<KnowledgeObject[]>;
}

/**
 * Build a CanonicalStore backed by the manifest's JSONL objects file. Validation
 * (per-object schema, schema-pack conformance, relationship target existence)
 * runs inside `readAll`, so consumers always see a verified set.
 */
export function makeJsonlCanonicalStore(objectsPath: string, schema: PackSchema): CanonicalStore {
  return {
    readAll() {
      return readKnowledgeObjects(objectsPath, schema);
    },
  };
}

function validateObjectAgainstPack(object: KnowledgeObject, schema: PackSchema): void {
  const typeDefinition = schema.object_types[object.type];
  if (!typeDefinition) {
    throw new AkpError(
      "AKP_OBJECT_TYPE_UNKNOWN",
      `Object ${object.id} uses undeclared type ${object.type}`,
    );
  }

  if (typeDefinition.kind !== object.kind) {
    throw new AkpError(
      "AKP_OBJECT_KIND_MISMATCH",
      `Object ${object.id} has kind ${object.kind}, but type ${object.type} declares ${typeDefinition.kind}`,
    );
  }

  for (const attribute of typeDefinition.required_attributes ?? []) {
    if (!(attribute in object.attributes)) {
      throw new AkpError(
        "AKP_OBJECT_ATTRIBUTE_MISSING",
        `Object ${object.id} is missing required attribute ${attribute}`,
      );
    }
  }

  for (const relationship of object.relationships) {
    const relationshipDefinition = schema.relationship_types?.[relationship.type];
    if (!relationshipDefinition) {
      throw new AkpError(
        "AKP_RELATIONSHIP_TYPE_UNKNOWN",
        `Object ${object.id} uses undeclared relationship ${relationship.type}`,
      );
    }

    if (relationship.category !== relationshipDefinition.category) {
      throw new AkpError(
        "AKP_RELATIONSHIP_CATEGORY_MISMATCH",
        `Object ${object.id} relationship ${relationship.type} has category ${relationship.category}, but schema declares ${relationshipDefinition.category}`,
      );
    }
  }
}

function validateRelationshipTargets(objects: KnowledgeObject[]): void {
  const objectIds = new Set(objects.map((object) => object.id));

  for (const object of objects) {
    for (const relationship of object.relationships) {
      if (!objectIds.has(relationship.target)) {
        throw new AkpError(
          "AKP_RELATIONSHIP_TARGET_MISSING",
          `Object ${object.id} relationship ${relationship.type} points to missing target ${relationship.target}`,
        );
      }
    }
  }
}

export async function readKnowledgeObjects(
  objectsPath: string,
  schema: PackSchema,
): Promise<KnowledgeObject[]> {
  let raw: string;
  try {
    raw = await readFile(objectsPath, "utf8");
  } catch (error: unknown) {
    const nodeError = error as NodeJS.ErrnoException;
    if (nodeError.code === "ENOENT") {
      return [];
    }
    throw new AkpError("AKP_OBJECTS_READ_FAILED", `Unable to read ${objectsPath}`, error);
  }

  const objects: KnowledgeObject[] = [];
  const seen = new Set<string>();
  const lines = raw.split(/\r?\n/).filter((line) => line.trim().length > 0);

  for (const [index, line] of lines.entries()) {
    let json: unknown;
    try {
      json = JSON.parse(line);
    } catch (error) {
      throw new AkpError(
        "AKP_OBJECT_JSON_INVALID",
        `Invalid JSON on ${objectsPath}:${index + 1}`,
        error,
      );
    }

    const parsed = knowledgeObjectSchema.safeParse(json);
    if (!parsed.success) {
      throw new AkpError(
        "AKP_OBJECT_INVALID",
        `Invalid AKP object on ${objectsPath}:${index + 1}`,
        parsed.error.format(),
      );
    }

    if (seen.has(parsed.data.id)) {
      throw new AkpError("AKP_OBJECT_DUPLICATE", `Duplicate AKP object id ${parsed.data.id}`);
    }
    seen.add(parsed.data.id);

    validateObjectAgainstPack(parsed.data, schema);
    objects.push(parsed.data);
  }

  validateRelationshipTargets(objects);
  return objects;
}
