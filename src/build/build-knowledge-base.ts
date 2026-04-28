import { loadProject } from "../core/config/load-project.js";
import { readKnowledgeObjects } from "../knowledge/read-objects.js";
import { SqliteStore } from "../store/sqlite/sqlite-store.js";

export interface BuildKnowledgeBaseResult {
  artifact: string;
  database_path: string;
  object_count: number;
  relationship_count: number;
  stale_count: number;
}

export async function buildKnowledgeBase(startDir = process.cwd()): Promise<BuildKnowledgeBaseResult> {
  const project = await loadProject(startDir);
  const objects = await readKnowledgeObjects(project.objectsPath, project.schema);
  const store = new SqliteStore(project.databasePath);

  try {
    store.initialize();
    store.replaceAll(objects);
    const stats = store.stats();
    return {
      artifact: project.manifest.artifact.name,
      database_path: project.databasePath,
      ...stats,
    };
  } finally {
    store.close();
  }
}
