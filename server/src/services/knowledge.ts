// server/src/services/knowledge.ts
// Knowledge merge service — handles extracting, merging, and persisting knowledge entries.
// Implements the merge rules from PRD-03 Section 2.3.

import path from 'path';
import fs from 'fs/promises';
import { createLogger } from '../utils/logger';
import { getWorkspaceRoot } from '../utils/file';
import {
  indexEntry,
} from '../db/knowledge';
import type {
  KnowledgeEntry,
  RawKnowledgeEntry,
  MergeResult,
  ConflictRecord,
  SourceInfo,
} from '../types/knowledge';

const logger = createLogger('knowledge-service');

/**
 * Sanitize a name for use in a filename.
 */
function sanitizeFilename(name: string): string {
  // Replace characters unsafe for filenames
  return name
    .replace(/[<>:"/\\|?*]/g, '_')
    .replace(/\s+/g, '_')
    .slice(0, 100);
}

/**
 * Create a new KnowledgeEntry from a raw extracted entry.
 */
function createEntry(
  raw: RawKnowledgeEntry,
  category: string,
  source: SourceInfo,
): KnowledgeEntry {
  const id = `${category.slice(0, 3)}_${sanitizeFilename(raw.name)}_${Date.now().toString(36)}`;
  const now = new Date().toISOString();

  return {
    id,
    category,
    name: raw.name,
    aliases: raw.aliases || [],
    attributes: raw.attributes || {},
    description: raw.description || '',
    relations: raw.relations || [],
    source: [source],
    version: 1,
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * Normalized Levenshtein similarity at character level (0.0 to 1.0).
 * Works well for Chinese text since each Chinese character is a unit.
 */
export function nameSimilarity(a: string, b: string): number {
  if (a === b) return 1.0;
  if (!a || !b) return 0.0;

  const longer = a.length > b.length ? a : b;
  const shorter = a.length > b.length ? b : a;

  if (longer.length === 0) return 1.0;

  // Quick check: if shorter is a substring of longer, that's pretty similar
  if (longer.includes(shorter)) return 0.9;

  // Levenshtein distance
  const matrix: number[] = [];
  for (let i = 0; i <= shorter.length; i++) {
    matrix[i] = i;
  }

  for (let j = 1; j <= longer.length; j++) {
    let prevDiagonal = matrix[0];
    matrix[0] = j;

    for (let i = 1; i <= shorter.length; i++) {
      const temp = matrix[i];
      if (longer[j - 1] === shorter[i - 1]) {
        matrix[i] = prevDiagonal;
      } else {
        matrix[i] = Math.min(matrix[i - 1], matrix[i], prevDiagonal) + 1;
      }
      prevDiagonal = temp;
    }
  }

  const distance = matrix[shorter.length];
  return 1 - distance / Math.max(longer.length, shorter.length);
}

/**
 * Detect if two values conflict according to PRD-03 Section 2.3.2 rules.
 * Returns a ConflictRecord if conflict detected, null otherwise.
 */
export function detectConflict(
  field: string,
  oldValue: unknown,
  newValue: unknown,
  sourceChapter: number,
): ConflictRecord | null {
  // If values are the same, no conflict
  if (oldValue === newValue) return null;

  // If both are undefined/null, no conflict
  if (oldValue == null && newValue == null) return null;

  // If one is null/undefined and the other isn't — this is a supplement, not conflict
  if (oldValue == null || newValue == null) return null;

  // Type mismatch — potential conflict
  if (typeof oldValue !== typeof newValue) {
    return {
      field,
      oldValue,
      newValue,
      sourceChapter,
      detectedAt: new Date().toISOString(),
      resolved: false,
    };
  }

  // For arrays: check if items were removed/replaced (not just appended)
  if (Array.isArray(oldValue) && Array.isArray(newValue)) {
    const removed = oldValue.filter((v) => !newValue.includes(v));
    if (removed.length > 0) {
      return {
        field,
        oldValue,
        newValue,
        sourceChapter,
        detectedAt: new Date().toISOString(),
        resolved: false,
      };
    }
    // If new is just a superset of old, it's a supplement — no conflict
    return null;
  }

  // For objects: shallow compare keys
  if (typeof oldValue === 'object' && typeof newValue === 'object') {
    // Delegate to mergeAttributes for recursive check
    return null;
  }

  // For strings: check if semantically significant fields changed
  if (typeof oldValue === 'string' && typeof newValue === 'string') {
    // Fields where any change is significant (always flag conflict)
    const criticalFields = ['gender', 'status', 'type'];
    if (criticalFields.includes(field) && oldValue !== newValue) {
      return {
        field,
        oldValue,
        newValue,
        sourceChapter,
        detectedAt: new Date().toISOString(),
        resolved: false,
        resolution: undefined,
      };
    }
  }

  // For numbers: flag if change exceeds threshold
  if (typeof oldValue === 'number' && typeof newValue === 'number') {
    // Age jumping more than 3 (excluding normal aging accounted by time passes)
    if (field === 'age' && Math.abs(newValue - oldValue) > 3) {
      return {
        field,
        oldValue,
        newValue,
        sourceChapter,
        detectedAt: new Date().toISOString(),
        resolved: false,
      };
    }
    // Other numeric values: flag if significantly different
    if (field !== 'age' && oldValue !== newValue) {
      return {
        field,
        oldValue,
        newValue,
        sourceChapter,
        detectedAt: new Date().toISOString(),
        resolved: false,
      };
    }
  }

  // Default: if values differ at all for scalars, flag as potential conflict
  if (oldValue !== newValue) {
    return {
      field,
      oldValue,
      newValue,
      sourceChapter,
      detectedAt: new Date().toISOString(),
      resolved: false,
    };
  }

  return null;
}

/**
 * Merge attributes from incoming entry into existing entry.
 * Returns updated attributes and any detected conflicts.
 */
export function mergeAttributes(
  existing: Record<string, unknown>,
  incoming: Record<string, unknown>,
  sourceChapter: number,
): { merged: Record<string, unknown>; conflicts: ConflictRecord[] } {
  const merged = { ...existing };
  const conflicts: ConflictRecord[] = [];

  for (const [key, newVal] of Object.entries(incoming)) {
    if (newVal === undefined || newVal === null) continue;

    const oldVal = merged[key];

    // New field — add it
    if (oldVal === undefined || oldVal === null) {
      merged[key] = newVal;
      continue;
    }

    // Both exist and are non-null — check for conflict
    const conflict = detectConflict(key, oldVal, newVal, sourceChapter);
    if (conflict) {
      conflicts.push(conflict);
      // Don't overwrite — keep old value for now, user will resolve
    } else {
      // Safe to merge
      if (Array.isArray(oldVal) && Array.isArray(newVal)) {
        // Merge arrays (union)
        merged[key] = [...new Set([...oldVal, ...newVal])];
      } else {
        merged[key] = newVal;
      }
    }
  }

  return { merged, conflicts };
}

/**
 * Load all entries from a category
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
    await fs.mkdir(categoryDir, { recursive: true });
  }

  return entries;
}

/**
 * Save a knowledge entry to disk.
 */
export async function saveEntry(entry: KnowledgeEntry): Promise<void> {
  const workspaceRoot = getWorkspaceRoot();
  const categoryDir = path.join(workspaceRoot, 'knowledge', entry.category);
  await fs.mkdir(categoryDir, { recursive: true });

  const filename = `${sanitizeFilename(entry.id)}.json`;
  const filePath = path.join(categoryDir, filename);

  await fs.writeFile(filePath, JSON.stringify(entry, null, 2), 'utf-8');
  logger.debug(`Saved entry: ${entry.name} -> ${filePath}`);
}

/**
 * Main merge pipeline.
 * Merges newly extracted entries into the existing knowledge base.
 */
export async function mergeExtractionResults(
  newEntries: RawKnowledgeEntry[],
  category: string,
  chapterIndex: number,
  chapterTitle: string,
): Promise<MergeResult> {
  const result: MergeResult = {
    added: [],
    merged: [],
    conflicts: [],
  };

  const source: SourceInfo = {
    chapter: chapterIndex,
    chapterTitle,
    excerpt: '',
    extractedAt: new Date().toISOString(),
  };

  // Load existing entries in this category
  const existingEntries = await loadCategoryEntries(category);

  // Build a lookup by name for O(1) exact match
  const nameMap = new Map<string, KnowledgeEntry>();
  for (const entry of existingEntries) {
    nameMap.set(entry.name, entry);
  }

  for (const raw of newEntries) {
    // Build source info with excerpt from the raw entry if available
    const entrySource: SourceInfo = {
      chapter: chapterIndex,
      chapterTitle,
      excerpt: raw.excerpt || '',
      extractedAt: new Date().toISOString(),
    };

    // 1. Try exact name match
    const exactMatch = nameMap.get(raw.name);

    if (exactMatch) {
      // Found exact match — merge attributes
      const { merged: mergedAttrs, conflicts } = mergeAttributes(
        exactMatch.attributes,
        raw.attributes,
        chapterIndex,
      );

      exactMatch.attributes = mergedAttrs;
      exactMatch.description = raw.description || exactMatch.description;

      // Merge aliases
      if (raw.aliases) {
        exactMatch.aliases = [
          ...new Set([...exactMatch.aliases, ...raw.aliases]),
        ];
      }

      // Merge relations with dedup by targetName + relationType
      if (raw.relations && raw.relations.length > 0) {
        const existingKeys = new Set(
          exactMatch.relations.map((r) => `${r.targetName}|${r.relationType}`),
        );
        for (const rel of raw.relations) {
          const key = `${rel.targetName}|${rel.relationType}`;
          if (!existingKeys.has(key)) {
            exactMatch.relations.push(rel);
            existingKeys.add(key);
          }
        }
      }

      // Add source
      exactMatch.source.push(entrySource);
      exactMatch.version += 1;
      exactMatch.updatedAt = new Date().toISOString();

      // Append conflicts
      if (conflicts.length > 0) {
        exactMatch.conflicts = [...(exactMatch.conflicts || []), ...conflicts];
        result.conflicts.push(...conflicts);
      }

      await saveEntry(exactMatch);
      indexEntry(exactMatch);
      result.merged.push(exactMatch.name);

      logger.debug(
        `Merged entry: ${raw.name} (version ${exactMatch.version}, conflicts=${conflicts.length})`,
      );
    } else {
      // 2. No exact match — check similarity against all entries
      let bestMatch: KnowledgeEntry | null = null;
      let bestScore = 0;

      for (const existing of existingEntries) {
        const score = nameSimilarity(raw.name, existing.name);
        if (score > bestScore && score > 0.8) {
          bestScore = score;
          bestMatch = existing;
        }
      }

      if (bestMatch) {
        // Similar enough — merge as same entity
        const { merged: mergedAttrs, conflicts } = mergeAttributes(
          bestMatch.attributes,
          raw.attributes,
          chapterIndex,
        );

        bestMatch.attributes = mergedAttrs;
        bestMatch.description = raw.description || bestMatch.description;

        if (raw.aliases) {
          bestMatch.aliases = [
            ...new Set([...bestMatch.aliases, ...raw.aliases, raw.name]),
          ];
        } else {
          bestMatch.aliases = [...new Set([...bestMatch.aliases, raw.name])];
        }

        if (raw.relations && raw.relations.length > 0) {
          const existingKeys = new Set(
            bestMatch.relations.map((r) => `${r.targetName}|${r.relationType}`),
          );
          for (const rel of raw.relations) {
            const key = `${rel.targetName}|${rel.relationType}`;
            if (!existingKeys.has(key)) {
              bestMatch.relations.push(rel);
              existingKeys.add(key);
            }
          }
        }

        bestMatch.source.push(entrySource);
        bestMatch.version += 1;
        bestMatch.updatedAt = new Date().toISOString();

        if (conflicts.length > 0) {
          bestMatch.conflicts = [
            ...(bestMatch.conflicts || []),
            ...conflicts,
          ];
          result.conflicts.push(...conflicts);
        }

        await saveEntry(bestMatch);
        indexEntry(bestMatch);
        result.merged.push(bestMatch.name);

        logger.debug(
          `Similarity-merged: "${raw.name}" -> "${bestMatch.name}" (score=${bestScore.toFixed(2)})`,
        );
      } else {
        // 3. New entry — create
        const newEntry = createEntry(raw, category, source);
        await saveEntry(newEntry);
        indexEntry(newEntry);
        result.added.push(newEntry.name);

        logger.debug(`New entry: ${raw.name} (${category})`);
      }
    }
  }

  logger.info(
    `Merge complete for category="${category}" chapter=${chapterIndex}: added=${result.added.length}, merged=${result.merged.length}, conflicts=${result.conflicts.length}`,
  );

  return result;
}

/**
 * Get all unresolved conflicts across all knowledge entries.
 */
export async function getAllConflicts(): Promise<
  Array<{ entry: KnowledgeEntry; conflicts: ConflictRecord[] }>
> {
  const categories = [
    'characters',
    'techniques',
    'locations',
    'worldbuilding',
    'weapons',
    'alchemy',
    'plot',
  ];

  const results: Array<{ entry: KnowledgeEntry; conflicts: ConflictRecord[] }> = [];

  for (const category of categories) {
    const entries = await loadCategoryEntries(category);
    for (const entry of entries) {
      if (entry.conflicts && entry.conflicts.length > 0) {
        const unresolved = entry.conflicts.filter((c) => !c.resolved);
        if (unresolved.length > 0) {
          results.push({
            entry,
            conflicts: unresolved,
          });
        }
      }
    }
  }

  return results;
}

/**
 * Resolve a single conflict.
 */
export async function resolveConflict(
  entryId: string,
  conflictIndex: number,
  resolution: 'accept_new' | 'keep_old' | 'manual',
  manualValue?: unknown,
): Promise<KnowledgeEntry | null> {
  const categories = [
    'characters',
    'techniques',
    'locations',
    'worldbuilding',
    'weapons',
    'alchemy',
    'plot',
  ];

  for (const category of categories) {
    const entries = await loadCategoryEntries(category);
    const entry = entries.find((e) => e.id === entryId);

    if (!entry || !entry.conflicts) continue;

    const conflict = entry.conflicts[conflictIndex];
    if (!conflict || conflict.resolved) return null;

    // Apply resolution
    switch (resolution) {
      case 'accept_new':
        entry.attributes[conflict.field] = conflict.newValue;
        break;
      case 'keep_old':
        // Keep old value — nothing to change
        break;
      case 'manual':
        entry.attributes[conflict.field] = manualValue;
        break;
    }

    conflict.resolved = true;
    conflict.resolution = resolution;
    if (manualValue !== undefined) {
      conflict.manualValue = manualValue;
    }

    entry.updatedAt = new Date().toISOString();

    await saveEntry(entry);
    indexEntry(entry);

    logger.info(`Resolved conflict: ${entry.name}#${conflict.field} -> ${resolution}`);
    return entry;
  }

  return null;
}

/**
 * Batch resolve multiple conflicts.
 */
export async function batchResolveConflicts(
  resolutions: Array<{
    entryId: string;
    conflictIndex: number;
    resolution: 'accept_new' | 'keep_old' | 'manual';
    manualValue?: unknown;
  }>,
): Promise<number> {
  let resolved = 0;
  for (const res of resolutions) {
    const result = await resolveConflict(
      res.entryId,
      res.conflictIndex,
      res.resolution,
      res.manualValue,
    );
    if (result) resolved++;
  }
  return resolved;
}
