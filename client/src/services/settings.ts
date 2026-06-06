// client/src/services/settings.ts
// API functions for Setting endpoints (PRD-06)

import { api } from './api';

// --- Types (mirrors server-side types) ---

export interface SettingFile {
  id: string;
  title: string;
  category: string;
  template?: string;
  status: 'draft' | 'migrated';
  references: string[];
  content: string;
  createdAt: string;
  updatedAt: string;
}

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

// --- API functions ---

export async function fetchSettings(category?: string): Promise<SettingFile[]> {
  const params = category ? { category } : {};
  const response = await api.get<SettingFile[]>('/api/v1/settings', { params });
  return response.data;
}

export async function fetchSetting(id: string): Promise<SettingFile> {
  const response = await api.get<SettingFile>(`/api/v1/settings/${encodeURIComponent(id)}`);
  return response.data;
}

export async function createSetting(data: {
  title: string;
  category: string;
  template?: string;
  content?: string;
}): Promise<SettingFile> {
  const response = await api.post<SettingFile>('/api/v1/settings', data);
  return response.data;
}

export async function updateSetting(
  id: string,
  data: { title?: string; category?: string; content?: string },
): Promise<SettingFile> {
  const response = await api.put<SettingFile>(
    `/api/v1/settings/${encodeURIComponent(id)}`,
    data,
  );
  return response.data;
}

export async function deleteSetting(id: string): Promise<void> {
  await api.delete(`/api/v1/settings/${encodeURIComponent(id)}`);
}

export async function addReference(
  settingId: string,
  knowledgeId: string,
): Promise<SettingFile> {
  const response = await api.post<SettingFile>(
    `/api/v1/settings/${encodeURIComponent(settingId)}/reference`,
    { knowledgeId },
  );
  return response.data;
}

export async function previewMigration(settingIds: string[]): Promise<MigrationPreview> {
  const response = await api.post<MigrationPreview>('/api/v1/settings/migrate', {
    settingIds,
  });
  return response.data;
}

export async function confirmMigration(
  preview: MigrationPreview,
  resolvedConflicts?: Array<{
    settingId: string;
    field: string;
    resolution: 'accept_new' | 'keep_old';
  }>,
): Promise<MigrateConfirmResult> {
  const response = await api.post<MigrateConfirmResult>(
    '/api/v1/settings/migrate/confirm',
    {
      preview,
      resolvedConflicts,
    },
  );
  return response.data;
}
