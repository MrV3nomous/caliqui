import { create } from 'zustand';
import { env } from '@/shared/env';
import { supabase } from '@/shared/lib/supabase';

export interface ShippingAddress {
  id: string;
  label: string;
  fullName: string;
  phone: string;
  address: string;
}

export interface CartEntry {
  cartId: string;
  type: 'custom' | 'marketplace';
  productId: string;
  name: string;
  thumbnail: string | null;
  price: number;
  originalPrice?: number;
  discountPercentage?: number;
  sizes: Record<string, number>;
  collection?: string;
  canvasState?: Record<string, unknown>[];
  tshirtColor?: string;
  apparelModel?: string;
}

export interface FreshMarketplaceItem {
  id: string;
  name: string;
  price: number;
  collection: string | null;
  discount_percentage: number | null;
  thumbnail_url: string | null;
  canvas_state: unknown | null;
  tshirt_color: string | null;
  apparel_model: string | null;
}

export interface FreshCustomItem {
  id: string;
  name: string | null;
  thumbnail_url: string | null;
  canvas_state: unknown | null;
  tshirt_color: string | null;
  apparel_model: string | null;
}

interface RazorpayOptions {
  key: string;
  amount: number;
  currency: string;
  name: string;
  description: string;
  order_id: string;
  handler: (_response: unknown) => void;
  prefill: { name?: string; email?: string; contact?: string };
  theme: { color: string };
  modal: { ondismiss: () => void };
}

interface RazorpayInstance {
  on: (event: string, handler: (_response: unknown) => void) => void;
  open: () => void;
}

declare global {
  interface Window {
    Razorpay?: new (options: RazorpayOptions) => RazorpayInstance;
  }
}

interface CheckoutState {
  cart: CartEntry[];
  savedAddresses: ShippingAddress[];
  orderStatus: 'idle' | 'processing' | 'success' | 'failed';
  lastOrderId: string | null;

  addToCart: (entry: Omit<CartEntry, 'cartId' | 'sizes'>) => void;
  updateCartItemQuantity: (cartId: string, size: string, delta: number) => void;
  removeFromCart: (cartId: string) => void;
  clearCart: () => void;
  setOrderStatus: (status: 'idle' | 'processing' | 'success' | 'failed') => void;

  fetchAddresses: () => Promise<void>;
  syncCart: () => Promise<void>;
  initCheckout: (type: 'custom' | 'marketplace', id?: string) => Promise<void>;
  addAddress: (newAddr: Omit<ShippingAddress, 'id'>) => Promise<ShippingAddress | null>;
  processPayment: (itemAddressIds: Record<string, string>) => Promise<void>;
}

const loadRazorpayScript = () =>
  new Promise((resolve) => {
    if (window.Razorpay) return resolve(true);
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });

let initialCart: CartEntry[] = [];
try {
  if (typeof window !== 'undefined') {
    const stored = localStorage.getItem('caliqui_cart');
    if (stored) initialCart = JSON.parse(stored);
  }
} catch (e) {
  console.warn('Failed to load cart', e);
}

export const useCheckoutStore = create<CheckoutState>((set, get) => ({
  cart: initialCart,
  savedAddresses: [],
  orderStatus: 'idle',
  lastOrderId: null,

  setOrderStatus: (status) => set({ orderStatus: status }),

  addToCart: (entry) => {
    set((state) => {
      const exists = state.cart.find((c) => c.productId === entry.productId);
      if (exists) return state;

      const newEntry: CartEntry = {
        ...entry,
        cartId: crypto.randomUUID(),
        sizes: { XS: 0, S: 0, M: 1, L: 0, XL: 0, XXL: 0 },
      };
      return { cart: [newEntry, ...state.cart] };
    });
  },

  updateCartItemQuantity: (cartId, size, delta) => {
    set((state) => ({
      cart: state.cart.map((item) => {
        if (item.cartId === cartId) {
          const currentQty = item.sizes[size] || 0;
          return {
            ...item,
            sizes: { ...item.sizes, [size]: Math.max(0, currentQty + delta) },
          };
        }
        return item;
      }),
    }));
  },

  removeFromCart: (cartId) => {
    set((state) => ({ cart: state.cart.filter((c) => c.cartId !== cartId) }));
  },

  clearCart: () => set({ cart: [] }),

  fetchAddresses: async () => {
    try {
      const {
        data: { user },
        error: authErr,
      } = await supabase.auth.getUser();
      if (authErr || !user) return;

      const { data: profile, error: profileErr } = await supabase
        .from('profiles')
        .select('saved_addresses, default_shipping_address, full_name')
        .eq('id', user.id)
        .single();

      if (profileErr) {
        console.error('Failed to fetch profile addresses:', profileErr);
        return;
      }

      if (profile) {
        let addresses: ShippingAddress[] = [];

        if (profile.saved_addresses) {
          if (Array.isArray(profile.saved_addresses)) {
            addresses = profile.saved_addresses;
          } else if (typeof profile.saved_addresses === 'string') {
            try {
              addresses = JSON.parse(profile.saved_addresses);
            } catch (e) {
              console.error('Failed to parse saved_addresses JSON', e);
            }
          }
        }

        if (addresses.length === 0 && profile.default_shipping_address?.address) {
          addresses = [
            {
              id: crypto.randomUUID(),
              label: 'Home',
              fullName: profile.full_name || '',
              phone: '',
              address: profile.default_shipping_address.address,
            },
          ];
        }

        set({ savedAddresses: addresses });
      }
    } catch (err) {
      console.error('Unexpected error fetching addresses:', err);
    }
  },

  syncCart: async () => {
    const { cart } = get();

    const marketplaceIds = cart.filter((c) => c.type === 'marketplace').map((c) => c.productId);
    const customIds = cart.filter((c) => c.type === 'custom').map((c) => c.productId);

    let freshMarketplace: FreshMarketplaceItem[] = [];
    let freshCustom: FreshCustomItem[] = [];

    try {
      if (marketplaceIds.length > 0) {
        const { data } = await supabase
          .from('marketplace_items')
          .select(
            'id, name, price, collection, discount_percentage, thumbnail_url, canvas_state, tshirt_color, apparel_model',
          )
          .in('id', marketplaceIds);
        if (data) freshMarketplace = data as FreshMarketplaceItem[];
      }

      if (customIds.length > 0) {
        const { data } = await supabase
          .from('designs')
          .select('id, name, thumbnail_url, canvas_state, tshirt_color, apparel_model')
          .in('id', customIds);
        if (data) freshCustom = data as FreshCustomItem[];
      }

      set((state) => ({
        cart: state.cart.map((cartItem) => {
          if (cartItem.type === 'marketplace') {
            const fresh = freshMarketplace.find((d) => d.id === cartItem.productId);
            if (!fresh) return cartItem;

            const discount = fresh.discount_percentage || 0;
            const currentPrice = discount > 0 ? fresh.price * (1 - discount / 100) : fresh.price;

            return {
              ...cartItem,
              name: fresh.name,
              collection: fresh.collection || 'Core Collection',
              thumbnail: fresh.thumbnail_url,
              price: Math.round(currentPrice),
              originalPrice: fresh.price,
              discountPercentage: discount,
              canvasState: fresh.canvas_state as Record<string, unknown>[],
              tshirtColor: fresh.tshirt_color || '#ffffff',
              apparelModel: fresh.apparel_model || 'tshirtman',
            };
          } else {
            const fresh = freshCustom.find((d) => d.id === cartItem.productId);
            if (!fresh) return cartItem;
            return {
              ...cartItem,
              name: fresh.name || 'Custom Studio Design',
              thumbnail: fresh.thumbnail_url,
              canvasState: fresh.canvas_state as Record<string, unknown>[],
              tshirtColor: fresh.tshirt_color || '#ffffff',
              apparelModel: fresh.apparel_model || 'tshirtman',
              price:
                1499 + (Array.isArray(fresh.canvas_state) ? fresh.canvas_state.length : 0) * 150,
            };
          }
        }),
      }));
    } catch (error) {
      console.error('Failed to sync cart data:', error);
    }
  },

  initCheckout: async (type, id) => {
    if (type === 'custom' && id) {
      const { data: design } = await supabase
        .from('designs')
        .select('name, thumbnail_url, canvas_state, tshirt_color, apparel_model')
        .eq('id', id)
        .single();

      if (design) {
        get().addToCart({
          type: 'custom',
          productId: id,
          name: design.name || 'Custom Studio Design',
          collection: 'Studio Custom',
          thumbnail: design.thumbnail_url,
          canvasState: design.canvas_state as Record<string, unknown>[],
          tshirtColor: design.tshirt_color || '#ffffff',
          apparelModel: design.apparel_model || 'tshirtman',
          price: 1499 + (design.canvas_state?.length || 0) * 150,
        });
      }
    } else if (type === 'marketplace' && id) {
      const { data: item } = await supabase
        .from('marketplace_items')
        .select(
          'name, thumbnail_url, price, collection, discount_percentage, canvas_state, tshirt_color, apparel_model',
        )
        .eq('id', id)
        .single();

      if (item) {
        const discount = item.discount_percentage || 0;
        const currentPrice = discount > 0 ? item.price * (1 - discount / 100) : item.price;

        get().addToCart({
          type: 'marketplace',
          productId: id,
          name: item.name,
          collection: item.collection || 'Core Collection',
          thumbnail: item.thumbnail_url,
          canvasState: item.canvas_state as Record<string, unknown>[],
          tshirtColor: item.tshirt_color || '#ffffff',
          apparelModel: item.apparel_model || 'tshirtman',
          price: Math.round(currentPrice),
          originalPrice: item.price,
          discountPercentage: discount,
        });
      }
    }
  },

  addAddress: async (newAddr) => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return null;

    const created: ShippingAddress = { id: crypto.randomUUID(), ...newAddr };
    const updatedAddresses = [...get().savedAddresses, created];

    set({ savedAddresses: updatedAddresses });

    const { error } = await supabase
      .from('profiles')
      .update({ saved_addresses: updatedAddresses })
      .eq('id', user.id);

    if (error) console.error('Failed to save address to database:', error);

    return created;
  },

  processPayment: async (itemAddressIds) => {
    set({ orderStatus: 'processing' });

    try {
      const { cart, savedAddresses } = get();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        set({ orderStatus: 'idle' });
        throw new Error('Authentication required');
      }

      const activeItems = cart.filter((item) => Object.values(item.sizes).some((qty) => qty > 0));

      // Removed Storage Logic & Promise.all entirely - completely synchronous now
      const processedItems = activeItems.map((item) => {
        const totalItemQty = Object.values(item.sizes).reduce((a, b) => a + b, 0);
        const specificAddress = savedAddresses.find((a) => a.id === itemAddressIds[item.cartId]);

        return {
          type: item.type,
          product_id: item.productId,
          name: item.name,
          print_file_path: null, // NO LONGER REQUIRED. Eliminated cloud dependency.
          sizes: item.sizes,
          quantity: totalItemQty,
          price: item.price,
          shipping_snapshot: specificAddress
            ? {
                address: specificAddress.address,
                phone: specificAddress.phone,
                label: specificAddress.label,
                customer_name: specificAddress.fullName,
              }
            : null,
        };
      });

      const totalAmount = processedItems.reduce((sum, item) => sum + item.price * item.quantity, 0);
      const totalQuantity = processedItems.reduce((sum, item) => sum + item.quantity, 0);

      const fallbackSnapshotId = Object.values(itemAddressIds)[0];
      const fallbackSnapshot = savedAddresses.find((a) => a.id === fallbackSnapshotId);

      const payload = {
        idempotency_key: crypto.randomUUID(),
        items: processedItems,
        quantity: totalQuantity,
        shipping_snapshot: fallbackSnapshot
          ? {
              address: fallbackSnapshot.address,
              phone: fallbackSnapshot.phone,
              label: fallbackSnapshot.label,
            }
          : null,
        customer_name: fallbackSnapshot?.fullName || user.email,
        total_amount: totalAmount,
      };

      const resDraft = await supabase.functions.invoke('create-order-draft', { body: payload });
      if (resDraft.error) throw resDraft.error;
      const draftOrder = resDraft.data;

      const resRzp = await supabase.functions.invoke('create-razorpay-order', {
        body: { order_id: draftOrder.id },
      });
      if (resRzp.error) throw resRzp.error;
      const rzpOrder = resRzp.data;

      const isLoaded = await loadRazorpayScript();
      if (!isLoaded || !window.Razorpay) throw new Error('Razorpay failed to load');

      const options: RazorpayOptions = {
        key: (import.meta.env.VITE_RAZORPAY_KEY_ID as string) || '',
        amount: rzpOrder.amount,
        currency: rzpOrder.currency,
        name: env.VITE_APP_NAME,
        description: `Order of ${totalQuantity} items`,
        order_id: rzpOrder.id,
        handler: (_response: unknown) => {
          set({ orderStatus: 'success', cart: [], lastOrderId: draftOrder.id });
        },
        prefill: {
          name: fallbackSnapshot?.fullName || '',
          email: user.email,
          contact: fallbackSnapshot?.phone || '',
        },
        theme: { color: '#000000' },
        modal: {
          ondismiss: () => {
            set({ orderStatus: 'idle' });
          },
        },
      };

      const rzp = new window.Razorpay(options);
      rzp.on('payment.failed', () => {
        set({ orderStatus: 'failed' });
      });
      rzp.open();
    } catch (error) {
      console.error('Checkout pipeline failed:', error);
      set({ orderStatus: 'failed' });
    }
  },
}));

let saveTimeout: ReturnType<typeof setTimeout>;
useCheckoutStore.subscribe((state) => {
  clearTimeout(saveTimeout);
  saveTimeout = setTimeout(() => {
    localStorage.setItem('caliqui_cart', JSON.stringify(state.cart));
  }, 500);
});
