// client/src/hooks/useWriting.ts
// Zustand store for writing window state management (PRD-05)

import { create } from 'zustand';
import {
  retrieveKnowledge,
  generateChapter,
  continueWriting,
  polishText,
  expandText,
  shortenText,
  rewriteText,
  checkForeshadowing,
  fetchDrafts,
  createDraft,
  updateDraft,
  deleteDraft,
  type PriorKnowledge,
  type DiffItem,
  type ForeshadowFinding,
  type DraftOutline,
} from '../services/writing';

// ============================================================
// State
// ============================================================

interface WritingState {
  // Draft identity
  draftId: string | null;
  title: string;
  targetChapter: number | null;

  // Content (synced with TipTap editors)
  outline: string;
  body: string;

  // Mode
  mode: 'outline' | 'body';

  // Prior knowledge
  priorKnowledge: PriorKnowledge | null;
  knowledgeLoading: boolean;

  // AI operation state
  aiLoading: boolean;
  aiOperation: string | null;
  abortController: AbortController | null;
  aiError: string | null;

  // AI suggestion state (accept/reject)
  showDiff: boolean;
  diffOriginal: string;
  diffModified: string;
  diffChanges: DiffItem[];
  diffMode: 'polish' | 'generate' | 'continue' | 'expand' | 'shorten' | 'rewrite';

  // Foreshadowing
  foreshadowingFindings: ForeshadowFinding[];

  // Draft management
  drafts: DraftOutline[];
  draftsLoading: boolean;
  draftManagerOpen: boolean;

  // UI
  drawerOpen: boolean;
  drawerTab: 'knowledge' | 'assistant';

  // Auto-save tracking
  lastSavedAt: string | null;
  isDirty: boolean;
  lastSavedOutline: string;
  lastSavedBody: string;

  // ============================================================
  // Actions — Content
  // ============================================================
  setTitle: (title: string) => void;
  setOutline: (text: string) => void;
  setBody: (text: string) => void;
  setMode: (mode: 'outline' | 'body') => void;
  setTargetChapter: (chapter: number | null) => void;

  // ============================================================
  // Actions — Knowledge retrieval
  // ============================================================
  retrieveKnowledge: (outline?: string, draft?: string) => Promise<void>;

  // ============================================================
  // Actions — AI operations
  // ============================================================
  generateChapter: (outline: string) => Promise<string | null>;
  continueWriting: () => Promise<string | null>;
  polishText: (
    selectedText: string,
    instruction?: string,
  ) => Promise<{ polishedText: string; changes: DiffItem[] } | null>;
  expandText: (text: string) => Promise<string | null>;
  shortenText: (text: string) => Promise<string | null>;
  rewriteText: (text: string, style?: string) => Promise<string | null>;
  checkForeshadowing: () => Promise<void>;
  cancelAiOperation: () => void;
  clearAiError: () => void;

  // ============================================================
  // Actions — Suggestion management
  // ============================================================
  acceptSuggestion: (replacementText: string) => void;
  rejectSuggestion: () => void;

  // ============================================================
  // Actions — Draft management
  // ============================================================
  loadDrafts: () => Promise<void>;
  saveDraft: () => Promise<void>;
  loadDraft: (id: string) => Promise<void>;
  deleteDraftById: (id: string) => Promise<void>;
  newDraft: () => void;
  openDraftManager: () => void;
  closeDraftManager: () => void;

  // ============================================================
  // Actions — UI
  // ============================================================
  toggleDrawer: () => void;
  openDrawer: (tab?: 'knowledge' | 'assistant') => void;
  closeDrawer: () => void;
  setDirty: (dirty: boolean) => void;
}

const EMPTY_PRIOR_KNOWLEDGE: PriorKnowledge = {
  characters: [],
  techniques: [],
  locations: [],
  worldbuilding: [],
  weapons: [],
  alchemy: [],
  plot: [],
  previousChapter: '',
  summary: '',
};

export const useWriting = create<WritingState>((set, get) => ({
  // Initial state
  draftId: null,
  title: '',
  targetChapter: null,
  outline: '',
  body: '',
  mode: 'outline',
  priorKnowledge: null,
  knowledgeLoading: false,
  aiLoading: false,
  aiOperation: null,
  abortController: null,
  aiError: null,
  showDiff: false,
  diffOriginal: '',
  diffModified: '',
  diffChanges: [],
  diffMode: 'polish',
  foreshadowingFindings: [],
  drafts: [],
  draftsLoading: false,
  draftManagerOpen: false,
  drawerOpen: false,
  drawerTab: 'assistant',
  lastSavedAt: null,
  isDirty: false,
  lastSavedOutline: '',
  lastSavedBody: '',

  // ============================================================
  // Content
  // ============================================================

  setTitle: (title: string) => {
    set({ title, isDirty: true });
  },

  setOutline: (text: string) => {
    set({ outline: text, isDirty: true });
  },

  setBody: (text: string) => {
    set({ body: text, isDirty: true });
  },

  setMode: (mode: 'outline' | 'body') => {
    set({ mode });
  },

  setTargetChapter: (chapter: number | null) => {
    set({ targetChapter: chapter });
  },

  // ============================================================
  // Knowledge retrieval
  // ============================================================

  retrieveKnowledge: async (outline?: string, draft?: string) => {
    const state = get();
    set({ knowledgeLoading: true });

    try {
      const result = await retrieveKnowledge({
        outline: outline ?? state.outline,
        draft: draft ?? state.body,
        targetChapter: state.targetChapter ?? undefined,
      });

      set({ priorKnowledge: result, knowledgeLoading: false });
    } catch (err: any) {
      console.error('Knowledge retrieval failed:', err);
      set({ knowledgeLoading: false });
    }
  },

  // ============================================================
  // AI operations
  // ============================================================

  generateChapter: async (outline: string) => {
    const abortController = new AbortController();
    set({
      aiLoading: true,
      aiOperation: 'generating',
      abortController,
      aiError: null,
    });

    try {
      const state = get();
      const result = await generateChapter(
        {
          outline,
          priorKnowledge: state.priorKnowledge || EMPTY_PRIOR_KNOWLEDGE,
          chapterNumber: state.targetChapter ?? undefined,
        },
        abortController.signal,
      );

      set({
        aiLoading: false,
        aiOperation: null,
        abortController: null,
        showDiff: true,
        diffOriginal: state.body,
        diffModified: result.content,
        diffChanges: [],
        diffMode: 'generate',
        isDirty: true,
      });

      return result.content;
    } catch (err: any) {
      if (err?.code === 'ERR_CANCELED' || err?.name === 'CanceledError') {
        set({ aiLoading: false, aiOperation: null, abortController: null });
        return null;
      }
      set({
        aiLoading: false,
        aiOperation: null,
        abortController: null,
        aiError: err?.response?.data?.error || err.message || 'AI撰写失败',
      });
      return null;
    }
  },

  continueWriting: async () => {
    const abortController = new AbortController();
    set({
      aiLoading: true,
      aiOperation: 'continuing',
      abortController,
      aiError: null,
    });

    try {
      const state = get();
      const result = await continueWriting(
        {
          currentContent: state.body,
          priorKnowledge: state.priorKnowledge || EMPTY_PRIOR_KNOWLEDGE,
        },
        abortController.signal,
      );

      set({
        aiLoading: false,
        aiOperation: null,
        abortController: null,
        showDiff: true,
        diffOriginal: state.body,
        diffModified: result.content,
        diffChanges: [],
        diffMode: 'continue',
        isDirty: true,
      });

      return result.content;
    } catch (err: any) {
      if (err?.code === 'ERR_CANCELED' || err?.name === 'CanceledError') {
        set({ aiLoading: false, aiOperation: null, abortController: null });
        return null;
      }
      set({
        aiLoading: false,
        aiOperation: null,
        abortController: null,
        aiError: err?.response?.data?.error || err.message || 'AI续写失败',
      });
      return null;
    }
  },

  polishText: async (selectedText: string, instruction?: string) => {
    const abortController = new AbortController();
    set({
      aiLoading: true,
      aiOperation: 'polishing',
      abortController,
      aiError: null,
    });

    try {
      const state = get();
      const result = await polishText(
        {
          selectedText,
          priorKnowledge: state.priorKnowledge || EMPTY_PRIOR_KNOWLEDGE,
          instruction,
        },
        abortController.signal,
      );

      set({
        aiLoading: false,
        aiOperation: null,
        abortController: null,
        showDiff: true,
        diffOriginal: selectedText,
        diffModified: result.polishedText,
        diffChanges: result.changes,
        diffMode: 'polish',
      });

      return { polishedText: result.polishedText, changes: result.changes };
    } catch (err: any) {
      if (err?.code === 'ERR_CANCELED' || err?.name === 'CanceledError') {
        set({ aiLoading: false, aiOperation: null, abortController: null });
        return null;
      }
      set({
        aiLoading: false,
        aiOperation: null,
        abortController: null,
        aiError: err?.response?.data?.error || err.message || 'AI润色失败',
      });
      return null;
    }
  },

  expandText: async (text: string) => {
    const abortController = new AbortController();
    set({
      aiLoading: true,
      aiOperation: 'expanding',
      abortController,
      aiError: null,
    });

    try {
      const state = get();
      const result = await expandText(
        {
          text,
          priorKnowledge: state.priorKnowledge || EMPTY_PRIOR_KNOWLEDGE,
        },
        abortController.signal,
      );

      set({
        aiLoading: false,
        aiOperation: null,
        abortController: null,
        showDiff: true,
        diffOriginal: text,
        diffModified: result.content,
        diffChanges: [],
        diffMode: 'expand',
      });

      return result.content;
    } catch (err: any) {
      if (err?.code === 'ERR_CANCELED' || err?.name === 'CanceledError') {
        set({ aiLoading: false, aiOperation: null, abortController: null });
        return null;
      }
      set({
        aiLoading: false,
        aiOperation: null,
        abortController: null,
        aiError: err?.response?.data?.error || err.message || 'AI扩写失败',
      });
      return null;
    }
  },

  shortenText: async (text: string) => {
    const abortController = new AbortController();
    set({
      aiLoading: true,
      aiOperation: 'shortening',
      abortController,
      aiError: null,
    });

    try {
      const state = get();
      const result = await shortenText(
        {
          text,
          priorKnowledge: state.priorKnowledge || EMPTY_PRIOR_KNOWLEDGE,
        },
        abortController.signal,
      );

      set({
        aiLoading: false,
        aiOperation: null,
        abortController: null,
        showDiff: true,
        diffOriginal: text,
        diffModified: result.content,
        diffChanges: [],
        diffMode: 'shorten',
      });

      return result.content;
    } catch (err: any) {
      if (err?.code === 'ERR_CANCELED' || err?.name === 'CanceledError') {
        set({ aiLoading: false, aiOperation: null, abortController: null });
        return null;
      }
      set({
        aiLoading: false,
        aiOperation: null,
        abortController: null,
        aiError: err?.response?.data?.error || err.message || 'AI缩写失败',
      });
      return null;
    }
  },

  rewriteText: async (text: string, style?: string) => {
    const abortController = new AbortController();
    set({
      aiLoading: true,
      aiOperation: 'rewriting',
      abortController,
      aiError: null,
    });

    try {
      const state = get();
      const result = await rewriteText(
        {
          text,
          style,
          priorKnowledge: state.priorKnowledge || EMPTY_PRIOR_KNOWLEDGE,
        },
        abortController.signal,
      );

      set({
        aiLoading: false,
        aiOperation: null,
        abortController: null,
        showDiff: true,
        diffOriginal: text,
        diffModified: result.content,
        diffChanges: [],
        diffMode: 'rewrite',
      });

      return result.content;
    } catch (err: any) {
      if (err?.code === 'ERR_CANCELED' || err?.name === 'CanceledError') {
        set({ aiLoading: false, aiOperation: null, abortController: null });
        return null;
      }
      set({
        aiLoading: false,
        aiOperation: null,
        abortController: null,
        aiError: err?.response?.data?.error || err.message || 'AI改写失败',
      });
      return null;
    }
  },

  checkForeshadowing: async () => {
    const abortController = new AbortController();
    set({
      aiLoading: true,
      aiOperation: 'foreshadowing',
      abortController,
      aiError: null,
    });

    try {
      const state = get();
      const result = await checkForeshadowing(
        {
          content: state.body,
          chapterNumber: state.targetChapter || 1,
          priorKnowledge: state.priorKnowledge || EMPTY_PRIOR_KNOWLEDGE,
        },
        abortController.signal,
      );

      set({
        aiLoading: false,
        aiOperation: null,
        abortController: null,
        foreshadowingFindings: result.findings,
      });
    } catch (err: any) {
      if (err?.code === 'ERR_CANCELED' || err?.name === 'CanceledError') {
        set({ aiLoading: false, aiOperation: null, abortController: null });
        return;
      }
      set({
        aiLoading: false,
        aiOperation: null,
        abortController: null,
        aiError: err?.response?.data?.error || err.message || '伏笔检查失败',
      });
    }
  },

  cancelAiOperation: () => {
    const { abortController } = get();
    if (abortController) {
      abortController.abort();
    }
    set({
      aiLoading: false,
      aiOperation: null,
      abortController: null,
    });
  },

  clearAiError: () => {
    set({ aiError: null });
  },

  // ============================================================
  // Suggestion management
  // ============================================================

  acceptSuggestion: (replacementText: string) => {
    const { diffMode, body, outline: _outline } = get();

    if (diffMode === 'generate' || diffMode === 'continue') {
      // In these modes, the full body is replaced
      set({
        body: replacementText,
        showDiff: false,
        diffOriginal: '',
        diffModified: '',
        diffChanges: [],
        isDirty: true,
      });
    } else if (diffMode === 'expand' || diffMode === 'shorten' || diffMode === 'rewrite') {
      // Replace the selected area in the body with the result
      const newBody = body.replace(get().diffOriginal, replacementText);
      set({
        body: newBody,
        showDiff: false,
        diffOriginal: '',
        diffModified: '',
        diffChanges: [],
        isDirty: true,
      });
    } else {
      // Polish mode — replace selected text
      const newBody = body.replace(get().diffOriginal, replacementText);
      set({
        body: newBody,
        showDiff: false,
        diffOriginal: '',
        diffModified: '',
        diffChanges: [],
        isDirty: true,
      });
    }
  },

  rejectSuggestion: () => {
    set({
      showDiff: false,
      diffOriginal: '',
      diffModified: '',
      diffChanges: [],
    });
  },

  // ============================================================
  // Draft management
  // ============================================================

  loadDrafts: async () => {
    set({ draftsLoading: true });
    try {
      const drafts = await fetchDrafts();
      set({ drafts, draftsLoading: false });
    } catch {
      set({ draftsLoading: false });
    }
  },

  saveDraft: async () => {
    const { draftId, title, targetChapter, outline, body, priorKnowledge } = get();

    try {
      if (draftId) {
        // Update existing draft
        await updateDraft(draftId, {
          title: title || '未命名草稿',
          targetChapter: targetChapter || 1,
          outline,
          draft: body,
          priorKnowledge: priorKnowledge || undefined,
        });
        set({
          lastSavedAt: new Date().toISOString(),
          isDirty: false,
          lastSavedOutline: outline,
          lastSavedBody: body,
        });
      } else {
        // Create new draft
        const createdDraft = await createDraft({
          title: title || '未命名草稿',
          targetChapter: targetChapter || 1,
          outline,
          draft: body,
          priorKnowledge: priorKnowledge || undefined,
        });
        set({
          draftId: createdDraft.id,
          lastSavedAt: new Date().toISOString(),
          isDirty: false,
          lastSavedOutline: outline,
          lastSavedBody: body,
        });
      }
    } catch (err: any) {
      console.error('Failed to save draft:', err);
    }
  },

  loadDraft: async (id: string) => {
    const { drafts } = get();
    const draft = drafts.find((d) => d.id === id);
    if (!draft) return;

    set({
      draftId: draft.id,
      title: draft.title,
      targetChapter: draft.targetChapter,
      outline: draft.outline,
      body: draft.draft,
      priorKnowledge: draft.priorKnowledge || null,
      draftManagerOpen: false,
      showDiff: false,
      isDirty: false,
      lastSavedOutline: draft.outline,
      lastSavedBody: draft.draft,
      lastSavedAt: draft.updatedAt,
    });
  },

  deleteDraftById: async (id: string) => {
    try {
      await deleteDraft(id);
      // If the deleted draft is the current one, reset
      if (get().draftId === id) {
        set({
          draftId: null,
          title: '',
          outline: '',
          body: '',
          priorKnowledge: null,
          isDirty: false,
        });
      }
      // Reload draft list
      await get().loadDrafts();
    } catch (err: any) {
      console.error('Failed to delete draft:', err);
    }
  },

  newDraft: () => {
    set({
      draftId: null,
      title: '',
      targetChapter: null,
      outline: '',
      body: '',
      priorKnowledge: null,
      draftManagerOpen: false,
      showDiff: false,
      foreshadowingFindings: [],
      isDirty: false,
      lastSavedAt: null,
      lastSavedOutline: '',
      lastSavedBody: '',
    });
  },

  openDraftManager: () => {
    set({ draftManagerOpen: true });
    get().loadDrafts();
  },

  closeDraftManager: () => {
    set({ draftManagerOpen: false });
  },

  // ============================================================
  // UI
  // ============================================================

  toggleDrawer: () => {
    set((s) => ({ drawerOpen: !s.drawerOpen }));
  },

  openDrawer: (tab) => {
    set({ drawerOpen: true, ...(tab ? { drawerTab: tab } : {}) });
  },

  closeDrawer: () => {
    set({ drawerOpen: false });
  },

  setDirty: (dirty: boolean) => {
    set({ isDirty: dirty });
  },
}));

export type { PriorKnowledge, DiffItem, ForeshadowFinding, DraftOutline };
