import { create } from 'zustand';
import { supabase } from '@/shared/lib/supabase';

export interface Order {
  id: string;
  created_at: string;
  status: string;
  amount: number;
  currency: string;
  size: string;
  quantity: number;
  marketplace_item_id: string | null;
  design_id: string | null;
  designs?: {
    canvas_state: Record<string, unknown>[];
    tshirt_color: string;
    thumbnail_url: string;
  };
}

export interface SavedDesign {
  id: string;
  name: string;
  thumbnail_url: string;
  created_at: string;
  canvas_state: Record<string, unknown>[];
  tshirt_color: string;
}

export interface UserProfile {
  id: string;
  email: string;
  full_name: string | null;
  default_shipping_address: Record<string, string> | null;
}

interface DashboardState {
  orders: Order[];
  designs: SavedDesign[];
  profile: UserProfile | null;
  isLoading: boolean;
  isUpdatingProfile: boolean;
  fetchDashboardData: () => Promise<void>;
  deleteDesign: (id: string) => Promise<void>;
  updateProfile: (full_name: string, address: string) => Promise<void>;
}

export const useDashboardStore = create<DashboardState>((set, get) => ({
  orders: [],
  designs: [],
  profile: null,
  isLoading: true,
  isUpdatingProfile: false,

  fetchDashboardData: async () => {
    set({ isLoading: true });

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      set({ isLoading: false });
      return;
    }

    try {
      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      const { data: orders } = await supabase
        .from('orders')
        .select('*, designs(canvas_state, tshirt_color, thumbnail_url)')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      const { data: designs } = await supabase
        .from('designs')
        .select('*')
        .eq('user_id', user.id)
        .is('deleted_at', null)
        .order('created_at', { ascending: false });

      set({
        profile: profile as UserProfile,
        orders: (orders as Order[]) || [],
        designs: (designs as SavedDesign[]) || [],
        isLoading: false,
      });
    } catch (error) {
      console.error('Failed to load dashboard data:', error);
      set({ isLoading: false });
    }
  },

  deleteDesign: async (id: string) => {
    const { designs } = get();
    set({ designs: designs.filter((d) => d.id !== id) }); // Optimistic

    const { error } = await supabase
      .from('designs')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id);

    if (error) {
      console.error('Failed to delete design:', error);
      get().fetchDashboardData(); // Revert
    }
  },

  updateProfile: async (full_name: string, address: string) => {
    set({ isUpdatingProfile: true });
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error('Not logged in');

      const { error } = await supabase
        .from('profiles')
        .update({ full_name, default_shipping_address: { address } })
        .eq('id', user.id);

      if (error) throw error;
      await get().fetchDashboardData();
    } catch (error) {
      console.error('Failed to update profile', error);
    } finally {
      set({ isUpdatingProfile: false });
    }
  },
}));
