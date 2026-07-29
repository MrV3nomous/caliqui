import { create } from 'zustand';

interface User {
  id: string;
  email: string;
}

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isAuthModalOpen: boolean;

  // Actions
  openAuthModal: () => void;
  closeAuthModal: () => void;
  login: (email: string) => Promise<void>;
  logout: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isAuthenticated: false,
  isAuthModalOpen: false,

  openAuthModal: () => set({ isAuthModalOpen: true }),
  closeAuthModal: () => set({ isAuthModalOpen: false }),

  login: async (email: string) => {
    // MOCK: Simulating a Supabase magic-link or password login delay
    await new Promise((resolve) => setTimeout(resolve, 1200));
    set({
      user: { id: crypto.randomUUID(), email },
      isAuthenticated: true,
      isAuthModalOpen: false,
    });
  },

  logout: () => {
    set({ user: null, isAuthenticated: false });
  },
}));
