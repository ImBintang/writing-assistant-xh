// client/src/hooks/useKnowledge.ts
// Zustand store for knowledge extraction state management (PRD-03)

import { create } from 'zustand';
import * as knowledgeApi from '../services/knowledge';

// Re-export types for convenience
export type {
  SkillInfo,
  ExtractionStatus,
  ExtractionProgress,
  KnowledgeEntry,
  ConflictRecord,
  ConflictWithEntry,
  CreateSkillRequest,
  UpdateSkillRequest,
  GeneratePromptRequest,
  GeneratePromptResponse,
  ConflictResolution,
  BatchResolution,
  TaskError,
  ImportProgressInfo,
  PrescanResultItem,
  ImportNextChapterResult,
} from '../services/knowledge';

// WebSocket disconnect reference
let wsDisconnectRef: (() => void) | null = null;

export function setWsDisconnect(fn: (() => void) | null): void {
  if (wsDisconnectRef) {
    wsDisconnectRef();
  }
  wsDisconnectRef = fn;
}

// ============================================================
// Store Types
// ============================================================

export interface KnowledgeState {
  // Extraction state
  taskId: string | null;
  taskStatus: 'idle' | 'running' | 'completed' | 'failed' | 'cancelled';
  progress: {
    totalSteps: number;
    completedSteps: number;
    currentChapterIndex: number | null;
    currentChapterTitle: string | null;
    currentCategory: string | null;
  } | null;
  extractionErrors: knowledgeApi.TaskError[];

  // Skills state
  skills: knowledgeApi.SkillInfo[];
  skillsLoading: boolean;
  selectedCategories: string[];
  selectedChapterIds: number[];

  // Conflicts state
  conflicts: knowledgeApi.ConflictWithEntry[];
  conflictsLoading: boolean;

  // UI state
  extractConfigOpen: boolean;
  skillEditorOpen: boolean;
  editingSkill: knowledgeApi.SkillInfo | null;
  conflictResolverOpen: boolean;
  conflictEntryId: string | null;

  // Actions — Extraction
  startExtraction: (chapterIds: number[], categories: string[]) => Promise<string | null>;
  cancelExtraction: () => Promise<void>;
  fetchTaskStatus: (taskId: string) => Promise<void>;
  resetExtraction: () => void;

  // Actions — Skills
  loadSkills: () => Promise<void>;
  createSkill: (data: knowledgeApi.CreateSkillRequest) => Promise<knowledgeApi.SkillInfo | null>;
  updateSkill: (id: string, data: knowledgeApi.UpdateSkillRequest) => Promise<knowledgeApi.SkillInfo | null>;
  deleteSkill: (id: string) => Promise<boolean>;
  generateSkillPrompt: (id: string, data: knowledgeApi.GeneratePromptRequest) => Promise<knowledgeApi.GeneratePromptResponse | null>;
  toggleCategory: (category: string) => void;
  toggleChapter: (chapterId: number) => void;
  selectAllChapters: (ids: number[]) => void;

  // Actions — Conflicts
  loadConflicts: () => Promise<void>;
  resolveConflict: (entryId: string, field: string, resolution: knowledgeApi.ConflictResolution, manualValue?: unknown) => Promise<boolean>;
  batchResolveConflicts: (resolutions: knowledgeApi.BatchResolution[]) => Promise<number>;

  // Actions — UI
  openExtractConfig: () => void;
  closeExtractConfig: () => void;
  openSkillEditor: (skill?: knowledgeApi.SkillInfo) => void;
  closeSkillEditor: () => void;
  openConflictResolver: (entryId?: string) => void;
  closeConflictResolver: () => void;

  // PRD-10: Import progress
  importProgress: knowledgeApi.ImportProgressInfo[];
  importProgressLoading: boolean;
  loadImportProgress: () => Promise<void>;
  inferImportProgress: (category: string) => Promise<number>;

  // PRD-10: Prescan & batch merge
  prescanLoading: boolean;
  prescanResults: knowledgeApi.PrescanResultItem[];
  prescanConflicts: (entryIds?: string[]) => Promise<void>;
  batchMergeLowRisk: (entryIds?: string[]) => Promise<number>;

  // PRD-10: Import next chapter
  importNextChapter: (category: string, chapterIndex?: number) => Promise<knowledgeApi.ImportNextChapterResult | null>;

  // PRD-10: Coexist
  resolveConflictCoexist: (
    entryId: string,
    field: string,
    oldChapterIndex: number,
    oldChapterTitle: string,
    newChapterIndex: number,
    newChapterTitle: string,
  ) => Promise<boolean>;
}

export const CATEGORY_NAMES: Record<string, string> = {
  characters: '人物',
  techniques: '功法',
  locations: '地图',
  worldbuilding: '世界观',
  weapons: '武器',
  alchemy: '丹药',
  plot: '情节',
};

export const useKnowledge = create<KnowledgeState>((set, get) => ({
  // Initial state
  taskId: null,
  taskStatus: 'idle',
  progress: null,
  extractionErrors: [],
  skills: [],
  skillsLoading: false,
  selectedCategories: [],
  selectedChapterIds: [],
  conflicts: [],
  conflictsLoading: false,
  extractConfigOpen: false,
  skillEditorOpen: false,
  editingSkill: null,
  conflictResolverOpen: false,
  conflictEntryId: null,

  // PRD-10 initial state
  importProgress: [],
  importProgressLoading: false,
  prescanLoading: false,
  prescanResults: [],

  // ---- Extraction actions ----

  startExtraction: async (chapterIds, categories) => {
    try {
      const state = get();
      const customSkillIds = state.skills
        .filter((s) => !s.isBuiltIn && state.selectedCategories.includes(s.category))
        .map((s) => s.id);

      const result = await knowledgeApi.startExtraction({
        chapterIds,
        categories,
        customSkillIds: customSkillIds.length > 0 ? customSkillIds : undefined,
      });

      set({
        taskId: result.taskId,
        taskStatus: 'running',
        progress: {
          totalSteps: chapterIds.length * categories.length,
          completedSteps: 0,
          currentChapterIndex: null,
          currentChapterTitle: null,
          currentCategory: null,
        },
        extractionErrors: [],
      });

      return result.taskId;
    } catch (err) {
      console.error('Failed to start extraction:', err);
      set({ taskStatus: 'failed' });
      return null;
    }
  },

  cancelExtraction: async () => {
    const { taskId } = get();
    if (!taskId) return;

    try {
      await knowledgeApi.cancelExtraction(taskId);
      set({ taskStatus: 'cancelled' });
    } catch (err) {
      console.error('Failed to cancel extraction:', err);
    }
  },

  fetchTaskStatus: async (taskId) => {
    try {
      const status = await knowledgeApi.getExtractionStatus(taskId);
      set({
        taskStatus: status.status as KnowledgeState['taskStatus'],
        progress: status.progress,
        extractionErrors: status.errors || [],
      });

      if (status.status === 'completed' || status.status === 'failed' || status.status === 'cancelled') {
        get().loadConflicts();
      }
    } catch (err) {
      console.error('Failed to fetch task status:', err);
    }
  },

  resetExtraction: () => {
    if (wsDisconnectRef) {
      wsDisconnectRef();
      wsDisconnectRef = null;
    }
    set({
      taskId: null,
      taskStatus: 'idle',
      progress: null,
      extractionErrors: [],
    });
  },

  // ---- Skills actions ----

  loadSkills: async () => {
    set({ skillsLoading: true });
    try {
      const skills = await knowledgeApi.fetchSkills();
      set({ skills, skillsLoading: false });
    } catch (err) {
      console.error('Failed to load skills:', err);
      set({ skillsLoading: false });
    }
  },

  createSkill: async (data) => {
    try {
      const skill = await knowledgeApi.createSkill(data);
      set((state) => ({ skills: [...state.skills, skill] }));
      return skill;
    } catch (err) {
      console.error('Failed to create skill:', err);
      return null;
    }
  },

  updateSkill: async (id, data) => {
    try {
      const skill = await knowledgeApi.updateSkill(id, data);
      set((state) => ({
        skills: state.skills.map((s) => (s.id === id ? skill : s)),
      }));
      return skill;
    } catch (err) {
      console.error('Failed to update skill:', err);
      return null;
    }
  },

  deleteSkill: async (id) => {
    try {
      await knowledgeApi.deleteSkill(id);
      set((state) => ({
        skills: state.skills.filter((s) => s.id !== id),
      }));
      return true;
    } catch (err) {
      console.error('Failed to delete skill:', err);
      return false;
    }
  },

  generateSkillPrompt: async (id, data) => {
    try {
      const result = await knowledgeApi.generateSkillPrompt(id, data);
      return result;
    } catch (err) {
      console.error('Failed to generate skill prompt:', err);
      return null;
    }
  },

  toggleCategory: (category) => {
    set((state) => ({
      selectedCategories: state.selectedCategories.includes(category)
        ? state.selectedCategories.filter((c) => c !== category)
        : [...state.selectedCategories, category],
    }));
  },

  toggleChapter: (chapterId) => {
    set((state) => ({
      selectedChapterIds: state.selectedChapterIds.includes(chapterId)
        ? state.selectedChapterIds.filter((id) => id !== chapterId)
        : [...state.selectedChapterIds, chapterId].sort((a, b) => a - b),
    }));
  },

  selectAllChapters: (ids) => {
    set((state) => ({
      selectedChapterIds:
        state.selectedChapterIds.length === ids.length ? [] : [...ids],
    }));
  },

  // ---- Conflicts actions ----

  loadConflicts: async () => {
    set({ conflictsLoading: true });
    try {
      const conflicts = await knowledgeApi.fetchConflicts();
      set({ conflicts, conflictsLoading: false });
    } catch (err) {
      console.error('Failed to load conflicts:', err);
      set({ conflictsLoading: false });
    }
  },

  resolveConflict: async (entryId, field, resolution, manualValue) => {
    try {
      await knowledgeApi.resolveConflict(entryId, field, resolution, manualValue);
      const conflicts = await knowledgeApi.fetchConflicts();
      set({ conflicts });
      return true;
    } catch (err) {
      console.error('Failed to resolve conflict:', err);
      return false;
    }
  },

  batchResolveConflicts: async (resolutions) => {
    try {
      const result = await knowledgeApi.batchResolveConflicts(resolutions);
      const conflicts = await knowledgeApi.fetchConflicts();
      set({ conflicts });
      return result.resolved;
    } catch (err) {
      console.error('Failed to batch resolve conflicts:', err);
      return 0;
    }
  },

  // ---- UI actions ----

  openExtractConfig: () => set({ extractConfigOpen: true }),
  closeExtractConfig: () => set({ extractConfigOpen: false }),
  openSkillEditor: (skill) =>
    set({ skillEditorOpen: true, editingSkill: skill || null }),
  closeSkillEditor: () =>
    set({ skillEditorOpen: false, editingSkill: null }),
  openConflictResolver: (entryId) =>
    set({ conflictResolverOpen: true, conflictEntryId: entryId || null }),
  closeConflictResolver: () =>
    set({ conflictResolverOpen: false, conflictEntryId: null }),

  // ---- PRD-10: Import progress ----

  loadImportProgress: async () => {
    set({ importProgressLoading: true });
    try {
      const progress = await knowledgeApi.fetchImportProgress();
      set({ importProgress: progress, importProgressLoading: false });
    } catch (err) {
      console.error('Failed to load import progress:', err);
      set({ importProgressLoading: false });
    }
  },

  inferImportProgress: async (category) => {
    try {
      const result = await knowledgeApi.inferImportProgress(category);
      return result.lastImportedChapterIndex;
    } catch (err) {
      console.error('Failed to infer import progress:', err);
      return 0;
    }
  },

  // ---- PRD-10: Prescan & batch merge ----

  prescanConflicts: async (entryIds) => {
    set({ prescanLoading: true });
    try {
      const results = await knowledgeApi.prescanConflicts(entryIds);
      set({ prescanResults: results });
      // Reload conflicts to get updated risk data
      const conflicts = await knowledgeApi.fetchConflicts();
      set({ conflicts, prescanLoading: false });
    } catch (err) {
      console.error('Failed to prescan conflicts:', err);
      set({ prescanLoading: false });
    }
  },

  batchMergeLowRisk: async (entryIds) => {
    try {
      const result = await knowledgeApi.batchMergeLowRisk(entryIds);
      // Reload conflicts
      const conflicts = await knowledgeApi.fetchConflicts();
      set({ conflicts });
      // Clear prescan results as they're stale
      set({ prescanResults: [] });
      return result.resolved;
    } catch (err) {
      console.error('Failed to batch merge low risk conflicts:', err);
      return 0;
    }
  },

  // ---- PRD-10: Import next chapter ----

  importNextChapter: async (category, chapterIndex) => {
    try {
      const result = await knowledgeApi.importNextChapter(category, chapterIndex);
      // Reload conflicts after import
      const conflicts = await knowledgeApi.fetchConflicts();
      set({ conflicts });
      return result;
    } catch (err) {
      console.error('Failed to import next chapter:', err);
      return null;
    }
  },

  // ---- PRD-10: Coexist ----

  resolveConflictCoexist: async (entryId, field, oldChapterIndex, oldChapterTitle, newChapterIndex, newChapterTitle) => {
    try {
      await knowledgeApi.resolveConflictCoexist(entryId, field, {
        oldChapterIndex,
        oldChapterTitle,
        newChapterIndex,
        newChapterTitle,
      });
      const conflicts = await knowledgeApi.fetchConflicts();
      set({ conflicts });
      return true;
    } catch (err) {
      console.error('Failed to coexist conflict:', err);
      return false;
    }
  },
}));

// Backward-compatible alias
export { useKnowledge as useKnowledgeStore };
