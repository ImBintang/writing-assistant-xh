// server/src/services/chunker.ts
// Splits large chapter content into overlapping chunks on paragraph boundaries
// to avoid exceeding the AI model's context window.

import type { ChapterChunk } from '../types/knowledge';
import { createLogger } from '../utils/logger';

const logger = createLogger('chunker');

const DEFAULT_MAX_CHARS = 4000;
const DEFAULT_OVERLAP = 500;

/**
 * Count Chinese characters in a string (each CJK character counts as 1).
 * Non-CJK characters are counted as-is.
 */
function charCount(text: string): number {
  return text.length;
}

/**
 * Split text on paragraph boundaries (`\n\n` or `\n`).
 * Each chunk is roughly maxChars characters, with overlap chars of overlap.
 */
export function chunkChapter(
  content: string,
  maxChars: number = DEFAULT_MAX_CHARS,
  overlap: number = DEFAULT_OVERLAP,
): ChapterChunk[] {
  // Split into paragraphs
  const paragraphs = content.split(/\n\n+/);
  if (paragraphs.length <= 1) {
    // Single paragraph — further split by sentences
    const sentences = content.split(/(?<=[。！？；\n])/);
    return buildChunks(sentences, maxChars, overlap, content);
  }

  return buildChunks(paragraphs, maxChars, overlap, content);
}

function buildChunks(
  segments: string[],
  maxChars: number,
  overlap: number,
  fullContent: string,
): ChapterChunk[] {
  const chunks: ChapterChunk[] = [];
  let currentChunk = '';
  let currentStart = 0;

  for (let i = 0; i < segments.length; i++) {
    const segment = segments[i];
    const combined = currentChunk ? currentChunk + '\n\n' + segment : segment;

    if (charCount(combined) > maxChars && currentChunk.length > 0) {
      // Finalize current chunk
      const endOffset = currentStart + charCount(currentChunk);
      chunks.push({
        index: chunks.length,
        total: 0, // will be updated
        content: currentChunk,
        label: `片段 ${chunks.length + 1}`,
        startOffset: currentStart,
        endOffset,
      });

      // Start new chunk with overlap
      if (overlap > 0 && charCount(currentChunk) > overlap) {
        // Take the last ~overlap characters of the current chunk as overlap
        const overlapText = takeLastChars(currentChunk, overlap);
        currentChunk = overlapText + '\n\n' + segment;
        currentStart = endOffset - charCount(overlapText);
      } else {
        currentChunk = segment;
        currentStart = endOffset;
      }
    } else {
      currentChunk = combined;
    }
  }

  // Don't forget the last chunk
  if (currentChunk.trim().length > 0) {
    const endOffset = currentStart + charCount(currentChunk);
    chunks.push({
      index: chunks.length,
      total: 0,
      content: currentChunk,
      label: `片段 ${chunks.length + 1}`,
      startOffset: currentStart,
      endOffset,
    });
  }

  // If no chunks were needed, return the whole content as one chunk
  if (chunks.length === 0) {
    chunks.push({
      index: 0,
      total: 1,
      content: fullContent,
      label: '全文',
      startOffset: 0,
      endOffset: charCount(fullContent),
    });
  }

  // Update total and labels
  for (const chunk of chunks) {
    chunk.total = chunks.length;
    if (chunks.length > 1) {
      chunk.label = `片段 ${chunk.index + 1}/${chunks.length}`;
    } else {
      chunk.label = '全文';
    }
  }

  logger.debug(
    `Chunked content (${charCount(fullContent)} chars) into ${chunks.length} chunk(s)`,
  );

  return chunks;
}

/**
 * Take approximately the last `count` characters of text,
 * trying to start at a natural boundary.
 */
function takeLastChars(text: string, count: number): string {
  if (charCount(text) <= count) return text;

  const tail = text.slice(-count);
  // Try to find the first paragraph or sentence boundary
  const boundary = tail.search(/[\n。！？；]/);
  if (boundary > 0 && boundary < tail.length - 1) {
    return tail.slice(boundary + 1);
  }
  return tail;
}

export default { chunkChapter };
