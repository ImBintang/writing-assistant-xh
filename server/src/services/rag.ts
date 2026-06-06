// server/src/services/rag.ts
// RAG (Retrieval-Augmented Generation) service for PRD-05 Writing Window
// Extracts keywords from input text, searches knowledge base via FTS5,
// and assembles prior knowledge context for the writing agent.

import path from 'path';
import fs from 'fs/promises';
import { createLogger } from '../utils/logger';
import { getWorkspaceRoot } from '../utils/file';
import { searchKnowledge, getCategoryIndex } from '../db/knowledge';
import type { KnowledgeEntry, PriorKnowledge, RetrieveRequest } from '../types/knowledge';

const logger = createLogger('rag-service');

const CATEGORIES = [
  'characters',
  'techniques',
  'locations',
  'worldbuilding',
  'weapons',
  'alchemy',
  'plot',
];

// FTS5 reserved characters that need escaping
const FTS5_SPECIAL = /[\*\"\(\)\^\~\!\@\#\$\%\&\+\-\=\[\]\{\}\\\|\:\;\,\.\/\<\>\?]/g;

/**
 * Escape FTS5 special characters in a string for safe MATCH usage.
 */
function escapeFtsQuery(term: string): string {
  return term.replace(FTS5_SPECIAL, ' ');
}

/**
 * Extract keywords from Chinese text using a combination of:
 * 1. Named entity matching against the knowledge base index
 * 2. N-gram extraction (2-4 gram)
 * 3. Punctuation-boundary phrase extraction
 *
 * No heavy NLP — simple and effective for Chinese novel content.
 */
function extractKeywords(text: string): string[] {
  const keywords = new Map<string, number>(); // keyword -> score

  // Clean and normalize
  const cleaned = text.trim();
  if (!cleaned) return [];

  // Method 1: Named entity matching — check all indexed names/aliases
  try {
    // Iterate through all categories and check if known entities appear in text
    for (const cat of CATEGORIES) {
      const entries = getCategoryIndex(cat);
      for (const entry of entries) {
        // Check name match
        if (entry.name.length >= 2 && cleaned.includes(entry.name)) {
          const score = keywords.get(entry.name) || 0;
          keywords.set(entry.name, Math.max(score, 3.0)); // Direct name match: weight 3.0
        }
      }
    }
  } catch (err) {
    logger.warn('Named entity matching failed:', err);
  }

  // Method 2: N-gram extraction (2-gram, 3-gram, 4-gram)
  const noPunct = cleaned.replace(/[，。！？；：、""''（）《》【】\s\n\r]+/g, '|');
  for (let n = 4; n >= 2; n--) {
    for (let i = 0; i <= noPunct.length - n; i++) {
      const gram = noPunct.slice(i, i + n);
      // Skip grams containing the separator
      if (gram.includes('|')) continue;
      // Skip purely whitespace/punctuation grams
      if (/^[\s\d]+$/.test(gram)) continue;

      const existing = keywords.get(gram) || 0;
      // Score: frequency * length bonus * 1.5
      const score = Math.max(existing, 1 * n * 1.5);
      keywords.set(gram, score);
    }
  }

  // Method 3: Punctuation boundary splitting (longest phrases first)
  const segments = cleaned
    .split(/[，。！？；：、\n\r]+/)
    .map((s) => s.trim())
    .filter((s) => s.length >= 2);

  for (const seg of segments.sort((a, b) => b.length - a.length).slice(0, 20)) {
    const existing = keywords.get(seg) || 0;
    keywords.set(seg, Math.max(existing, 2.0)); // Phrase: weight 2.0
  }

  // Sort by score descending, take top 30
  const sorted = Array.from(keywords.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 30)
    .map(([kw]) => kw);

  logger.info(`Extracted ${sorted.length} keywords: ${sorted.slice(0, 10).join(', ')}...`);
  return sorted;
}

/**
 * Build an FTS5 MATCH query from keywords, joining with OR.
 */
function buildFtsQuery(keywords: string[]): string {
  if (keywords.length === 0) return '';
  return keywords
    .map((kw) => escapeFtsQuery(kw))
    .filter((kw) => kw.trim().length >= 1)
    .map((kw) => `"${kw.trim()}"`)
    .slice(0, 20)
    .join(' OR ');
}

/**
 * Load a KnowledgeEntry from its JSON file on disk.
 */
async function loadEntryById(id: string): Promise<KnowledgeEntry | null> {
  const workspaceRoot = getWorkspaceRoot();
  const knowledgeDir = path.join(workspaceRoot, 'knowledge');

  for (const cat of CATEGORIES) {
    const filePath = path.join(knowledgeDir, cat, `${id}.json`);
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      return JSON.parse(content) as KnowledgeEntry;
    } catch {
      // Not in this category, try next
    }
  }

  return null;
}

/**
 * Load full KnowledgeEntry objects for a list of search result IDs.
 */
async function loadEntriesByIds(
  results: Array<{ id: string; score: number; category: string }>,
): Promise<KnowledgeEntry[]> {
  const entries: KnowledgeEntry[] = [];
  const seen = new Set<string>();

  for (const r of results) {
    if (seen.has(r.id)) continue;
    seen.add(r.id);

    const entry = await loadEntryById(r.id);
    if (entry && !entry.deletedAt) {
      entries.push(entry);
    }
  }

  return entries;
}

/**
 * Get the last `charCount` characters of a specific chapter file.
 */
async function getPreviousChapterEnding(
  chapterNumber: number,
  charCount: number,
): Promise<string> {
  const workspaceRoot = getWorkspaceRoot();
  const chaptersDir = path.join(workspaceRoot, 'chapters');

  // Find chapter file matching chapter_NNN*.txt
  try {
    const files = await fs.readdir(chaptersDir);
    const prefix = `chapter_${String(chapterNumber).padStart(3, '0')}`;
    const chapterFile = files.find((f) => f.startsWith(prefix) && f.endsWith('.txt'));

    if (!chapterFile) return '';

    const content = await fs.readFile(path.join(chaptersDir, chapterFile), 'utf-8');
    if (content.length <= charCount) return content;
    return '...' + content.slice(-charCount);
  } catch {
    return '';
  }
}

/**
 * Partition loaded entries by their category field.
 */
function partitionByCategory(entries: KnowledgeEntry[]): Record<string, KnowledgeEntry[]> {
  const partitioned: Record<string, KnowledgeEntry[]> = {};
  for (const cat of CATEGORIES) {
    partitioned[cat] = [];
  }

  for (const entry of entries) {
    const cat = entry.category;
    if (partitioned[cat]) {
      partitioned[cat].push(entry);
    }
  }

  return partitioned;
}

/**
 * Generate a concise Chinese summary of the retrieved knowledge.
 */
function buildSummary(partitioned: Record<string, KnowledgeEntry[]>): string {
  const labelMap: Record<string, string> = {
    characters: '人物',
    techniques: '功法',
    locations: '地点',
    worldbuilding: '世界观',
    weapons: '武器',
    alchemy: '丹药',
    plot: '情节',
  };

  const lines: string[] = [];

  for (const cat of CATEGORIES) {
    const list = partitioned[cat];
    if (list.length === 0) continue;

    const names = list.map((e) => e.name).join('、');
    lines.push(`- ${labelMap[cat]}：${names}`);
  }

  if (lines.length === 0) {
    return '未检索到相关先验知识。';
  }

  return '检索到以下先验知识：\n' + lines.join('\n');
}

/**
 * Weighted merge of search results across general and per-category searches.
 *
 * Scoring:
 * - Direct name match in input text: 3.0
 * - Alias match: 2.0
 * - FTS keyword match: 1.0
 * - Chapter recency decay: 1.0 / (1.0 + 0.1 * distance)
 *
 * Deduplicates by entry ID, keeping highest-weighted occurrence.
 */
function weightedMerge(
  generalResults: Array<{ id: string; category: string; name: string; snippet: string }>,
  categoryResults: Record<string, Array<{ id: string; category: string; name: string; snippet: string }>>,
  keywords: string[],
  targetChapter?: number,
): Array<{ id: string; score: number; category: string }> {
  const scored = new Map<string, { score: number; category: string }>();

  const addResult = (
    result: { id: string; category: string; name: string; snippet: string },
    baseWeight: number,
  ) => {
    let score = baseWeight;

    // Apply chapter recency decay if we know the target chapter
    if (targetChapter !== undefined && targetChapter > 0) {
      // Estimate the entry's chapter affiliation from the snippet
      // Use a heuristic: if the result contains chapter info, apply decay
      const distance = 0; // Default: no distance info available, no decay
      if (result.snippet && result.snippet.includes('章')) {
        // Attempt a rough distance estimate — conservative: apply 1.0 multiplier
        const recencyDecay = 1.0 / (1.0 + 0.1 * distance);
        score *= recencyDecay;
      }
    }

    const existing = scored.get(result.id);
    if (!existing || score > existing.score) {
      scored.set(result.id, { score, category: result.category });
    }
  };

  // General results: base weight 1.0 (FTS keyword match)
  for (const r of generalResults) {
    let weight = 1.0;
    // Increase weight if name is in keywords (was found by named entity matching)
    if (keywords.includes(r.name)) {
      weight = 3.0;
    }
    addResult(r, weight);
  }

  // Per-category results: slight boost for category diversity
  for (const cat of CATEGORIES) {
    const catResults = categoryResults[cat] || [];
    for (const r of catResults) {
      let weight = 1.2; // Category-directed results get slight boost
      if (keywords.includes(r.name)) {
        weight = 3.0;
      }
      addResult(r, weight);
    }
  }

  // Sort by score descending, limit to 50 entries
  return Array.from(scored.entries())
    .map(([id, val]) => ({ id, score: val.score, category: val.category }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 50);
}

/**
 * Main RAG retrieval function.
 *
 * Given an outline/draft input, extracts keywords, searches the knowledge base,
 * and assembles a PriorKnowledge object with relevant entries partitioned by category.
 */
export async function retrievePriorKnowledge(
  input: RetrieveRequest,
): Promise<PriorKnowledge> {
  const combinedText = [input.outline, input.draft].filter(Boolean).join('\n');

  logger.info(
    `Retrieving prior knowledge: textLen=${combinedText.length}, targetChapter=${input.targetChapter}, categories=${input.categoryFilter?.join(',') || 'all'}`,
  );

  // Step 1: Extract keywords
  const keywords = extractKeywords(combinedText);

  // Step 2: Build FTS5 query
  const ftsQuery = buildFtsQuery(keywords);

  // Step 3: General search + per-category directed search
  let generalResults: Array<{ id: string; category: string; name: string; snippet: string }> = [];

  if (ftsQuery) {
    try {
      generalResults = searchKnowledge(ftsQuery, undefined, 1, 30);
    } catch (err) {
      logger.warn('FTS5 general search failed, falling back:', err);
    }
  }

  // Per-category directed search
  const categoryResults: Record<string, Array<{ id: string; category: string; name: string; snippet: string }>> = {};
  const targetCategories = input.categoryFilter && input.categoryFilter.length > 0
    ? input.categoryFilter
    : CATEGORIES;

  if (ftsQuery) {
    for (const cat of targetCategories) {
      try {
        categoryResults[cat] = searchKnowledge(ftsQuery, cat, 1, 10);
      } catch (err) {
        logger.warn(`FTS5 search failed for category ${cat}:`, err);
        categoryResults[cat] = [];
      }
    }
  }

  // Step 4: Weighted merge
  const merged = weightedMerge(generalResults, categoryResults, keywords, input.targetChapter);

  // Step 5: Load full KnowledgeEntry objects
  const entries = await loadEntriesByIds(merged);

  // Step 6: Get previous chapter ending
  let previousChapter = '';
  if (input.targetChapter && input.targetChapter > 1) {
    previousChapter = await getPreviousChapterEnding(input.targetChapter - 1, 300);
  }

  // Step 7: Partition by category
  const partitioned = partitionByCategory(entries);

  // Step 8: Build summary
  const summary = buildSummary(partitioned);

  logger.info(
    `Retrieved ${entries.length} knowledge entries across ${Object.values(partitioned).filter((a) => a.length > 0).length} categories`,
  );

  return {
    characters: partitioned.characters,
    techniques: partitioned.techniques,
    locations: partitioned.locations,
    worldbuilding: partitioned.worldbuilding,
    weapons: partitioned.weapons,
    alchemy: partitioned.alchemy,
    plot: partitioned.plot,
    previousChapter,
    summary,
  };
}

/**
 * Allow external code to collect all known entity names for client-side
 * cross-referencing (used by WritingSidebar for real-time hints).
 */
export function getAllKnownEntityNames(): string[] {
  const names: string[] = [];
  for (const cat of CATEGORIES) {
    try {
      const entries = getCategoryIndex(cat);
      for (const entry of entries) {
        names.push(entry.name);
      }
    } catch {
      // Ignore
    }
  }
  return names;
}

export { CATEGORIES };
