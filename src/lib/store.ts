import { create } from 'zustand';

export type TabId = 'dashboard' | 'inventory' | 'sales' | 'batches' | 'customers' | 'logs' | 'settings';

interface AppState {
  activeTab: TabId;
  setActiveTab: (tab: TabId) => void;
  selectedItems: Set<number>;
  toggleItem: (id: number) => void;
  clearSelection: () => void;
  selectAll: (ids: number[]) => void;
  theme: 'light' | 'dark' | 'system';
  setTheme: (theme: 'light' | 'dark' | 'system') => void;
}

export const useAppStore = create<AppState>((set) => ({
  activeTab: 'dashboard',
  setActiveTab: (tab) => set({ activeTab: tab }),
  selectedItems: new Set(),
  toggleItem: (id) =>
    set((state) => {
      const next = new Set(state.selectedItems);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return { selectedItems: next };
    }),
  clearSelection: () => set({ selectedItems: new Set() }),
  selectAll: (ids) => set({ selectedItems: new Set(ids) }),
  theme: 'system',
  setTheme: (theme) => set({ theme }),
}));
