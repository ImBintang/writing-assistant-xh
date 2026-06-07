// client/src/services/chapters.ts

import { api } from './api';

// ==============================================================================
// Types
// ==============================================================================

export interface ChapterMeta {
  index: number;
  title: string;
  fileName: string;
  lineStart: number;
  lineEnd: number;
  charCount: number;
  type?: 'chapter' | 'volume' | 'section' | 'preamble';
}

export interface AnomalyRecord {
  chapterIndex: number;
  type:
    | 'orphan_title'
    | 'missing_chapter'
    | 'duplicate_chapter'
    | 'empty_chapter'
    | 'oversized_chapter'
    | 'title_format';
  severity: 'warning' | 'error' | 'info';
  message: string;
  details?: Record<string, unknown>;
}

export interface UploadResponse {
  sourceId: string;
  sourceFile: string;
  totalChapters: number;
  anomalies: AnomalyRecord[];
}

export interface ChapterListResponse {
  chapters: ChapterMeta[];
  total: number;
  status: string;
  sourceFile: string | null;
}

export interface ChapterDetailResponse {
  meta: ChapterMeta;
  content: string;
}

export interface RawChapterResponse {
  content: string;
  note?: string;
  contextStart?: number;
  contextEnd?: number;
  chapterStart?: number;
  chapterEnd?: number;
}

// ==============================================================================
// API Functions
// ==============================================================================

export async function uploadChapter(
  file: File,
  onProgress?: (pct: number) => void,
): Promise<UploadResponse> {
  const formData = new FormData();
  formData.append('file', file);

  const response = await api.post<UploadResponse>(
    '/api/v1/chapters/upload',
    formData,
    {
      headers: { 'Content-Type': 'multipart/form-data' },
      onUploadProgress: (e) => {
        if (onProgress && e.total) {
          onProgress(Math.round((e.loaded / e.total) * 100));
        }
      },
    },
  );

  return response.data;
}

export async function fetchChapters(
  status?: string,
): Promise<ChapterListResponse> {
  const params = status ? { status } : {};
  const response = await api.get<ChapterListResponse>('/api/v1/chapters', {
    params,
  });
  return response.data;
}

export async function fetchChapter(
  id: number,
): Promise<ChapterDetailResponse> {
  const response = await api.get<ChapterDetailResponse>(
    `/api/v1/chapters/${id}`,
  );
  return response.data;
}

export async function fetchChapterRaw(
  id: number,
): Promise<RawChapterResponse> {
  const response = await api.get<RawChapterResponse>(
    `/api/v1/chapters/${id}/raw`,
  );
  return response.data;
}

export async function updateChapter(
  id: number,
  data: { title?: string; content?: string },
): Promise<ChapterMeta> {
  const response = await api.put<ChapterMeta>(
    `/api/v1/chapters/${id}`,
    data,
  );
  return response.data;
}

export async function mergeChapters(
  chapterIds: number[],
): Promise<ChapterMeta> {
  const response = await api.post<ChapterMeta>(
    '/api/v1/chapters/merge',
    { chapterIds },
  );
  return response.data;
}

export async function splitChapter(
  chapterId: number,
  splitAtLine: number,
): Promise<ChapterMeta[]> {
  const response = await api.post<ChapterMeta[]>(
    '/api/v1/chapters/split',
    { chapterId, splitAtLine },
  );
  return response.data;
}

export async function confirmChapters(): Promise<{ status: string }> {
  const response = await api.post<{ status: string }>(
    '/api/v1/chapters/confirm',
  );
  return response.data;
}

export async function fetchAnomalies(): Promise<{
  anomalies: AnomalyRecord[];
  total: number;
}> {
  const response = await api.get<{
    anomalies: AnomalyRecord[];
    total: number;
  }>('/api/v1/chapters/anomalies');
  return response.data;
}

export async function exportChapters(): Promise<void> {
  const response = await api.post(
    '/api/v1/chapters/export',
    {},
    { responseType: 'blob' },
  );

  // Trigger browser download
  const contentDisposition = response.headers?.['content-disposition'];
  let filename = 'chapters.txt';
  if (contentDisposition) {
    const match = contentDisposition.match(/filename\*=UTF-8''(.+)/)
      || contentDisposition.match(/filename="(.+)"/);
    if (match) {
      filename = decodeURIComponent(match[1]);
    }
  }

  const url = URL.createObjectURL(response.data as Blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
