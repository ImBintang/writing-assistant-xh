// client/src/hooks/useSettings.ts
// Zustand store for Setting Conception page (PRD-06)

import { create } from 'zustand';
import * as settingsApi from '../services/settings';
import type { SettingFile, MigrationPreview } from '../services/settings';

export type { SettingFile, MigrationPreview } from '../services/settings';

// Template constants
export const SETTING_TEMPLATES: Record<string, string> = {
  character: `# {角色名}

## 基本信息
- **姓名**：
- **年龄**：
- **性别**：
- **外貌**：

## 性格与背景
- **性格**：
- **背景**：

## 能力
- **修为/等级**：
- **技能**：

## 关系
| 角色 | 关系 | 描述 |
|------|------|------|

## 出场计划
- **首次出场**：
- **关键情节**：
`,
  technique: `# {功法名}

## 基本信息
- **名称**：
- **类型**：（如：攻击型、防御型、辅助型）
- **等级**：（如：黄阶、玄阶、地阶、天阶）

## 效果描述


## 修炼条件


## 拥有者


## 出场计划
`,
  plot: `# {情节名}

## 基本信息
- **事件名称**：
- **时间线位置**：

## 参与角色
| 角色 | 角色定位 | 备注 |
|------|---------|------|

## 剧情概要
- **起因**：
- **经过**：
- **结果**：

## 伏笔安排

`,
  alchemy: `# {丹药名}

## 基本信息
- **名称**：
- **品级**：（如：一品、二品、三品...九品）
- **效果**：

## 配方


## 炼制条件


## 归属


## 出场计划
`,
  map: `# {地图名}

## 基本信息
- **名称**：
- **类型**：（如：城市、宗门、秘境、大陆）

## 地理位置


## 重要地标
| 地标 | 描述 | 相关剧情 |
|------|------|---------|

## 相关角色/势力

`,
  organization: `# {组织名}

## 基本信息
- **名称**：
- **类型**：（如：宗门、家族、商会、帝国）

## 组织结构


## 重要成员
| 姓名 | 职位 | 备注 |
|------|------|------|

## 势力关系

`,
  other: `# {设定名}

## 描述


## 相关信息

`,
};

export const CATEGORY_LABELS: Record<string, string> = {
  characters: '人物设定',
  techniques: '功法设定',
  plot: '情节设定',
  alchemy: '丹药设定',
  map: '地图设定',
  organization: '组织设定',
  other: '其他设定',
};

export const CATEGORY_COLORS: Record<string, string> = {
  characters: 'bg-orange-100 text-orange-800 border-orange-300',
  techniques: 'bg-amber-100 text-amber-800 border-amber-300',
  plot: 'bg-yellow-100 text-yellow-800 border-yellow-300',
  alchemy: 'bg-green-100 text-green-800 border-green-300',
  map: 'bg-teal-100 text-teal-800 border-teal-300',
  organization: 'bg-red-100 text-red-800 border-red-300',
  other: 'bg-gray-100 text-gray-800 border-gray-300',
};

interface SettingsState {
  // Data
  settings: SettingFile[];
  currentSetting: SettingFile | null;
  settingsLoading: boolean;
  saving: boolean;

  // UI State
  selectedCategory: string | null;
  editorContent: string;
  showReferencePanel: boolean;
  knowledgeSearchQuery: string;
  knowledgeSearchResults: Array<{
    id: string;
    name: string;
    category: string;
    snippet: string;
  }>;
  searchLoading: boolean;

  // Migration
  migrationPreview: MigrationPreview | null;
  migrationLoading: boolean;
  showMigrateDialog: boolean;
  selectedSettingIds: string[];

  // Actions
  loadSettings: (category?: string) => Promise<void>;
  selectSetting: (setting: SettingFile | null) => void;
  createSetting: (data: { title: string; category: string; template?: string }) => Promise<SettingFile | null>;
  saveCurrentSetting: () => Promise<void>;
  updateEditorContent: (content: string) => void;
  deleteSetting: (id: string) => Promise<void>;
  searchKnowledge: (query: string) => Promise<void>;
  addReference: (knowledgeId: string) => Promise<void>;
  previewMigration: (settingIds: string[]) => Promise<void>;
  confirmMigration: (resolvedConflicts?: Array<{ settingId: string; field: string; resolution: 'accept_new' | 'keep_old' }>) => Promise<void>;
  toggleReferencePanel: () => void;
  toggleMigrateDialog: () => void;
  toggleSelectForMigration: (id: string) => void;
}

export const useSettings = create<SettingsState>((set, get) => ({
  // Initial state
  settings: [],
  currentSetting: null,
  settingsLoading: false,
  saving: false,
  selectedCategory: null,
  editorContent: '',
  showReferencePanel: false,
  knowledgeSearchQuery: '',
  knowledgeSearchResults: [],
  searchLoading: false,
  migrationPreview: null,
  migrationLoading: false,
  showMigrateDialog: false,
  selectedSettingIds: [],

  // Load settings list
  loadSettings: async (category?: string) => {
    set({ settingsLoading: true });
    try {
      const settings = await settingsApi.fetchSettings(category);
      set({ settings, settingsLoading: false });
    } catch (err) {
      console.error('Failed to load settings:', err);
      set({ settingsLoading: false });
    }
  },

  // Select a setting to edit
  selectSetting: (setting) => {
    if (!setting) {
      set({ currentSetting: null, editorContent: '' });
      return;
    }
    set({
      currentSetting: setting,
      editorContent: setting.content,
      showReferencePanel: false,
    });
  },

  // Create new setting
  createSetting: async (data) => {
    const template = data.template ? SETTING_TEMPLATES[data.template] : undefined;
    set({ saving: true });
    try {
      const setting = await settingsApi.createSetting({
        title: data.title,
        category: data.category,
        template: data.template,
        content: template || '',
      });
      const { settings } = get();
      set({
        settings: [setting, ...settings],
        currentSetting: setting,
        editorContent: setting.content,
        saving: false,
      });
      return setting;
    } catch (err) {
      console.error('Failed to create setting:', err);
      set({ saving: false });
      return null;
    }
  },

  // Save current editor content
  saveCurrentSetting: async () => {
    const { currentSetting, editorContent } = get();
    if (!currentSetting) return;
    set({ saving: true });
    try {
      const updated = await settingsApi.updateSetting(currentSetting.id, {
        content: editorContent,
      });
      const { settings } = get();
      set({
        settings: settings.map((s) => (s.id === updated.id ? updated : s)),
        currentSetting: updated,
        saving: false,
      });
    } catch (err) {
      console.error('Failed to save setting:', err);
      set({ saving: false });
    }
  },

  // Update editor content (local state)
  updateEditorContent: (content) => {
    set({ editorContent: content });
  },

  // Delete a setting
  deleteSetting: async (id) => {
    try {
      await settingsApi.deleteSetting(id);
      const { settings, currentSetting } = get();
      set({
        settings: settings.filter((s) => s.id !== id),
        currentSetting: currentSetting?.id === id ? null : currentSetting,
        editorContent: currentSetting?.id === id ? '' : get().editorContent,
        selectedSettingIds: get().selectedSettingIds.filter((sid) => sid !== id),
      });
    } catch (err) {
      console.error('Failed to delete setting:', err);
    }
  },

  // Search knowledge base
  searchKnowledge: async (query) => {
    if (!query.trim()) {
      set({ knowledgeSearchResults: [], searchLoading: false });
      return;
    }
    set({ searchLoading: true, knowledgeSearchQuery: query });
    try {
      // Use knowledge search API
      const { api } = await import('../services/api');
      const response = await api.get('/api/v1/knowledge/search', {
        params: { q: query, size: 10 },
      });
      set({
        knowledgeSearchResults: response.data || [],
        searchLoading: false,
      });
    } catch (err) {
      console.error('Failed to search knowledge:', err);
      set({ searchLoading: false });
    }
  },

  // Add knowledge reference to current setting
  addReference: async (knowledgeId) => {
    const { currentSetting } = get();
    if (!currentSetting) return;
    try {
      const updated = await settingsApi.addReference(currentSetting.id, knowledgeId);
      set({
        currentSetting: updated,
        settings: get().settings.map((s) => (s.id === updated.id ? updated : s)),
      });
    } catch (err) {
      console.error('Failed to add reference:', err);
    }
  },

  // Preview migration
  previewMigration: async (settingIds) => {
    set({ migrationLoading: true });
    try {
      const preview = await settingsApi.previewMigration(settingIds);
      set({
        migrationPreview: preview,
        migrationLoading: false,
        showMigrateDialog: true,
      });
    } catch (err) {
      console.error('Failed to preview migration:', err);
      set({ migrationLoading: false });
    }
  },

  // Confirm migration
  confirmMigration: async (resolvedConflicts) => {
    const { migrationPreview } = get();
    if (!migrationPreview) return;
    set({ migrationLoading: true });
    try {
      await settingsApi.confirmMigration(migrationPreview, resolvedConflicts);
      // Reload settings to show updated statuses
      await get().loadSettings(get().selectedCategory || undefined);
      set({
        migrationLoading: false,
        showMigrateDialog: false,
        migrationPreview: null,
        selectedSettingIds: [],
      });
    } catch (err) {
      console.error('Failed to confirm migration:', err);
      set({ migrationLoading: false });
    }
  },

  // UI toggles
  toggleReferencePanel: () => set((s) => ({ showReferencePanel: !s.showReferencePanel })),
  toggleMigrateDialog: () => set((s) => ({ showMigrateDialog: !s.showMigrateDialog })),
  toggleSelectForMigration: (id) =>
    set((s) => ({
      selectedSettingIds: s.selectedSettingIds.includes(id)
        ? s.selectedSettingIds.filter((sid) => sid !== id)
        : [...s.selectedSettingIds, id],
    })),
}));
