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
  print_file_path?: string | null;
  shipping_snapshot?: {
    address: string;
    phone: string;
    label: string;
    customer_name?: string;
  } | null;
  status: 'draft' | 'processing' | 'shipped' | 'delivered';
  courier_name?: string | null;
  tracking_number?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface GlobalOrder {
  id: string;
  created_at: string;
  updated_at?: string;
  customer_name: string;
  amount: number;
  status: 'draft' | 'processing' | 'shipped' | 'delivered' | 'cancelled';
  shipping_snapshot: { address: string; phone: string; label: string };
  order_items: OrderLineItem[];
  user_id: string;
}

export interface AdminDesign {
  id: string;
  name: string | null;
  thumbnail_url: string;
  canvas_state: Record<string, unknown>[];
  tshirt_color: string;
  apparel_model?: string;
  created_at: string;
}

export interface NewMarketplaceItem {
  name: string;
  description: string;
  price: number;
  thumbnail_url: string;
  gallery_urls?: string[];
  canvas_state?: Record<string, unknown>[];
  tshirt_color?: string;
  apparel_model?: string;
  collection: string;
  available_sizes: string[];
}

interface AdminState {
  isAdmin: boolean | null;
  orders: GlobalOrder[];
  adminDesigns: AdminDesign[];
  isLoading: boolean;

  verifyAdminAccess: () => Promise<boolean>;
  fetchAdminData: (background?: boolean) => Promise<void>;
  updateOrderItemStatus: (
    itemId: string,
    status: 'draft' | 'processing' | 'shipped' | 'delivered',
    courier?: string,
    tracking?: string,
  ) => Promise<void>;

  // CMS Methods
  fetchAdminDesigns: () => Promise<void>;
  uploadMarketplaceAsset: (file: File) => Promise<string>;
  createMarketplaceItem: (item: NewMarketplaceItem) => Promise<void>;
}

export const useAdminStore = create<AdminState>((set, get) => ({
  isAdmin: null,
  orders: [],
  adminDesigns: [],
  isLoading: true,

  verifyAdminAccess: async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      set({ isAdmin: false, isLoading: false });
      return false;
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    const isAdmin = profile?.role === 'admin';
    set({ isAdmin });
    return isAdmin;
  },

  fetchAdminData: async (background = false) => {
    if (!background) set({ isLoading: true });

    const { data: orders, error } = await supabase
      .from('orders')
      .select('*, order_items(*)')
      .order('created_at', { ascending: false });

    if (!error) set({ orders: orders as GlobalOrder[] });
    if (!background) set({ isLoading: false });
  },

  updateOrderItemStatus: async (itemId, status, courier, tracking) => {
    // 1. Optimistic Update: Instantly change the UI without waiting for the network
    const previousOrders = get().orders;
    set((state) => ({
      orders: state.orders.map((order) => {
        let hasChanges = false;
        const newItems = order.order_items?.map((item) => {
          if (item.id === itemId) {
            hasChanges = true;
            return {
              ...item,
              status,
              courier_name: courier || item.courier_name,
              tracking_number: tracking || item.tracking_number,
              updated_at: new Date().toISOString(), // Optimistically update local timestamp
            };
          }
          return item;
        });

        if (hasChanges) {
          // Re-calculate the global order status locally
          const itemsWithStatus = newItems.map((i) => i.status || order.status || 'draft');
          let globalStatus: GlobalOrder['status'] = 'processing';
          if (itemsWithStatus.every((s) => s === 'delivered')) globalStatus = 'delivered';
          else if (itemsWithStatus.every((s) => s === 'shipped' || s === 'delivered'))
            globalStatus = 'shipped';
          else if (itemsWithStatus.every((s) => s === 'draft')) globalStatus = 'draft';

          return {
            ...order,
            status: globalStatus,
            order_items: newItems,
            updated_at: new Date().toISOString(),
          };
        }
        return order;
      }),
    }));

    // 2. Database Execution
    const updates = {
      status,
      courier_name: courier || null,
      tracking_number: tracking || null,
    };

    const { error } = await supabase.from('order_items').update(updates).eq('id', itemId);

    if (!error) {
      // Background re-fetch to ensure sync
      get().fetchAdminData(true);
    } else {
      console.error('Failed to update item status:', error);
      alert('Failed to update item status. Check permissions.');
      // Revert optimistic update on failure
      set({ orders: previousOrders });
    }
  },

  fetchAdminDesigns: async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;
    const { data } = await supabase
      .from('designs')
      .select('*')
      .eq('user_id', user.id)
      .is('deleted_at', null)
      .order('created_at', { ascending: false });
    if (data) set({ adminDesigns: data });
  },

  uploadMarketplaceAsset: async (file: File) => {
    const fileName = `${crypto.randomUUID()}-${file.name.replace(/[^a-zA-Z0-9.]/g, '')}`;
    const { error } = await supabase.storage
      .from('marketplace_assets')
      .upload(fileName, file, { cacheControl: '3600', upsert: false });
    if (error) throw error;

    const { data } = supabase.storage.from('marketplace_assets').getPublicUrl(fileName);
    return data.publicUrl;
  },

  createMarketplaceItem: async (item) => {
    const { error } = await supabase
      .from('marketplace_items')
      .insert([{ ...item, is_active: true }]);
    if (error) throw error;
  },
}));
