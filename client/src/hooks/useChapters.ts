// client/src/hooks/useChapters.ts

import { create } from 'zustand';
import {
  ChapterMeta,
  AnomalyRecord,
  ChapterDetailResponse,
  uploadChapter,
  fetchChapters,
  fetchChapter,
  updateChapter as updateChapterApi,
  mergeChapters as mergeChaptersApi,
  splitChapter as splitChapterApi,
  confirmChapters as confirmChaptersApi,
} from '../services/chapters';

// ==============================================================================
// State
// ==============================================================================

interface ChaptersState {
  // Data
  chapters: ChapterMeta[];
  anomalies: AnomalyRecord[];
  sourceId: string | null;
  sourceFile: string | null;
  status: 'empty' | 'pending' | 'confirmed' | 'idle';
  totalChapters: number;

  // UI state
  loading: boolean;
  uploading: boolean;
  uploadProgress: number;
  uploadError: string | null;
  uploadErrorType: 'duplicate' | 'generic' | null;
  duplicateSourceId: string | null;
  selectedChapterId: number | null;
  selectedIds: number[];
  editorOpen: boolean;
  editorSplitOpen: boolean;
  editorContent: ChapterDetailResponse | null;
  editorLoading: boolean;
  mergeModalOpen: boolean;
  confirmDialogOpen: boolean;
  selectedAnomaly: AnomalyRecord | null;
  anomalyDetailOpen: boolean;

  // Actions
  uploadFile: (file: File) => Promise<void>;
  loadChapters: (statusFilter?: string) => Promise<void>;
  loadChapter: (id: number) => Promise<void>;
  selectChapter: (id: number | null) => void;
  toggleSelect: (id: number) => void;
  clearSelection: () => void;
  updateChapter: (id: number, data: { title?: string; content?: string }) => Promise<void>;
  mergeChapters: () => Promise<void>;
  splitChapter: (id: number, splitAtLine: number) => Promise<void>;
  confirm: () => Promise<void>;
  openEditor: (id: number, options?: { splitOpen?: boolean }) => void;
  closeEditor: () => void;
  openMergeModal: () => void;
  closeMergeModal: () => void;
  openConfirmDialog: () => void;
  closeConfirmDialog: () => void;
  openAnomalyDetail: (anomaly: AnomalyRecord) => void;
  closeAnomalyDetail: () => void;
}

export const useChapters = create<ChaptersState>((set, get) => ({
  // Initial data state
  chapters: [],
  anomalies: [],
  sourceId: null,
  sourceFile: null,
  status: 'idle',
  totalChapters: 0,

  // Initial UI state
  loading: false,
  uploading: false,
  uploadProgress: 0,
  uploadError: null,
  uploadErrorType: null,
  duplicateSourceId: null,
  selectedChapterId: null,
  selectedIds: [],
  editorOpen: false,
  editorSplitOpen: false,
  editorContent: null,
  editorLoading: false,
  mergeModalOpen: false,
  confirmDialogOpen: false,
  selectedAnomaly: null,
  anomalyDetailOpen: false,

  // ==========================================================================
  // Actions
  // ==========================================================================

  uploadFile: async (file: File) => {
    set({ uploading: true, uploadProgress: 0, uploadError: null, uploadErrorType: null });
    try {
      const result = await uploadChapter(file, (pct) => {
        set({ uploadProgress: pct });
      });

      set({
        sourceId: result.sourceId,
        sourceFile: result.sourceFile,
        totalChapters: result.totalChapters,
        anomalies: result.anomalies,
        uploading: false,
        uploadProgress: 100,
      });

      // Reload chapters after successful upload
      await get().loadChapters();
    } catch (err: any) {
      const status = err.response?.status;
      if (status === 409) {
        const data = err.response?.data;
        const existingSourceId = data?.existingSourceId || null;

        // 409 响应现在携带完整的已有章节数据，直接填充 store 自动恢复
        if (data?.chapters) {
          set({
            uploading: false,
            uploadError: '该文件已上传过，已自动加载已有章节数据。您可以继续使用已有的拆分结果。',
            uploadErrorType: 'duplicate',
            duplicateSourceId: existingSourceId,
            chapters: data.chapters,
            totalChapters: data.totalChapters,
            status: data.status,
            sourceFile: data.sourceFile,
            anomalies: data.anomalies || [],
          });
        } else {
          set({
            uploading: false,
            uploadError: '该文件已上传过，拆分结果已存在。您可以继续使用已有的章节数据。',
            uploadErrorType: 'duplicate',
            duplicateSourceId: existingSourceId,
          });
        }
      } else {
        const message =
          err.response?.data?.error || err.message || '上传失败';
        set({
          uploading: false,
          uploadError: message,
          uploadErrorType: 'generic',
        });
      }
    }
  },

  loadChapters: async (statusFilter?: string) => {
    set({ loading: true });
    try {
      const result = await fetchChapters(statusFilter);
      set({
        chapters: result.chapters,
        totalChapters: result.total,
        status: result.status as ChaptersState['status'],
        sourceFile: result.sourceFile,
        loading: false,
      });
    } catch {
      set({ loading: false });
    }
  },

  loadChapter: async (id: number) => {
    set({ editorLoading: true });
    try {
      const result = await fetchChapter(id);
      set({ editorContent: result, editorLoading: false });
    } catch {
      set({ editorLoading: false });
    }
  },

  selectChapter: (id: number | null) => {
    set({ selectedChapterId: id });
  },

  toggleSelect: (id: number) => {
    const { selectedIds } = get();
    if (selectedIds.includes(id)) {
      set({ selectedIds: selectedIds.filter((i) => i !== id) });
    } else {
      set({ selectedIds: [...selectedIds, id].sort((a, b) => a - b) });
    }
  },

  clearSelection: () => {
    set({ selectedIds: [] });
  },

  updateChapter: async (id, data) => {
    await updateChapterApi(id, data);
    await get().loadChapters();
  },

  mergeChapters: async () => {
    const { selectedIds } = get();
    if (selectedIds.length < 2) return;

    await mergeChaptersApi(selectedIds);
    set({ selectedIds: [], mergeModalOpen: false });
    await get().loadChapters();
  },

  splitChapter: async (id, splitAtLine) => {
    await splitChapterApi(id, splitAtLine);
    await get().loadChapters();
  },

  confirm: async () => {
    await confirmChaptersApi();
    set({ status: 'confirmed', confirmDialogOpen: false });
    await get().loadChapters();
  },

  openEditor: (id: number, options?: { splitOpen?: boolean }) => {
    set({ editorOpen: true, editorSplitOpen: options?.splitOpen ?? false });
    get().loadChapter(id);
  },

  closeEditor: () => {
    set({ editorOpen: false, editorSplitOpen: false, editorContent: null });
  },

  openMergeModal: () => {
    set({ mergeModalOpen: true });
  },

  closeMergeModal: () => {
    set({ mergeModalOpen: false });
  },

  openConfirmDialog: () => {
    set({ confirmDialogOpen: true });
  },

  closeConfirmDialog: () => {
    set({ confirmDialogOpen: false });
  },

  openAnomalyDetail: (anomaly: AnomalyRecord) => {
    set({ selectedAnomaly: anomaly, anomalyDetailOpen: true });
  },

  closeAnomalyDetail: () => {
    set({ selectedAnomaly: null, anomalyDetailOpen: false });
  },
}));
