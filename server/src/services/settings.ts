// server/src/services/settings.ts
// Setting file management service for PRD-06
// Handles CRUD for .md setting files, knowledge references, and migration to knowledge base.

import { createLogger } from '../utils/logger';
import { readFile, writeFile, deleteFile, listDir } from '../utils/file';
import { searchKnowledge } from '../db/knowledge';
import type {
  SettingFile,
  SettingFrontmatter,
  SettingCategory,
  MigrationPreview,
  MigrationItem,
  FieldMapping,
  MigrateConfirmResult,
} from '../types/knowledge';
import { mergeAttributes, saveEntry } from './knowledge';
import { createEntry as createKnowledgeEntry, getEntryById } from './knowledge-management';

const logger = createLogger('settings-service');

const ALL_SETTING_CATEGORIES: SettingCategory[] = [
  'characters',
  'techniques',
  'plot',
  'alchemy',
  'map',
  'organization',
  'other',
];

// ============================================================
// Frontmatter parsing helpers
// ============================================================

/**
 * Parse YAML-like frontmatter from .md content between --- delimiters.
 */
function parseFrontmatter(raw: string): { frontmatter: Partial<SettingFrontmatter>; body: string } {
  const lines = raw.split('\n');
  const frontmatter: Partial<SettingFrontmatter> = { references: [] };

  if (lines[0]?.trim() === '---') {
    let endIdx = -1;
    for (let i = 1; i < lines.length; i++) {
      if (lines[i].trim() === '---') {
        endIdx = i;
        break;
      }

      const match = lines[i].match(/^(\w+):\s*(.*)$/);
      if (match) {
        const key = match[1];
        let value: unknown = match[2].trim();

        // Parse array values like [a, b, c]
        if (typeof value === 'string' && value.startsWith('[') && value.endsWith(']')) {
          const inner = value.slice(1, -1);
          if (inner.length === 0) {
            value = [];
          } else {
            value = inner
              .split(',')
              .map((s) => s.trim().replace(/^['"]|['"]$/g, ''));
          }
        }

        (frontmatter as Record<string, unknown>)[key] = value;
      }
    }

    if (endIdx > 0) {
      const body = lines.slice(endIdx + 1).join('\n').trim();
      return { frontmatter, body };
    }
  }

  // No frontmatter found — entire file is body
  return { frontmatter, body: raw.trim() };
}

/**
 * Serialize frontmatter and body back into a .md file string.
 */
function serializeSetting(fm: SettingFrontmatter, body: string): string {
  const lines = ['---'];

  lines.push(`id: ${fm.id}`);
  lines.push(`title: ${fm.title}`);
  lines.push(`category: ${fm.category}`);
  if (fm.template) lines.push(`template: ${fm.template}`);
  lines.push(`status: ${fm.status}`);
  lines.push(`references: [${fm.references.join(', ')}]`);
  lines.push(`createdAt: ${fm.createdAt}`);
  lines.push(`updatedAt: ${fm.updatedAt}`);

  lines.push('---');
  lines.push('');
  lines.push(body);

  return lines.join('\n') + '\n';
}

// ============================================================
// File helpers
// ============================================================

/**
 * Generate a unique ID for a setting file.
 */
function generateId(category: string, title: string): string {
  const sanitized = title.replace(/[<>:"/\\|?*\s]/g, '_').slice(0, 30);
  return `set_${category}_${sanitized}_${Date.now().toString(36)}`;
}

/**
 * Parse a SettingFile from a frontmatter + body blob.
 */
function toSettingFile(fm: Partial<SettingFrontmatter>, body: string): SettingFile {
  return {
    id: fm.id || '',
    title: fm.title || '未命名设定',
    category: (fm.category || 'other') as SettingCategory,
    template: fm.template,
    status: fm.status || 'draft',
    references: Array.isArray(fm.references) ? fm.references : [],
    content: body,
    createdAt: fm.createdAt || new Date().toISOString(),
    updatedAt: fm.updatedAt || new Date().toISOString(),
  };
}

/**
 * Read and parse a setting .md file from disk.
 */
async function readSettingFileFromDisk(
  category: SettingCategory,
  filename: string,
): Promise<SettingFile | null> {
  try {
    const relativePath = `settings/${category}/${filename}`;
    const raw = await readFile(relativePath);
    const { frontmatter, body } = parseFrontmatter(raw);
    if (!frontmatter.id) {
      frontmatter.id = filename.replace('.md', '');
    }
    if (!frontmatter.category) {
      frontmatter.category = category;
    }
    return toSettingFile(frontmatter, body);
  } catch {
    return null;
  }
}

/**
 * Write a setting file to disk.
 */
async function writeSettingFile(setting: SettingFile): Promise<void> {
  const fm: SettingFrontmatter = {
    id: setting.id,
    title: setting.title,
    category: setting.category,
    template: setting.template,
    status: setting.status,
    references: setting.references,
    createdAt: setting.createdAt,
    updatedAt: setting.updatedAt,
  };

  const content = serializeSetting(fm, setting.content);
  const relativePath = `settings/${setting.category}/${setting.id}.md`;
  await writeFile(relativePath, content);
}

// ============================================================
// Public CRUD API
// ============================================================

/**
 * List all setting files, optionally filtered by category.
 */
export async function listSettings(category?: string): Promise<SettingFile[]> {
  const categories: SettingCategory[] = category
    ? [category as SettingCategory]
    : ALL_SETTING_CATEGORIES;

  const results: SettingFile[] = [];

  for (const cat of categories) {
    const dir = `settings/${cat}`;
    try {
      const files = await listDir(dir);
      for (const file of files) {
        if (!file.endsWith('.md')) continue;
        const setting = await readSettingFileFromDisk(cat, file);
        if (setting) results.push(setting);
      }
    } catch {
      // Directory may not exist yet — skip
    }
  }

  results.sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
  );
  return results;
}

/**
 * Get a single setting file by ID.
 */
export async function getSettingById(id: string): Promise<SettingFile | null> {
  for (const cat of ALL_SETTING_CATEGORIES) {
    const dir = `settings/${cat}`;
    try {
      const files = await listDir(dir);
      const match = files.find((f) => f === `${id}.md`);
      if (match) {
        return readSettingFileFromDisk(cat, match);
      }
    } catch {
      // Directory may not exist
    }
  }

  return null;
}

/**
 * Create a new setting .md file.
 */
export async function createSetting(params: {
  title: string;
  category: SettingCategory;
  template?: string;
  content: string;
}): Promise<SettingFile> {
  const id = generateId(params.category, params.title);
  const now = new Date().toISOString();

  const setting: SettingFile = {
    id,
    title: params.title,
    category: params.category,
    template: params.template,
    status: 'draft',
    references: [],
    content: params.content || '',
    createdAt: now,
    updatedAt: now,
  };

  await writeSettingFile(setting);
  logger.info(`Created setting: "${params.title}" (${params.category}) -> ${id}.md`);

  return setting;
}

/**
 * Update an existing setting file.
 */
export async function updateSetting(
  id: string,
  data: { title?: string; category?: SettingCategory; content?: string },
): Promise<SettingFile | null> {
  const existing = await getSettingById(id);
  if (!existing) return null;

  const oldCategory = existing.category;

  if (data.title !== undefined) existing.title = data.title;
  if (data.category !== undefined) {
    existing.category = data.category;
  }
  if (data.content !== undefined) existing.content = data.content;
  existing.updatedAt = new Date().toISOString();

  await writeSettingFile(existing);

  // If category changed, delete the old file
  if (data.category !== undefined && data.category !== oldCategory) {
    try {
      await deleteFile(`settings/${oldCategory}/${existing.id}.md`);
    } catch {
      // Old file might not exist
    }
  }

  logger.info(`Updated setting: "${existing.title}" (${existing.id})`);
  return existing;
}

/**
 * Delete a setting file permanently (no trash for settings).
 */
export async function deleteSettingFile(id: string): Promise<boolean> {
  const existing = await getSettingById(id);
  if (!existing) return false;

  const relativePath = `settings/${existing.category}/${existing.id}.md`;
  await deleteFile(relativePath);
  logger.info(`Deleted setting: "${existing.title}" (${id})`);
  return true;
}

/**
 * Add a reference to a knowledge entry in a setting file.
 */
export async function addReferenceToSetting(
  settingId: string,
  knowledgeId: string,
): Promise<SettingFile | null> {
  const setting = await getSettingById(settingId);
  if (!setting) return null;

  if (!setting.references.includes(knowledgeId)) {
    setting.references.push(knowledgeId);
    setting.updatedAt = new Date().toISOString();
    await writeSettingFile(setting);
  }

  return setting;
}

// ============================================================
// Markdown-to-KnowledgeEntry field extraction
// ============================================================

/**
 * Extract structured fields from Markdown content.
 * Heuristic: ## headings → attribute groups, - **key**: value → individual attributes,
 * free text → description.
 */
function extractFieldsFromMarkdown(
  content: string,
): { attributes: Record<string, unknown>; description: string; extractedFields: FieldMapping[] } {
  const attributes: Record<string, unknown> = {};
  const extractedFields: FieldMapping[] = [];
  let description = '';

  const lines = content.split('\n');
  let currentSection = '';

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // ## Section headings (not the main title # )
    const h2Match = line.match(/^##\s+(.+)/);
    if (h2Match) {
      currentSection = h2Match[1].trim();
      continue;
    }

    // - **key**: value pairs
    const kvMatch = line.match(/^[-*]\s+\*\*(.+?)\*\*\s*[:：]\s*(.+)/);
    if (kvMatch) {
      const key = kvMatch[1].trim();
      let value: unknown = kvMatch[2].trim();

      if (value === '' || value === '-') value = null;

      const fullKey = currentSection ? `${currentSection}_${key}` : key;

      attributes[fullKey] = value;
      extractedFields.push({
        field: fullKey,
        value,
        source: `## ${currentSection || '正文'} → ${key}`,
      });

      continue;
    }

    // Skip empty lines and tables
    if (line.trim() === '' || line.trim().startsWith('|')) {
      continue;
    }

    // Free text — accumulate for description
    if (!line.startsWith('#') && !line.startsWith('-') && !line.startsWith('*')) {
      description += line + '\n';
    }
  }

  // Cap description at 2000 chars
  description = (description.trim() || content.slice(0, 500)).slice(0, 2000);

  return { attributes, description, extractedFields };
}

// ============================================================
// Migration
// ============================================================

/**
 * Preview what would happen when migrating settings to knowledge base.
 */
export async function previewMigration(settingIds: string[]): Promise<MigrationPreview> {
  const items: MigrationItem[] = [];
  let willCreate = 0;
  let willMerge = 0;
  let totalConflicts = 0;

  for (const id of settingIds) {
    const setting = await getSettingById(id);
    if (!setting) continue;

    const { attributes, extractedFields } = extractFieldsFromMarkdown(setting.content);

    // Try to match against existing knowledge entries
    let bestMatch: { id: string; name: string; similarity: number } | null = null;

    try {
      const results = searchKnowledge(setting.title, setting.category === 'map' ? 'locations' : setting.category, 1, 5);
      if (results && results.length > 0) {
        bestMatch = {
          id: results[0].id,
          name: results[0].name,
          similarity: 1.0,
        };
      }
    } catch {
      // DB may not be initialized yet — okay to match nothing
    }

    if (!bestMatch) {
      items.push({
        settingId: setting.id,
        settingTitle: setting.title,
        category: setting.category,
        action: 'create',
        extractedFields,
        conflicts: [],
      });
      willCreate++;
    } else {
      const existingEntry = await getEntryById(bestMatch.id);
      if (existingEntry) {
        const { conflicts } = mergeAttributes(
          existingEntry.attributes,
          attributes,
          0, // No chapter context for migration
        );

        items.push({
          settingId: setting.id,
          settingTitle: setting.title,
          category: setting.category,
          action: 'merge',
          matchedEntryId: bestMatch.id,
          matchedEntryName: bestMatch.name,
          similarity: bestMatch.similarity,
          extractedFields,
          conflicts: conflicts.map((c) => ({
            field: c.field,
            existingValue: c.oldValue,
            incomingValue: c.newValue,
          })),
        });
        willMerge++;
        totalConflicts += conflicts.length;
      } else {
        items.push({
          settingId: setting.id,
          settingTitle: setting.title,
          category: setting.category,
          action: 'create',
          extractedFields,
          conflicts: [],
        });
        willCreate++;
      }
    }
  }

  return {
    items,
    summary: { willCreate, willMerge, totalConflicts },
  };
}

/**
 * Confirm and execute migration of settings to knowledge base.
 */
export async function confirmMigration(
  preview: MigrationPreview,
  resolvedConflicts?: Array<{
    settingId: string;
    field: string;
    resolution: 'accept_new' | 'keep_old';
  }>,
): Promise<MigrateConfirmResult> {
  let created = 0;
  let merged = 0;

  for (const item of preview.items) {
    const setting = await getSettingById(item.settingId);
    if (!setting) continue;

    const { attributes, description } = extractFieldsFromMarkdown(setting.content);

    // Build resolved conflicts map for this setting
    const itemResolutions = (resolvedConflicts || []).filter(
      (r) => r.settingId === item.settingId,
    );

    // Apply conflict resolutions
    const resolvedAttributes = { ...attributes };
    for (const res of itemResolutions) {
      if (res.resolution === 'keep_old') {
        delete resolvedAttributes[res.field];
      }
      // accept_new keeps the value (already in attributes)
    }

    // Map setting category to knowledge base category
    const kbCategory =
      item.category === 'map'
        ? 'locations'
        : item.category === 'organization'
          ? 'worldbuilding'
          : item.category === 'other'
            ? 'worldbuilding'
            : item.category;

    if (item.action === 'create') {
      try {
        await createKnowledgeEntry({
          name: setting.title,
          category: kbCategory,
          attributes: resolvedAttributes,
          description,
          aliases: [],
          relations: [],
        });
        created++;
      } catch (err) {
        logger.error(`Failed to create knowledge entry from setting "${setting.title}":`, err);
      }
    } else if (item.action === 'merge' && item.matchedEntryId) {
      const existingEntry = await getEntryById(item.matchedEntryId);
      if (existingEntry) {
        existingEntry.attributes = { ...existingEntry.attributes, ...resolvedAttributes };
        if (description && description.length > (existingEntry.description?.length || 0)) {
          existingEntry.description = description;
        }
        existingEntry.updatedAt = new Date().toISOString();
        existingEntry.version = (existingEntry.version || 1) + 1;
        await saveEntry(existingEntry);
        merged++;
      }
    }

    // Mark setting as migrated
    setting.status = 'migrated';
    setting.updatedAt = new Date().toISOString();
    await writeSettingFile(setting);
  }

  logger.info(
    `Migration complete: created=${created}, merged=${merged}, total=${preview.items.length}`,
  );

  return { migrated: preview.items.length, created, merged };
}
