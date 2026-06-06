// server/src/agents/extractor.ts
// Core extraction engine — executes extraction tasks chapter by chapter

import path from 'path';
import { createLogger } from '../utils/logger';
import { getWorkspaceRoot, readFile } from '../utils/file';
import { runExtractionWithRetry } from './client';
import { getSkillRegistry } from './skills/registry';
import { chunkChapter } from '../services/chunker';
import { mergeExtractionResults } from '../services/knowledge';
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
        allEntries.push(...result.entries);
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
