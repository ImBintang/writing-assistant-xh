// server/src/agents/extractor.ts
// Core extraction engine — executes extraction tasks chapter by chapter

import path from 'path';
import { createLogger } from '../utils/logger';
import { getWorkspaceRoot, readFile } from '../utils/file';
import { runExtractionWithRetry } from './client';
import { getSkillRegistry } from './skills/registry';
import { chunkChapter } from '../services/chunker';
import { mergeExtractionResults, saveImportProgress, inferProgressFromKnowledge, getImportProgress } from '../services/knowledge';
import { recordUsage } from '../utils/context';
import type {
  ExtractionTask,
  ExtractionInput,
  RawKnowledgeEntry,
  TaskError,
  ProgressUpdate,
  ExtractionStatusResponse,
  MergeResult,
} from '../types/knowledge';
import type { SkillDefinition } from '../agents/skills/types';

const logger = createLogger('extractor');

// Progress callback type
export type ProgressCallback = (update: ProgressUpdate) => void;
// Merge callback type (called after each category merge)
export type MergeCallback = (category: string, result: MergeResult) => void;

export { loadChapterContent };

/**
 * Run extraction for a single chapter (used by "import next chapter" flow).
 * Loads chapter content, runs all skills for the given categories, returns raw entries.
 */
/**
 * Run extraction + merge for a single chapter, then save import progress.
 * Used by "import next chapter" flow (PRD-10).
 */
export async function importNextChapter(
  category: string,
  chapterIndex?: number,
  signal?: AbortSignal,
): Promise<{
  result: MergeResult;
  nextChapterIndex: number;
  isLatest: boolean;
  chapterTitle: string;
}> {
  const workspaceRoot = getWorkspaceRoot();

  // 1. Read chapter meta to know total chapters and titles
  const metaPath = path.join(workspaceRoot, 'chapters', '_meta.json');
  let meta: { chapters: Array<{ index: number; title: string }>; totalChapters: number };
  try {
    const metaContent = await readFile(metaPath);
    meta = JSON.parse(metaContent);
  } catch {
    throw new Error('章节数据不存在，请先上传并拆分章节文件');
  }

  if (!meta.chapters || meta.chapters.length === 0) {
    throw new Error('没有可导入的章节');
  }

  // 2. Determine next chapter index
  let nextIndex: number;
  let chapterTitle: string;

  if (chapterIndex) {
    // User-specified chapter
    const ch = meta.chapters.find((c) => c.index === chapterIndex);
    if (!ch) {
      throw new Error(`第${chapterIndex}章不存在`);
    }
    nextIndex = chapterIndex;
    chapterTitle = ch.title;
  } else {
    // Auto-detect from progress or knowledge base
    const progressList = await getImportProgress();
    const existing = progressList.find((p) => p.category === category);

    let lastImported = existing?.lastImportedChapterIndex || 0;

    // Fallback: infer from knowledge base
    if (lastImported === 0) {
      lastImported = await inferProgressFromKnowledge(category);
    }

    nextIndex = lastImported + 1;

    const ch = meta.chapters.find((c) => c.index === nextIndex);
    if (!ch) {
      return {
        result: { added: [], merged: [], conflicts: [] },
        nextChapterIndex: nextIndex,
        isLatest: true,
        chapterTitle: '',
      };
    }
    chapterTitle = ch.title;
  }

  // 3. Load chapter content
  const { content: chapterContent } = await loadChapterContent(nextIndex);

  // 4. Run extraction for all categories (or single category)
  const registry = getSkillRegistry();
  const skills = registry.getSkillsByCategories([category]);

  if (skills.length === 0) {
    throw new Error(`分类 "${category}" 没有可用的提取技能`);
  }

  const allResults: Record<string, RawKnowledgeEntry[]> = {};
  const allErrors: TaskError[] = [];

  const skillPromises = skills.map(async (skill) => {
    try {
      const { entries, errors } = await extractWithSkill(
        skill,
        nextIndex,
        chapterTitle,
        chapterContent,
        signal,
      );
      return { skill, entries, errors };
    } catch (err) {
      return {
        skill,
        entries: [] as RawKnowledgeEntry[],
        errors: [{
          chapterIndex: nextIndex,
          chapterTitle,
          category: skill.category,
          message: err instanceof Error ? err.message : String(err),
        }] as TaskError[],
      };
    }
  });

  const skillResults = await Promise.all(skillPromises);
  for (const { skill, entries, errors } of skillResults) {
    if (!allResults[skill.category]) allResults[skill.category] = [];
    allResults[skill.category].push(...entries);
    allErrors.push(...errors);
  }

  // 5. Merge results for the target category
  const entries = allResults[category] || [];
  let result: MergeResult = { added: [], merged: [], conflicts: [] };
  if (entries.length > 0) {
    result = await mergeExtractionResults(entries, category, nextIndex, chapterTitle);
  }

  // 6. Save import progress
  await saveImportProgress({
    category,
    lastImportedChapterIndex: nextIndex,
    lastImportedChapterTitle: chapterTitle,
    importedAt: new Date().toISOString(),
    totalChaptersAtImport: meta.totalChapters,
  });

  // 7. Check if this is the latest chapter
  const lastChapterIndex = Math.max(...meta.chapters.map((c) => c.index));
  const isLatest = nextIndex >= lastChapterIndex;

  logger.info(
    `Import next chapter complete: category=${category} chapter=${nextIndex} "${chapterTitle}" added=${result.added.length} merged=${result.merged.length} conflicts=${result.conflicts.length}`,
  );

  return { result, nextChapterIndex: nextIndex, isLatest, chapterTitle };
}

export async function extractSingleChapter(
  chapterIndex: number,
  categories: string[],
  signal?: AbortSignal,
): Promise<{ results: Record<string, RawKnowledgeEntry[]>; errors: TaskError[]; chapterTitle: string }> {
  const registry = getSkillRegistry();
  const skills = registry.getSkillsByCategories(categories);

  const { content: chapterContent, title: chapterTitle } = await loadChapterContent(chapterIndex);

  const allErrors: TaskError[] = [];
  const allResults: Record<string, RawKnowledgeEntry[]> = {};

  const skillPromises = skills.map(async (skill) => {
    try {
      const { entries, errors } = await extractWithSkill(
        skill,
        chapterIndex,
        chapterTitle,
        chapterContent,
        signal,
      );

      return { skill, entries, errors };
    } catch (err) {
      return {
        skill,
        entries: [] as RawKnowledgeEntry[],
        errors: [{
          chapterIndex,
          chapterTitle,
          category: skill.category,
          message: err instanceof Error ? err.message : String(err),
        }] as TaskError[],
      };
    }
  });

  const skillResults = await Promise.all(skillPromises);

  for (const { skill, entries, errors } of skillResults) {
    if (!allResults[skill.category]) {
      allResults[skill.category] = [];
    }
    allResults[skill.category].push(...entries);
    allErrors.push(...errors);
  }

  return { results: allResults, errors: allErrors, chapterTitle };
}

/**
 * Read a chapter's content from disk.
 */
async function loadChapterContent(
  chapterIndex: number,
): Promise<{ content: string; title: string; fileName: string }> {
  const workspaceRoot = getWorkspaceRoot();
  const fileName = `chapter_${String(chapterIndex).padStart(3, '0')}.txt`;
  const chapterPath = path.join(workspaceRoot, 'chapters', fileName);

  let content: string;
  try {
    content = await readFile(chapterPath);
  } catch {
    throw new Error(`章节文件不存在: ${fileName}`);
  }

  // Try to get chapter title from meta
  let title = `第${chapterIndex}章`;
  try {
    const metaPath = path.join(workspaceRoot, 'chapters', '_meta.json');
    const metaContent = await readFile(metaPath);
    const meta = JSON.parse(metaContent);
    const chapterMeta = meta.chapters?.find(
      (c: { index: number }) => c.index === chapterIndex,
    );
    if (chapterMeta?.title) {
      title = chapterMeta.title;
    }
  } catch {
    // Use default title
  }

  return { content, title, fileName };
}

/**
 * Extract knowledge from a single chapter using a skill.
 * Handles chunking for large chapters.
 */
async function extractWithSkill(
  skill: SkillDefinition,
  chapterIndex: number,
  chapterTitle: string,
  chapterContent: string,
  signal?: AbortSignal,
): Promise<{ entries: RawKnowledgeEntry[]; errors: TaskError[] }> {
  const allEntries: RawKnowledgeEntry[] = [];
  const errors: TaskError[] = [];

  // Check if chunking is needed
  const needsChunking = chapterContent.length > 8000;
  const chunks = needsChunking ? chunkChapter(chapterContent) : [{ index: 0, total: 1, content: chapterContent, label: chapterTitle, startOffset: 0, endOffset: chapterContent.length }];

  for (const chunk of chunks) {
    // Check for cancellation
    if (signal?.aborted) {
      return { entries: [], errors };
    }

    try {
      const input: ExtractionInput = {
        systemPrompt: skill.promptTemplate
          .replace('{{chapterContent}}', chunk.content)
          .replace('{{chapterTitle}}', chunk.label),
        chapterContent: chunk.content,
        chapterTitle: chunk.label,
        chapterIndex,
        outputSchema: skill.outputSchema,
        signal,
      };

      const result = await runExtractionWithRetry(input, 3);

      if (result.entries && result.entries.length > 0) {
        // Fill excerpt for each entry: extract context around the entry name's first occurrence
        for (const entry of result.entries) {
          if (!entry.name) continue;
          const nameIdx = chunk.content.indexOf(entry.name);
          if (nameIdx >= 0) {
            const start = Math.max(0, nameIdx - 100);
            const end = Math.min(chunk.content.length, nameIdx + entry.name.length + 100);
            entry.excerpt = chunk.content.slice(start, end);
          }
        }
        allEntries.push(...result.entries);
      }

      // Track token usage
      if (result.tokensUsed) {
        recordUsage('extract', result.tokensUsed, 0);
      }
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'AbortError') {
        return { entries: allEntries, errors };
      }

      const errorMsg = err instanceof Error ? err.message : String(err);
      logger.error(
        `Extraction failed: chapter=${chapterIndex} skill=${skill.name} chunk=${chunk.label}: ${errorMsg}`,
      );

      errors.push({
        chapterIndex,
        chapterTitle: chunk.label,
        category: skill.category,
        message: errorMsg,
      });
    }
  }

  // Deduplicate entries from multiple chunks (by name within same chapter)
  if (chunks.length > 1) {
    const seen = new Set<string>();
    const deduped: RawKnowledgeEntry[] = [];

    for (const entry of allEntries) {
      const key = `${entry.name}|${skill.category}`;
      if (!seen.has(key)) {
        seen.add(key);
        deduped.push(entry);
      }
    }

    return { entries: deduped, errors };
  }

  return { entries: allEntries, errors };
}

/**
 * Run a full extraction task.
 * Iterates chapters sequentially, runs skills concurrently per chapter.
 */
export async function runExtractionTask(
  task: ExtractionTask,
  onProgress: ProgressCallback,
  onMergeComplete: MergeCallback,
): Promise<ExtractionStatusResponse> {
  const { chapterIds, categories, customSkillIds } = task.config;
  const registry = getSkillRegistry();

  // Get skills for requested categories
  const skills = registry.getSkillsByCategories(categories);

  // Add custom skills if specified
  if (customSkillIds && customSkillIds.length > 0) {
    for (const skillId of customSkillIds) {
      const customSkill = registry.getSkill(skillId);
      if (customSkill && customSkill.enabled) {
        skills.push(customSkill);
      }
    }
  }

  if (skills.length === 0) {
    throw new Error('没有可用的提取技能');
  }

  const totalSteps = chapterIds.length * skills.length;
  let completedSteps = 0;

  const allErrors: TaskError[] = [];
  const allResults: Record<string, RawKnowledgeEntry[]> = {};

  // Process each chapter sequentially
  for (const chapterIndex of chapterIds) {
    // Check for cancellation
    if (task.abortController.signal.aborted) {
      task.status = 'cancelled';
      return {
        status: 'cancelled',
        progress: {
          totalSteps,
          completedSteps,
          currentChapterIndex: null,
          currentChapterTitle: null,
          currentCategory: null,
        },
        errors: allErrors,
      };
    }

    let chapterContent: string;
    let chapterTitle: string;

    try {
      const chapter = await loadChapterContent(chapterIndex);
      chapterContent = chapter.content;
      chapterTitle = chapter.title;
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      logger.error(`Failed to load chapter ${chapterIndex}: ${errorMsg}`);
      allErrors.push({
        chapterIndex,
        chapterTitle: `第${chapterIndex}章`,
        category: 'system',
        message: errorMsg,
      });
      completedSteps += skills.length;
      continue;
    }

    // Update progress
    task.progress.currentChapterIndex = chapterIndex;
    task.progress.currentChapterTitle = chapterTitle;

    onProgress({
      taskId: task.taskId,
      totalSteps,
      completedSteps,
      currentChapterIndex: chapterIndex,
      currentChapterTitle: chapterTitle,
      currentCategory: null,
    });

    // Run all skills concurrently for this chapter
    const skillPromises = skills.map(async (skill) => {
      try {
        task.progress.currentCategory = skill.name;

        onProgress({
          taskId: task.taskId,
          totalSteps,
          completedSteps,
          currentChapterIndex: chapterIndex,
          currentChapterTitle: chapterTitle,
          currentCategory: skill.name,
        });

        const { entries, errors } = await extractWithSkill(
          skill,
          chapterIndex,
          chapterTitle,
          chapterContent,
          task.abortController.signal,
        );

        completedSteps++;

        onProgress({
          taskId: task.taskId,
          totalSteps,
          completedSteps,
          currentChapterIndex: chapterIndex,
          currentChapterTitle: chapterTitle,
          currentCategory: skill.name,
        });

        return { skill, entries, errors };
      } catch (err) {
        completedSteps++;
        return {
          skill,
          entries: [] as RawKnowledgeEntry[],
          errors: [
            {
              chapterIndex,
              chapterTitle,
              category: skill.category,
              message: err instanceof Error ? err.message : String(err),
            },
          ] as TaskError[],
        };
      }
    });

    const skillResults = await Promise.all(skillPromises);

    // Collect results per category
    for (const { skill, entries, errors } of skillResults) {
      if (!allResults[skill.category]) {
        allResults[skill.category] = [];
      }
      allResults[skill.category].push(...entries);
      allErrors.push(...errors);
    }

    // Merge results into knowledge base per category
    for (const [category, entries] of Object.entries(allResults)) {
      if (entries.length === 0) continue;

      try {
        const mergeResult = await mergeExtractionResults(
          entries,
          category,
          chapterIndex,
          chapterTitle,
        );
        onMergeComplete(category, mergeResult);

        task.progress.resultsByCategory[category] = [
          ...(task.progress.resultsByCategory[category] || []),
        ];
      } catch (err) {
        logger.error(
          `Merge failed for category=${category} chapter=${chapterIndex}:`,
          err,
        );
      }

      // Reset for next chapter (we've already merged)
      allResults[category] = [];
    }
  }

  // Check final status
  if (task.abortController.signal.aborted) {
    task.status = 'cancelled';
    return {
      status: 'cancelled',
      progress: {
        totalSteps,
        completedSteps,
        currentChapterIndex: null,
        currentChapterTitle: null,
        currentCategory: null,
      },
      errors: allErrors,
    };
  }

  const allFailed = allErrors.length === totalSteps;
  task.status = allFailed ? 'failed' : 'completed';

  return {
    status: task.status,
    progress: {
      totalSteps,
      completedSteps,
      currentChapterIndex: null,
      currentChapterTitle: null,
      currentCategory: null,
    },
    errors: allErrors.length > 0 ? allErrors : undefined,
  };
}
