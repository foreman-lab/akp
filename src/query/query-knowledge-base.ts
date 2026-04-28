import { loadProject } from "../core/config/load-project.js";
import { ensureStoreBuilt } from "../store/ensure-store-built.js";
import { SqliteStore } from "../store/sqlite/sqlite-store.js";

export async function describeKnowledgeBase(startDir = process.cwd()) {
  const project = await loadProject(startDir);
  return {
    artifact: project.manifest.artifact,
    version: project.manifest.version,
    security: project.manifest.security,
    object_types: project.schema.object_types,
    relationship_types: project.schema.relationship_types ?? {},
  };
}

export async function getObject(id: string, startDir = process.cwd()) {
  const project = await loadProject(startDir);
  await ensureStoreBuilt(project.databasePath);
  const store = new SqliteStore(project.databasePath);
  try {
    store.initialize();
    return store.getObject(id);
  } finally {
    store.close();
  }
}

export async function lookupKnowledge(intent: string, limit: number, startDir = process.cwd()) {
  const project = await loadProject(startDir);
  await ensureStoreBuilt(project.databasePath);
  const store = new SqliteStore(project.databasePath);
  try {
    store.initialize();
    return store.lookup(intent, limit);
  } finally {
    store.close();
  }
}

export async function getNeighbors(id: string, limit: number, startDir = process.cwd()) {
  const project = await loadProject(startDir);
  await ensureStoreBuilt(project.databasePath);
  const store = new SqliteStore(project.databasePath);
  try {
    store.initialize();
    return store.neighbors(id, 1, limit);
  } finally {
    store.close();
  }
}

export async function getFreshness(startDir = process.cwd()) {
  const project = await loadProject(startDir);
  await ensureStoreBuilt(project.databasePath);
  const store = new SqliteStore(project.databasePath);
  try {
    store.initialize();
    return {
      artifact: project.manifest.artifact.name,
      ...store.stats(),
    };
  } finally {
    store.close();
  }
}

export async function briefKnowledge(scope: string, limit: number, startDir = process.cwd()) {
  const results = await lookupKnowledge(scope, limit, startDir);
  return {
    scope,
    summary: results.length
      ? `Found ${results.length} AKP reference object(s) related to "${scope}".`
      : `No AKP reference objects found for "${scope}".`,
    primary_objects: results.map((result) => result.object),
    gaps_known: false,
    gaps: [],
  };
}
