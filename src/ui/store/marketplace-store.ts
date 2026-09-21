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
  canvas_state?: Record<string, unknown>[];
  tshirt_color?: string;
  apparel_model?: string;
  discount_percentage?: number;
  is_new?: boolean;
  is_bestseller?: boolean;
  is_trending?: boolean;
  is_active?: boolean;
  is_spotlight?: boolean;
  popularity_score?: number;
}

interface MarketplaceState {
  items: MarketplaceItem[];
  spotlightItems: MarketplaceItem[];
  collections: string[];
  isLoading: boolean;
  isLoadingMore: boolean;
  hasMore: boolean;
  currentPage: number;
  isShuffleMode: boolean;
  sortBy: 'trending' | 'newest';

  fetchCollections: () => Promise<void>;
  fetchSpotlightItems: () => Promise<void>;
  fetchRandomItems: () => Promise<void>;
  fetchItems: (category: string, query: string, page: number) => Promise<void>;
  incrementPopularity: (id: string) => Promise<void>;
  setSortBy: (sort: 'trending' | 'newest') => void;
}

export const useMarketplaceStore = create<MarketplaceState>((set, get) => ({
  items: [],
  spotlightItems: [],
  collections: ['All'],
  isLoading: true,
  isLoadingMore: false,
  hasMore: true,
  currentPage: 1,
  isShuffleMode: false,
  sortBy: 'trending', // Default to the new trending algorithm

  setSortBy: (sort) => set({ sortBy: sort }),

  // 1. Direct, lightweight RPC call to populate all categories at once
  fetchCollections: async () => {
    const { data, error } = await supabase.rpc('get_distinct_collections');

    if (!error && data) {
      const list = (data as { collection: string }[])
        .map((row) => row.collection?.trim())
        .filter(Boolean);

      set({ collections: ['All', ...list] });
    } else {
      console.error('Failed to fetch collections via RPC:', error);
    }
  },

  // 2. Fetch the top 4 Spotlight items
  fetchSpotlightItems: async () => {
    const { data, error } = await supabase
      .from('marketplace_items')
      .select('*')
      .eq('is_active', true)
      .eq('is_spotlight', true)
      .limit(4);

    if (!error && data) {
      set({ spotlightItems: data as MarketplaceItem[] });
    }
  },

  // 3. The "Surprise Me" Shuffle Mode
  fetchRandomItems: async () => {
    // Clear items, show loader, lock infinite scrolling
    set({ isLoading: true, isShuffleMode: true, hasMore: false, currentPage: 1 });

    const { data, error } = await supabase.rpc('get_random_items', { limit_count: 12 });

    if (!error && data) {
      set({ items: data as MarketplaceItem[], isLoading: false });
    } else {
      console.error('Failed to fetch random items:', error);
      set({ isLoading: false });
    }
  },

  // 4. Fire-and-forget Telemetry
  incrementPopularity: async (id: string) => {
    // We don't await this because we don't want to block the UI.
    // It silently tells the database to +1 the item's score.
    supabase.rpc('increment_popularity', { target_id: id }).then();
  },

  // 5. Paginated item retrieval with SWR Caching and Server-Side Filters
  fetchItems: async (category: string, query: string, page: number) => {
    const { sortBy, isShuffleMode } = get();

    const isLoadMore = page > 1;
    const limit = typeof window !== 'undefined' && window.innerWidth < 768 ? 6 : 12;

    // Determine if this is the "Default View" (where we apply caching)
    const isDefaultView =
      page === 1 && category === 'All' && !query.trim() && sortBy === 'trending';

    // --- SWR CACHING LOGIC (Stale-While-Revalidate) ---
    if (!isLoadMore) {
      let injectedCache = false;

      if (isDefaultView) {
        try {
          const cached = localStorage.getItem('caliqui_marketplace_cache');
          if (cached) {
            // Instantly render from local storage (0ms latency)
            set({
              items: JSON.parse(cached),
              isLoading: false,
              hasMore: true,
              currentPage: 1,
              isShuffleMode: false,
            });
            injectedCache = true;
          }
        } catch (e) {
          console.warn('Failed to parse marketplace cache', e);
        }
      }

      // If we didn't have a cache, or we changed categories, show the Skeleton loader
      if (!injectedCache) {
        set({ isLoading: true, hasMore: true, currentPage: 1, isShuffleMode: false });
      }
    } else {
      // If we are appending to the grid, disable shuffle mode lock and show the bottom spinner
      if (isShuffleMode) set({ isShuffleMode: false });
      set({ isLoadingMore: true });
    }

    // --- DATABASE FETCH ---
    let dbQuery = supabase.from('marketplace_items').select('*').eq('is_active', true);

    // Apply Sorting based on UI Toggle
    if (sortBy === 'trending') {
      dbQuery = dbQuery
        .order('popularity_score', { ascending: false })
        .order('created_at', { ascending: false });
    } else {
      dbQuery = dbQuery.order('created_at', { ascending: false });
    }

    if (category !== 'All') {
      dbQuery = dbQuery.eq('collection', category);
    }

    if (query.trim()) {
      const safeQuery = `%${query.trim()}%`;
      dbQuery = dbQuery.or(
        `name.ilike.${safeQuery},description.ilike.${safeQuery},collection.ilike.${safeQuery}`,
      );
    }

    const from = (page - 1) * limit;
    const to = from + limit;
    dbQuery = dbQuery.range(from, to);

    const { data, error } = await dbQuery;

    if (!error && data) {
      set((state) => {
        const hasMore = data.length > limit;
        const actualData = hasMore ? data.slice(0, limit) : data;

        const newItems = isLoadMore ? [...state.items, ...actualData] : actualData;
        const uniqueItems = Array.from(
          new Map(newItems.map((item) => [item.id, item])).values(),
        ) as MarketplaceItem[];

        // --- SILENT CACHE UPDATE ---
        // If this was the default view, update the cache in the background for their next visit
        if (isDefaultView) {
          try {
            localStorage.setItem('caliqui_marketplace_cache', JSON.stringify(uniqueItems));
          } catch (e) {
            console.warn('Failed to save marketplace cache', e);
          }
        }

        return {
          items: uniqueItems,
          isLoading: false,
          isLoadingMore: false,
          hasMore,
          currentPage: page,
        };
      });
    } else {
      console.error('Failed to load marketplace items:', error);
      set({ isLoading: false, isLoadingMore: false });
    }
  },
}));
