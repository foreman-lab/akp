import { mkdirSync } from "node:fs";
import path from "node:path";

import Database from "better-sqlite3";

import type { KnowledgeObject } from "../../core/protocol/types.js";

export interface LookupResult {
  object: KnowledgeObject;
  score: number;
}

export interface Neighbor {
  object: KnowledgeObject | null;
  edge: {
    source: string;
    type: string;
    category: string;
    target: string;
    direction: "outgoing" | "incoming";
  };
}

export interface StoreStats {
  object_count: number;
  relationship_count: number;
  stale_count: number;
}

/**
 * Read/write surface AKP uses against derived storage (FTS, graph traversal,
 * fast id lookup). Today there is one implementation (SqliteStore); the
 * interface exists so future extractor / refresh flows can write incremental
 * updates without coupling to better-sqlite3 specifics.
 */
export interface IndexedStore {
  initialize(): void;
  upsertMany(objects: KnowledgeObject[]): void;
  deleteMany(ids: string[]): void;
  replaceAll(objects: KnowledgeObject[]): void;
  getObject(id: string): KnowledgeObject | null;
  lookup(intent: string, limit: number): LookupResult[];
  neighbors(id: string, depth?: number, limit?: number): Neighbor[];
  stats(): StoreStats;
  close(): void;
}

interface ObjectRow {
  object_json: string;
}

export class SqliteStore implements IndexedStore {
  private readonly db: Database.Database;

  constructor(databasePath: string) {
    mkdirSync(path.dirname(databasePath), { recursive: true });
    this.db = new Database(databasePath);
    this.db.pragma("journal_mode = WAL");
    this.db.pragma("foreign_keys = ON");
  }

  initialize(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS objects (
        id TEXT PRIMARY KEY,
        type TEXT NOT NULL,
        kind TEXT NOT NULL,
        title TEXT NOT NULL,
        summary TEXT NOT NULL,
        classification TEXT NOT NULL,
        exposure TEXT NOT NULL,
        review_state TEXT NOT NULL,
        freshness_status TEXT NOT NULL,
        object_json TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS relationships (
        source_id TEXT NOT NULL,
        type TEXT NOT NULL,
        category TEXT NOT NULL,
        target_id TEXT NOT NULL,
        relationship_json TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS audit_events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        event_type TEXT NOT NULL,
        payload_json TEXT NOT NULL,
        created_at TEXT NOT NULL
      );

      CREATE VIRTUAL TABLE IF NOT EXISTS object_fts USING fts5(
        id UNINDEXED,
        title,
        summary,
        type,
        kind,
        attributes
      );
    `);
  }

  replaceAll(objects: KnowledgeObject[]): void {
    const transaction = this.db.transaction((items: KnowledgeObject[]) => {
      this.db.prepare("DELETE FROM relationships").run();
      this.db.prepare("DELETE FROM object_fts").run();
      this.db.prepare("DELETE FROM objects").run();

      const insertObject = this.db.prepare(`
        INSERT INTO objects (
          id, type, kind, title, summary, classification, exposure,
          review_state, freshness_status, object_json
        ) VALUES (
          @id, @type, @kind, @title, @summary, @classification, @exposure,
          @review_state, @freshness_status, @object_json
        )
      `);

      const insertFts = this.db.prepare(`
        INSERT INTO object_fts (id, title, summary, type, kind, attributes)
        VALUES (@id, @title, @summary, @type, @kind, @attributes)
      `);

      const insertRelationship = this.db.prepare(`
        INSERT INTO relationships (source_id, type, category, target_id, relationship_json)
        VALUES (@source_id, @type, @category, @target_id, @relationship_json)
      `);

      for (const object of items) {
        insertObject.run({
          id: object.id,
          type: object.type,
          kind: object.kind,
          title: object.title,
          summary: object.summary,
          classification: object.classification,
          exposure: object.exposure,
          review_state: object.review_state,
          freshness_status: object.freshness.status,
          object_json: JSON.stringify(object),
        });

        insertFts.run({
          id: object.id,
          title: object.title,
          summary: object.summary,
          type: object.type,
          kind: object.kind,
          attributes: JSON.stringify(object.attributes),
        });

        for (const relationship of object.relationships) {
          insertRelationship.run({
            source_id: object.id,
            type: relationship.type,
            category: relationship.category,
            target_id: relationship.target,
            relationship_json: JSON.stringify(relationship),
          });
        }
      }

      this.recordAuditEvent("build.replace_all", { object_count: items.length });
    });

    transaction(objects);
  }

  upsertMany(objects: KnowledgeObject[]): void {
    if (objects.length === 0) {
      return;
    }

    const transaction = this.db.transaction((items: KnowledgeObject[]) => {
      const deleteOutgoing = this.db.prepare("DELETE FROM relationships WHERE source_id = ?");
      const deleteFts = this.db.prepare("DELETE FROM object_fts WHERE id = ?");

      const upsertObject = this.db.prepare(`
        INSERT INTO objects (
          id, type, kind, title, summary, classification, exposure,
          review_state, freshness_status, object_json
        ) VALUES (
          @id, @type, @kind, @title, @summary, @classification, @exposure,
          @review_state, @freshness_status, @object_json
        )
        ON CONFLICT(id) DO UPDATE SET
          type = excluded.type,
          kind = excluded.kind,
          title = excluded.title,
          summary = excluded.summary,
          classification = excluded.classification,
          exposure = excluded.exposure,
          review_state = excluded.review_state,
          freshness_status = excluded.freshness_status,
          object_json = excluded.object_json
      `);

      const insertFts = this.db.prepare(`
        INSERT INTO object_fts (id, title, summary, type, kind, attributes)
        VALUES (@id, @title, @summary, @type, @kind, @attributes)
      `);

      const insertRelationship = this.db.prepare(`
        INSERT INTO relationships (source_id, type, category, target_id, relationship_json)
        VALUES (@source_id, @type, @category, @target_id, @relationship_json)
      `);

      for (const object of items) {
        deleteOutgoing.run(object.id);
        deleteFts.run(object.id);

        upsertObject.run({
          id: object.id,
          type: object.type,
          kind: object.kind,
          title: object.title,
          summary: object.summary,
          classification: object.classification,
          exposure: object.exposure,
          review_state: object.review_state,
          freshness_status: object.freshness.status,
          object_json: JSON.stringify(object),
        });

        insertFts.run({
          id: object.id,
          title: object.title,
          summary: object.summary,
          type: object.type,
          kind: object.kind,
          attributes: JSON.stringify(object.attributes),
        });

        for (const relationship of object.relationships) {
          insertRelationship.run({
            source_id: object.id,
            type: relationship.type,
            category: relationship.category,
            target_id: relationship.target,
            relationship_json: JSON.stringify(relationship),
          });
        }
      }

      this.recordAuditEvent("upsert_many", { object_count: items.length });
    });

    transaction(objects);
  }

  deleteMany(ids: string[]): void {
    if (ids.length === 0) {
      return;
    }

    const transaction = this.db.transaction((items: string[]) => {
      const deleteOutgoing = this.db.prepare("DELETE FROM relationships WHERE source_id = ?");
      const deleteIncoming = this.db.prepare("DELETE FROM relationships WHERE target_id = ?");
      const deleteFts = this.db.prepare("DELETE FROM object_fts WHERE id = ?");
      const deleteObject = this.db.prepare("DELETE FROM objects WHERE id = ?");

      for (const id of items) {
        deleteOutgoing.run(id);
        deleteIncoming.run(id);
        deleteFts.run(id);
        deleteObject.run(id);
      }

      this.recordAuditEvent("delete_many", { id_count: items.length });
    });

    transaction(ids);
  }

  getObject(id: string): KnowledgeObject | null {
    const row = this.db.prepare("SELECT object_json FROM objects WHERE id = ?").get(id) as
      | ObjectRow
      | undefined;
    return row ? (JSON.parse(row.object_json) as KnowledgeObject) : null;
  }

  lookup(intent: string, limit: number): LookupResult[] {
    const ftsQuery = makeFtsQuery(intent);
    if (!ftsQuery) {
      return [];
    }

    const rows = this.db
      .prepare(
        `
        SELECT objects.object_json, bm25(object_fts) AS score
        FROM object_fts
        JOIN objects ON objects.id = object_fts.id
        WHERE object_fts MATCH ?
        ORDER BY score
        LIMIT ?
      `,
      )
      .all(ftsQuery, limit) as Array<ObjectRow & { score: number }>;

    return rows.map((row) => ({
      object: JSON.parse(row.object_json) as KnowledgeObject,
      score: row.score,
    }));
  }

  neighbors(id: string, depth = 1, limit = 20): Neighbor[] {
    if (depth !== 1) {
      throw new Error("Only depth=1 is supported in v0.1");
    }

    const outgoing = this.db
      .prepare(
        `
        SELECT relationships.*, objects.object_json
        FROM relationships
        LEFT JOIN objects ON objects.id = relationships.target_id
        WHERE source_id = ?
        LIMIT ?
      `,
      )
      .all(id, limit) as Array<Record<string, unknown> & Partial<ObjectRow>>;

    const remaining = Math.max(limit - outgoing.length, 0);
    const incoming = remaining
      ? (this.db
          .prepare(
            `
            SELECT relationships.*, objects.object_json
            FROM relationships
            LEFT JOIN objects ON objects.id = relationships.source_id
            WHERE target_id = ?
            LIMIT ?
          `,
          )
          .all(id, remaining) as Array<Record<string, unknown> & Partial<ObjectRow>>)
      : [];

    return [
      ...outgoing.map((row) => toNeighbor(row, "outgoing")),
      ...incoming.map((row) => toNeighbor(row, "incoming")),
    ];
  }

  stats(): StoreStats {
    const objectCount = this.db.prepare("SELECT COUNT(*) AS count FROM objects").get() as {
      count: number;
    };
    const relationshipCount = this.db
      .prepare("SELECT COUNT(*) AS count FROM relationships")
      .get() as { count: number };
    const staleCount = this.db
      .prepare("SELECT COUNT(*) AS count FROM objects WHERE freshness_status != 'fresh'")
      .get() as { count: number };

    return {
      object_count: objectCount.count,
      relationship_count: relationshipCount.count,
      stale_count: staleCount.count,
    };
  }

  close(): void {
    this.db.close();
  }

  private recordAuditEvent(eventType: string, payload: unknown): void {
    this.db
      .prepare("INSERT INTO audit_events (event_type, payload_json, created_at) VALUES (?, ?, ?)")
      .run(eventType, JSON.stringify(payload), new Date().toISOString());
  }
}

function toNeighbor(
  row: Record<string, unknown> & Partial<ObjectRow>,
  direction: "outgoing" | "incoming",
): Neighbor {
  return {
    object: row.object_json ? (JSON.parse(row.object_json) as KnowledgeObject) : null,
    edge: {
      source: String(row.source_id),
      type: String(row.type),
      category: String(row.category),
      target: String(row.target_id),
      direction,
    },
  };
}

function makeFtsQuery(input: string): string {
  return input
    .toLowerCase()
    .split(/[^a-z0-9_./-]+/i)
    .map((token) => token.trim())
    .filter((token) => token.length >= 2)
    .slice(0, 12)
    .map((token) => `"${token.replaceAll('"', '""')}"`)
    .join(" OR ");
}
