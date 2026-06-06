// server/src/utils/context.ts
// Context management utility for PRD-07.
// Handles knowledge entry truncation, conversation history management,
// conversation summarization, and budget pre-flight checks.

import { estimateTokens } from './tokenizer';
import { createLogger } from './logger';

const logger = createLogger('context');

// ==================== Types ====================

export interface TruncatableEntry {
  content: string;
  relevance: number; // 0–1 scale, higher = more relevant
  name?: string;
  category?: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
  pinned?: boolean;
}

// ==================== Knowledge Context Truncation ====================

/**
 * Truncate knowledge entries to fit within a token budget.
 * Entries are sorted by relevance (descending), then included until
 * the cumulative token count exceeds the budget.
 *
 * @param entries - Array of truncatable entries with relevance scores
 * @param budget - Token budget (default: 30000)
 * @returns Truncated list of entries that fit within the budget
 */
export function truncateKnowledgeContext(
  entries: TruncatableEntry[],
  budget: number = 30000,
): TruncatableEntry[] {
  if (entries.length === 0) return [];

  // Sort by relevance descending
  const sorted = [...entries].sort((a, b) => b.relevance - a.relevance);

  const result: TruncatableEntry[] = [];
  let totalTokens = 0;

  for (const entry of sorted) {
    const entryTokens = estimateTokens(entry.content);

    if (totalTokens + entryTokens <= budget) {
      result.push(entry);
      totalTokens += entryTokens;
    } else {
      // Try to include a truncated version
      const remainingBudget = budget - totalTokens;
      if (remainingBudget > 200) {
        // At least 200 tokens for a meaningful excerpt
        const truncatedContent = truncateToTokenBudget(entry.content, remainingBudget);
        if (truncatedContent.length > 0) {
          result.push({ ...entry, content: truncatedContent + '...' });
          totalTokens += estimateTokens(truncatedContent + '...');
        }
      }
      break;
    }
  }

  logger.debug(
    `Knowledge context: ${entries.length} entries → ${result.length} (budget=${budget}, used=${totalTokens} tokens)`,
  );

  return result;
}

/**
 * Truncate a text to fit within a token budget.
 * Uses character-proportional truncation.
 */
function truncateToTokenBudget(text: string, budget: number): string {
  if (estimateTokens(text) <= budget) return text;

  // Binary search for the right cutoff using approximate char-to-token ratio
  // Assume ~2 chars per token for Chinese, ~4 for English — use 3 as a middle ground
  let lo = 0;
  let hi = text.length;

  while (lo < hi) {
    const mid = Math.floor((lo + hi + 1) / 2);
    const slice = text.slice(0, mid);
    const tokens = estimateTokens(slice);

    if (tokens <= budget) {
      lo = mid;
    } else {
      hi = mid - 1;
    }
  }

  return text.slice(0, lo);
}

// ==================== Conversation History Management ====================

/**
 * Truncate conversation history to the last N messages,
 * preserving pinned messages regardless of age.
 *
 * @param messages - Full conversation history
 * @param maxMessages - Maximum number of recent non-pinned messages to keep (default: 20)
 * @returns Truncated messages sorted by timestamp
 */
export function truncateConversationHistory(
  messages: ChatMessage[],
  maxMessages: number = 20,
): ChatMessage[] {
  if (messages.length <= maxMessages) return messages;

  const pinned = messages.filter((m) => m.pinned);
  const recent = messages.slice(-maxMessages);

  // Merge: recent messages + pinned messages not already in recent
  const seen = new Set(recent.map((m) => m.id));
  const extraPinned = pinned.filter((m) => !seen.has(m.id));

  const all = [...recent, ...extraPinned].sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
  );

  if (messages.length > all.length) {
    logger.debug(
      `Conversation truncated: ${messages.length} → ${all.length} messages (pinned: ${pinned.length})`,
    );
  }

  return all;
}

/**
 * Generate a summary of older conversation messages.
 *
 * Currently returns a simple truncation-based summary.
 * Future enhancement: use a lightweight model to generate a real summary.
 *
 * @param messages - The messages to summarize
 * @returns A summary string
 */
export function summarizeConversation(messages: ChatMessage[]): string {
  if (messages.length === 0) return '';

  const truncated = truncateConversationHistory(messages, 20);

  if (truncated.length < messages.length) {
    const omitted = messages.length - truncated.length;
    return `[之前讨论了 ${omitted} 条消息。以下是最近的讨论：]\n\n` +
      truncated.map((m) => `[${m.role === 'user' ? '作者' : 'AI'}] ${m.content.slice(0, 200)}`).join('\n');
  }

  return truncated.map((m) => `[${m.role === 'user' ? '作者' : 'AI'}] ${m.content}`).join('\n');
}

// ==================== Token Budget Pre-Flight Check ====================

export interface BudgetCheckResult {
  fits: boolean;
  estimatedTokens: number;
  budget: number;
  remainingTokens: number;
}

/**
 * Check if an input text fits within a token budget.
 *
 * @param input - The text to check
 * @param budget - Token budget limit
 * @returns BudgetCheckResult with fit status and token estimates
 */
export function checkTokenBudget(input: string, budget: number): BudgetCheckResult {
  const estimatedTokens = estimateTokens(input);
  const remainingTokens = budget - estimatedTokens;

  return {
    fits: estimatedTokens <= budget,
    estimatedTokens,
    budget,
    remainingTokens,
  };
}

// ==================== Context Usage Tracking ====================

interface ContextUsageRecord {
  function: string;
  inputTokens: number;
  outputTokens: number;
  timestamp: string;
}

const usageHistory: ContextUsageRecord[] = [];
const MAX_USAGE_HISTORY = 100;

/**
 * Record a context usage event.
 */
export function recordUsage(
  func: string,
  inputTokens: number,
  outputTokens: number,
): void {
  usageHistory.push({
    function: func,
    inputTokens,
    outputTokens,
    timestamp: new Date().toISOString(),
  });

  // Trim history
  while (usageHistory.length > MAX_USAGE_HISTORY) {
    usageHistory.shift();
  }
}

/**
 * Build a context usage report for the system endpoint.
 */
export interface ContextUsageReport {
  recentCalls: ContextUsageRecord[];
  summary: {
    totalCalls: number;
    totalInputTokens: number;
    totalOutputTokens: number;
    averageInputTokens: number;
    averageOutputTokens: number;
  };
  byFunction: Record<
    string,
    {
      calls: number;
      totalInputTokens: number;
      totalOutputTokens: number;
    }
  >;
}

export function buildContextUsageReport(): ContextUsageReport {
  const byFunction: ContextUsageReport['byFunction'] = {};

  for (const record of usageHistory) {
    if (!byFunction[record.function]) {
      byFunction[record.function] = {
        calls: 0,
        totalInputTokens: 0,
        totalOutputTokens: 0,
      };
    }
    byFunction[record.function].calls++;
    byFunction[record.function].totalInputTokens += record.inputTokens;
    byFunction[record.function].totalOutputTokens += record.outputTokens;
  }

  const totalInputTokens = usageHistory.reduce((s, r) => s + r.inputTokens, 0);
  const totalOutputTokens = usageHistory.reduce((s, r) => s + r.outputTokens, 0);

  return {
    recentCalls: usageHistory.slice(-20),
    summary: {
      totalCalls: usageHistory.length,
      totalInputTokens,
      totalOutputTokens,
      averageInputTokens:
        usageHistory.length > 0
          ? Math.round(totalInputTokens / usageHistory.length)
          : 0,
      averageOutputTokens:
        usageHistory.length > 0
          ? Math.round(totalOutputTokens / usageHistory.length)
          : 0,
    },
    byFunction,
  };
}
