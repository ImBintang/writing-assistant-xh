// server/src/types/knowledge.ts
// Shared type definitions and Zod schemas for PRD-03 Knowledge Extraction System

import { z } from 'zod';

// ============================================================
// Knowledge Entry (PRD-03 Section 4)
// ============================================================

export interface SourceInfo {
  chapter: number;
  chapterTitle: string;
  excerpt: string;
  extractedAt: string;
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
  // PRD-10: 并行共存时间线
  timeline?: TimelineRecord[];
  // PRD-10: 预扫描风险分级
  riskLevel?: 'low' | 'high';
  riskReason?: string;
  aiMergedText?: string;
  suggestedAction?: 'merge' | 'manual' | 'coexist';
}

// PRD-10: 并行共存时间线记录
export interface TimelineRecord {
  chapterIndex: number;
  chapterTitle: string;
  value: unknown;
  recordedAt: string;
}

// PRD-10: 导入进度
export interface ImportProgress {
  category: string;
  lastImportedChapterIndex: number;
  lastImportedChapterTitle: string;
  importedAt: string;
  totalChaptersAtImport: number;
}

// PRD-10: 预扫描单个冲突结果
export interface PrescanResult {
  entryId: string;
  field: string;
  riskLevel: 'low' | 'high';
  reason: string;
  aiMergedText?: string;
  suggestedAction: 'merge' | 'manual' | 'coexist';
}

export interface Relation {
  targetId: string;
  targetName: string;
  relationType: string; // e.g. "师徒", "父子", "敌对"
  description: string;
}

// Version record for knowledge entry version history (PRD-04 Section 2.3)
export interface VersionRecord {
  version: number;
  timestamp: string;
  changedFields: string[];
  snapshot: Record<string, unknown>;
  reason: 'extraction' | 'manual_edit' | 'import';
  editorNote?: string;
}

// Change notification record (PRD-04 Section 2.3.2)
export interface ChangeRecord {
  entryId: string;
  entryName: string;
  category: string;
  changeType: 'created' | 'updated' | 'deleted' | 'restored';
  timestamp: string;
  version: number;
  changedFields?: string[];
}

// Graph node for knowledge graph visualization (PRD-04 Section 2.4)
export interface GraphNode {
  id: string;
  name: string;
  category: string;
  group: string;
  version: number;
  attributes?: Record<string, unknown>;
}

// Graph edge for knowledge graph visualization (PRD-04 Section 2.4)
export interface GraphEdge {
  id: string;
  source: string;
  target: string;
  relationType: string;
  label: string;
  description?: string;
}

// Relation type definition (PRD-04 Section 2.4.1)
export interface RelationTypeDefinition {
  id: string;
  name: string;
  description: string;
  bidirectional: boolean;
  isBuiltIn: boolean;
}

export interface KnowledgeEntry {
  id: string;
  category: string;
  name: string;
  aliases: string[];
  attributes: Record<string, unknown>;
  description: string;
  relations: Relation[];
  source: SourceInfo[];
  version: number;
  createdAt: string;
  updatedAt: string;
  conflicts?: ConflictRecord[];
  // PRD-04 additions
  versionHistory?: VersionRecord[];
  deletedAt?: string;
  manualEdited?: boolean;
}

// Raw entry extracted by AI (before merging)
export interface RawKnowledgeEntry {
  name: string;
  aliases?: string[];
  attributes: Record<string, unknown>;
  description?: string;
  relations?: Relation[];
  excerpt?: string;
}

// ============================================================
// Skill Definition (PRD-03 Section 2.1.1)
// ============================================================

export interface SkillDefinition {
  id: string;
  name: string;
  category: string;
  description: string;
  promptTemplate: string;
  outputSchema: Record<string, unknown>;
  isBuiltIn: boolean;
  enabled: boolean;
}

// ============================================================
// Extraction Task (PRD-03 Section 3.1)
// ============================================================

export interface ExtractRequest {
  chapterIds: number[];
  categories: string[];
  customSkillIds?: string[];
}

export interface ExtractionTask {
  taskId: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  config: {
    chapterIds: number[];
    categories: string[];
    customSkillIds?: string[];
  };
  progress: {
    totalSteps: number;
    completedSteps: number;
    currentChapterIndex: number | null;
    currentChapterTitle: string | null;
    currentCategory: string | null;
    resultsByCategory: Record<string, unknown[]>;
  };
  abortController: AbortController;
}

export interface TaskError {
  chapterIndex: number;
  chapterTitle: string;
  category: string;
  message: string;
}

export interface ProgressUpdate {
  taskId: string;
  totalSteps: number;
  completedSteps: number;
  currentChapterIndex: number | null;
  currentChapterTitle: string | null;
  currentCategory: string | null;
}

export interface ExtractionStatusResponse {
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  progress: {
    totalSteps: number;
    completedSteps: number;
    currentChapterIndex: number | null;
    currentChapterTitle: string | null;
    currentCategory: string | null;
  };
  results?: Record<string, KnowledgeEntry[]>; // category -> entries
  errors?: TaskError[];
}

// ============================================================
// Merge Result
// ============================================================

export interface MergeResult {
  added: string[];     // names of newly created entries
  merged: string[];    // names of updated entries
  conflicts: ConflictRecord[];
}

// ============================================================
// Skill Management
// ============================================================

export interface CreateSkillRequest {
  name: string;
  category: string;
  description: string;
  promptTemplate?: string;
  outputSchema?: Record<string, unknown>;
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

// ============================================================
// Conflict Resolution (PRD-03 Section 2.3.3)
// ============================================================

export type ConflictResolution = 'accept_new' | 'keep_old' | 'manual';

export interface ResolveConflictRequest {
  resolution: ConflictResolution;
  manualValue?: unknown;
  field?: string;
}

export interface BatchResolveRequest {
  resolutions: Array<{
    entryId: string;
    field: string;
    resolution: ConflictResolution;
    manualValue?: unknown;
  }>;
}

// ============================================================
// Chunking
// ============================================================

export interface ChapterChunk {
  index: number;
  total: number;
  content: string;
  label: string; // e.g. "第六章 (片段 1/3)"
  startOffset: number;
  endOffset: number;
}

// ============================================================
// AI Client
// ============================================================

export interface ExtractionInput {
  systemPrompt: string;
  chapterContent: string;
  chapterTitle: string;
  chapterIndex: number;
  outputSchema: Record<string, unknown>;
  modelId?: string;
  signal?: AbortSignal;
}

export interface ExtractionOutput {
  entries: RawKnowledgeEntry[];
  tokensUsed: number;
  durationMs: number;
}

// ============================================================
// SQLite Search
// ============================================================

export interface SearchResult {
  id: string;
  category: string;
  name: string;
  aliases: string[];
  chapters: number[];
  snippet: string;
}

// ============================================================
// Zod Schemas for Request Validation
// ============================================================

export const extractRequestSchema = z.object({
  chapterIds: z.array(z.number().int().positive()).min(1, '至少选择一个章节'),
  categories: z.array(z.string()).min(1, '至少选择一个分类'),
  customSkillIds: z.array(z.string()).optional(),
});

export const createSkillSchema = z.object({
  name: z.string().min(1, 'Skill名称不能为空').max(50, 'Skill名称最多50字符'),
  category: z.string().min(1, '分类不能为空'),
  description: z.string().min(1, '描述不能为空'),
  promptTemplate: z.string().optional(),
  outputSchema: z.record(z.unknown()).optional(),
});

export const updateSkillSchema = z.object({
  name: z.string().min(1).max(50).optional(),
  category: z.string().min(1).optional(),
  description: z.string().min(1).optional(),
  promptTemplate: z.string().optional(),
  outputSchema: z.record(z.unknown()).optional(),
  enabled: z.boolean().optional(),
});

export const generatePromptSchema = z.object({
  name: z.string().min(1),
  category: z.string().min(1),
  description: z.string().min(1),
});

export const resolveConflictSchema = z.object({
  resolution: z.enum(['accept_new', 'keep_old', 'manual']),
  manualValue: z.unknown().optional(),
  field: z.string().optional(),
});

export const batchResolveSchema = z.object({
  resolutions: z.array(
    z.object({
      entryId: z.string(),
      field: z.string().min(1, '字段名不能为空'),
      resolution: z.enum(['accept_new', 'keep_old', 'manual']),
      manualValue: z.unknown().optional(),
    }),
  ),
});

export const aiMergeSchema = z.object({
  oldValue: z.string(),
  newValue: z.string(),
  mode: z.enum(['prefer_old', 'prefer_new', 'balanced']),
});

// PRD-10: 导入下一章
export const importNextChapterSchema = z.object({
  category: z.string().min(1, '分类不能为空'),
  chapterIndex: z.number().int().positive().optional(),
});

// PRD-10: 预扫描冲突
export const prescanSchema = z.object({
  entryIds: z.array(z.string()).optional(),
});

// PRD-10: 批量合并低风险冲突
export const batchMergeLowRiskSchema = z.object({
  entryIds: z.array(z.string()).optional(),
});

// PRD-10: 并行共存
export const coexistSchema = z.object({
  oldChapterIndex: z.number().int().positive(),
  oldChapterTitle: z.string(),
  newChapterIndex: z.number().int().positive(),
  newChapterTitle: z.string(),
});

// ============================================================
// PRD-04 Zod Schemas for Knowledge Management
// ============================================================

export const createEntrySchema = z.object({
  name: z.string().min(1, '名称不能为空'),
  category: z.string().min(1, '分类不能为空'),
  aliases: z.array(z.string()).optional(),
  attributes: z.record(z.unknown()).optional(),
  description: z.string().optional(),
  relations: z.array(z.object({
    targetId: z.string().optional(),
    targetName: z.string(),
    relationType: z.string(),
    description: z.string(),
  })).optional(),
});

export const updateEntrySchema = z.object({
  name: z.string().min(1).optional(),
  category: z.string().min(1).optional(),
  aliases: z.array(z.string()).optional(),
  attributes: z.record(z.unknown()).optional(),
  description: z.string().optional(),
  relations: z.array(z.object({
    targetId: z.string().optional(),
    targetName: z.string(),
    relationType: z.string(),
    description: z.string(),
  })).optional(),
  editorNote: z.string().optional(),
});

export const addRelationSchema = z.object({
  targetId: z.string().optional(),
  targetName: z.string().min(1, '关联目标名称不能为空'),
  relationType: z.string().min(1, '关系类型不能为空'),
  description: z.string().default(''),
});

export const browseQuerySchema = z.object({
  category: z.string().optional(),
  page: z.coerce.number().int().positive().default(1),
  size: z.coerce.number().int().positive().max(100).default(20),
  sort: z.enum(['name', 'updatedAt']).default('updatedAt'),
});

export const searchQuerySchema = z.object({
  q: z.string().min(1, '搜索关键词不能为空'),
  category: z.string().optional(),
  page: z.coerce.number().int().positive().default(1),
  size: z.coerce.number().int().positive().max(100).default(20),
});

export const graphQuerySchema = z.object({
  categories: z.string().optional(), // comma-separated category list
  relationTypes: z.string().optional(), // comma-separated relation types
});

export const nodeGraphQuerySchema = z.object({
  depth: z.coerce.number().int().positive().max(5).default(2),
});

export const exportBodySchema = z.object({
  categories: z.array(z.string()).optional(),
});

export const addRelationTypeSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  description: z.string().default(''),
  bidirectional: z.boolean().default(false),
});

// ============================================================
// PRD-05 Writing Window Types
// ============================================================

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

// PRD-05 Request types
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

// PRD-05 Response types
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

// PRD-05 Zod Schemas
export const retrieveRequestSchema = z.object({
  outline: z.string().optional(),
  draft: z.string().optional(),
  targetChapter: z.number().int().positive().optional(),
  categoryFilter: z.array(z.string()).optional(),
});

export const generateRequestSchema = z.object({
  outline: z.string().min(1, '大纲不能为空'),
  priorKnowledge: z.any().refine((val) => val !== undefined && val !== null, {
    message: '先验知识不能为空',
  }),
  chapterNumber: z.number().int().positive().optional(),
});

export const continueRequestSchema = z.object({
  currentContent: z.string().min(1, '当前正文不能为空'),
  priorKnowledge: z.any().refine((val) => val !== undefined && val !== null, {
    message: '先验知识不能为空',
  }),
  length: z.number().int().positive().max(5000).optional(),
});

export const polishRequestSchema = z.object({
  selectedText: z.string().min(1, '选中文本不能为空'),
  priorKnowledge: z.any().refine((val) => val !== undefined && val !== null, {
    message: '先验知识不能为空',
  }),
  instruction: z.string().optional(),
});

export const expandRequestSchema = z.object({
  text: z.string().min(1, '文本不能为空'),
  priorKnowledge: z.any().refine((val) => val !== undefined && val !== null, {
    message: '先验知识不能为空',
  }),
});

export const shortenRequestSchema = z.object({
  text: z.string().min(1, '文本不能为空'),
  priorKnowledge: z.any().refine((val) => val !== undefined && val !== null, {
    message: '先验知识不能为空',
  }),
});

export const rewriteRequestSchema = z.object({
  text: z.string().min(1, '文本不能为空'),
  style: z.string().optional(),
  priorKnowledge: z.any().refine((val) => val !== undefined && val !== null, {
    message: '先验知识不能为空',
  }),
});

export const foreshadowCheckSchema = z.object({
  content: z.string().min(1, '正文不能为空'),
  chapterNumber: z.number().int().positive(),
  priorKnowledge: z.any().refine((val) => val !== undefined && val !== null, {
    message: '先验知识不能为空',
  }),
});

export const createDraftSchema = z.object({
  title: z.string().min(1, '标题不能为空'),
  targetChapter: z.number().int().positive(),
  outline: z.string().default(''),
  draft: z.string().default(''),
  priorKnowledge: z.any().optional(),
});

export const updateDraftSchema = z.object({
  title: z.string().optional(),
  targetChapter: z.number().int().positive().optional(),
  outline: z.string().optional(),
  draft: z.string().optional(),
  priorKnowledge: z.any().optional(),
});

// ============================================================
// PRD-06 Setting & Brainstorm Types
// ============================================================

// Setting categories (extends knowledge categories with setting-specific ones)
export const SETTING_CATEGORIES = [
  'characters',
  'techniques',
  'plot',
  'alchemy',
  'map',
  'organization',
  'other',
] as const;

export type SettingCategory = (typeof SETTING_CATEGORIES)[number];

export const SETTING_CATEGORY_LABELS: Record<string, string> = {
  characters: '人物设定',
  techniques: '功法设定',
  plot: '情节设定',
  alchemy: '丹药设定',
  map: '地图设定',
  organization: '组织设定',
  other: '其他设定',
};

// Template preset for structured setting creation
export interface SettingTemplate {
  id: string;
  name: string;
  category: SettingCategory;
  fields: Array<{
    key: string;
    label: string;
    type: 'text' | 'textarea' | 'number';
    placeholder?: string;
  }>;
}

// Frontmatter metadata embedded in setting .md files
export interface SettingFrontmatter {
  id: string;
  title: string;
  category: SettingCategory;
  template?: string;
  status: 'draft' | 'migrated';
  references: string[];
  createdAt: string;
  updatedAt: string;
}

// Parsed .md file with frontmatter and body
export interface SettingFile {
  id: string;
  title: string;
  category: SettingCategory;
  template?: string;
  status: 'draft' | 'migrated';
  references: string[];
  content: string;
  createdAt: string;
  updatedAt: string;
}

// Migration preview types
export interface FieldMapping {
  field: string;
  value: unknown;
  source: string;
}

export interface MigrationItem {
  settingId: string;
  settingTitle: string;
  category: string;
  action: 'create' | 'merge';
  matchedEntryId?: string;
  matchedEntryName?: string;
  similarity?: number;
  extractedFields: FieldMapping[];
  conflicts: Array<{
    field: string;
    existingValue: unknown;
    incomingValue: unknown;
  }>;
}

export interface MigrationPreview {
  items: MigrationItem[];
  summary: {
    willCreate: number;
    willMerge: number;
    totalConflicts: number;
  };
}

export interface MigrateConfirmResult {
  migrated: number;
  created: number;
  merged: number;
}

// Brainstorm types
export interface BrainstormSession {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  messageCount: number;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  references?: Array<{
    knowledgeId: string;
    knowledgeName: string;
    category: string;
  }>;
  timestamp: string;
  pinned?: boolean;
}

export interface BrainstormSessionContent {
  session: BrainstormSession;
  messages: ChatMessage[];
}

export interface BrainstormReply {
  reply: string;
  references: Array<{
    knowledgeId: string;
    knowledgeName: string;
    category: string;
    excerpt: string;
  }>;
}

export interface ExtractedConclusions {
  summary: string;
  decisions: Array<{
    text: string;
    category: SettingCategory;
    confidence: number;
  }>;
  suggestedSettings: Array<{
    category: SettingCategory;
    title: string;
    content: string;
  }>;
}

// PRD-06 Zod Schemas
export const createSettingSchema = z.object({
  title: z.string().min(1, '标题不能为空'),
  category: z.enum(['characters', 'techniques', 'plot', 'alchemy', 'map', 'organization', 'other']),
  template: z.string().optional(),
  content: z.string().default(''),
});

export const updateSettingSchema = z.object({
  title: z.string().min(1).optional(),
  category: z.enum(['characters', 'techniques', 'plot', 'alchemy', 'map', 'organization', 'other']).optional(),
  content: z.string().optional(),
});

export const referenceSchema = z.object({
  knowledgeId: z.string().min(1, '知识条目ID不能为空'),
});

export const migrateSchema = z.object({
  settingIds: z.array(z.string()).min(1, '至少选择一个设定文件'),
});

export const migrateConfirmSchema = z.object({
  preview: z.any(),
  resolvedConflicts: z
    .array(
      z.object({
        settingId: z.string(),
        field: z.string(),
        resolution: z.enum(['accept_new', 'keep_old']),
      }),
    )
    .optional(),
});

export const createSessionSchema = z.object({
  title: z.string().optional(),
});

export const sendMessageSchema = z.object({
  message: z.string().min(1, '消息不能为空'),
  references: z.array(z.string()).optional(),
});

export const extractConclusionsSchema = z.object({});

export const convertDecisionsSchema = z.object({
  decisions: z.array(z.string()).min(1, '至少选择一个结论'),
});
