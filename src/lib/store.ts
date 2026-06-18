import { create } from 'zustand';

export type TabId = 'dashboard' | 'inventory' | 'sales' | 'batches' | 'customers' | 'logs' | 'settings'
  | 'promotions' | 'restock' | 'stocktaking' | 'content-promotion';

export interface NavGroup {
  id: string;
  label: string;
  icon: React.ElementType;
  children: { id: TabId; label: string }[];
}

export interface CurrentUser {
  id: number;
  username: string;
  displayName: string;
  roleName: string;
  permissions: string[];
  mustChangePwd: boolean;
}

interface AppState {
  activeTab: TabId;
  setActiveTab: (tab: TabId) => void;
  selectedItems: Set<number>;
  toggleItem: (id: number) => void;
  clearSelection: () => void;
  selectAll: (ids: number[]) => void;
  theme: 'light' | 'dark' | 'system';
  setTheme: (theme: 'light' | 'dark' | 'system') => void;

  // Auth state
  currentUser: CurrentUser | null;
  isAuthenticated: boolean;
  isAuthLoading: boolean;
  setAuth: (user: CurrentUser) => void;
  clearAuth: () => void;
  setAuthLoading: (val: boolean) => void;
  logout: () => Promise<void>;
  checkSession: () => Promise<void>;
}

export const useAppStore = create<AppState>((set, get) => ({
  activeTab: 'sales',
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

  // Auth state
  currentUser: null,
  isAuthenticated: false,
  isAuthLoading: true,
  setAuth: (user) => set({ currentUser: user, isAuthenticated: true, isAuthLoading: false }),
  clearAuth: () => {
    localStorage.removeItem('auth_token');
    set({ currentUser: null, isAuthenticated: false, isAuthLoading: false });
  },
  setAuthLoading: (val) => set({ isAuthLoading: val }),
  logout: async () => {
    try {
      const token = localStorage.getItem('auth_token');
      if (token) {
        await fetch('/api/auth/logout', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${token}` },
        });
      }
    } catch { /* ignore */ }
    localStorage.removeItem('auth_token');
    set({ currentUser: null, isAuthenticated: false, isAuthLoading: false });
  },
  checkSession: async () => {
    const token = localStorage.getItem('auth_token');
    if (!token) {
      set({ currentUser: null, isAuthenticated: false, isAuthLoading: false });
      return;
    }
    try {
      const res = await fetch('/api/auth/me', {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.code === 0 && data.data) {
        set({ currentUser: data.data, isAuthenticated: true, isAuthLoading: false });
      } else {
        localStorage.removeItem('auth_token');
        set({ currentUser: null, isAuthenticated: false, isAuthLoading: false });
      }
    } catch {
      localStorage.removeItem('auth_token');
      set({ currentUser: null, isAuthenticated: false, isAuthLoading: false });
    }
  },
}));
