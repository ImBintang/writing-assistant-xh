// client/src/stores/app.ts

import { create } from 'zustand';

interface AppState {
  // Server connection
  isServerConnected: boolean;
  serverVersion: string | null;

  // Workspace
  workspaceStatus: Record<string, { exists: boolean; fileCount: number }> | null;

  // UI state
  sidebarOpen: boolean;

  // Actions
  checkHealth: () => Promise<void>;
  fetchWorkspaceStatus: () => Promise<void>;
  toggleSidebar: () => void;
}

export const useAppStore = create<AppState>((set) => ({
  isServerConnected: false,
  serverVersion: null,
  workspaceStatus: null,
  sidebarOpen: true,

  checkHealth: async () => {
    try {
      const { api } = await import('../services/api');
      const response = await api.get('/api/v1/health');
      set({
        isServerConnected: response.data.status === 'ok',
      });
    } catch {
      set({ isServerConnected: false });
    }
  },

  fetchWorkspaceStatus: async () => {
    try {
      const { api } = await import('../services/api');
      const response = await api.get('/api/v1/workspace/status');
      set({ workspaceStatus: response.data.directories });
    } catch {
      // Silently fail -- workspace may not be initialized yet
    }
  },

  toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
}));
