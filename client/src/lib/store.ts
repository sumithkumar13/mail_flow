import { create } from 'zustand';
import { api, type User } from './api';

interface AppState {
  user: User | null;
  setUser: (user: User | null) => void;
  logout: () => Promise<void>;
}

export const useStore = create<AppState>((set) => ({
  user: null,
  setUser: (user) => set({ user }),
  logout: async () => {
    await api.logout();
    set({ user: null });
  },
}));
