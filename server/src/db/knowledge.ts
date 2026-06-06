// server/src/db/knowledge.ts
// SQLite Knowledge Index using sql.js (WASM-based, no native compilation)
// Maintains a full-text search index synced with JSON knowledge files.

import path from 'path';
import fs from 'fs/promises';
import initSqlJs, { Database, SqlJsStatic } from 'sql.js';
import { createLogger } from '../utils/logger';
import { getWorkspaceRoot } from '../utils/file';
import type { KnowledgeEntry, SearchResult } from '../types/knowledge';

const logger = createLogger('knowledge-db');

let SQL: SqlJsStatic | null = null;
let db: Database | null = null;
let dbPath: string = '';

/**
 * Initialize the SQLite database. Must be called once on startup.
 */
export async function initKnowledgeDb(workspaceRoot?: string): Promise<void> {
  if (db) {
    logger.warn('Knowledge DB already initialized');
    return;
  }

  const root = workspaceRoot || getWorkspaceRoot();
  dbPath = path.join(root, 'knowledge', '_index.db');

  // Initialize sql.js
  SQL = await initSqlJs();
  logger.info('sql.js initialized');

  // Load existing DB or create new
  try {
    const buffer = await fs.readFile(dbPath);
    db = new SQL.Database(new Uint8Array(buffer));
    logger.info(`Loaded existing knowledge DB from ${dbPath}`);
  } catch {
    db = new SQL.Database();
    logger.info('Created new knowledge DB');
  }

  // Create tables
  db.run(`
    CREATE TABLE IF NOT EXISTS knowledge_index (
      id TEXT PRIMARY KEY,
      category TEXT NOT NULL,
      name TEXT NOT NULL,
      aliases TEXT NOT NULL DEFAULT '[]',
      chapters TEXT NOT NULL DEFAULT '[]',
      updated_at TEXT NOT NULL,
      version INTEGER DEFAULT 1,
      file_path TEXT NOT NULL,
      deleted_at TEXT DEFAULT NULL,
      manual_edited INTEGER DEFAULT 0
    )
  `);

  // Migrate: add columns if they don't exist (for existing DBs from PRD-03)
  try {
    db.run('ALTER TABLE knowledge_index ADD COLUMN deleted_at TEXT DEFAULT NULL');
  } catch { /* column already exists */ }
  try {
    db.run('ALTER TABLE knowledge_index ADD COLUMN manual_edited INTEGER DEFAULT 0');
  } catch { /* column already exists */ }

  // Create FTS5 virtual table (if supported by sql.js build)
  try {
    db.run(`
      CREATE VIRTUAL TABLE IF NOT EXISTS knowledge_fts USING fts5(
        name,
        aliases,
        content='knowledge_index',
        content_rowid='rowid'
      )
    `);

    // Triggers to keep FTS in sync
    db.run(`
      CREATE TRIGGER IF NOT EXISTS knowledge_ai AFTER INSERT ON knowledge_index BEGIN
        INSERT INTO knowledge_fts(rowid, name, aliases)
        VALUES (new.rowid, new.name, new.aliases);
      END
    `);

    db.run(`
      CREATE TRIGGER IF NOT EXISTS knowledge_ad AFTER DELETE ON knowledge_index BEGIN
        INSERT INTO knowledge_fts(knowledge_fts, rowid, name, aliases)
        VALUES ('delete', old.rowid, old.name, old.aliases);
      END
    `);

    db.run(`
      CREATE TRIGGER IF NOT EXISTS knowledge_au AFTER UPDATE ON knowledge_index BEGIN
        INSERT INTO knowledge_fts(knowledge_fts, rowid, name, aliases)
        VALUES ('delete', old.rowid, old.name, old.aliases);
        INSERT INTO knowledge_fts(rowid, name, aliases)
        VALUES (new.rowid, new.name, new.aliases);
      END
    `);
  } catch {
    // FTS5 might not be available in some sql.js builds — fall back to LIKE search
    logger.warn('FTS5 not available, falling back to LIKE-based search');
    // Create a simple index for name-based lookup instead
    db.run(`
      CREATE INDEX IF NOT EXISTS idx_knowledge_category ON knowledge_index(category)
    `);
    db.run(`
      CREATE INDEX IF NOT EXISTS idx_knowledge_name ON knowledge_index(name)
    `);
  }

  // Save initial state
  await saveDb();
}

/**
 * Persist the database to disk (debounced).
 */
let saveTimer: NodeJS.Timeout | null = null;

async function saveDb(): Promise<void> {
  if (!db) return;

  // Debounce: batch rapid writes into a single save
  if (saveTimer) {
    clearTimeout(saveTimer);
  }

  saveTimer = setTimeout(async () => {
    saveTimer = null;
    try {
      const data = db!.export();
      const buffer = Buffer.from(data);
      await fs.mkdir(path.dirname(dbPath), { recursive: true });
      await fs.writeFile(dbPath, buffer);
      logger.debug('Knowledge DB saved to disk');
    } catch (err) {
      logger.error('Failed to save knowledge DB:', err);
    }
  }, 100);
}

/**
 * Index (insert or update) a knowledge entry in SQLite.
 */
export function indexEntry(entry: KnowledgeEntry): void {
  if (!db) throw new Error('Knowledge DB not initialized');

  const aliases = JSON.stringify(entry.aliases || []);
  const chapters = JSON.stringify(entry.source.map((s) => s.chapter));
  const deletedAt = entry.deletedAt || null;
  const manualEdited = entry.manualEdited ? 1 : 0;

  db.run(
    `INSERT OR REPLACE INTO knowledge_index (id, category, name, aliases, chapters, updated_at, version, file_path, deleted_at, manual_edited)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      entry.id,
      entry.category,
      entry.name,
      aliases,
      chapters,
      entry.updatedAt,
      entry.version,
      `${entry.category}/${entry.id}.json`,
      deletedAt,
      manualEdited,
    ],
  );

  // Save after each write
  saveDb().catch((err) => logger.error('Failed to save after indexEntry:', err));
}

/**
 * Remove an entry from the index.
 */
export function deindexEntry(entryId: string): void {
  if (!db) throw new Error('Knowledge DB not initialized');

  db.run('DELETE FROM knowledge_index WHERE id = ?', [entryId]);
  saveDb().catch((err) => logger.error('Failed to save after deindexEntry:', err));
}

/**
 * Mark an entry as deleted (soft delete — sets deleted_at timestamp).
 */
export function markDeleted(entryId: string): void {
  if (!db) throw new Error('Knowledge DB not initialized');
  db.run('UPDATE knowledge_index SET deleted_at = ? WHERE id = ?', [
    new Date().toISOString(),
    entryId,
  ]);
  saveDb().catch((err) => logger.error('Failed to save after markDeleted:', err));
}

/**
 * Restore a soft-deleted entry (clear deleted_at).
 */
export function markRestored(entryId: string): void {
  if (!db) throw new Error('Knowledge DB not initialized');
  db.run('UPDATE knowledge_index SET deleted_at = NULL WHERE id = ?', [entryId]);
  saveDb().catch((err) => logger.error('Failed to save after markRestored:', err));
}

/**
 * Get IDs of all soft-deleted entries.
 */
export function getDeletedEntryIds(): string[] {
  if (!db) throw new Error('Knowledge DB not initialized');
  const ids: string[] = [];
  try {
    const stmt = db.prepare('SELECT id FROM knowledge_index WHERE deleted_at IS NOT NULL');
    while (stmt.step()) {
      const row = stmt.getAsObject();
      ids.push(row.id as string);
    }
    stmt.free();
  } catch { /* ignore */ }
  return ids;
}

/**
 * Full-text search across name and aliases.
 */
export function searchKnowledge(
  query: string,
  category?: string,
  page: number = 1,
  size: number = 20,
): SearchResult[] {
  if (!db) throw new Error('Knowledge DB not initialized');

  const results: SearchResult[] = [];
  const offset = (page - 1) * size;

  try {
    // Try FTS5 first
    const stmt = db.prepare(`
      SELECT ki.id, ki.category, ki.name, ki.aliases, ki.chapters,
             snippet(knowledge_fts, 0, '<mark>', '</mark>', '...', 32) as snippet
      FROM knowledge_fts
      JOIN knowledge_index ki ON ki.rowid = knowledge_fts.rowid
      WHERE ki.deleted_at IS NULL AND knowledge_fts MATCH ?
      ${category ? 'AND ki.category = ?' : ''}
      ORDER BY rank
      LIMIT ? OFFSET ?
    `);

    const params: any[] = [query];
    if (category) params.push(category);
    params.push(size, offset);

    stmt.bind(params);

    while (stmt.step()) {
      const row = stmt.getAsObject();
      results.push({
        id: row.id as string,
        category: row.category as string,
        name: row.name as string,
        aliases: JSON.parse((row.aliases as string) || '[]'),
        chapters: JSON.parse((row.chapters as string) || '[]'),
        snippet: (row.snippet as string) || '',
      });
    }
    stmt.free();
  } catch {
    // Fallback to LIKE search
    const likeQuery = `%${query}%`;
    const stmt = db.prepare(`
      SELECT id, category, name, aliases, chapters
      FROM knowledge_index
      WHERE (name LIKE ? OR aliases LIKE ?) AND deleted_at IS NULL
      ${category ? 'AND category = ?' : ''}
      ORDER BY updated_at DESC
      LIMIT ? OFFSET ?
    `);

    const params: any[] = [likeQuery, likeQuery];
    if (category) params.push(category);
    params.push(size, offset);

    stmt.bind(params);
    while (stmt.step()) {
      const row = stmt.getAsObject();
      results.push({
        id: row.id as string,
        category: row.category as string,
        name: row.name as string,
        aliases: JSON.parse((row.aliases as string) || '[]'),
        chapters: JSON.parse((row.chapters as string) || '[]'),
        snippet: (row.name as string) || '',
      });
    }
    stmt.free();
  }

  return results;
}

/**
 * Quick name lookup for merge phase.
 */
export function findByName(
  name: string,
  category: string,
): { id: string; filePath: string } | null {
  if (!db) throw new Error('Knowledge DB not initialized');

  try {
    const stmt = db.prepare(
      'SELECT id, file_path FROM knowledge_index WHERE name = ? AND category = ? AND deleted_at IS NULL LIMIT 1',
    );
    stmt.bind([name, category]);

    if (stmt.step()) {
      const row = stmt.getAsObject();
      stmt.free();
      return {
        id: row.id as string,
        filePath: row.file_path as string,
      };
    }
    stmt.free();
    return null;
  } catch {
    return null;
  }
}

/**
 * Get all entries in a category (for similarity matching during merge).
 * Returns entry IDs and names — actual data is loaded from JSON files.
 */
export function getCategoryIndex(
  category: string,
): Array<{ id: string; name: string; filePath: string }> {
  if (!db) throw new Error('Knowledge DB not initialized');

  const result: Array<{ id: string; name: string; filePath: string }> = [];

  try {
    const stmt = db.prepare(
      'SELECT id, name, file_path FROM knowledge_index WHERE category = ? AND deleted_at IS NULL ORDER BY name',
    );
    stmt.bind([category]);

    while (stmt.step()) {
      const row = stmt.getAsObject();
      result.push({
        id: row.id as string,
        name: row.name as string,
        filePath: row.file_path as string,
      });
    }
    stmt.free();
  } catch {
    // Ignore errors
  }

  return result;
}

/**
 * Rebuild entire index from JSON files on disk.
 * Used for recovery after manual file changes.
 */
export async function rebuildIndex(): Promise<void> {
  if (!db) throw new Error('Knowledge DB not initialized');

  // Clear existing index
  db.run('DELETE FROM knowledge_index');
  if (db) {
    try {
      db.run("DELETE FROM knowledge_fts WHERE rowid NOT IN (SELECT rowid FROM knowledge_index)");
    } catch {
      // FTS might not exist
    }
  }

  const workspaceRoot = getWorkspaceRoot();
  const knowledgeDir = path.join(workspaceRoot, 'knowledge');

  const categories = [
    'characters',
    'techniques',
    'locations',
    'worldbuilding',
    'weapons',
    'alchemy',
    'plot',
  ];

  let count = 0;

  for (const category of categories) {
    const categoryDir = path.join(knowledgeDir, category);

    try {
      const files = await fs.readdir(categoryDir);
      const jsonFiles = files.filter((f) => f.endsWith('.json') && f !== '_index.json');

      for (const file of jsonFiles) {
        try {
          const content = await fs.readFile(path.join(categoryDir, file), 'utf-8');
          const entry = JSON.parse(content) as KnowledgeEntry;
          indexEntry(entry);
          count++;
        } catch (err) {
          logger.warn(`Failed to re-index ${category}/${file}:`, err);
        }
      }
    } catch {
      // Directory might not exist yet
    }
  }

  logger.info(`Rebuilt knowledge index: ${count} entries`);
  await saveDb();
}

/**
 * Browse knowledge entries with pagination and sorting.
 * Returns entries ordered by specified field.
 */
export function browseKnowledg(
  category?: string,
  page: number = 1,
  size: number = 20,
  sort: 'name' | 'updatedAt' = 'updatedAt',
): Array<{ id: string; name: string; category: string; filePath: string; updatedAt: string; version: number }> {
  if (!db) throw new Error('Knowledge DB not initialized');

  const result: Array<{
    id: string; name: string; category: string; filePath: string; updatedAt: string; version: number;
  }> = [];

  const offset = (page - 1) * size;
  const orderCol = sort === 'name' ? 'name' : 'updated_at';
  const orderDir = sort === 'name' ? 'ASC' : 'DESC';

  try {
    let sql = `SELECT id, name, category, file_path, updated_at, version FROM knowledge_index WHERE deleted_at IS NULL`;
    const params: (string | number)[] = [];

    if (category) {
      sql += ` AND category = ?`;
      params.push(category);
    }

    sql += ` ORDER BY ${orderCol} ${orderDir} LIMIT ? OFFSET ?`;
    params.push(size, offset);

    const stmt = db.prepare(sql);
    stmt.bind(params);

    while (stmt.step()) {
      const row = stmt.getAsObject();
      result.push({
        id: row.id as string,
        name: row.name as string,
        category: row.category as string,
        filePath: row.file_path as string,
        updatedAt: row.updated_at as string,
        version: row.version as number,
      });
    }
    stmt.free();
  } catch (err) {
    logger.error('Browse query failed:', err);
  }

  return result;
}

/**
 * Count total non-deleted entries, optionally filtered by category.
 */
export function countKnowledge(category?: string): number {
  if (!db) return 0;

  try {
    let sql = 'SELECT COUNT(*) as cnt FROM knowledge_index WHERE deleted_at IS NULL';
    const params: string[] = [];
    if (category) {
      sql += ' AND category = ?';
      params.push(category);
    }

    const stmt = db.prepare(sql);
    stmt.bind(params);
    if (stmt.step()) {
      const row = stmt.getAsObject();
      stmt.free();
      return row.cnt as number;
    }
    stmt.free();
    return 0;
  } catch {
    return 0;
  }
}

/**
 * Get deleted (trashed) entries with pagination.
 */
export function browseTrash(
  page: number = 1,
  size: number = 20,
): Array<{ id: string; name: string; category: string; filePath: string; deletedAt: string }> {
  if (!db) throw new Error('Knowledge DB not initialized');

  const result: Array<{
    id: string; name: string; category: string; filePath: string; deletedAt: string;
  }> = [];

  const offset = (page - 1) * size;

  try {
    const stmt = db.prepare(
      `SELECT id, name, category, file_path, deleted_at
       FROM knowledge_index
       WHERE deleted_at IS NOT NULL
       ORDER BY deleted_at DESC
       LIMIT ? OFFSET ?`,
    );
    stmt.bind([size, offset]);

    while (stmt.step()) {
      const row = stmt.getAsObject();
      result.push({
        id: row.id as string,
        name: row.name as string,
        category: row.category as string,
        filePath: row.file_path as string,
        deletedAt: row.deleted_at as string,
      });
    }
    stmt.free();
  } catch (err) {
    logger.error('Trash browse query failed:', err);
  }

  return result;
}

/**
 * Close the database connection.
 */
export async function closeKnowledgeDb(): Promise<void> {
  if (db) {
    await saveDb();
    db.close();
    db = null;
    logger.info('Knowledge DB closed');
  }
}
