// client/src/services/knowledge-management.ts
// Client API functions for knowledge management (PRD-04)

import { api } from './api';
import type {
  KnowledgeEntry,
  BrowseResponse,
  CategoryInfo,
  VersionRecord,
  ChangeRecord,
  GraphNode,
  GraphEdge,
  RelationTypeDefinition,
} from './knowledge';

// Re-export types that this service uses
export type {
  KnowledgeEntry,
  BrowseResponse,
  CategoryInfo,
  VersionRecord,
  ChangeRecord,
  GraphNode,
  GraphEdge,
  RelationTypeDefinition,
};

export interface SearchResult {
  id: string;
  category: string;
  name: string;
  aliases: string[];
  chapters: number[];
  snippet: string;
}

export interface SearchResults {
  results: Array<{
    id: string;
    category: string;
    name: string;
    aliases: string[];
    chapters: number[];
    snippet: string;
  }>;
  query: string;
  page: number;
  size: number;
}

// ============================================================
// Browse & Search
// ============================================================

export async function fetchEntries(params?: {
  category?: string;
  page?: number;
  size?: number;
  sort?: 'name' | 'updatedAt';
}): Promise<BrowseResponse> {
  const response = await api.get('/api/v1/knowledge/entries', { params });
  return response.data as BrowseResponse;
}

export async function fetchEntry(id: string): Promise<{ entry: KnowledgeEntry }> {
  const response = await api.get(`/api/v1/knowledge/entries/${id}`);
  return response.data as { entry: KnowledgeEntry };
}

export async function searchKnowledge(params: {
  q: string;
  category?: string;
  page?: number;
  size?: number;
}): Promise<SearchResults> {
  const response = await api.get('/api/v1/knowledge/search', { params });
  return response.data as SearchResults;
}

export async function fetchCategories(): Promise<{ categories: CategoryInfo[] }> {
  const response = await api.get('/api/v1/knowledge/categories');
  return response.data as { categories: CategoryInfo[] };
}

// ============================================================
// CRUD
// ============================================================

export async function createEntry(data: {
  name: string;
  category: string;
  aliases?: string[];
  attributes?: Record<string, unknown>;
  description?: string;
  relations?: Array<{
    targetId?: string;
    targetName: string;
    relationType: string;
    description: string;
  }>;
}): Promise<{ entry: KnowledgeEntry }> {
  const response = await api.post('/api/v1/knowledge/entries', data);
  return response.data as { entry: KnowledgeEntry };
}

export async function updateEntry(
  id: string,
  data: {
    name?: string;
    category?: string;
    aliases?: string[];
    attributes?: Record<string, unknown>;
    description?: string;
    relations?: Array<{
      targetId?: string;
      targetName: string;
      relationType: string;
      description: string;
    }>;
    editorNote?: string;
  },
): Promise<{ entry: KnowledgeEntry }> {
  const response = await api.put(`/api/v1/knowledge/entries/${id}`, data);
  return response.data as { entry: KnowledgeEntry };
}

export async function deleteEntry(id: string): Promise<{ message: string; entry: KnowledgeEntry }> {
  const response = await api.delete(`/api/v1/knowledge/entries/${id}`);
  return response.data as { message: string; entry: KnowledgeEntry };
}

export async function addRelation(
  entryId: string,
  data: { targetId?: string; targetName: string; relationType: string; description: string },
): Promise<{ entry: KnowledgeEntry }> {
  const response = await api.post(`/api/v1/knowledge/entries/${entryId}/relations`, data);
  return response.data as { entry: KnowledgeEntry };
}

export async function removeRelation(
  entryId: string,
  relationIndex: number,
): Promise<{ entry: KnowledgeEntry }> {
  const response = await api.delete(
    `/api/v1/knowledge/entries/${entryId}/relations/${relationIndex}`,
  );
  return response.data as { entry: KnowledgeEntry };
}

// ============================================================
// Trash
// ============================================================

export async function fetchTrash(params?: {
  page?: number;
  size?: number;
}): Promise<{ entries: KnowledgeEntry[]; total: number; page: number; size: number }> {
  const response = await api.get('/api/v1/knowledge/trash', { params });
  return response.data as {
    entries: KnowledgeEntry[];
    total: number;
    page: number;
    size: number;
  };
}

export async function restoreEntry(id: string): Promise<{ message: string; entry: KnowledgeEntry }> {
  const response = await api.post(`/api/v1/knowledge/trash/${id}/restore`);
  return response.data as { message: string; entry: KnowledgeEntry };
}

export async function emptyTrash(): Promise<{ message: string; count: number }> {
  const response = await api.delete('/api/v1/knowledge/trash/empty');
  return response.data as { message: string; count: number };
}

// ============================================================
// Version History & Changes
// ============================================================

export async function fetchVersions(id: string): Promise<{ versions: VersionRecord[] }> {
  const response = await api.get(`/api/v1/knowledge/entries/${id}/history`);
  return response.data as { versions: VersionRecord[] };
}

export async function fetchRecentChanges(limit?: number): Promise<{ changes: ChangeRecord[] }> {
  const response = await api.get('/api/v1/knowledge/changes', { params: { limit } });
  return response.data as { changes: ChangeRecord[] };
}

// ============================================================
// Graph
// ============================================================

export async function fetchGraph(params?: {
  categories?: string[];
  relationTypes?: string[];
}): Promise<{ nodes: GraphNode[]; edges: GraphEdge[] }> {
  const queryParams: Record<string, string> = {};
  if (params?.categories?.length) queryParams.categories = params.categories.join(',');
  if (params?.relationTypes?.length) queryParams.relationTypes = params.relationTypes.join(',');
  const response = await api.get('/api/v1/knowledge/graph', { params: queryParams });
  return response.data as { nodes: GraphNode[]; edges: GraphEdge[] };
}

export async function fetchNodeGraph(
  nodeId: string,
  depth?: number,
): Promise<{ nodes: GraphNode[]; edges: GraphEdge[] }> {
  const response = await api.get(`/api/v1/knowledge/graph/node/${nodeId}`, {
    params: { depth },
  });
  return response.data as { nodes: GraphNode[]; edges: GraphEdge[] };
}

export async function fetchRelationTypes(): Promise<{ types: RelationTypeDefinition[] }> {
  const response = await api.get('/api/v1/knowledge/graph/relations');
  return response.data as { types: RelationTypeDefinition[] };
}

export async function addRelationType(data: {
  id: string;
  name: string;
  description: string;
  bidirectional: boolean;
}): Promise<{ types: RelationTypeDefinition[] }> {
  const response = await api.post('/api/v1/knowledge/graph/relations', data);
  return response.data as { types: RelationTypeDefinition[] };
}

// ============================================================
// Export / Import
// ============================================================

export async function exportKnowledge(categories?: string[]): Promise<Blob> {
  const response = await api.post('/api/v1/knowledge/export', { categories }, { responseType: 'blob' });
  return response.data as Blob;
}

export async function importKnowledge(
  file: File,
): Promise<{ imported: number; skipped: number; errors: string[] }> {
  const formData = new FormData();
  formData.append('file', file);
  const response = await api.post('/api/v1/knowledge/import', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return response.data as { imported: number; skipped: number; errors: string[] };
}
