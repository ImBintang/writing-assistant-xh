// server/src/agents/brainstorm.ts
// Brainstorm AI Agent for PRD-06
// Handles multi-turn creative conversation and conclusion extraction.
// Uses the multi-provider client abstraction for AI calls.

import { getProviderForMode } from './client';
import { createLogger } from '../utils/logger';
import { estimateTokens } from '../utils/tokenizer';
import { truncateConversationHistory } from '../utils/context';
import { getEntryById } from '../services/knowledge-management';
import type { ChatMessage, BrainstormReply, ExtractedConclusions } from '../types/knowledge';
import type { ToolUseBlock } from './client';

const logger = createLogger('brainstorm-agent');

const MAX_HISTORY_MESSAGES = 8;
const MAX_KNOWLEDGE_CHARS_PER_ENTRY = 500;

/**
 * Format a knowledge entry for inclusion in the system prompt.
 */
function formatKnowledgeEntry(entry: {
  id: string;
  name: string;
  category: string;
  description?: string;
  attributes?: Record<string, unknown>;
}): string {
  const parts: string[] = [];
  parts.push(`[${entry.name}] (${entry.category})`);
  if (entry.description) {
    parts.push(`  描述: ${entry.description.slice(0, MAX_KNOWLEDGE_CHARS_PER_ENTRY)}`);
  }
  if (entry.attributes && Object.keys(entry.attributes).length > 0) {
    const attrs = Object.entries(entry.attributes)
      .slice(0, 8)
      .map(([k, v]) => `  - ${k}: ${typeof v === 'string' ? v.slice(0, 100) : JSON.stringify(v)}`)
      .join('\n');
    parts.push(attrs);
  }
  return parts.join('\n');
}

/**
 * Build the brainstorm system prompt with knowledge context and conversation history.
 * Estimates total context size and warns if near limits.
 */
async function buildSystemPrompt(
  conversationHistory: ChatMessage[],
  referenceIds: string[],
): Promise<string> {
  let prompt = `你是一位专业的创意写作头脑风暴伙伴。你的任务是帮助作者：
- 探讨剧情发展方向
- 分析角色动机和成长弧线
- 提出伏笔和反转建议
- 评估情节合理性和连贯性
- 提供多个可行的方案供作者选择

回复风格：
- 使用中文交流
- 保持鼓励和支持的态度
- 当引用设定时，标注来源
- 如有多个方案，用编号列出并分析各自的优缺点
- 可以提问引导作者深入思考

`;

  // Load referenced knowledge entries
  if (referenceIds.length > 0) {
    prompt += '---\n## 引用的知识库条目\n\n';
    for (const id of referenceIds) {
      try {
        const entry = await getEntryById(id);
        if (entry) {
          prompt += formatKnowledgeEntry(entry) + '\n\n';
        }
      } catch {
        // Entry not found — skip
      }
    }
  }

  // Add pinned messages as key context
  const pinnedMessages = conversationHistory.filter((m) => m.pinned);
  if (pinnedMessages.length > 0) {
    prompt += '---\n## 已钉选的关键讨论点\n\n';
    for (const msg of pinnedMessages) {
      prompt += `- [${msg.role === 'user' ? '作者' : 'AI'}] ${msg.content.slice(0, 300)}\n`;
    }
    prompt += '\n';
  }

  // Estimate system prompt size
  const estimatedPromptTokens = estimateTokens(prompt);
  if (estimatedPromptTokens > 50000) {
    logger.warn(
      `Brainstorm system prompt estimated at ${estimatedPromptTokens} tokens — may approach context limits`,
    );
  }

  return prompt;
}

/**
 * Build the messages array for the brainstorm conversation from history.
 * Keeps the last N non-pinned messages plus all pinned messages.
 */
function buildMessages(
  conversationHistory: ChatMessage[],
): Array<{ role: 'user' | 'assistant'; content: string }> {
  // Keep last MAX_HISTORY_MESSAGES non-pinned + all pinned
  const truncated = truncateConversationHistory(
    conversationHistory.map((m) => ({
      id: m.id,
      role: m.role as 'user' | 'assistant',
      content: m.content,
      timestamp: m.timestamp,
      pinned: m.pinned,
    })),
    MAX_HISTORY_MESSAGES,
  );

  return truncated
    .filter((m) => m.role === 'user' || m.role === 'assistant')
    .map((m) => ({
      role: m.role as 'user' | 'assistant',
      content: m.content,
    }));
}

/**
 * Send a message in a brainstorm session and get an AI reply.
 */
export async function sendBrainstormMessage(params: {
  conversationHistory: ChatMessage[];
  referenceIds: string[];
  signal?: AbortSignal;
}): Promise<BrainstormReply> {
  const startTime = Date.now();
  const { provider, modelId } = await getProviderForMode('brainstorm');

  const systemPrompt = await buildSystemPrompt(params.conversationHistory, params.referenceIds);
  const messages = buildMessages(params.conversationHistory);

  // Estimate total input tokens and warn if needed
  const promptTokens = estimateTokens(systemPrompt);
  const msgTokens = estimateTokens(messages.map((m) => m.content).join('\n'));
  const totalEstimate = promptTokens + msgTokens;

  if (totalEstimate > 90000) {
    logger.warn(
      `Brainstorm input estimated at ${totalEstimate} tokens (prompt=${promptTokens}, msgs=${msgTokens}) — may exceed context limit`,
    );
  }

  logger.info(
    `Brainstorm: sending message (historyLen=${messages.length}, refs=${params.referenceIds.length}, model=${modelId}, provider=${provider.name}, estTokens=${totalEstimate})`,
  );

  try {
    const result = await provider.chat({
      model: modelId,
      maxTokens: 2048,
      temperature: 0.8,
      system: systemPrompt,
      messages,
      signal: params.signal,
    });

    // Extract text reply
    const textBlocks = result.content.filter((c) => c.type === 'text');
    const replyText = textBlocks.map((b) => (b as { type: 'text'; text: string }).text).join('\n');

    // Collect knowledge excerpts for referenced entries
    const references: BrainstormReply['references'] = [];
    for (const id of params.referenceIds) {
      try {
        const entry = await getEntryById(id);
        if (entry) {
          references.push({
            knowledgeId: entry.id,
            knowledgeName: entry.name,
            category: entry.category,
            excerpt: (entry.description || '').slice(0, 200),
          });
        }
      } catch {
        // Skip
      }
    }

    const durationMs = Date.now() - startTime;
    logger.info(
      `Brainstorm reply received: len=${replyText.length}, refs=${references.length}, duration=${durationMs}ms`,
    );

    return { reply: replyText, references };
  } catch (err: unknown) {
    if (err instanceof Error && err.name === 'AbortError') {
      logger.info('Brainstorm message aborted');
      throw err;
    }
    const errorMsg = err instanceof Error ? err.message : String(err);
    logger.error(`Brainstorm message failed: ${errorMsg}`);
    throw err;
  }
}

/**
 * Extract conclusions from a brainstorm session.
 * Uses tool_choice for structured JSON output.
 */
export async function extractConclusions(
  conversationHistory: ChatMessage[],
  signal?: AbortSignal,
): Promise<ExtractedConclusions> {
  const { provider, modelId } = await getProviderForMode('chat');

  // Build the full conversation text for analysis
  const truncatedHistory = truncateConversationHistory(
    conversationHistory.map((m) => ({
      id: m.id,
      role: m.role as 'user' | 'assistant',
      content: m.content,
      timestamp: m.timestamp,
      pinned: m.pinned,
    })),
    50, // More context for analysis
  );

  const conversationText = truncatedHistory
    .map((m) => `[${m.role === 'user' ? '作者' : 'AI'}] ${m.content}`)
    .join('\n\n');

  // Check conversation size
  const estimatedInputTokens = estimateTokens(conversationText);
  if (estimatedInputTokens > 80000) {
    logger.warn(
      `Extract conclusions: conversation estimated at ${estimatedInputTokens} tokens — may be truncated by model`,
    );
  }

  const systemPrompt = `你是一位专业的写作分析助手。请分析以下头脑风暴对话，提取关键结论。

要求：
1. 用中文总结
2. 只提取已经达成的结论（不是所有讨论过的想法）
3. 对每个结论评估置信度（0-1）
4. 为可转化为设定的结论建议设定类别

设定类别选项：characters(人物), techniques(功法), plot(情节), alchemy(丹药), map(地图), organization(组织), other(其他)`;

  const extractTool = {
    name: 'extract_conclusions',
    description: '提取头脑风暴对话中的关键结论和决策',
    inputSchema: {
      type: 'object' as const,
      properties: {
        summary: {
          type: 'string',
          description: '对话摘要，概述讨论的主要内容',
        },
        decisions: {
          type: 'array',
          description: '已达成共识的关键结论列表',
          items: {
            type: 'object',
            properties: {
              text: { type: 'string', description: '结论内容' },
              category: {
                type: 'string',
                enum: ['characters', 'techniques', 'plot', 'alchemy', 'map', 'organization', 'other'],
                description: '该结论对应的设定类别',
              },
              confidence: {
                type: 'number',
                description: '结论置信度 (0-1)',
                minimum: 0,
                maximum: 1,
              },
            },
            required: ['text', 'category', 'confidence'],
          },
        },
        suggestedSettings: {
          type: 'array',
          description: '可以转化为设定文件的建议',
          items: {
            type: 'object',
            properties: {
              category: {
                type: 'string',
                enum: ['characters', 'techniques', 'plot', 'alchemy', 'map', 'organization', 'other'],
              },
              title: { type: 'string' },
              content: { type: 'string', description: '设定内容的 Markdown 预览' },
            },
            required: ['category', 'title', 'content'],
          },
        },
      },
      required: ['summary', 'decisions', 'suggestedSettings'],
    },
  };

  logger.info(`Extracting conclusions from ${conversationHistory.length} messages (truncated to ${truncatedHistory.length})`);

  try {
    const result = await provider.chat({
      model: modelId,
      maxTokens: 4096,
      temperature: 0.3,
      system: systemPrompt,
      messages: [
        {
          role: 'user',
          content: `请分析以下头脑风暴对话并提取关键结论：\n\n${conversationText}`,
        },
      ],
      tools: [extractTool],
      toolChoice: { type: 'tool', name: 'extract_conclusions' },
      signal,
    });

    const toolUseBlocks = result.content.filter(
      (c): c is ToolUseBlock => c.type === 'tool_use',
    );
    if (toolUseBlocks.length === 0) {
      logger.warn('No tool_use block in extract conclusions response');
      return { summary: '', decisions: [], suggestedSettings: [] };
    }

    const conclusionsData = toolUseBlocks[0].input as unknown as ExtractedConclusions;

    logger.info(
      `Extracted conclusions: ${conclusionsData.decisions.length} decisions, ${conclusionsData.suggestedSettings.length} suggestions`,
    );

    return conclusionsData;
  } catch (err: unknown) {
    if (err instanceof Error && err.name === 'AbortError') {
      throw err;
    }
    logger.error('Failed to extract conclusions:', err);
    throw err;
  }
}
