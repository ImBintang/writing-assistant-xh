// client/src/hooks/useKnowledgeManagement.ts
// Zustand store for knowledge management, graph, and trash (PRD-04)

import { create } from 'zustand';
import * as api from '../services/knowledge-management';
import type {
  KnowledgeEntry,
  CategoryInfo,
  VersionRecord,
  ChangeRecord,
  GraphNode,
  GraphEdge,
  RelationTypeDefinition,
} from '../services/knowledge';

export interface KnowledgeManagementState {
  // Browse
  entries: KnowledgeEntry[];
  totalEntries: number;
  page: number;
  size: number;
  totalPages: number;
  selectedCategory: string | null;
  viewMode: 'card' | 'table';
  sortBy: 'name' | 'updatedAt';
  searchQuery: string;
  categoryCounts: Record<string, number>;
  categories: CategoryInfo[];
  loading: boolean;

  // Detail / Edit
  selectedEntry: KnowledgeEntry | null;
  detailOpen: boolean;
  editOpen: boolean;
  createOpen: boolean;
  saving: boolean;

  // Version
  versions: VersionRecord[];
  versionsLoading: boolean;

  // Trash
  trashEntries: KnowledgeEntry[];
  trashTotal: number;
  trashPage: number;
  trashOpen: boolean;
  trashLoading: boolean;

  // Graph
  graphData: { nodes: GraphNode[]; edges: GraphEdge[] } | null;
  graphLoading: boolean;
  graphFilters: { categories: string[]; relationTypes: string[] };
  selectedNode: GraphNode | null;
  nodeDetailOpen: boolean;
  relationTypes: RelationTypeDefinition[];

  // Changes
  recentChanges: ChangeRecord[];
  changesLoading: boolean;

  // Export/Import
  exporting: boolean;
  importing: boolean;
  importResult: { imported: number; skipped: number; errors: string[] } | null;

  // Actions
  loadEntries: (category?: string | null, page?: number, sort?: 'name' | 'updatedAt') => Promise<void>;
  loadEntry: (id: string) => Promise<void>;
  createEntry: (data: Parameters<typeof api.createEntry>[0]) => Promise<KnowledgeEntry | null>;
  updateEntry: (id: string, data: Parameters<typeof api.updateEntry>[1]) => Promise<KnowledgeEntry | null>;
  deleteEntry: (id: string) => Promise<boolean>;
  addRelation: (entryId: string, data: { targetId?: string; targetName: string; relationType: string; description: string }) => Promise<boolean>;
  removeRelation: (entryId: string, index: number) => Promise<boolean>;
  loadCategories: () => Promise<void>;
  searchEntries: (query: string, category?: string) => Promise<void>;
  loadTrash: (page?: number) => Promise<void>;
  restoreEntry: (id: string) => Promise<boolean>;
  emptyTrash: () => Promise<number>;
  loadVersions: (id: string) => Promise<void>;
  loadRecentChanges: () => Promise<void>;
  loadGraph: (filters?: { categories?: string[]; relationTypes?: string[] }) => Promise<void>;
  loadNodeGraph: (nodeId: string, depth?: number) => Promise<void>;
  loadRelationTypes: () => Promise<void>;
  addRelationType: (data: { id: string; name: string; description: string; bidirectional: boolean }) => Promise<void>;
  doExport: (categories?: string[]) => Promise<void>;
  doImport: (file: File) => Promise<void>;

  // UI actions
  setCategory: (category: string | null) => void;
  setViewMode: (mode: 'card' | 'table') => void;
  setSortBy: (sort: 'name' | 'updatedAt') => void;
  setSearchQuery: (query: string) => void;
  setPage: (page: number) => void;
  openDetail: (entry: KnowledgeEntry) => void;
  closeDetail: () => void;
  openEdit: (entry?: KnowledgeEntry) => void;
  closeEdit: () => void;
  openCreate: () => void;
  closeCreate: () => void;
  openTrash: () => void;
  closeTrash: () => void;
  selectNode: (node: GraphNode | null) => void;
  closeNodeDetail: () => void;
  setGraphFilters: (filters: Partial<{ categories: string[]; relationTypes: string[] }>) => void;
  clearImportResult: () => void;
}

export const useKnowledgeManagement = create<KnowledgeManagementState>((set, get) => ({
  // Initial state
  entries: [],
  totalEntries: 0,
  page: 1,
  size: 20,
  totalPages: 0,
  selectedCategory: null,
  viewMode: 'card',
  sortBy: 'updatedAt',
  searchQuery: '',
  categoryCounts: {},
  categories: [],
  loading: false,

  selectedEntry: null,
  detailOpen: false,
  editOpen: false,
  createOpen: false,
  saving: false,

  versions: [],
  versionsLoading: false,

  trashEntries: [],
  trashTotal: 0,
  trashPage: 1,
  trashOpen: false,
  trashLoading: false,

  graphData: null,
  graphLoading: false,
  graphFilters: { categories: [], relationTypes: [] },
  selectedNode: null,
  nodeDetailOpen: false,
  relationTypes: [],

  recentChanges: [],
  changesLoading: false,

  exporting: false,
  importing: false,
  importResult: null,

  // ---- Browse actions ----

  loadEntries: async (category, page, sort) => {
    const state = get();
    set({ loading: true });
    try {
      const result = await api.fetchEntries({
        category: category !== null ? category : undefined,
        page: page || state.page,
        size: state.size,
        sort: sort || state.sortBy,
      });
      set({
        entries: result.entries,
        totalEntries: result.total,
        page: result.page,
        totalPages: result.totalPages,
        categoryCounts: result.categoryCounts,
        loading: false,
      });
    } catch (err) {
      console.error('Failed to load entries:', err);
      set({ loading: false });
    }
  },

  loadEntry: async (id) => {
    try {
      const result = await api.fetchEntry(id);
      set({ selectedEntry: result.entry });
    } catch (err) {
      console.error('Failed to load entry:', err);
    }
  },

  createEntry: async (data) => {
    set({ saving: true });
    try {
      const result = await api.createEntry(data);
      set({ saving: false, createOpen: false });
      get().loadEntries(get().selectedCategory);
      get().loadCategories();
      get().loadRecentChanges();
      return result.entry;
    } catch (err) {
      console.error('Failed to create entry:', err);
      set({ saving: false });
      return null;
    }
  },

  updateEntry: async (id, data) => {
    set({ saving: true });
    try {
      const result = await api.updateEntry(id, data);
      set({ saving: false, editOpen: false, selectedEntry: result.entry });
      get().loadEntries(get().selectedCategory);
      get().loadRecentChanges();
      return result.entry;
    } catch (err) {
      console.error('Failed to update entry:', err);
      set({ saving: false });
      return null;
    }
  },

  deleteEntry: async (id) => {
    try {
      await api.deleteEntry(id);
      get().loadEntries(get().selectedCategory);
      get().loadCategories();
      get().loadRecentChanges();
      return true;
    } catch (err) {
      console.error('Failed to delete entry:', err);
      return false;
    }
  },

  addRelation: async (entryId, data) => {
    try {
      const result = await api.addRelation(entryId, data);
      set({ selectedEntry: result.entry });
      get().loadRecentChanges();
      return true;
    } catch (err) {
      console.error('Failed to add relation:', err);
      return false;
    }
  },

  removeRelation: async (entryId, index) => {
    try {
      const result = await api.removeRelation(entryId, index);
      set({ selectedEntry: result.entry });
      get().loadRecentChanges();
      return true;
    } catch (err) {
      console.error('Failed to remove relation:', err);
      return false;
    }
  },

  loadCategories: async () => {
    try {
      const result = await api.fetchCategories();
      set({ categories: result.categories });
    } catch (err) {
      console.error('Failed to load categories:', err);
    }
  },

  searchEntries: async (query, category) => {
    if (!query.trim()) {
      get().loadEntries(get().selectedCategory);
      return;
    }
    set({ loading: true, searchQuery: query });
    try {
      const result = await api.searchKnowledge({ q: query, category, size: 50 });
      // Map search results to entries by loading full details
      const entries: KnowledgeEntry[] = [];
      for (const r of result.results) {
        try {
          const detail = await api.fetchEntry(r.id);
          entries.push(detail.entry);
        } catch { /* skip */ }
      }
      set({
        entries,
        totalEntries: entries.length,
        page: 1,
        totalPages: 1,
        loading: false,
      });
    } catch (err) {
      console.error('Failed to search:', err);
      set({ loading: false });
    }
  },

  // ---- Trash actions ----

  loadTrash: async (page) => {
    const state = get();
    set({ trashLoading: true });
    try {
      const result = await api.fetchTrash({ page: page || state.trashPage });
      set({
        trashEntries: result.entries,
        trashTotal: result.total,
        trashPage: result.page,
        trashLoading: false,
      });
    } catch (err) {
      console.error('Failed to load trash:', err);
      set({ trashLoading: false });
    }
  },

  restoreEntry: async (id) => {
    try {
      await api.restoreEntry(id);
      get().loadTrash();
      get().loadEntries(get().selectedCategory);
      get().loadCategories();
      get().loadRecentChanges();
      return true;
    } catch (err) {
      console.error('Failed to restore entry:', err);
      return false;
    }
  },

  emptyTrash: async () => {
    try {
      const result = await api.emptyTrash();
      get().loadTrash();
      return result.count;
    } catch (err) {
      console.error('Failed to empty trash:', err);
      return 0;
    }
  },

  // ---- Version actions ----

  loadVersions: async (id) => {
    set({ versionsLoading: true });
    try {
      const result = await api.fetchVersions(id);
      set({ versions: result.versions, versionsLoading: false });
    } catch (err) {
      console.error('Failed to load versions:', err);
      set({ versionsLoading: false });
    }
  },

  // ---- Changes actions ----

  loadRecentChanges: async () => {
    set({ changesLoading: true });
    try {
      const result = await api.fetchRecentChanges(10);
      set({ recentChanges: result.changes, changesLoading: false });
    } catch (err) {
      console.error('Failed to load recent changes:', err);
      set({ changesLoading: false });
    }
  },

  // ---- Graph actions ----

  loadGraph: async (filters) => {
    set({ graphLoading: true });
    try {
      const result = await api.fetchGraph(filters);
      set({ graphData: result, graphLoading: false });
    } catch (err) {
      console.error('Failed to load graph:', err);
      set({ graphLoading: false });
    }
  },

  loadNodeGraph: async (nodeId, depth) => {
    set({ graphLoading: true });
    try {
      const result = await api.fetchNodeGraph(nodeId, depth);
      set({ graphData: result, graphLoading: false });
    } catch (err) {
      console.error('Failed to load node graph:', err);
      set({ graphLoading: false });
    }
  },

  loadRelationTypes: async () => {
    try {
      const result = await api.fetchRelationTypes();
      set({ relationTypes: result.types });
    } catch (err) {
      console.error('Failed to load relation types:', err);
    }
  },

  addRelationType: async (data) => {
    try {
      const result = await api.addRelationType(data);
      set({ relationTypes: result.types });
    } catch (err) {
      console.error('Failed to add relation type:', err);
    }
  },

  // ---- Export/Import actions ----

  doExport: async (categories) => {
    set({ exporting: true });
    try {
      const blob = await api.exportKnowledge(categories);
      // Trigger download
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `knowledge-backup-${new Date().toISOString().slice(0, 10)}.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      set({ exporting: false });
    } catch (err) {
      console.error('Failed to export:', err);
      set({ exporting: false });
    }
  },

  doImport: async (file) => {
    set({ importing: true, importResult: null });
    try {
      const result = await api.importKnowledge(file);
      set({ importing: false, importResult: result });
      get().loadEntries(get().selectedCategory);
      get().loadCategories();
      get().loadRecentChanges();
    } catch (err) {
      console.error('Failed to import:', err);
      set({
        importing: false,
        importResult: { imported: 0, skipped: 0, errors: ['导入失败: 网络错误'] },
      });
    }
  },

  // ---- UI actions ----

  setCategory: (category) => {
    set({ selectedCategory: category, page: 1, searchQuery: '' });
    get().loadEntries(category, 1);
  },

  setViewMode: (mode) => set({ viewMode: mode }),

  setSortBy: (sort) => {
    set({ sortBy: sort });
    get().loadEntries(get().selectedCategory, 1, sort);
  },

  setSearchQuery: (query) => set({ searchQuery: query }),

  setPage: (page) => {
    set({ page });
    const state = get();
    if (state.searchQuery) {
      state.searchEntries(state.searchQuery, state.selectedCategory || undefined);
    } else {
      get().loadEntries(state.selectedCategory, page);
    }
  },

  openDetail: (entry) => set({ selectedEntry: entry, detailOpen: true }),
  closeDetail: () => set({ detailOpen: false }),

  openEdit: (entry) => set({ selectedEntry: entry || get().selectedEntry, editOpen: true }),
  closeEdit: () => set({ editOpen: false }),

  openCreate: () => set({ createOpen: true }),
  closeCreate: () => set({ createOpen: false }),

  openTrash: () => {
    set({ trashOpen: true });
    get().loadTrash();
  },
  closeTrash: () => set({ trashOpen: false }),

  selectNode: (node) => set({ selectedNode: node, nodeDetailOpen: !!node }),
  closeNodeDetail: () => set({ nodeDetailOpen: false }),

  setGraphFilters: (filters) => {
    const current = get().graphFilters;
    const merged = { ...current, ...filters };
    set({ graphFilters: merged });
    get().loadGraph(merged);
  },

  clearImportResult: () => set({ importResult: null }),
}));
