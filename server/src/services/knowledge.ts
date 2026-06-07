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
  ImportProgress,
  PrescanResult,
  TimelineRecord,
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
 * Resolve a single conflict by entry ID and field name.
 */
export async function resolveConflict(
  entryId: string,
  field: string,
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

    const conflictIndex = entry.conflicts.findIndex(
      (c) => c.field === field && !c.resolved,
    );
    if (conflictIndex === -1) {
      // Conflict already resolved or not found for this entry — skip to next category
      continue;
    }

    const conflict = entry.conflicts[conflictIndex];

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
    field: string;
    resolution: 'accept_new' | 'keep_old' | 'manual';
    manualValue?: unknown;
  }>,
): Promise<number> {
  let resolved = 0;
  for (const res of resolutions) {
    const result = await resolveConflict(
      res.entryId,
      res.field,
      res.resolution,
      res.manualValue,
    );
    if (result) resolved++;
  }
  return resolved;
}

/**
 * AI-merge two conflicting text values using the configured AI provider.
 */
export async function aiMergeConflict(
  oldValue: string,
  newValue: string,
  mode: 'prefer_old' | 'prefer_new' | 'balanced',
): Promise<string> {
  // Dynamic import to avoid circular dependency at module init
  const { getProviderForMode } = await import('../agents/client.js');

  const { provider, modelId } = await getProviderForMode('chat');

  const modeDescriptions: Record<string, string> = {
    prefer_old: '以旧版描述为主要框架，仅在新版有明确补充信息时融入',
    prefer_new: '以新版描述为主要框架，保留旧版中未提及的关键信息',
    balanced: '综合考量两版描述，取长补短，生成最完善的合并版本',
  };

  const result = await provider.chat({
    model: modelId,
    maxTokens: 1024,
    temperature: 0.3,
    system: `你是一个专业的文本合并助手。请将两段描述合并为一段连贯的文本。
合并模式：${modeDescriptions[mode]}
要求：
- 输出纯合并后的文本（不要加任何前缀、后缀或解释）
- 保持描述的自然流畅
- 合并后的长度应接近两段中较长的那段`,
    messages: [
      {
        role: 'user' as const,
        content: `旧版描述：\n${oldValue}\n\n新版描述：\n${newValue}`,
      },
    ],
  });

  const block = result.content.find((c: { type: string }) => c.type === 'text');
  const merged = (block as { type: 'text'; text: string })?.text?.trim() || '';

  if (!merged) {
    logger.warn(`AI merge returned empty result for mode=${mode}`);
    throw new Error('AI 合并结果为空，请重试或使用手动模式');
  }

  return merged;
}

// ============================================================
// PRD-10: 导入进度管理
// ============================================================

const PROGRESS_FILE = 'knowledge/_import_progress.json';

/**
 * 读取导入进度记录
 */
export async function getImportProgress(): Promise<ImportProgress[]> {
  const workspaceRoot = getWorkspaceRoot();
  const progressPath = path.join(workspaceRoot, PROGRESS_FILE);
  try {
    const raw = await fs.readFile(progressPath, 'utf-8');
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/**
 * 保存导入进度
 */
export async function saveImportProgress(progress: ImportProgress): Promise<void> {
  const workspaceRoot = getWorkspaceRoot();
  const progressPath = path.join(workspaceRoot, PROGRESS_FILE);

  let allProgress: ImportProgress[] = [];
  try {
    const raw = await fs.readFile(progressPath, 'utf-8');
    allProgress = JSON.parse(raw);
    if (!Array.isArray(allProgress)) allProgress = [];
  } catch {
    allProgress = [];
  }

  // 替换或追加
  const idx = allProgress.findIndex((p) => p.category === progress.category);
  if (idx >= 0) {
    allProgress[idx] = progress;
  } else {
    allProgress.push(progress);
  }

  await fs.mkdir(path.dirname(progressPath), { recursive: true });
  await fs.writeFile(progressPath, JSON.stringify(allProgress, null, 2), 'utf-8');
  logger.info(`Import progress saved: ${progress.category} -> chapter ${progress.lastImportedChapterIndex}`);
}

/**
 * 从知识库反向推断导入进度（遍历 source[] 取最大 chapter）
 */
export async function inferProgressFromKnowledge(category: string): Promise<number> {
  const entries = await loadCategoryEntries(category);
  let maxChapter = 0;
  for (const entry of entries) {
    for (const src of entry.source || []) {
      if (src.chapter > maxChapter) {
        maxChapter = src.chapter;
        // Also includes the chapterTitle for progress record
      }
    }
  }
  return maxChapter;
}

// ============================================================
// PRD-10: 冲突预扫描
// ============================================================

/**
 * AI 预扫描未裁决冲突的风险等级
 */
export async function prescanConflicts(
  entryIds?: string[],
): Promise<PrescanResult[]> {
  const all = await getAllConflicts();
  const filtered = entryIds
    ? all.filter((c) => entryIds.includes(c.entry.id))
    : all;

  const results: PrescanResult[] = [];

  for (const { entry, conflicts } of filtered) {
    for (const conflict of conflicts) {
      if (conflict.resolved) continue;

      // PRD-10: Skip already-scanned conflicts to avoid re-scanning
      if (conflict.riskLevel !== undefined) {
        // Reuse existing result
        results.push({
          entryId: entry.id,
          field: conflict.field,
          riskLevel: conflict.riskLevel!,
          reason: conflict.riskReason || 'AI 分析完成',
          aiMergedText: conflict.aiMergedText,
          suggestedAction: conflict.suggestedAction || 'manual',
        });
        continue;
      }

      // Skip non-string conflicts for AI analysis
      if (typeof conflict.oldValue !== 'string' || typeof conflict.newValue !== 'string') {
        // Default: numeric/object changes are high risk
        const result: PrescanResult = {
          entryId: entry.id,
          field: conflict.field,
          riskLevel: 'high',
          reason: '非文本类型的值变更，需要人工确认',
          suggestedAction: 'manual',
        };
        results.push(result);

        // Persist
        conflict.riskLevel = 'high';
        conflict.riskReason = result.reason;
        conflict.suggestedAction = 'manual';
        continue;
      }

      try {
        const aiResult = await prescanWithAI(
          entry.name,
          entry.category,
          conflict.field,
          conflict.oldValue as string,
          conflict.newValue as string,
          conflict.sourceChapter,
        );

        const result: PrescanResult = {
          entryId: entry.id,
          field: conflict.field,
          riskLevel: aiResult.riskLevel,
          reason: aiResult.reason,
          aiMergedText: aiResult.mergedText,
          suggestedAction: aiResult.suggestedAction,
        };
        results.push(result);

        // Persist into the conflict record
        conflict.riskLevel = aiResult.riskLevel;
        conflict.riskReason = aiResult.reason;
        conflict.aiMergedText = aiResult.mergedText;
        conflict.suggestedAction = aiResult.suggestedAction;
      } catch (err) {
        logger.warn(`Prescan failed for ${entry.name}#${conflict.field}:`, err);
        const result: PrescanResult = {
          entryId: entry.id,
          field: conflict.field,
          riskLevel: 'high',
          reason: 'AI 分析失败，默认标记为高风险',
          suggestedAction: 'manual',
        };
        results.push(result);

        conflict.riskLevel = 'high';
        conflict.riskReason = 'AI 分析失败';
        conflict.suggestedAction = 'manual';
      }
    }

    // Save entry with updated conflict records
    await saveEntry(entry);
    indexEntry(entry);
  }

  return results;
}

interface PrescanAiResponse {
  riskLevel: 'low' | 'high';
  reason: string;
  mergedText?: string;
  suggestedAction: 'merge' | 'manual' | 'coexist';
}

/**
 * 调用 AI 分析单个冲突
 */
async function prescanWithAI(
  entryName: string,
  category: string,
  field: string,
  oldValue: string,
  newValue: string,
  sourceChapter: number,
): Promise<PrescanAiResponse> {
  const { getProviderForMode } = await import('../agents/client.js');
  const { provider, modelId } = await getProviderForMode('chat');

  const result = await provider.chat({
    model: modelId,
    maxTokens: 512,
    temperature: 0.2,
    system: `你是一位专业的网络小说编辑，负责评估知识库中冲突的风险等级。
对于以下冲突进行判断：
- low（低风险）：同一场景的不同描写角度、相似的性格描述、用词差异但本质不矛盾的内容。例如"他面容俊朗"vs"他相貌英俊"。
- high（高风险）：明确矛盾的信息（如生死状态、身份变更、修为数值变化）。例如"修为练气境五重"vs"修为练气境六重"。

如果判定为 low，给出合并后的文本（mergedText），使两段描述融合为一段连贯的文本。
如果判定为 high 但属于正常时间线演进（如修为提升、年龄增长），建议使用 coexist 模式。

输出严格为 JSON 格式，不要加其它文字：
{ "riskLevel": "low"|"high", "reason": "判定理由", "mergedText?": "low时的合并文本", "suggestedAction": "merge"|"manual"|"coexist" }`,
    messages: [
      {
        role: 'user' as const,
        content: `知识条目：${entryName}（${category}）\n冲突字段：${field}\n来源章节：第${sourceChapter}章\n\n旧值：\n${oldValue}\n\n新值：\n${newValue}`,
      },
    ],
  });

  const block = result.content.find((c: { type: string }) => c.type === 'text');
  const text = (block as { type: 'text'; text: string })?.text?.trim() || '';

  // Extract JSON from the response (handling potential markdown fences)
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  const jsonStr = jsonMatch ? jsonMatch[0] : text;

  try {
    const parsed = JSON.parse(jsonStr) as PrescanAiResponse;
    return {
      riskLevel: parsed.riskLevel === 'low' ? 'low' : 'high',
      reason: parsed.reason || 'AI 分析完成',
      mergedText: parsed.mergedText,
      suggestedAction: parsed.suggestedAction || 'manual',
    };
  } catch {
    logger.warn(`Failed to parse prescan AI response: ${jsonStr.slice(0, 200)}`);
    return {
      riskLevel: 'high',
      reason: 'AI 响应解析失败',
      suggestedAction: 'manual',
    };
  }
}

/**
 * 一键批量合并低风险冲突
 */
export async function batchMergeLowRisk(entryIds?: string[]): Promise<number> {
  const all = await getAllConflicts();

  const toResolve: Array<{
    entryId: string;
    field: string;
    resolution: 'accept_new' | 'keep_old' | 'manual';
    manualValue?: unknown;
  }> = [];

  for (const { entry, conflicts } of all) {
    if (entryIds && !entryIds.includes(entry.id)) continue;

    for (const conflict of conflicts) {
      if (conflict.resolved) continue;
      if (conflict.riskLevel !== 'low') continue;
      if (!conflict.aiMergedText) continue;

      toResolve.push({
        entryId: entry.id,
        field: conflict.field,
        resolution: 'manual',
        manualValue: conflict.aiMergedText,
      });
    }
  }

  if (toResolve.length === 0) return 0;

  return await batchResolveConflicts(toResolve);
}

// ============================================================
// PRD-10: 并行共存（resolveConflict 扩展）
// ============================================================

/**
 * 以并行共存方式解决冲突：保留时间线上的所有版本
 */
export async function resolveConflictCoexist(
  entryId: string,
  field: string,
  oldChapterIndex: number,
  oldChapterTitle: string,
  newChapterIndex: number,
  newChapterTitle: string,
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

    const conflictIndex = entry.conflicts.findIndex(
      (c) => c.field === field && !c.resolved,
    );
    if (conflictIndex === -1) continue;

    const conflict = entry.conflicts[conflictIndex];
    const now = new Date().toISOString();

    // Build timeline records
    const timeline: TimelineRecord[] = [
      {
        chapterIndex: oldChapterIndex,
        chapterTitle: oldChapterTitle,
        value: conflict.oldValue,
        recordedAt: conflict.detectedAt || now,
      },
      {
        chapterIndex: newChapterIndex,
        chapterTitle: newChapterTitle,
        value: conflict.newValue,
        recordedAt: now,
      },
    ];

    // Prepend existing timeline if any
    if (conflict.timeline && conflict.timeline.length > 0) {
      timeline.unshift(...conflict.timeline);
    }

    conflict.timeline = timeline;
    conflict.resolved = true;
    conflict.resolution = 'coexist';

    // Keep the new value in attributes (for export always uses latest)
    entry.attributes[conflict.field] = conflict.newValue;
    entry.updatedAt = now;

    await saveEntry(entry);
    indexEntry(entry);

    logger.info(`Conflict coexisted: ${entry.name}#${conflict.field} (timeline: ${oldChapterIndex} -> ${newChapterIndex})`);
    return entry;
  }

  return null;
}
