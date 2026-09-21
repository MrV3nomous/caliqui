import { create } from 'zustand';
import { supabase } from '@/shared/lib/supabase';

export interface OrderLineItem {
  id: string;
  order_id: string;
  type: 'custom' | 'marketplace';
  product_id: string;
  name: string;
  price: number;
  quantity: number;
  sizes: Record<string, number>;
  status: 'draft' | 'processing' | 'shipped' | 'delivered';
  courier_name?: string | null;
  tracking_number?: string | null;
  created_at: string;
  updated_at: string;
}

export interface Order {
  id: string;
  created_at: string;
  updated_at: string;
  status: string;
  amount: number;
  currency: string;
  customer_name: string;
  shipping_snapshot: Record<string, string> | null;
  order_items: OrderLineItem[];
}

export interface SavedDesign {
  id: string;
  name: string;
  thumbnail_url: string;
  created_at: string;
  canvas_state: Record<string, unknown>[];
  tshirt_color: string;
}

export interface StoreMarketplaceItem {
  id: string;
  thumbnail_url: string | null;
  canvas_state: Record<string, unknown>[] | null;
  tshirt_color: string | null;
  apparel_model: string | null;
  collection: string | null; // Added to fetch the actual collection name
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
  marketplaceItems: StoreMarketplaceItem[];
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
  marketplaceItems: [],
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

      // Relational join using the new database schema
      const { data: orders } = await supabase
        .from('orders')
        .select('*, order_items(*)')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      const { data: designs } = await supabase
        .from('designs')
        .select('*')
        .eq('user_id', user.id)
        .is('deleted_at', null)
        .order('created_at', { ascending: false });

      // Included 'collection' in the selection string
      const { data: marketplaceItems } = await supabase
        .from('marketplace_items')
        .select('id, thumbnail_url, canvas_state, tshirt_color, apparel_model, collection');

      set({
        profile: profile as UserProfile,
        orders: (orders as Order[]) || [],
        designs: (designs as SavedDesign[]) || [],
        marketplaceItems: (marketplaceItems as StoreMarketplaceItem[]) || [],
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
