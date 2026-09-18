import { create } from 'zustand';
import { supabase } from '@/shared/lib/supabase';

interface User {
  id: string;
  email: string;
}

interface AuthState {
  user: User | null;
  isAdmin: boolean;
  isAuthenticated: boolean;
  isAuthModalOpen: boolean;

  initAuth: () => void;
  openAuthModal: () => void;
  closeAuthModal: () => void;
  login: (email: string, password?: string) => Promise<void>;
  checkSession: () => Promise<void>;
  logout: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  isAdmin: false,
  isAuthenticated: false,
  isAuthModalOpen: false,

  initAuth: () => {
    get().checkSession();
    // Continuously monitor token refreshes in the background
    supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        get().checkSession();
      } else {
        set({ user: null, isAdmin: false, isAuthenticated: false });
      }
    });
  },

  openAuthModal: () => set({ isAuthModalOpen: true }),
  closeAuthModal: () => set({ isAuthModalOpen: false }),

  login: async (email: string, password = '') => {
    // Attempt to sign in
    const { error } = await supabase.auth.signInWithPassword({ email, password });

    // Auto-signup fallback: If the user doesn't exist, create an account instantly
    if (error?.message.includes('Invalid login credentials')) {
      const { error: signUpError } = await supabase.auth.signUp({ email, password });
      if (signUpError) throw signUpError;
    } else if (error) {
      throw error;
    }

    await get().checkSession();
    set({ isAuthModalOpen: false });
  },

  checkSession: async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (session?.user) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('is_admin')
        .eq('id', session.user.id)
        .single();

      set({
        user: { id: session.user.id, email: session.user.email || '' },
        isAdmin: profile?.is_admin || false,
        isAuthenticated: true,
      });
    } else {
      set({ user: null, isAdmin: false, isAuthenticated: false });
    }
  },

  logout: async () => {
    await supabase.auth.signOut();
    set({ user: null, isAdmin: false, isAuthenticated: false });
  },
}));
