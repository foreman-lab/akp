import path from "node:path";

/**
 * Minimum filesystem surface the init use case needs. Adapter implementations
 * live elsewhere (production: `src/init/adapters/node-fs.ts`; tests: an
 * in-memory fake). Splitting this out as a port lets `init` be unit-tested
 * without touching the real filesystem.
 */
export interface FileSystemPort {
  mkdir(target: string, opts?: { recursive?: boolean }): Promise<void>;
  writeFile(target: string, content: string, opts?: { flag?: "wx" | "w" }): Promise<void>;
}

export interface InitKnowledgeBaseInput {
  /** Absolute path to the directory the AKB should be initialised under. */
  rootDir: string;
}

export interface InitKnowledgeBaseResult {
  akp_dir: string;
  manifest_path: string;
  schema_path: string;
  objects_path: string;
}

export interface InitKnowledgeBaseUseCase {
  execute(input: InitKnowledgeBaseInput): Promise<InitKnowledgeBaseResult>;
}

/**
 * Scaffold a starter AKB at `<rootDir>/.akp/`. Idempotent: pre-existing
 * `manifest.yaml`, `schemas/base.yaml`, and `objects.jsonl` are preserved
 * (the use case tolerates the `EEXIST` raised by `flag: "wx"` writes).
 */
export function makeInitKnowledgeBase(fs: FileSystemPort): InitKnowledgeBaseUseCase {
  return {
    async execute({ rootDir }: InitKnowledgeBaseInput): Promise<InitKnowledgeBaseResult> {
      const akpDir = path.join(rootDir, ".akp");
      const schemasDir = path.join(akpDir, "schemas");
      const manifestPath = path.join(akpDir, "manifest.yaml");
      const schemaPath = path.join(schemasDir, "base.yaml");
      const objectsPath = path.join(akpDir, "objects.jsonl");

      await fs.mkdir(schemasDir, { recursive: true });

      await tolerateExisting(
        fs.writeFile(manifestPath, makeManifestContent(rootDir), { flag: "wx" }),
      );
      await tolerateExisting(fs.writeFile(schemaPath, DEFAULT_SCHEMA_CONTENT, { flag: "wx" }));
      await tolerateExisting(fs.writeFile(objectsPath, "", { flag: "wx" }));

      return {
        akp_dir: akpDir,
        manifest_path: manifestPath,
        schema_path: schemaPath,
        objects_path: objectsPath,
      };
    },
  };
}

async function tolerateExisting(promise: Promise<void>): Promise<void> {
  try {
    await promise;
  } catch (error: unknown) {
    const nodeError = error as NodeJS.ErrnoException;
    if (nodeError.code !== "EEXIST") {
      throw error;
    }
  }
}

function makeManifestContent(rootDir: string): string {
  return `version: 0.1
artifact:
  name: ${path.basename(rootDir)}
  kind: artifact
  description: AKP artifact knowledge base.

schema: schemas/base.yaml
objects: objects.jsonl
security:
  default_classification: internal
  default_exposure: committed
`;
}

const DEFAULT_SCHEMA_CONTENT = `object_types:
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
`;
