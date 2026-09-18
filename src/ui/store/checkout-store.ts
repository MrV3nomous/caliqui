import { create } from 'zustand';
import { env } from '@/shared/env';
import { supabase } from '@/shared/lib/supabase';
import { generatePrintFile } from '@/shared/utils/export-engine';
import type { DecalData } from '@/ui/store/editor-store';

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
  sizes: Record<string, number>;
  canvasState?: Record<string, unknown>[];
  tshirtColor?: string;
  apparelModel?: string;
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
  orderStatus: 'idle' | 'processing' | 'success';

  addToCart: (entry: Omit<CartEntry, 'cartId' | 'sizes'>) => void;
  updateCartItemQuantity: (cartId: string, size: string, delta: number) => void;
  removeFromCart: (cartId: string) => void;
  clearCart: () => void;

  initCheckout: (type: 'custom' | 'marketplace', id?: string) => Promise<void>;
  addAddress: (newAddr: Omit<ShippingAddress, 'id'>) => Promise<ShippingAddress | null>;
  processPayment: (addressObj: ShippingAddress, saveAddress: boolean) => Promise<void>;
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

// Load persistent cart
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

  addToCart: (entry) => {
    set((state) => {
      // Prevent exact duplicates, just navigate if already in cart
      const exists = state.cart.find((c) => c.productId === entry.productId);
      if (exists) return state;

      const newEntry: CartEntry = {
        ...entry,
        cartId: crypto.randomUUID(),
        sizes: { S: 0, M: 1, L: 0, XL: 0, XXL: 0 },
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

  initCheckout: async (type, id) => {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (user) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('saved_addresses, default_shipping_address, full_name, phone')
        .eq('id', user.id)
        .single();

      if (profile) {
        let addresses: ShippingAddress[] = profile.saved_addresses || [];
        if (addresses.length === 0 && profile.default_shipping_address?.address) {
          addresses = [
            {
              id: crypto.randomUUID(),
              label: 'Home',
              fullName: profile.full_name || '',
              phone: profile.phone || '',
              address: profile.default_shipping_address.address,
            },
          ];
        }
        set({ savedAddresses: addresses });
      }

      // If triggered from the Editor's "Order" button
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
            thumbnail: design.thumbnail_url,
            canvasState: design.canvas_state as Record<string, unknown>[],
            tshirtColor: design.tshirt_color || '#ffffff',
            apparelModel: design.apparel_model || 'tshirtman',
            price: 1499 + (design.canvas_state?.length || 0) * 150,
          });
        }
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
    await supabase.from('profiles').update({ saved_addresses: updatedAddresses }).eq('id', user.id);
    return created;
  },

  processPayment: async (addressObj, saveAddress) => {
    set({ orderStatus: 'processing' });

    try {
      const { cart, addAddress, savedAddresses } = get();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) throw new Error('Authentication required');

      if (saveAddress && addressObj) {
        const exists = savedAddresses.some((a) => a.address === addressObj.address);
        if (!exists) await addAddress(addressObj);
      }

      const activeItems = cart.filter((item) => Object.values(item.sizes).some((qty) => qty > 0));

      // Generate print files for ALL custom designs in the cart!
      const processedItems = await Promise.all(
        activeItems.map(async (item) => {
          let printFilePath = null;
          if (item.type === 'custom' && item.canvasState) {
            const blob = await generatePrintFile(item.canvasState as unknown as DecalData[]);
            const fileName = `${user.id}/${crypto.randomUUID()}.png`;
            const { error: uploadError } = await supabase.storage
              .from('print_files')
              .upload(fileName, blob, { contentType: 'image/png' });
            if (uploadError) throw uploadError;
            printFilePath = fileName;
          }

          const totalItemQty = Object.values(item.sizes).reduce((a, b) => a + b, 0);

          return {
            type: item.type,
            product_id: item.productId,
            name: item.name,
            print_file_path: printFilePath,
            sizes: item.sizes,
            quantity: totalItemQty,
            price: item.price,
          };
        }),
      );

      const totalAmount = processedItems.reduce((sum, item) => sum + item.price * item.quantity, 0);
      const totalQuantity = processedItems.reduce((sum, item) => sum + item.quantity, 0);

      const payload = {
        idempotency_key: crypto.randomUUID(),
        // Multi-item payload array
        items: processedItems,
        // Legacy fallback fields for safety
        design_id: processedItems[0]?.type === 'custom' ? processedItems[0].product_id : undefined,
        marketplace_item_id:
          processedItems[0]?.type === 'marketplace' ? processedItems[0].product_id : undefined,
        quantity: totalQuantity,
        shipping_snapshot: {
          address: addressObj.address,
          phone: addressObj.phone,
          label: addressObj.label,
        },
        customer_name: addressObj.fullName,
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
          set({ orderStatus: 'success', cart: [] }); // Clear cart on success!
          window.location.href = '/dashboard?success=true';
        },
        prefill: {
          name: addressObj.fullName,
          email: user.email,
          contact: addressObj.phone,
        },
        theme: { color: '#000000' },
        modal: { ondismiss: () => set({ orderStatus: 'idle' }) },
      };

      const rzp = new window.Razorpay(options);
      rzp.on('payment.failed', () => set({ orderStatus: 'idle' }));
      rzp.open();
    } catch (error) {
      console.error('Checkout pipeline failed:', error);
      alert('An error occurred while preparing your checkout. Please try again.');
      set({ orderStatus: 'idle' });
    }
  },
}));

// Automatically persist cart to local storage
let saveTimeout: ReturnType<typeof setTimeout>;
useCheckoutStore.subscribe((state) => {
  clearTimeout(saveTimeout);
  saveTimeout = setTimeout(() => {
    localStorage.setItem('caliqui_cart', JSON.stringify(state.cart));
  }, 500);
});
