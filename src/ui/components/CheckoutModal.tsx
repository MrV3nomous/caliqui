import { CheckCircle, CreditCard, Loader2, Package, X } from 'lucide-react';
import { useState } from 'react';
import { env } from '@/shared/env';
import { Button, IconButton, Input, Label } from '@/ui/design-system';
import { useCheckoutStore } from '@/ui/store/checkout-store';

export function CheckoutModal() {
  const { isCheckoutOpen, closeCheckout, orderStatus, processPayment, reset } = useCheckoutStore();
  const [size, setSize] = useState('L');

  if (!isCheckoutOpen) return null;

  const handleClose = () => {
    closeCheckout();
    setTimeout(reset, 300); // Reset after closing animation
  };

  const handleCheckout = async (e: React.FormEvent) => {
    e.preventDefault();
    await processPayment();
  };

  if (orderStatus === 'success') {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
        <div className="bg-surface border border-border rounded-xl shadow-2xl w-full max-w-sm overflow-hidden p-8 text-center space-y-4 animate-in zoom-in-95 duration-200">
          <div className="w-16 h-16 bg-green-500/20 text-green-500 rounded-full flex items-center justify-center mx-auto">
            <CheckCircle size={32} />
          </div>
          <h2 className="text-2xl font-bold text-primary">Order Confirmed!</h2>
          <p className="text-secondary text-sm">
            Your custom {env.VITE_APP_NAME} apparel is entering production. We'll email you the
            tracking details soon.
          </p>
          <Button variant="primary" className="w-full mt-4" onClick={handleClose}>
            Back to Studio
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-surface border border-border rounded-xl shadow-2xl w-full max-w-2xl overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col md:flex-row">
        {/* Left Side: Order Summary */}
        <div className="bg-background p-6 md:w-2/5 border-b md:border-b-0 md:border-r border-border">
          <h3 className="font-semibold text-primary flex items-center gap-2 mb-4">
            <Package size={18} /> Order Summary
          </h3>
          <div className="space-y-4">
            <div className="flex justify-between items-center bg-surface p-3 rounded-lg border border-border">
              <span className="text-sm font-medium">Custom T-Shirt</span>
              <span className="text-sm font-bold">$35.00</span>
            </div>

            <div className="space-y-1.5">
              <Label>Select Size</Label>
              <div className="flex gap-2">
                {['S', 'M', 'L', 'XL'].map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setSize(s)}
                    className={`flex-1 py-2 text-sm font-medium rounded-md border transition-colors ${
                      size === s
                        ? 'bg-primary text-primary-foreground border-primary'
                        : 'bg-surface border-border text-secondary hover:text-primary'
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>

            <div className="pt-4 border-t border-border space-y-2">
              <div className="flex justify-between text-sm text-secondary">
                <span>Subtotal</span>
                <span>$35.00</span>
              </div>
              <div className="flex justify-between text-sm text-secondary">
                <span>Shipping</span>
                <span>$5.00</span>
              </div>
              <div className="flex justify-between text-lg font-bold text-primary pt-2">
                <span>Total</span>
                <span>$40.00</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right Side: Shipping & Payment */}
        <div className="p-6 md:w-3/5">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-semibold text-primary">Checkout</h2>
            <IconButton onClick={handleClose} title="Close">
              <X size={20} />
            </IconButton>
          </div>

          <form onSubmit={handleCheckout} className="space-y-5">
            <div className="space-y-4">
              <h4 className="text-sm font-semibold text-secondary uppercase tracking-wider">
                Shipping
              </h4>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5 col-span-2">
                  <Label htmlFor="address">Full Address</Label>
                  <Input
                    id="address"
                    placeholder="123 Creator St, Design City"
                    required
                    disabled={orderStatus === 'processing'}
                  />
                </div>
              </div>
            </div>

            <div className="space-y-4 pt-2">
              <h4 className="text-sm font-semibold text-secondary uppercase tracking-wider">
                Payment
              </h4>
              <div className="space-y-1.5">
                <Label htmlFor="card">Card Details (Mock)</Label>
                <div className="relative">
                  <CreditCard
                    size={16}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-secondary"
                  />
                  <Input
                    id="card"
                    placeholder="4242 4242 4242 4242"
                    className="pl-9"
                    required
                    disabled={orderStatus === 'processing'}
                  />
                </div>
              </div>
            </div>

            <Button
              type="submit"
              variant="primary"
              className="w-full h-12 text-lg mt-4"
              disabled={orderStatus === 'processing'}
            >
              {orderStatus === 'processing' ? (
                <>
                  <Loader2 size={20} className="animate-spin mr-2" /> Processing Payment...
                </>
              ) : (
                `Pay $40.00`
              )}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
