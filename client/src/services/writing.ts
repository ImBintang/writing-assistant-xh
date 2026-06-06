// client/src/services/writing.ts
// Client API functions for writing window (PRD-05)

import { api } from './api';

// ============================================================
// Types (mirroring server-side types)
// ============================================================

export interface KnowledgeEntry {
  id: string;
  category: string;
  name: string;
  aliases: string[];
  attributes: Record<string, unknown>;
  description: string;
  relations: Array<{ targetId: string; targetName: string; relationType: string; description: string }>;
  source: Array<{ chapter: number; chapterTitle: string; excerpt: string; extractedAt: string }>;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface PriorKnowledge {
  characters: KnowledgeEntry[];
  techniques: KnowledgeEntry[];
  locations: KnowledgeEntry[];
  worldbuilding: KnowledgeEntry[];
  weapons: KnowledgeEntry[];
  alchemy: KnowledgeEntry[];
  plot: KnowledgeEntry[];
  previousChapter: string;
  summary: string;
}

export interface DiffItem {
  type: 'add' | 'remove' | 'unchanged';
  value: string;
}

export interface ForeshadowFinding {
  type: 'unresolved' | 'contradiction' | 'new_foreshadow';
  description: string;
  relatedPlot: string;
  chapterReference: number;
  severity: 'info' | 'warning' | 'error';
}

export interface DraftOutline {
  id: string;
  title: string;
  targetChapter: number;
  outline: string;
  draft: string;
  priorKnowledge?: PriorKnowledge;
  createdAt: string;
  updatedAt: string;
}

export interface RetrieveRequest {
  outline?: string;
  draft?: string;
  targetChapter?: number;
  categoryFilter?: string[];
}

export interface GenerateRequest {
  outline: string;
  priorKnowledge: PriorKnowledge;
  chapterNumber?: number;
}

export interface ContinueRequest {
  currentContent: string;
  priorKnowledge: PriorKnowledge;
  length?: number;
}

export interface PolishRequest {
  selectedText: string;
  priorKnowledge: PriorKnowledge;
  instruction?: string;
}

export interface ExpandRequest {
  text: string;
  priorKnowledge: PriorKnowledge;
}

export interface ShortenRequest {
  text: string;
  priorKnowledge: PriorKnowledge;
}

export interface RewriteRequest {
  text: string;
  style?: string;
  priorKnowledge: PriorKnowledge;
}

export interface ForeshadowCheckRequest {
  content: string;
  chapterNumber: number;
  priorKnowledge: PriorKnowledge;
}

export interface GenerateResponse {
  content: string;
  usage: { inputTokens: number; outputTokens: number };
}

export interface PolishResponse {
  polishedText: string;
  changes: DiffItem[];
  usage: { inputTokens: number; outputTokens: number };
}

export interface ForeshadowCheckResponse {
  findings: ForeshadowFinding[];
  usage: { inputTokens: number; outputTokens: number };
}

// ============================================================
// API Functions
// ============================================================

/**
 * Retrieve prior knowledge for given outline/draft input.
 */
export async function retrieveKnowledge(
  data: RetrieveRequest,
  signal?: AbortSignal,
): Promise<PriorKnowledge> {
  const response = await api.post<PriorKnowledge>(
    '/api/v1/writing/retrieve',
    data,
    { signal },
  );
  return response.data;
}

/**
 * Generate a full chapter from an outline.
 */
export async function generateChapter(
  data: GenerateRequest,
  signal?: AbortSignal,
): Promise<GenerateResponse> {
  const response = await api.post<GenerateResponse>(
    '/api/v1/writing/generate',
    data,
    { signal },
  );
  return response.data;
}

/**
 * Continue writing from current body content.
 */
export async function continueWriting(
  data: ContinueRequest,
  signal?: AbortSignal,
): Promise<{ content: string }> {
  const response = await api.post<{ content: string }>(
    '/api/v1/writing/continue',
    data,
    { signal },
  );
  return response.data;
}

/**
 * Polish selected text, returns word-level diff.
 */
export async function polishText(
  data: PolishRequest,
  signal?: AbortSignal,
): Promise<PolishResponse> {
  const response = await api.post<PolishResponse>(
    '/api/v1/writing/polish',
    data,
    { signal },
  );
  return response.data;
}

/**
 * Expand text with more detail.
 */
export async function expandText(
  data: ExpandRequest,
  signal?: AbortSignal,
): Promise<{ content: string }> {
  const response = await api.post<{ content: string }>(
    '/api/v1/writing/expand',
    data,
    { signal },
  );
  return response.data;
}

/**
 * Shorten/condense text.
 */
export async function shortenText(
  data: ShortenRequest,
  signal?: AbortSignal,
): Promise<{ content: string }> {
  const response = await api.post<{ content: string }>(
    '/api/v1/writing/shorten',
    data,
    { signal },
  );
  return response.data;
}

/**
 * Rewrite text in specified style.
 */
export async function rewriteText(
  data: RewriteRequest,
  signal?: AbortSignal,
): Promise<{ content: string }> {
  const response = await api.post<{ content: string }>(
    '/api/v1/writing/rewrite',
    data,
    { signal },
  );
  return response.data;
}

/**
 * Check foreshadowing against knowledge base plot entries.
 */
export async function checkForeshadowing(
  data: ForeshadowCheckRequest,
  signal?: AbortSignal,
): Promise<ForeshadowCheckResponse> {
  const response = await api.post<ForeshadowCheckResponse>(
    '/api/v1/writing/check-foreshadowing',
    data,
    { signal },
  );
  return response.data;
}

// ============================================================
// Draft Management API
// ============================================================

/**
 * List all drafts, sorted by updatedAt descending.
 */
export async function fetchDrafts(): Promise<DraftOutline[]> {
  const response = await api.get<{ drafts: DraftOutline[] }>(
    '/api/v1/writing/drafts',
  );
  return response.data.drafts;
}

/**
 * Create a new draft.
 */
export async function createDraft(
  data: Omit<DraftOutline, 'id' | 'createdAt' | 'updatedAt'>,
): Promise<DraftOutline> {
  const response = await api.post<DraftOutline>(
    '/api/v1/writing/drafts',
    data,
  );
  return response.data;
}

/**
 * Update an existing draft.
 */
export async function updateDraft(
  id: string,
  data: Partial<Omit<DraftOutline, 'id' | 'createdAt'>>,
): Promise<DraftOutline> {
  const response = await api.put<DraftOutline>(
    `/api/v1/writing/drafts/${id}`,
    data,
  );
  return response.data;
}

/**
 * Delete a draft by ID.
 */
export async function deleteDraft(id: string): Promise<void> {
  await api.delete(`/api/v1/writing/drafts/${id}`);
}
