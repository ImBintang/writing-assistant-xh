// server/src/services/knowledge-management.ts
// Knowledge CRUD, trash, and version management service (PRD-04)

import path from 'path';
import fs from 'fs/promises';
import { createLogger } from '../utils/logger';
import { getWorkspaceRoot } from '../utils/file';
import {
  indexEntry,
  deindexEntry,
  markDeleted,
  markRestored,
  browseKnowledg,
  countKnowledge,
  searchKnowledge,
} from '../db/knowledge';
import type {
  KnowledgeEntry,
  VersionRecord,
  ChangeRecord,
} from '../types/knowledge';

const logger = createLogger('knowledge-mgmt');

const CATEGORIES = [
  'characters',
  'techniques',
  'locations',
  'worldbuilding',
  'weapons',
  'alchemy',
  'plot',
];

/**
 * Sanitize a name for use in a filename/id.
 */
function sanitizeFilename(name: string): string {
  return name
    .replace(/[<>:"/\\|?*]/g, '_')
    .replace(/\s+/g, '_')
    .slice(0, 100);
}

/**
 * Load all entries from a specific category directory (including trashed).
 */
async function loadCategoryEntries(category: string): Promise<KnowledgeEntry[]> {
  const workspaceRoot = getWorkspaceRoot();
  const categoryDir = path.join(workspaceRoot, 'knowledge', category);
  const entries: KnowledgeEntry[] = [];

  try {
    const files = await fs.readdir(categoryDir);
    const jsonFiles = files.filter(
      (f) => f.endsWith('.json') && f !== '_index.json',
    );

    for (const file of jsonFiles) {
      try {
        const content = await fs.readFile(path.join(categoryDir, file), 'utf-8');
        entries.push(JSON.parse(content) as KnowledgeEntry);
      } catch {
        // Skip malformed files
      }
    }
  } catch {
    // Directory might not exist yet
  }

  return entries;
}

/**
 * Find a knowledge entry by its ID across all categories.
 */
export async function getEntryById(id: string): Promise<KnowledgeEntry | null> {
  for (const category of CATEGORIES) {
    const entries = await loadCategoryEntries(category);
    const entry = entries.find((e) => e.id === id);
    if (entry) return entry;
  }

  // Also check trash
  const workspaceRoot = getWorkspaceRoot();
  for (const category of CATEGORIES) {
    const trashDir = path.join(workspaceRoot, 'knowledge', '_trash', category);
    try {
      const files = await fs.readdir(trashDir);
      const jsonFiles = files.filter((f) => f.endsWith('.json'));
      for (const file of jsonFiles) {
        try {
          const content = await fs.readFile(path.join(trashDir, file), 'utf-8');
          const entry = JSON.parse(content) as KnowledgeEntry;
          if (entry.id === id) return entry;
        } catch { /* skip */ }
      }
    } catch { /* directory might not exist */ }
  }

  return null;
}

/**
 * Create a new knowledge entry.
 */
export async function createEntry(data: {
  name: string;
  category: string;
  aliases?: string[];
  attributes?: Record<string, unknown>;
  description?: string;
  relations?: Array<{ targetId?: string; targetName: string; relationType: string; description: string }>;
}): Promise<KnowledgeEntry> {
  const now = new Date().toISOString();
  const id = `${data.category.slice(0, 3)}_${sanitizeFilename(data.name)}_${Date.now().toString(36)}`;

  const entry: KnowledgeEntry = {
    id,
    category: data.category,
    name: data.name,
    aliases: data.aliases || [],
    attributes: data.attributes || {},
    description: data.description || '',
    relations: (data.relations || []).map((r) => ({
      targetId: r.targetId || '',
      targetName: r.targetName,
      relationType: r.relationType,
      description: r.description || '',
    })),
    source: [],
    version: 1,
    createdAt: now,
    updatedAt: now,
    versionHistory: [
      {
        version: 1,
        timestamp: now,
        changedFields: ['name', 'category', 'attributes', 'description', 'relations'],
        snapshot: {},
        reason: 'manual_edit',
        editorNote: '手动创建条目',
      },
    ],
    manualEdited: true,
  };

  await saveEntry(entry);
  indexEntry(entry);
  logger.info(`Created entry: ${entry.name} (${entry.category})`);
  return entry;
}

/**
 * Save a knowledge entry to disk.
 */
async function saveEntry(entry: KnowledgeEntry): Promise<void> {
  const workspaceRoot = getWorkspaceRoot();
  const categoryDir = path.join(workspaceRoot, 'knowledge', entry.category);
  await fs.mkdir(categoryDir, { recursive: true });

  const filename = `${sanitizeFilename(entry.id)}.json`;
  const filePath = path.join(categoryDir, filename);

  await fs.writeFile(filePath, JSON.stringify(entry, null, 2), 'utf-8');
}

/**
 * Update a knowledge entry — creates version snapshot, increments version.
 */
export async function updateEntry(
  id: string,
  data: {
    name?: string;
    category?: string;
    aliases?: string[];
    attributes?: Record<string, unknown>;
    description?: string;
    relations?: Array<{ targetId?: string; targetName: string; relationType: string; description: string }>;
    editorNote?: string;
  },
): Promise<KnowledgeEntry | null> {
  const entry = await getEntryById(id);
  if (!entry) return null;

  const now = new Date().toISOString();
  const changedFields: string[] = [];

  // Snapshot current state before changes
  const snapshot: Record<string, unknown> = {
    name: entry.name,
    category: entry.category,
    aliases: [...entry.aliases],
    attributes: { ...entry.attributes },
    description: entry.description,
    relations: JSON.parse(JSON.stringify(entry.relations)),
  };

  // Apply changes
  if (data.name !== undefined && data.name !== entry.name) {
    entry.name = data.name;
    changedFields.push('name');
  }
  if (data.category !== undefined && data.category !== entry.category) {
    // Move file between category directories
    entry.category = data.category;
    changedFields.push('category');
  }
  if (data.aliases !== undefined) {
    entry.aliases = data.aliases;
    changedFields.push('aliases');
  }
  if (data.attributes !== undefined) {
    // Track which attribute fields changed
    for (const [key, val] of Object.entries(data.attributes)) {
      if (JSON.stringify(entry.attributes[key]) !== JSON.stringify(val)) {
        changedFields.push(`attributes.${key}`);
      }
    }
    entry.attributes = { ...entry.attributes, ...data.attributes };
  }
  if (data.description !== undefined && data.description !== entry.description) {
    entry.description = data.description;
    changedFields.push('description');
  }
  if (data.relations !== undefined) {
    entry.relations = data.relations.map((r) => ({
      targetId: r.targetId || '',
      targetName: r.targetName,
      relationType: r.relationType,
      description: r.description || '',
    }));
    changedFields.push('relations');
  }

  if (changedFields.length === 0) {
    return entry; // No changes
  }

  // Push version history
  const versionRecord: VersionRecord = {
    version: entry.version + 1,
    timestamp: now,
    changedFields,
    snapshot,
    reason: 'manual_edit',
    editorNote: data.editorNote || '手动编辑',
  };

  entry.version = versionRecord.version;
  entry.updatedAt = now;
  entry.manualEdited = true;

  if (!entry.versionHistory) {
    entry.versionHistory = [];
  }
  entry.versionHistory.push(versionRecord);

  await saveEntry(entry);
  indexEntry(entry);
  logger.info(`Updated entry: ${entry.name} (v${entry.version}, fields: ${changedFields.join(', ')})`);
  return entry;
}

/**
 * Soft-delete an entry — move to _trash directory, mark in DB.
 */
export async function deleteEntry(id: string): Promise<KnowledgeEntry | null> {
  const entry = await getEntryById(id);
  if (!entry) return null;
  if (entry.deletedAt) return null; // Already deleted

  const workspaceRoot = getWorkspaceRoot();
  const categoryDir = path.join(workspaceRoot, 'knowledge', entry.category);
  const trashCategoryDir = path.join(workspaceRoot, 'knowledge', '_trash', entry.category);

  const filename = `${sanitizeFilename(entry.id)}.json`;
  const srcPath = path.join(categoryDir, filename);
  const dstPath = path.join(trashCategoryDir, filename);

  // Set deleted timestamp
  entry.deletedAt = new Date().toISOString();
  entry.updatedAt = entry.deletedAt;

  // Move to trash
  await fs.mkdir(trashCategoryDir, { recursive: true });
  try {
    // Write updated entry to trash location
    await fs.writeFile(dstPath, JSON.stringify(entry, null, 2), 'utf-8');
    // Remove from original location
    await fs.unlink(srcPath).catch(() => {});
  } catch (err) {
    logger.error(`Failed to move entry to trash: ${entry.name}`, err);
    return null;
  }

  markDeleted(entry.id);
  logger.info(`Soft-deleted entry: ${entry.name} (${entry.category})`);
  return entry;
}

/**
 * Batch soft-delete multiple entries by ID.
 * Returns count of successfully deleted entries.
 */
export async function batchDeleteEntries(ids: string[]): Promise<{ deleted: number; errors: string[] }> {
  let deleted = 0;
  const errors: string[] = [];

  for (const id of ids) {
    try {
      const result = await deleteEntry(id);
      if (result) {
        deleted++;
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      errors.push(`删除 ${id} 失败: ${message}`);
    }
  }

  logger.info(`Batch deleted ${deleted}/${ids.length} entries`);
  return { deleted, errors };
}

/**
 * Restore an entry from trash to its original category.
 */
export async function restoreEntry(id: string): Promise<KnowledgeEntry | null> {
  // Look in trash
  const workspaceRoot = getWorkspaceRoot();
  const trashBase = path.join(workspaceRoot, 'knowledge', '_trash');

  for (const category of CATEGORIES) {
    const trashDir = path.join(trashBase, category);
    const filename = `${sanitizeFilename(id)}.json`;
    const trashPath = path.join(trashDir, filename);

    try {
      const content = await fs.readFile(trashPath, 'utf-8');
      const entry = JSON.parse(content) as KnowledgeEntry;

      if (entry.id !== id) continue;

      // Clear deletedAt
      entry.deletedAt = undefined;
      entry.updatedAt = new Date().toISOString();

      // Move back to category dir
      const categoryDir = path.join(workspaceRoot, 'knowledge', category);
      const dstPath = path.join(categoryDir, filename);

      await fs.writeFile(dstPath, JSON.stringify(entry, null, 2), 'utf-8');
      await fs.unlink(trashPath).catch(() => {});

      markRestored(entry.id);
      indexEntry(entry);
      logger.info(`Restored entry: ${entry.name} (${entry.category})`);
      return entry;
    } catch {
      continue;
    }
  }

  return null;
}

/**
 * Permanently delete all trashed entries.
 */
export async function emptyTrash(): Promise<number> {
  const workspaceRoot = getWorkspaceRoot();
  const trashBase = path.join(workspaceRoot, 'knowledge', '_trash');
  let count = 0;

  for (const category of CATEGORIES) {
    const trashDir = path.join(trashBase, category);
    try {
      const files = await fs.readdir(trashDir);
      for (const file of files) {
        try {
          const content = await fs.readFile(path.join(trashDir, file), 'utf-8');
          const entry = JSON.parse(content) as KnowledgeEntry;
          deindexEntry(entry.id);
          await fs.unlink(path.join(trashDir, file));
          count++;
        } catch { /* skip */ }
      }
    } catch { /* dir might not exist */ }
  }

  logger.info(`Emptied trash: ${count} entries permanently deleted`);
  return count;
}

/**
 * Add a relation to an existing entry.
 */
export async function addRelation(
  entryId: string,
  relation: { targetId?: string; targetName: string; relationType: string; description: string },
): Promise<KnowledgeEntry | null> {
  const entry = await getEntryById(entryId);
  if (!entry) return null;

  const now = new Date().toISOString();

  // Snapshot
  const snapshot: Record<string, unknown> = {
    relations: JSON.parse(JSON.stringify(entry.relations)),
  };

  entry.relations.push({
    targetId: relation.targetId || '',
    targetName: relation.targetName,
    relationType: relation.relationType,
    description: relation.description || '',
  });

  const versionRecord: VersionRecord = {
    version: entry.version + 1,
    timestamp: now,
    changedFields: ['relations'],
    snapshot,
    reason: 'manual_edit',
    editorNote: '添加关联',
  };

  entry.version = versionRecord.version;
  entry.updatedAt = now;
  entry.manualEdited = true;
  if (!entry.versionHistory) entry.versionHistory = [];
  entry.versionHistory.push(versionRecord);

  await saveEntry(entry);
  indexEntry(entry);
  return entry;
}

/**
 * Remove a relation from an entry by array index.
 */
export async function removeRelation(
  entryId: string,
  relationIndex: number,
): Promise<KnowledgeEntry | null> {
  const entry = await getEntryById(entryId);
  if (!entry) return null;
  if (relationIndex < 0 || relationIndex >= entry.relations.length) return null;

  const now = new Date().toISOString();
  const snapshot: Record<string, unknown> = {
    relations: JSON.parse(JSON.stringify(entry.relations)),
  };

  entry.relations.splice(relationIndex, 1);

  const versionRecord: VersionRecord = {
    version: entry.version + 1,
    timestamp: now,
    changedFields: ['relations'],
    snapshot,
    reason: 'manual_edit',
    editorNote: '删除关联',
  };

  entry.version = versionRecord.version;
  entry.updatedAt = now;
  entry.manualEdited = true;
  if (!entry.versionHistory) entry.versionHistory = [];
  entry.versionHistory.push(versionRecord);

  await saveEntry(entry);
  indexEntry(entry);
  return entry;
}

/**
 * Browse entries with pagination and optional category filter.
 */
export async function browseEntries(
  category?: string,
  page: number = 1,
  size: number = 20,
  sort: 'name' | 'updatedAt' = 'updatedAt',
): Promise<{ entries: KnowledgeEntry[]; total: number }> {
  const rows = browseKnowledg(category, page, size, sort);
  const total = countKnowledge(category);

  // Load full entries from disk based on the indexed rows
  const entries: KnowledgeEntry[] = [];
  for (const row of rows) {
    const entry = await getEntryById(row.id);
    if (entry) {
      entries.push(entry);
    }
  }

  return { entries, total };
}

/**
 * Get category counts (non-deleted entries per category).
 */
export async function getCategoryCounts(): Promise<Record<string, number>> {
  const counts: Record<string, number> = {};
  for (const category of CATEGORIES) {
    counts[category] = countKnowledge(category);
  }
  return counts;
}

/**
 * Get trash entries with pagination.
 */
export async function getTrashEntries(
  page: number = 1,
  size: number = 20,
): Promise<{ entries: KnowledgeEntry[]; total: number }> {
  const workspaceRoot = getWorkspaceRoot();
  const trashBase = path.join(workspaceRoot, 'knowledge', '_trash');
  const allTrash: KnowledgeEntry[] = [];

  for (const category of CATEGORIES) {
    const trashDir = path.join(trashBase, category);
    try {
      const files = await fs.readdir(trashDir);
      for (const file of files) {
        if (!file.endsWith('.json')) continue;
        try {
          const content = await fs.readFile(path.join(trashDir, file), 'utf-8');
          allTrash.push(JSON.parse(content) as KnowledgeEntry);
        } catch { /* skip */ }
      }
    } catch { /* dir might not exist */ }
  }

  // Sort by deletedAt descending
  allTrash.sort((a, b) => (b.deletedAt || '').localeCompare(a.deletedAt || ''));

  const total = allTrash.length;
  const start = (page - 1) * size;
  const paged = allTrash.slice(start, start + size);

  return { entries: paged, total };
}

/**
 * Get version history for an entry.
 */
export async function getVersionHistory(id: string): Promise<VersionRecord[] | null> {
  const entry = await getEntryById(id);
  if (!entry) return null;
  return entry.versionHistory || [];
}

/**
 * Get recent changes across all knowledge entries.
 */
export async function getRecentChanges(
  limit: number = 10,
): Promise<ChangeRecord[]> {
  const changes: ChangeRecord[] = [];

  for (const category of CATEGORIES) {
    const entries = await loadCategoryEntries(category);
    for (const entry of entries) {
      if (entry.deletedAt) continue;

      // Use version history for detailed change records
      if (entry.versionHistory && entry.versionHistory.length > 0) {
        for (const versionRecord of entry.versionHistory) {
          changes.push({
            entryId: entry.id,
            entryName: entry.name,
            category: entry.category,
            changeType: versionRecord.version === 1 ? 'created' : 'updated',
            timestamp: versionRecord.timestamp,
            version: versionRecord.version,
            changedFields: versionRecord.changedFields,
          });
        }
      } else {
        // Fallback: use basic entry metadata
        changes.push({
          entryId: entry.id,
          entryName: entry.name,
          category: entry.category,
          changeType: entry.version === 1 ? 'created' : 'updated',
          timestamp: entry.updatedAt,
          version: entry.version,
        });
      }
    }
  }

  // Sort by timestamp descending, take limit
  changes.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
  return changes.slice(0, limit);
}

/**
 * Search knowledge entries using FTS5.
 */
export function searchEntries(
  query: string,
  category?: string,
  page: number = 1,
  size: number = 20,
) {
  return searchKnowledge(query, category, page, size);
}

// Re-export categories for use by routes
export { CATEGORIES };
