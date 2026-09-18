import { create } from 'zustand';
import { supabase } from '@/shared/lib/supabase';
import type { CartEntry } from './checkout-store';

export interface GlobalOrder {
  id: string;
  created_at: string;
  customer_name: string;
  total_amount: number;
  status: 'processing' | 'shipped' | 'delivered' | 'cancelled';
  courier_name: string | null;
  tracking_number: string | null;
  print_file_path: string | null;
  shipping_snapshot: { address: string; phone: string; label: string };
  cart: CartEntry[];
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
  fetchAdminData: () => Promise<void>;
  updateOrderStatus: (
    id: string,
    status: string,
    courier?: string,
    tracking?: string,
  ) => Promise<void>;
  downloadPrintFile: (path: string) => Promise<void>;

  // CMS Methods
  fetchAdminDesigns: () => Promise<void>;
  uploadMarketplaceAsset: (file: File) => Promise<string>;
  createMarketplaceItem: (item: NewMarketplaceItem) => Promise<void>;
}

export const useAdminStore = create<AdminState>((set) => ({
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

  fetchAdminData: async () => {
    set({ isLoading: true });
    const { data: orders, error } = await supabase
      .from('orders')
      .select('*')
      .order('created_at', { ascending: false });

    if (!error) set({ orders: orders as GlobalOrder[] });
    set({ isLoading: false });
  },

  updateOrderStatus: async (id, status, courier, tracking) => {
    const updates: Partial<GlobalOrder> = { status: status as GlobalOrder['status'] };
    if (status === 'shipped') {
      updates.courier_name = courier;
      updates.tracking_number = tracking;
    }

    const { error } = await supabase.from('orders').update(updates).eq('id', id);

    if (!error) {
      set((state) => ({
        orders: state.orders.map((o) => (o.id === id ? { ...o, ...updates } : o)),
      }));
    } else {
      console.error('Failed to update order:', error);
      alert('Failed to update order. Check permissions.');
    }
  },

  downloadPrintFile: async (path) => {
    const { data, error } = await supabase.storage.from('print_files').download(path);
    if (error) return alert('Could not download print file.');

    const url = URL.createObjectURL(data);
    const a = document.createElement('a');
    a.href = url;
    a.download = path.split('/').pop() || 'print_file.png';
    document.body.appendChild(a);
    a.click();
    URL.revokeObjectURL(url);
    document.body.removeChild(a);
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
