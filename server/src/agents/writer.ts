// server/src/agents/writer.ts
// Writing Agent for PRD-05 Writing Window
// Handles AI writing, polishing, expanding, shortening, rewriting, and foreshadowing checks.
// Uses the multi-provider client abstraction for AI calls.

import { getProviderForMode } from './client';
import { createLogger } from '../utils/logger';
import { estimateTokens } from '../utils/tokenizer';
import {
  truncateKnowledgeContext,
  checkTokenBudget,
} from '../utils/context';
import type { PriorKnowledge, ForeshadowFinding, ForeshadowCheckResponse } from '../types/knowledge';
import type { ContentBlock, ToolUseBlock } from './client';

const logger = createLogger('writer-agent');

const CATEGORY_LABELS: Record<string, string> = {
  characters: '人物',
  techniques: '功法',
  locations: '地点',
  worldbuilding: '世界观',
  weapons: '武器',
  alchemy: '丹药',
  plot: '情节/伏笔',
};

const MAX_ENTRIES_PER_CATEGORY = 5;
const MAX_DESC_LENGTH = 200;

/**
 * Format a single knowledge entry for inclusion in the system prompt.
 */
function formatEntry(entry: PriorKnowledge['characters'][0]): string {
  const parts: string[] = [];
  parts.push(`**${entry.name}**`);

  if (entry.aliases && entry.aliases.length > 0) {
    parts.push(`别名：${entry.aliases.join('、')}`);
  }

  if (entry.description) {
    const desc =
      entry.description.length > MAX_DESC_LENGTH
        ? entry.description.slice(0, MAX_DESC_LENGTH) + '...'
        : entry.description;
    parts.push(desc);
  }

  if (entry.attributes && Object.keys(entry.attributes).length > 0) {
    const attrStr = Object.entries(entry.attributes)
      .filter(([, v]) => v !== undefined && v !== null && v !== '')
      .slice(0, 5)
      .map(([k, v]) => `${k}: ${v}`)
      .join(', ');
    if (attrStr) {
      parts.push(`属性：${attrStr}`);
    }
  }

  return parts.join('\n  ');
}

/**
 * Build the complete writing system prompt with prior knowledge context.
 * Enforces knowledge context budget to avoid token overflow.
 */
function buildWritingSystemPrompt(
  priorKnowledge: PriorKnowledge,
  mode: 'write' | 'continue' | 'polish' | 'expand' | 'shorten' | 'rewrite',
  extraInstructions?: string,
): { systemPrompt: string; truncationWarnings: string[] } {
  const sections: string[] = [];
  const truncationWarnings: string[] = [];

  // Role
  sections.push('你是一位专业的网络小说作家，正在协助创作章节内容。');

  // Prior knowledge summary
  if (priorKnowledge.summary) {
    sections.push(priorKnowledge.summary);
  }

  // Detailed prior knowledge (budget-aware)
  const catSections: string[] = [];
  let totalCategoryEntries = 0;

  for (const [cat, label] of Object.entries(CATEGORY_LABELS)) {
    const entries = (priorKnowledge as unknown as Record<string, PriorKnowledge['characters']>)[cat];
    if (Array.isArray(entries) && entries.length > 0) {
      // Apply per-category entry limit
      const limited = entries.slice(0, MAX_ENTRIES_PER_CATEGORY);
      const formatted = limited.map((e) => formatEntry(e)).join('\n\n');
      if (formatted) {
        catSections.push(`### ${label}\n${formatted}`);
        totalCategoryEntries += limited.length;
      }
      if (entries.length > MAX_ENTRIES_PER_CATEGORY) {
        truncationWarnings.push(
          `Category "${label}" truncated from ${entries.length} to ${MAX_ENTRIES_PER_CATEGORY} entries`,
        );
      }
    }
  }

  if (catSections.length > 0) {
    sections.push('## 故事设定与先验知识\n');
    // Check knowledge context budget and truncate if needed
    const knowledgeSection = catSections.join('\n\n');
    const budgetCheck = checkTokenBudget(knowledgeSection, 30000); // 30K token budget

    if (!budgetCheck.fits) {
      const truncated = truncateKnowledgeContext(
        catSections.map((s) => ({ content: s, relevance: 1 })),
        30000,
      );
      sections.push(truncated.map((t) => t.content).join('\n\n'));
      truncationWarnings.push(
        `Knowledge context exceeded budget (${budgetCheck.estimatedTokens} tokens), truncated to fit 30K budget`,
      );
    } else {
      sections.push(knowledgeSection);
    }
  }

  // Previous chapter context
  if (priorKnowledge.previousChapter) {
    sections.push('## 上一章结尾\n');
    sections.push(priorKnowledge.previousChapter);
  }

  // Mode-specific instructions
  sections.push('## 写作指令\n');

  switch (mode) {
    case 'write':
      sections.push('请根据以下大纲创作完整的章节正文。你需要：');
      sections.push('- 保持与已有设定的严格一致，不引入矛盾的新设定');
      sections.push('- 自然引用先验知识中的人物、地点和设定');
      sections.push('- 注意与前文伏笔的衔接');
      sections.push('- 控制节奏，完整覆盖大纲要点');
      sections.push('- 输出高质量的文学性正文，不包含大纲标记或元信息');
      break;
    case 'continue':
      sections.push('请在当前正文的基础上续写。你需要：');
      sections.push('- 保持文风、语气、节奏的连贯性');
      sections.push('- 自然延续当前情节发展');
      sections.push('- 严格遵守先验知识中的设定');
      sections.push('- 不引入与已有设定矛盾的新内容');
      break;
    case 'polish':
      sections.push('请对以下文本进行润色优化。你需要：');
      sections.push('- 优化文笔表达，修正语法错误和不通顺的句子');
      sections.push('- 保持原意不变，不添加新情节');
      sections.push('- 使语言更加流畅优美');
      if (extraInstructions) {
        sections.push(`- 额外要求：${extraInstructions}`);
      }
      break;
    case 'expand':
      sections.push('请对以下文本进行扩展和丰富。你需要：');
      sections.push('- 增加更多细节描写（环境、动作、心理、对话等）');
      sections.push('- 保持原有情节走向和设定一致');
      sections.push('- 自然地扩展内容，不偏离主题');
      break;
    case 'shorten':
      sections.push('请对以下文本进行精简。你需要：');
      sections.push('- 保留核心情节和信息');
      sections.push('- 删除冗余描写和重复内容');
      sections.push('- 使内容更加精炼');
      break;
    case 'rewrite':
      sections.push('请按指定风格改写以下文本。你需要：');
      sections.push('- 改变文风和语气以匹配要求');
      sections.push('- 保持原意和核心情节不变');
      if (extraInstructions) {
        sections.push(`- 目标风格：${extraInstructions}`);
      }
      break;
  }

  sections.push('');
  sections.push('## 核心规则');
  sections.push('1. 严格遵循设定，不编造与先验知识矛盾的内容');
  sections.push('2. 保持文风的一致性');
  sections.push('3. 【重要】如果设定中某个细节不清楚，宁可模糊处理也不编造');
  sections.push('4. 输出纯正文内容，不要包含解释、注释或元信息');

  // Check total system prompt token budget
  const fullPrompt = sections.join('\n');
  const estimatedTokens = estimateTokens(fullPrompt);
  if (estimatedTokens > 90000) {
    truncationWarnings.push(
      `System prompt estimated at ${estimatedTokens} tokens (over 90K). Consider reducing knowledge context budget.`,
    );
  }
  logger.debug(
    `System prompt built: mode=${mode}, estimatedTokens=${estimatedTokens}, warnings=${truncationWarnings.length}`,
  );

  return { systemPrompt: fullPrompt, truncationWarnings };
}

/**
 * Extract text content from a unified ContentBlock array.
 */
function extractText(blocks: ContentBlock[]): string {
  const textBlocks = blocks.filter((c): c is { type: 'text'; text: string } => c.type === 'text');
  return textBlocks.map((b) => b.text).join('\n');
}

/**
 * AbortError class for cancellation support.
 */
class AbortError extends Error {
  constructor() {
    super('Operation cancelled');
    this.name = 'AbortError';
  }
}

// ==================== Public API ====================

/**
 * Generate a full chapter from an outline and prior knowledge.
 */
export async function generateChapter(params: {
  outline: string;
  priorKnowledge: PriorKnowledge;
  chapterNumber?: number;
  signal?: AbortSignal;
}): Promise<{ content: string; tokensUsed: number }> {
  const { provider, modelId } = await getProviderForMode('write');

  const { systemPrompt, truncationWarnings } = buildWritingSystemPrompt(params.priorKnowledge, 'write');

  for (const warning of truncationWarnings) {
    logger.warn(`Context truncation [generate]: ${warning}`);
  }

  const titleLine = params.chapterNumber
    ? `第${params.chapterNumber}章`
    : '新章节';

  logger.info(`Generating chapter: chapter=${titleLine}, model=${modelId}, provider=${provider.name}, outlineLen=${params.outline.length}`);

  const result = await provider.chat({
    model: modelId,
    maxTokens: 4096,
    temperature: 0.7,
    system: systemPrompt,
    messages: [
      {
        role: 'user',
        content: `## 大纲\n${params.outline}\n\n请根据以上大纲创作${titleLine}的完整正文。`,
      },
    ],
    signal: params.signal,
  });

  const content = extractText(result.content);
  const tokensUsed = result.usage.inputTokens + result.usage.outputTokens;

  logger.info(`Chapter generated: tokens=${tokensUsed}, contentLen=${content.length}`);
  return { content, tokensUsed };
}

/**
 * Continue writing from the current body content.
 */
export async function continueWriting(params: {
  currentContent: string;
  priorKnowledge: PriorKnowledge;
  length?: number;
  signal?: AbortSignal;
}): Promise<{ content: string; tokensUsed: number }> {
  const { provider, modelId } = await getProviderForMode('write');

  const { systemPrompt, truncationWarnings } = buildWritingSystemPrompt(params.priorKnowledge, 'continue');

  for (const warning of truncationWarnings) {
    logger.warn(`Context truncation [continue]: ${warning}`);
  }

  // Use the last ~2000 chars of current content as context
  const contentForContext =
    params.currentContent.length > 2000
      ? '...' + params.currentContent.slice(-2000)
      : params.currentContent;

  // Check total input token budget
  const inputTokens = estimateTokens(systemPrompt + contentForContext);
  if (inputTokens > 100000) {
    logger.warn(`Continue writing input estimated at ${inputTokens} tokens — may exceed model context`);
  }

  const lengthHint = params.length ? `续写约${params.length}字。` : '续写适量内容。';

  logger.info(`Continue writing: model=${modelId}, provider=${provider.name}, contentLen=${params.currentContent.length}, length=${params.length}`);

  const result = await provider.chat({
    model: modelId,
    maxTokens: 4096,
    temperature: 0.7,
    system: systemPrompt,
    messages: [
      {
        role: 'user',
        content: `## 当前正文（末尾）\n${contentForContext}\n\n请在此基础上${lengthHint}保持情节和文风的连贯性。`,
      },
    ],
    signal: params.signal,
  });

  const content = extractText(result.content);
  const tokensUsed = result.usage.inputTokens + result.usage.outputTokens;

  logger.info(`Continue done: tokens=${tokensUsed}, contentLen=${content.length}`);
  return { content, tokensUsed };
}

/**
 * Polish (refine prose) selected text.
 */
export async function polishText(params: {
  selectedText: string;
  priorKnowledge: PriorKnowledge;
  instruction?: string;
  signal?: AbortSignal;
}): Promise<{ polishedText: string; tokensUsed: number }> {
  const { provider, modelId } = await getProviderForMode('polish');

  const { systemPrompt, truncationWarnings } = buildWritingSystemPrompt(params.priorKnowledge, 'polish', params.instruction);

  for (const warning of truncationWarnings) {
    logger.warn(`Context truncation [polish]: ${warning}`);
  }

  logger.info(`Polish: textLen=${params.selectedText.length}, model=${modelId}, provider=${provider.name}`);

  const result = await provider.chat({
    model: modelId,
    maxTokens: 4096,
    temperature: 0.3,
    system: systemPrompt,
    messages: [
      {
        role: 'user',
        content: `## 需要润色的文本\n${params.selectedText}\n\n请输出润色后的完整文本。`,
      },
    ],
    signal: params.signal,
  });

  const polishedText = extractText(result.content);
  const tokensUsed = result.usage.inputTokens + result.usage.outputTokens;

  logger.info(`Polish done: tokens=${tokensUsed}, resultLen=${polishedText.length}`);
  return { polishedText, tokensUsed };
}

/**
 * Expand (add detail) to the given text.
 */
export async function expandText(params: {
  text: string;
  priorKnowledge: PriorKnowledge;
  signal?: AbortSignal;
}): Promise<{ content: string; tokensUsed: number }> {
  const { provider, modelId } = await getProviderForMode('write');

  const { systemPrompt, truncationWarnings } = buildWritingSystemPrompt(params.priorKnowledge, 'expand');

  for (const warning of truncationWarnings) {
    logger.warn(`Context truncation [expand]: ${warning}`);
  }

  logger.info(`Expand: textLen=${params.text.length}, model=${modelId}, provider=${provider.name}`);

  const result = await provider.chat({
    model: modelId,
    maxTokens: 4096,
    temperature: 0.7,
    system: systemPrompt,
    messages: [
      {
        role: 'user',
        content: `## 需要扩写的文本\n${params.text}\n\n请扩写以上文本，丰富细节描写。`,
      },
    ],
    signal: params.signal,
  });

  const content = extractText(result.content);
  const tokensUsed = result.usage.inputTokens + result.usage.outputTokens;

  logger.info(`Expand done: tokens=${tokensUsed}, resultLen=${content.length}`);
  return { content, tokensUsed };
}

/**
 * Shorten (condense) the given text.
 */
export async function shortenText(params: {
  text: string;
  priorKnowledge: PriorKnowledge;
  signal?: AbortSignal;
}): Promise<{ content: string; tokensUsed: number }> {
  const { provider, modelId } = await getProviderForMode('polish');

  const { systemPrompt, truncationWarnings } = buildWritingSystemPrompt(params.priorKnowledge, 'shorten');

  for (const warning of truncationWarnings) {
    logger.warn(`Context truncation [shorten]: ${warning}`);
  }

  logger.info(`Shorten: textLen=${params.text.length}, model=${modelId}, provider=${provider.name}`);

  const result = await provider.chat({
    model: modelId,
    maxTokens: 4096,
    temperature: 0.3,
    system: systemPrompt,
    messages: [
      {
        role: 'user',
        content: `## 需要精简的文本\n${params.text}\n\n请精简以上文本，保留核心内容。`,
      },
    ],
    signal: params.signal,
  });

  const content = extractText(result.content);
  const tokensUsed = result.usage.inputTokens + result.usage.outputTokens;

  logger.info(`Shorten done: tokens=${tokensUsed}, resultLen=${content.length}`);
  return { content, tokensUsed };
}

/**
 * Rewrite the given text in a specified style.
 */
export async function rewriteText(params: {
  text: string;
  style?: string;
  priorKnowledge: PriorKnowledge;
  signal?: AbortSignal;
}): Promise<{ content: string; tokensUsed: number }> {
  const { provider, modelId } = await getProviderForMode('polish');

  const { systemPrompt, truncationWarnings } = buildWritingSystemPrompt(params.priorKnowledge, 'rewrite', params.style);

  for (const warning of truncationWarnings) {
    logger.warn(`Context truncation [rewrite]: ${warning}`);
  }

  logger.info(`Rewrite: textLen=${params.text.length}, style=${params.style}, model=${modelId}, provider=${provider.name}`);

  const styleHint = params.style ? `目标风格：${params.style}` : '';

  const result = await provider.chat({
    model: modelId,
    maxTokens: 4096,
    temperature: 0.8,
    system: systemPrompt,
    messages: [
      {
        role: 'user',
        content: `## 需要改写的文本\n${params.text}\n\n${styleHint}\n请按指定风格改写以上文本。`,
      },
    ],
    signal: params.signal,
  });

  const content = extractText(result.content);
  const tokensUsed = result.usage.inputTokens + result.usage.outputTokens;

  logger.info(`Rewrite done: tokens=${tokensUsed}, resultLen=${content.length}`);
  return { content, tokensUsed };
}

/**
 * Check content against knowledge base for foreshadowing issues.
 * Uses tool_choice for structured output.
 */
export async function checkForeshadowing(params: {
  content: string;
  chapterNumber: number;
  priorKnowledge: PriorKnowledge;
  signal?: AbortSignal;
}): Promise<ForeshadowCheckResponse> {
  const { provider, modelId } = await getProviderForMode('chat');

  const { systemPrompt, truncationWarnings } = buildWritingSystemPrompt(params.priorKnowledge, 'write');

  for (const warning of truncationWarnings) {
    logger.warn(`Context truncation [foreshadowing]: ${warning}`);
  }

  const foreshadowSystemPrompt = systemPrompt.replace(
    '## 写作指令',
    '## 伏笔检查指令',
  );

  // Truncate content if too long
  const contentForCheck =
    params.content.length > 8000
      ? params.content.slice(0, 2000) + '\n...\n' + params.content.slice(-6000)
      : params.content;

  logger.info(
    `Foreshadowing check: chapter=${params.chapterNumber}, contentLen=${params.content.length}, model=${modelId}, provider=${provider.name}`,
  );

  const toolName = 'report_foreshadowing_findings';

  const result = await provider.chat({
    model: modelId,
    maxTokens: 4096,
    temperature: 0.1,
    system: foreshadowSystemPrompt,
    messages: [
      {
        role: 'user',
        content: `## 当前章节正文\n${contentForCheck}\n\n请对照先验知识中的情节/伏笔信息，检查本章的伏笔情况。`,
      },
    ],
    tools: [
      {
        name: toolName,
        description: '报告伏笔检查发现',
        inputSchema: {
          type: 'object',
          properties: {
            findings: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  type: {
                    type: 'string',
                    enum: ['unresolved', 'contradiction', 'new_foreshadow'],
                  },
                  description: { type: 'string' },
                  relatedPlot: { type: 'string' },
                  chapterReference: { type: 'number' },
                  severity: {
                    type: 'string',
                    enum: ['info', 'warning', 'error'],
                  },
                },
                required: ['type', 'description', 'relatedPlot', 'severity'],
              },
            },
          },
          required: ['findings'],
        },
      },
    ],
    toolChoice: { type: 'tool', name: toolName },
    signal: params.signal,
  });

  const toolUseBlocks = result.content.filter(
    (c): c is ToolUseBlock => c.type === 'tool_use',
  );

  let findings: ForeshadowFinding[] = [];

  if (toolUseBlocks.length > 0) {
    try {
      const raw = toolUseBlocks[0].input as { findings?: ForeshadowFinding[] };
      if (raw && Array.isArray(raw.findings)) {
        findings = raw.findings;
      }
    } catch (err) {
      logger.error('Failed to parse foreshadowing tool response:', err);
    }
  }

  const tokensUsed = result.usage.inputTokens + result.usage.outputTokens;
  logger.info(`Foreshadowing check done: tokens=${tokensUsed}, findings=${findings.length}`);

  return {
    findings,
    usage: {
      inputTokens: result.usage.inputTokens,
      outputTokens: result.usage.outputTokens,
    },
  };
}

export { AbortError, buildWritingSystemPrompt };
