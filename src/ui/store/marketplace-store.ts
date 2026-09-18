import { create } from 'zustand';
import { supabase } from '@/shared/lib/supabase';

export interface MarketplaceItem {
  id: string;
  name: string;
  description: string;
  price: number;
  thumbnail_url: string;
  gallery_urls: string[];
  collection: string;
  available_sizes: string[];
  // New 3D Engine Fields
  canvas_state?: Record<string, unknown>[];
  tshirt_color?: string;
  apparel_model?: string;
}

interface MarketplaceState {
  items: MarketplaceItem[];
  isLoading: boolean;
  fetchItems: () => Promise<void>;
}

export const useMarketplaceStore = create<MarketplaceState>((set) => ({
  items: [],
  isLoading: true,
  fetchItems: async () => {
    set({ isLoading: true });
    const { data, error } = await supabase
      .from('marketplace_items')
      .select('*')
      .eq('is_active', true)
      .order('created_at', { ascending: false });

    if (!error && data) {
      set({ items: data, isLoading: false });
    } else {
      console.error('Failed to load marketplace catalog:', error);
      set({ isLoading: false });
    }
  },
}));
