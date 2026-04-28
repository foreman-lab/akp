import { access } from "node:fs/promises";
import path from "node:path";

export const AKP_DIR = ".akp";
export const AKP_LOCAL_DIR = ".akp-local";
export const AKP_DATABASE_FILE = "akp.sqlite";

async function exists(filePath: string): Promise<boolean> {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

export async function findProjectRoot(startDir = process.cwd()): Promise<string> {
  let current = path.resolve(startDir);

  while (true) {
    if (await exists(path.join(current, AKP_DIR, "manifest.yaml"))) {
      return current;
    }

    const parent = path.dirname(current);
    if (parent === current) {
      return path.resolve(startDir);
    }
    current = parent;
  }
}
