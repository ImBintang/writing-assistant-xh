// client/src/services/knowledge.ts
// Client API functions for knowledge extraction (PRD-03)

import { api } from './api';

// ============================================================
// Types
// ============================================================

export interface SkillInfo {
  id: string;
  name: string;
  category: string;
  description: string;
  promptTemplate: string;
  outputSchema: Record<string, unknown>;
  isBuiltIn: boolean;
  enabled: boolean;
}

export interface ExtractionConfig {
  chapterIds: number[];
  categories: string[];
  customSkillIds?: string[];
}

export interface ExtractionProgress {
  totalSteps: number;
  completedSteps: number;
  currentChapterIndex: number | null;
  currentChapterTitle: string | null;
  currentCategory: string | null;
}

export interface TaskError {
  chapterIndex: number;
  chapterTitle: string;
  category: string;
  message: string;
}

export interface ExtractionStatus {
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  progress: ExtractionProgress;
  results?: Record<string, KnowledgeEntry[]>;
  errors?: TaskError[];
}

export interface KnowledgeEntry {
  id: string;
  category: string;
  name: string;
  aliases: string[];
  attributes: Record<string, unknown>;
  description: string;
  relations: Array<{
    targetId?: string;
    targetName: string;
    relationType: string;
    description: string;
  }>;
  source: Array<{
    chapter: number;
    chapterTitle: string;
    excerpt: string;
    extractedAt: string;
  }>;
  version: number;
  createdAt: string;
  updatedAt: string;
  versionHistory?: VersionRecord[];
  deletedAt?: string;
  manualEdited?: boolean;
  conflicts?: ConflictRecord[];
}

export interface ConflictRecord {
  field: string;
  oldValue: unknown;
  newValue: unknown;
  sourceChapter: number;
  detectedAt: string;
  resolved: boolean;
  resolution?: string;
  manualValue?: unknown;
  // PRD-10
  timeline?: Array<{
    chapterIndex: number;
    chapterTitle: string;
    value: unknown;
    recordedAt: string;
  }>;
  riskLevel?: 'low' | 'high';
  riskReason?: string;
  aiMergedText?: string;
  suggestedAction?: 'merge' | 'manual' | 'coexist';
}

export interface CreateSkillRequest {
  name: string;
  category: string;
  description: string;
  promptTemplate?: string;
  outputSchema?: Record<string, unknown>;
  enabled?: boolean;
}

export interface UpdateSkillRequest {
  name?: string;
  category?: string;
  description?: string;
  promptTemplate?: string;
  outputSchema?: Record<string, unknown>;
  enabled?: boolean;
}

export interface GeneratePromptRequest {
  name: string;
  category: string;
  description: string;
}

export interface GeneratePromptResponse {
  promptTemplate: string;
  outputSchema: Record<string, unknown>;
}

export type ConflictResolution = 'accept_new' | 'keep_old' | 'manual';

export interface BatchResolution {
  entryId: string;
  field: string;
  resolution: ConflictResolution;
  manualValue?: unknown;
}

export interface ConflictWithEntry {
  entry: KnowledgeEntry;
  conflicts: ConflictRecord[];
}

// ============================================================
// Extraction API
// ============================================================

export async function startExtraction(
  config: ExtractionConfig,
): Promise<{ taskId: string }> {
  const response = await api.post('/api/v1/extract/start', config);
  return response.data as { taskId: string };
}

export async function getExtractionStatus(
  taskId: string,
): Promise<ExtractionStatus> {
  const response = await api.get(`/api/v1/extract/${taskId}/status`);
  return response.data as ExtractionStatus;
}

export async function cancelExtraction(taskId: string): Promise<void> {
  await api.post(`/api/v1/extract/${taskId}/cancel`);
}

// ============================================================
// Skills API
// ============================================================

export async function fetchSkills(): Promise<SkillInfo[]> {
  const response = await api.get('/api/v1/skills');
  return (response.data as { skills: SkillInfo[] }).skills;
}

export async function createSkill(
  skillData: CreateSkillRequest,
): Promise<SkillInfo> {
  const response = await api.post('/api/v1/skills', skillData);
  return response.data as SkillInfo;
}

export async function updateSkill(
  id: string,
  skillData: UpdateSkillRequest,
): Promise<SkillInfo> {
  const response = await api.put(`/api/v1/skills/${id}`, skillData);
  return response.data as SkillInfo;
}

export async function deleteSkill(id: string): Promise<void> {
  await api.delete(`/api/v1/skills/${id}`);
}

export async function generateSkillPrompt(
  id: string,
  genData: GeneratePromptRequest,
): Promise<GeneratePromptResponse> {
  const response = await api.post(`/api/v1/skills/${id}/generate`, genData);
  return response.data as GeneratePromptResponse;
}

// ============================================================
// Conflicts API
// ============================================================

export async function fetchConflicts(): Promise<ConflictWithEntry[]> {
  const response = await api.get('/api/v1/knowledge/conflicts');
  return (response.data as { conflicts: ConflictWithEntry[] }).conflicts;
}

export async function resolveConflict(
  entryId: string,
  field: string,
  resolution: ConflictResolution,
  manualValue?: unknown,
): Promise<void> {
  await api.put(
    `/api/v1/knowledge/conflicts/${entryId}/${encodeURIComponent(field)}`,
    {
      resolution,
      manualValue,
    },
  );
}

export async function batchResolveConflicts(
  resolutions: BatchResolution[],
): Promise<{ resolved: number }> {
  const response = await api.post('/api/v1/knowledge/conflicts/batch', {
    resolutions,
  });
  return response.data as { resolved: number };
}

/**
 * AI-merge merge mode
 */
export type AiMergeMode = 'prefer_old' | 'prefer_new' | 'balanced';

/**
 * AI-merge two conflicting text values.
 */
export async function aiMergeConflict(
  oldValue: string,
  newValue: string,
  mode: AiMergeMode,
): Promise<string> {
  const response = await api.post('/api/v1/knowledge/conflicts/ai-merge', {
    oldValue,
    newValue,
    mode,
  });
  return (response.data as { merged: string }).merged;
}

// ============================================================
// PRD-10: Import Progress, Prescan, Coexist
// ============================================================

export interface ImportProgressInfo {
  category: string;
  lastImportedChapterIndex: number;
  lastImportedChapterTitle: string;
  importedAt: string;
  totalChaptersAtImport: number;
}

export interface PrescanResultItem {
  entryId: string;
  field: string;
  riskLevel: 'low' | 'high';
  reason: string;
  aiMergedText?: string;
  suggestedAction: 'merge' | 'manual' | 'coexist';
}

export interface ImportNextChapterResult {
  result: {
    added: string[];
    merged: string[];
    conflicts: ConflictRecord[];
  };
  nextChapterIndex: number;
  isLatest: boolean;
  chapterTitle: string;
}

export async function fetchImportProgress(): Promise<ImportProgressInfo[]> {
  const response = await api.get('/api/v1/knowledge/import-progress');
  return (response.data as { progress: ImportProgressInfo[] }).progress;
}

export async function inferImportProgress(category: string): Promise<{ category: string; lastImportedChapterIndex: number }> {
  const response = await api.get('/api/v1/knowledge/import-progress/infer', { params: { category } });
  return response.data as { category: string; lastImportedChapterIndex: number };
}

export async function importNextChapter(
  category: string,
  chapterIndex?: number,
): Promise<ImportNextChapterResult> {
  const response = await api.post('/api/v1/knowledge/import-next', {
    category,
    chapterIndex,
  });
  return response.data as ImportNextChapterResult;
}

export async function prescanConflicts(entryIds?: string[]): Promise<PrescanResultItem[]> {
  const response = await api.post('/api/v1/knowledge/conflicts/prescan', {
    entryIds,
  });
  return (response.data as { results: PrescanResultItem[] }).results;
}

export async function batchMergeLowRisk(entryIds?: string[]): Promise<{ resolved: number }> {
  const response = await api.post('/api/v1/knowledge/conflicts/batch-merge-low', {
    entryIds,
  });
  return response.data as { resolved: number };
}

export async function resolveConflictCoexist(
  entryId: string,
  field: string,
  data: {
    oldChapterIndex: number;
    oldChapterTitle: string;
    newChapterIndex: number;
    newChapterTitle: string;
  },
): Promise<void> {
  await api.put(
    `/api/v1/knowledge/conflicts/${entryId}/${encodeURIComponent(field)}/coexist`,
    data,
  );
}

// ============================================================
// PRD-04: Knowledge Management Types
// ============================================================

export interface VersionRecord {
  version: number;
  timestamp: string;
  changedFields: string[];
  snapshot: Record<string, unknown>;
  reason: 'extraction' | 'manual_edit' | 'import';
  editorNote?: string;
}

export interface ChangeRecord {
  entryId: string;
  entryName: string;
  category: string;
  changeType: 'created' | 'updated' | 'deleted' | 'restored';
  timestamp: string;
  version: number;
  changedFields?: string[];
}

export interface GraphNode {
  id: string;
  name: string;
  category: string;
  group: string;
  version: number;
  attributes?: Record<string, unknown>;
}

export interface GraphEdge {
  id: string;
  source: string;
  target: string;
  relationType: string;
  label: string;
  description?: string;
}

export interface RelationTypeDefinition {
  id: string;
  name: string;
  description: string;
  bidirectional: boolean;
  isBuiltIn: boolean;
}

export interface BrowseResponse {
  entries: KnowledgeEntry[];
  total: number;
  page: number;
  size: number;
  totalPages: number;
  categoryCounts: Record<string, number>;
}

export interface CategoryInfo {
  key: string;
  name: string;
  count: number;
}
