import { create } from 'zustand';

interface CheckoutState {
  isCheckoutOpen: boolean;
  orderStatus: 'idle' | 'processing' | 'success';

  openCheckout: () => void;
  closeCheckout: () => void;
  processPayment: () => Promise<void>;
  reset: () => void;
}

export const useCheckoutStore = create<CheckoutState>((set) => ({
  isCheckoutOpen: false,
  orderStatus: 'idle',

  openCheckout: () => set({ isCheckoutOpen: true, orderStatus: 'idle' }),
  closeCheckout: () => set({ isCheckoutOpen: false }),

  processPayment: async () => {
    set({ orderStatus: 'processing' });
    // MOCK: Simulate a payment gateway delay (e.g., Stripe)
    await new Promise((resolve) => setTimeout(resolve, 2500));
    set({ orderStatus: 'success' });
  },

  reset: () => set({ orderStatus: 'idle', isCheckoutOpen: false }),
}));
