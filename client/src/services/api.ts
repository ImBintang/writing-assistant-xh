// client/src/services/api.ts

import axios, { AxiosError, AxiosResponse, InternalAxiosRequestConfig } from 'axios';

// Create axios instance
export const api = axios.create({
  baseURL: '/',
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor
api.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    // Future: add auth tokens or loading indicators here
    return config;
  },
  (error: AxiosError) => {
    return Promise.reject(error);
  },
);

// Response interceptor
api.interceptors.response.use(
  (response: AxiosResponse) => {
    return response;
  },
  (error: AxiosError) => {
    if (error.response) {
      const { status, data } = error.response;

      switch (status) {
        case 400:
          console.error('Bad request:', data);
          break;
        case 403:
          console.error('Forbidden:', data);
          break;
        case 404:
          console.error('Not found:', data);
          break;
        case 429:
          console.error('Rate limited:', data);
          break;
        case 500:
          console.error('Server error:', data);
          break;
        default:
          console.error(`HTTP ${status}:`, data);
      }
    } else if (error.request) {
      console.error('Network error: No response from server');
    } else {
      console.error('Request error:', error.message);
    }

    return Promise.reject(error);
  },
);

// Typed helper functions
export async function fetchHealth(): Promise<{ status: string }> {
  const response = await api.get<{ status: string }>('/api/v1/health');
  return response.data;
}

export async function fetchSystemInfo(): Promise<Record<string, unknown>> {
  const response = await api.get('/api/v1/system/info');
  return response.data;
}

export async function fetchWorkspaceStatus(): Promise<Record<string, unknown>> {
  const response = await api.get('/api/v1/workspace/status');
  return response.data;
}
