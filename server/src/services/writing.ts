// server/src/services/writing.ts
// Writing business logic layer for PRD-05
// Thin orchestration between routes, RAG service, and writer agent.

import { diffWords } from 'diff';
import { createLogger } from '../utils/logger';
import { retrievePriorKnowledge } from './rag';
import * as writer from '../agents/writer';
import type {
  RetrieveRequest,
  PriorKnowledge,
  GenerateRequest,
  ContinueRequest,
  PolishRequest,
  ExpandRequest,
  ShortenRequest,
  RewriteRequest,
  ForeshadowCheckRequest,
  GenerateResponse,
  PolishResponse,
  ForeshadowCheckResponse,
  DiffItem,
} from '../types/knowledge';

const logger = createLogger('writing-service');

/**
 * Retrieve prior knowledge for given outline/draft input.
 */
export async function retrieve(params: RetrieveRequest): Promise<PriorKnowledge> {
  return retrievePriorKnowledge(params);
}

/**
 * Generate a full chapter from an outline.
 */
export async function generate(
  params: GenerateRequest & { signal?: AbortSignal },
): Promise<GenerateResponse> {
  logger.info('Starting chapter generation');
  const result = await writer.generateChapter({
    outline: params.outline,
    priorKnowledge: params.priorKnowledge,
    chapterNumber: params.chapterNumber,
    signal: params.signal,
  });
  return {
    content: result.content,
    usage: { inputTokens: 0, outputTokens: result.tokensUsed },
  };
}

/**
 * Continue writing from current body content.
 */
export async function continueWriting(
  params: ContinueRequest & { signal?: AbortSignal },
): Promise<{ content: string }> {
  logger.info('Starting continue writing');
  const result = await writer.continueWriting({
    currentContent: params.currentContent,
    priorKnowledge: params.priorKnowledge,
    length: params.length,
    signal: params.signal,
  });
  return { content: result.content };
}

/**
 * Polish selected text — computes word-level diff between original and polished.
 */
export async function polish(
  params: PolishRequest & { signal?: AbortSignal },
): Promise<PolishResponse> {
  logger.info('Starting polish');
  const result = await writer.polishText({
    selectedText: params.selectedText,
    priorKnowledge: params.priorKnowledge,
    instruction: params.instruction,
    signal: params.signal,
  });

  // Compute word-level diff between original and polished text
  const diffs = diffWords(params.selectedText, result.polishedText);
  const changes: DiffItem[] = diffs
    .filter((d) => !(d.added === undefined && d.removed === undefined))
    .map((d) => ({
      type: d.added ? 'add' : d.removed ? 'remove' : 'unchanged',
      value: d.value,
    }));

  return {
    polishedText: result.polishedText,
    changes,
    usage: { inputTokens: 0, outputTokens: result.tokensUsed },
  };
}

/**
 * Expand text with more detail.
 */
export async function expand(
  params: ExpandRequest & { signal?: AbortSignal },
): Promise<{ content: string }> {
  logger.info('Starting expand');
  const result = await writer.expandText({
    text: params.text,
    priorKnowledge: params.priorKnowledge,
    signal: params.signal,
  });
  return { content: result.content };
}

/**
 * Shorten/condense text.
 */
export async function shorten(
  params: ShortenRequest & { signal?: AbortSignal },
): Promise<{ content: string }> {
  logger.info('Starting shorten');
  const result = await writer.shortenText({
    text: params.text,
    priorKnowledge: params.priorKnowledge,
    signal: params.signal,
  });
  return { content: result.content };
}

/**
 * Rewrite text in a specified style.
 */
export async function rewrite(
  params: RewriteRequest & { signal?: AbortSignal },
): Promise<{ content: string }> {
  logger.info('Starting rewrite');
  const result = await writer.rewriteText({
    text: params.text,
    style: params.style,
    priorKnowledge: params.priorKnowledge,
    signal: params.signal,
  });
  return { content: result.content };
}

/**
 * Check foreshadowing against knowledge base plot entries.
 */
export async function checkForeshadowing(
  params: ForeshadowCheckRequest & { signal?: AbortSignal },
): Promise<ForeshadowCheckResponse> {
  logger.info('Starting foreshadowing check');
  return writer.checkForeshadowing({
    content: params.content,
    chapterNumber: params.chapterNumber,
    priorKnowledge: params.priorKnowledge,
    signal: params.signal,
  });
}
