import { loadProject } from "../core/config/load-project.js";
import { readKnowledgeObjects } from "../knowledge/read-objects.js";

export interface CheckKnowledgeBaseResult {
  artifact: string;
  object_count: number;
  schema_types: string[];
  relationship_types: string[];
}

export async function checkKnowledgeBase(
  startDir = process.cwd(),
): Promise<CheckKnowledgeBaseResult> {
  const project = await loadProject(startDir);
  const objects = await readKnowledgeObjects(project.objectsPath, project.schema);

  return {
    artifact: project.manifest.artifact.name,
    object_count: objects.length,
    schema_types: Object.keys(project.schema.object_types),
    relationship_types: Object.keys(project.schema.relationship_types ?? {}),
  };
}
