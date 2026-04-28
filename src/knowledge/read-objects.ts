import { rename, readFile, writeFile } from "node:fs/promises";

import { AppError } from "../core/errors/app-error.js";
import { knowledgeObjectSchema } from "../core/protocol/schema.js";

import type { KnowledgeObject, PackSchema } from "../core/protocol/types.js";

/**
 * Read/write surface over the canonical authored knowledge (today: a JSONL
 * file at `.akp/objects.jsonl`). Build, check, and refresh flows depend on
 * this port rather than the concrete reader.
 */
export interface CanonicalStore {
  readAll(): Promise<KnowledgeObject[]>;
  /**
   * Replace the canonical object set atomically. Implementations MUST write
   * the new content to a sibling file and rename, so a partial failure never
   * leaves the canonical store in a half-written state.
   */
  writeAll(objects: KnowledgeObject[]): Promise<void>;
}

/**
 * Build a CanonicalStore backed by the manifest's JSONL objects file. Read
 * validates per-object schema, schema-pack conformance, and relationship
 * target existence; write performs an atomic temp-file + rename.
 */
export function makeJsonlCanonicalStore(objectsPath: string, schema: PackSchema): CanonicalStore {
  return {
    readAll() {
      return readKnowledgeObjects(objectsPath, schema);
    },
    async writeAll(objects: KnowledgeObject[]): Promise<void> {
      const tmpPath = `${objectsPath}.tmp`;
      const content = objects.map((object) => JSON.stringify(object)).join("\n") + "\n";
      try {
        await writeFile(tmpPath, content, "utf8");
        await rename(tmpPath, objectsPath);
      } catch (error: unknown) {
        throw new AppError("AKP_OBJECTS_WRITE_FAILED", `Unable to write ${objectsPath}`, error);
      }
    },
  };
}

export function validateObjectAgainstPack(object: KnowledgeObject, schema: PackSchema): void {
  const typeDefinition = schema.object_types[object.type];
  if (!typeDefinition) {
    throw new AppError(
      "AKP_OBJECT_TYPE_UNKNOWN",
      `Object ${object.id} uses undeclared type ${object.type}`,
    );
  }

  if (typeDefinition.kind !== object.kind) {
    throw new AppError(
      "AKP_OBJECT_KIND_MISMATCH",
      `Object ${object.id} has kind ${object.kind}, but type ${object.type} declares ${typeDefinition.kind}`,
    );
  }

  for (const attribute of typeDefinition.required_attributes ?? []) {
    if (!(attribute in object.attributes)) {
      throw new AppError(
        "AKP_OBJECT_ATTRIBUTE_MISSING",
        `Object ${object.id} is missing required attribute ${attribute}`,
      );
    }
  }

  for (const relationship of object.relationships) {
    const relationshipDefinition = schema.relationship_types?.[relationship.type];
    if (!relationshipDefinition) {
      throw new AppError(
        "AKP_RELATIONSHIP_TYPE_UNKNOWN",
        `Object ${object.id} uses undeclared relationship ${relationship.type}`,
      );
    }

    if (relationship.category !== relationshipDefinition.category) {
      throw new AppError(
        "AKP_RELATIONSHIP_CATEGORY_MISMATCH",
        `Object ${object.id} relationship ${relationship.type} has category ${relationship.category}, but schema declares ${relationshipDefinition.category}`,
      );
    }
  }
}

export function validateRelationshipTargets(objects: KnowledgeObject[]): void {
  const objectIds = new Set(objects.map((object) => object.id));

  for (const object of objects) {
    for (const relationship of object.relationships) {
      if (!objectIds.has(relationship.target)) {
        throw new AppError(
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
    throw new AppError("AKP_OBJECTS_READ_FAILED", `Unable to read ${objectsPath}`, error);
  }

  const objects: KnowledgeObject[] = [];
  const seen = new Set<string>();
  const lines = raw.split(/\r?\n/).filter((line) => line.trim().length > 0);

  for (const [index, line] of lines.entries()) {
    let json: unknown;
    try {
      json = JSON.parse(line);
    } catch (error) {
      throw new AppError(
        "AKP_OBJECT_JSON_INVALID",
        `Invalid JSON on ${objectsPath}:${index + 1}`,
        error,
      );
    }

    const parsed = knowledgeObjectSchema.safeParse(json);
    if (!parsed.success) {
      throw new AppError(
        "AKP_OBJECT_INVALID",
        `Invalid AKP object on ${objectsPath}:${index + 1}`,
        parsed.error.format(),
      );
    }

    if (seen.has(parsed.data.id)) {
      throw new AppError("AKP_OBJECT_DUPLICATE", `Duplicate AKP object id ${parsed.data.id}`);
    }
    seen.add(parsed.data.id);

    validateObjectAgainstPack(parsed.data, schema);
    objects.push(parsed.data);
  }

  validateRelationshipTargets(objects);
  return objects;
}
