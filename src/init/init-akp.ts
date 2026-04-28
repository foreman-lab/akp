import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { AKP_DIR } from "../core/config/paths.js";

export interface InitAkpResult {
  akp_dir: string;
  manifest_path: string;
  schema_path: string;
  objects_path: string;
}

export async function initAkp(startDir = process.cwd()): Promise<InitAkpResult> {
  const rootDir = path.resolve(startDir);
  const akpDir = path.join(rootDir, AKP_DIR);
  const schemasDir = path.join(akpDir, "schemas");
  const manifestPath = path.join(akpDir, "manifest.yaml");
  const schemaPath = path.join(schemasDir, "base.yaml");
  const objectsPath = path.join(akpDir, "objects.jsonl");

  await mkdir(schemasDir, { recursive: true });

  await writeFile(
    manifestPath,
    `version: 0.1
artifact:
  name: ${path.basename(rootDir)}
  kind: artifact
  description: AKP artifact knowledge base.

schema: schemas/base.yaml
objects: objects.jsonl
security:
  default_classification: internal
  default_exposure: committed
`,
    { flag: "wx" },
  ).catch((error: NodeJS.ErrnoException) => {
    if (error.code !== "EEXIST") {
      throw error;
    }
  });

  await writeFile(
    schemaPath,
    `object_types:
  note:
    kind: fact
    description: General attestable knowledge about the artifact.
  convention:
    kind: convention
    description: Prescriptive guidance for working with the artifact.
  procedure:
    kind: procedure
    description: Structured guidance for a common task.

relationship_types:
  references:
    category: reference
  depends_on:
    category: dependency
  supports:
    category: evidence
`,
    { flag: "wx" },
  ).catch((error: NodeJS.ErrnoException) => {
    if (error.code !== "EEXIST") {
      throw error;
    }
  });

  await writeFile(objectsPath, "", { flag: "wx" }).catch((error: NodeJS.ErrnoException) => {
    if (error.code !== "EEXIST") {
      throw error;
    }
  });

  return {
    akp_dir: akpDir,
    manifest_path: manifestPath,
    schema_path: schemaPath,
    objects_path: objectsPath,
  };
}
