import { readFile } from "node:fs/promises";
import path from "node:path";
import YAML from "yaml";
import { AkpError } from "../errors/akp-error.js";
import { manifestSchema, packSchemaSchema } from "../protocol/schema.js";
import type { ProjectContext } from "../protocol/types.js";
import { AKP_DATABASE_FILE, AKP_DIR, AKP_LOCAL_DIR, findProjectRoot } from "./paths.js";

async function readYaml(filePath: string): Promise<unknown> {
  try {
    return YAML.parse(await readFile(filePath, "utf8"));
  } catch (error) {
    throw new AkpError("AKP_CONFIG_READ_FAILED", `Unable to read ${filePath}`, error);
  }
}

export async function loadProject(startDir = process.cwd()): Promise<ProjectContext> {
  const rootDir = await findProjectRoot(startDir);
  const akpDir = path.join(rootDir, AKP_DIR);
  const localDir = path.join(rootDir, AKP_LOCAL_DIR);
  const manifestPath = path.join(akpDir, "manifest.yaml");

  const manifestResult = manifestSchema.safeParse(await readYaml(manifestPath));
  if (!manifestResult.success) {
    throw new AkpError("AKP_MANIFEST_INVALID", "Invalid .akp/manifest.yaml", manifestResult.error.format());
  }

  const manifest = manifestResult.data;
  const schemaPath = path.resolve(akpDir, manifest.schema);
  const schemaResult = packSchemaSchema.safeParse(await readYaml(schemaPath));
  if (!schemaResult.success) {
    throw new AkpError("AKP_SCHEMA_INVALID", `Invalid AKP schema at ${schemaPath}`, schemaResult.error.format());
  }

  return {
    rootDir,
    akpDir,
    localDir,
    manifestPath,
    schemaPath,
    objectsPath: path.resolve(akpDir, manifest.objects ?? "objects.jsonl"),
    databasePath: path.join(localDir, AKP_DATABASE_FILE),
    manifest,
    schema: schemaResult.data,
  };
}
