// server/src/services/export-import.ts
// Knowledge export/import service — ZIP export and import (PRD-04 Section 2.5)

import path from 'path';
import fs from 'fs/promises';
import type { Response } from 'express';
import { createLogger } from '../utils/logger';
import { getWorkspaceRoot } from '../utils/file';
import { indexEntry, rebuildIndex } from '../db/knowledge';
import type { KnowledgeEntry } from '../types/knowledge';

// archiver is ESM-only in newer versions; use dynamic require for CommonJS compat
// eslint-disable-next-line @typescript-eslint/no-var-requires
const archiver: (format: string, options?: Record<string, unknown>) => {
  pipe: (destination: NodeJS.WritableStream) => void;
  append: (content: string | Buffer, options: { name: string }) => void;
  finalize: () => Promise<void>;
  on: (event: string, handler: (...args: any[]) => void) => void;
} = require('archiver');

const logger = createLogger('export-import');

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
 * Export all (or selected) knowledge entries as a ZIP file.
 * Streams directly to the Express response.
 */
export async function exportKnowledge(
  res: Response,
  categories?: string[],
): Promise<void> {
  const workspaceRoot = getWorkspaceRoot();
  const cats = categories || CATEGORIES;

  // Set response headers
  res.setHeader('Content-Type', 'application/zip');
  res.setHeader(
    'Content-Disposition',
    `attachment; filename="knowledge-backup-${new Date().toISOString().slice(0, 10)}.zip"`,
  );

  const archive = archiver('zip', { zlib: { level: 9 } });

  // Handle archive errors
  archive.on('error', (err) => {
    logger.error('Archive error:', err);
    if (!res.headersSent) {
      res.status(500).json({ error: '导出失败' });
    }
  });

  // Pipe to response
  archive.pipe(res);

  // Collect manifest data
  const manifest: {
    exportedAt: string;
    totalEntries: number;
    categories: Record<string, number>;
    entries: Array<{ id: string; name: string; category: string; version: number }>;
  } = {
    exportedAt: new Date().toISOString(),
    totalEntries: 0,
    categories: {},
    entries: [],
  };

  for (const category of cats) {
    const categoryDir = path.join(workspaceRoot, 'knowledge', category);
    let count = 0;

    try {
      const files = await fs.readdir(categoryDir);
      const jsonFiles = files.filter(
        (f) => f.endsWith('.json') && f !== '_index.json',
      );

      for (const file of jsonFiles) {
        try {
          const content = await fs.readFile(path.join(categoryDir, file), 'utf-8');
          const entry = JSON.parse(content) as KnowledgeEntry;

          // Skip trashed entries
          if (entry.deletedAt) continue;

          // Add to archive
          archive.append(JSON.stringify(entry, null, 2), {
            name: `${category}/${file}`,
          });

          manifest.entries.push({
            id: entry.id,
            name: entry.name,
            category: entry.category,
            version: entry.version,
          });

          count++;
          manifest.totalEntries++;
        } catch (err) {
          logger.warn(`Failed to add ${category}/${file} to export:`, err);
        }
      }
    } catch {
      // Category dir might not exist
    }

    manifest.categories[category] = count;
  }

  // Add manifest.json
  archive.append(JSON.stringify(manifest, null, 2), {
    name: 'manifest.json',
  });

  // Finalize
  await archive.finalize();
  logger.info(`Export complete: ${manifest.totalEntries} entries in ${Object.keys(manifest.categories).length} categories`);
}

/**
 * Import knowledge entries from a ZIP file buffer.
 * Returns import statistics.
 */
export async function importKnowledge(
  zipBuffer: Buffer,
): Promise<{ imported: number; skipped: number; errors: string[] }> {
  const unzipper = (await import('unzipper')).default;
  const workspaceRoot = getWorkspaceRoot();
  const result = { imported: 0, skipped: 0, errors: [] as string[] };

  let directory: any;
  try {
    directory = await unzipper.Open.buffer(zipBuffer);
  } catch (err) {
    result.errors.push(`无法解压ZIP文件: ${err instanceof Error ? err.message : '未知错误'}`);
    return result;
  }

  for (const file of directory.files) {
    const filePath: string = file.path;

    // Skip directories and manifest
    if (file.type === 'Directory' || filePath === 'manifest.json') {
      continue;
    }

    // Parse path: should be <category>/<filename>.json
    const parts = filePath.split('/');
    if (parts.length !== 2) {
      result.skipped++;
      continue;
    }

    const [category, filename] = parts;

    // Validate category
    if (!CATEGORIES.includes(category)) {
      result.skipped++;
      continue;
    }

    if (!filename.endsWith('.json')) {
      result.skipped++;
      continue;
    }

    try {
      // Read file content
      const content = (await file.buffer()).toString('utf-8');
      const entryData = JSON.parse(content);

      // Basic validation
      if (!entryData.id || !entryData.name || !entryData.category) {
        result.skipped++;
        continue;
      }

      // Ensure category matches directory
      if (entryData.category !== category) {
        result.skipped++;
        continue;
      }

      const entry = entryData as KnowledgeEntry;

      // Check if entry already exists
      const categoryDir = path.join(workspaceRoot, 'knowledge', category);
      const destPath = path.join(categoryDir, filename);

      try {
        await fs.access(destPath);
        // File exists — skip (version could be checked in future)
        result.skipped++;
        continue;
      } catch {
        // File doesn't exist — import it
      }

      // Ensure directory exists
      await fs.mkdir(categoryDir, { recursive: true });

      // Mark as imported
      entry.updatedAt = new Date().toISOString();
      if (entry.deletedAt) entry.deletedAt = undefined;

      // Write to disk
      await fs.writeFile(destPath, JSON.stringify(entry, null, 2), 'utf-8');

      // Index in DB
      indexEntry(entry);

      result.imported++;
    } catch (err) {
      const errorMsg = `导入 ${filePath} 失败: ${err instanceof Error ? err.message : '未知错误'}`;
      result.errors.push(errorMsg);
      logger.warn(errorMsg);
    }
  }

  // Rebuild index to ensure consistency
  try {
    await rebuildIndex();
  } catch (err) {
    logger.warn('Failed to rebuild index after import:', err);
  }

  logger.info(
    `Import complete: ${result.imported} imported, ${result.skipped} skipped, ${result.errors.length} errors`,
  );
  return result;
}
