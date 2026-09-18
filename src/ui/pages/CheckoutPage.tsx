import { ArrowLeft, Check, Loader2, Minus, Plus, ShoppingBag, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { env } from '@/shared/env';
import { Mini3DViewer } from '@/ui/components/Mini3DViewer';
import { Input, Label } from '@/ui/design-system';
import { type ShippingAddress, useCheckoutStore } from '@/ui/store/checkout-store';

export function CheckoutPage() {
  const navigate = useNavigate();
  const {
    cart,
    savedAddresses,
    orderStatus,
    initCheckout,
    processPayment,
    updateCartItemQuantity,
    removeFromCart,
  } = useCheckoutStore();

  const [activeAddrId, setActiveAddrId] = useState<string | null>(null);
  const [isAddingNew, setIsAddingNew] = useState(false);

  const [newLabel, setNewLabel] = useState('Home');
  const [newFullName, setNewFullName] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newAddressStr, setNewAddressStr] = useState('');
  const [saveToAccount, setSaveToAccount] = useState(true);

  useEffect(() => {
    initCheckout('custom');
  }, [initCheckout]);

  useEffect(() => {
    if (savedAddresses.length > 0 && !activeAddrId) {
      setActiveAddrId(savedAddresses[0].id);
    }
  }, [savedAddresses, activeAddrId]);

  const totalQuantity = cart.reduce(
    (acc, item) => acc + Object.values(item.sizes).reduce((a, b) => a + b, 0),
    0,
  );

  const displayPrice = cart.reduce((sum, item) => {
    const qty = Object.values(item.sizes).reduce((a, b) => a + b, 0);
    return sum + item.price * qty;
  }, 0);

  const handleCheckoutSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (totalQuantity === 0) {
      alert('Please select at least one item size and quantity.');
      return;
    }

    let targetAddress: ShippingAddress;

    if (isAddingNew || savedAddresses.length === 0) {
      if (!newFullName.trim() || !newPhone.trim() || !newAddressStr.trim()) {
        alert('Please complete the new shipping address details.');
        return;
      }
      targetAddress = {
        id: crypto.randomUUID(),
        label: newLabel || 'Home',
        fullName: newFullName,
        phone: newPhone,
        address: newAddressStr,
      };
    } else {
      const found = savedAddresses.find((a) => a.id === activeAddrId);
      if (!found) {
        alert('Please select a delivery address.');
        return;
      }
      targetAddress = found;
    }

    await processPayment(
      targetAddress,
      (isAddingNew || savedAddresses.length === 0) && saveToAccount,
    );
  };

  return (
    <div className="w-full h-[100dvh] bg-[#fbfbfd] text-black font-sans flex flex-col selection:bg-neutral-200 overflow-hidden">
      <style>{`
        .hide-scrollbar::-webkit-scrollbar { display: none; }
      `}</style>

      <header className="h-16 md:h-20 bg-white/80 backdrop-blur-xl border-b border-black/5 flex items-center justify-between px-4 md:px-8 lg:px-16 shrink-0 z-50">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="inline-flex items-center gap-2 text-[10px] md:text-xs font-extrabold uppercase tracking-widest text-neutral-500 hover:text-black transition-colors outline-none"
        >
          <ArrowLeft size={16} /> <span className="hidden sm:inline">Return</span>
        </button>
        <Link to="/" className="hover:opacity-70 transition-opacity outline-none">
          <img
            src="/logo.png"
            alt={env.VITE_APP_NAME}
            className="h-6 sm:h-8 md:h-10 w-auto object-contain drop-shadow-sm"
          />
        </Link>
        <div className="w-16 md:w-24 flex justify-end">
          <div className="flex items-center gap-2 bg-black/5 px-3 py-1.5 rounded-full">
            <ShoppingBag size={14} className="text-black" />
            <span className="text-xs font-extrabold">{totalQuantity}</span>
          </div>
        </div>
      </header>

      <main className="flex-1 w-full max-w-[1400px] mx-auto p-4 sm:p-6 lg:p-10 flex flex-col lg:flex-row gap-8 lg:gap-12 lg:overflow-hidden overflow-y-auto">
        <div className="flex-1 flex flex-col gap-8 lg:overflow-y-auto hide-scrollbar lg:pb-24">
          <div className="space-y-4">
            <h2 className="text-[10px] md:text-sm font-extrabold uppercase tracking-widest text-neutral-400 pl-1">
              Your Cart
            </h2>

            {cart.length === 0 ? (
              <div className="bg-white rounded-[2rem] border border-black/5 p-12 text-center flex flex-col items-center shadow-sm">
                <ShoppingBag size={32} className="text-neutral-300 mb-4" />
                <p className="font-bold text-neutral-500 mb-6">Your cart is empty.</p>
                <Link
                  to="/marketplace"
                  className="px-6 py-3 bg-black text-white text-xs font-bold rounded-xl hover:bg-neutral-800 transition-colors outline-none"
                >
                  Continue Shopping
                </Link>
              </div>
            ) : (
              <div className="flex flex-col gap-4">
                {cart.map((item) => (
                  <div
                    key={item.cartId}
                    className="flex flex-col sm:flex-row gap-4 p-4 md:p-5 border border-black/5 bg-white rounded-3xl shadow-sm hover:shadow-md transition-shadow"
                  >
                    <div className="w-full sm:w-24 h-48 sm:h-24 md:w-32 md:h-32 bg-neutral-100 rounded-2xl relative shrink-0 overflow-hidden cursor-grab active:cursor-grabbing">
                      {item.type === 'custom' && item.canvasState ? (
                        <Mini3DViewer
                          canvasState={item.canvasState}
                          tshirtColor={item.tshirtColor || '#ffffff'}
                          apparelModel={item.apparelModel || 'tshirtman'}
                        />
                      ) : (
                        <img
                          src={item.thumbnail || ''}
                          alt={item.name}
                          className="w-full h-full object-cover mix-blend-multiply"
                        />
                      )}
                    </div>

                    <div className="flex-1 flex flex-col justify-between min-w-0 py-1">
                      <div className="flex justify-between items-start gap-2">
                        <div>
                          <h4 className="font-bold text-sm md:text-base truncate leading-tight">
                            {item.name}
                          </h4>
                          <p className="text-xs font-semibold text-neutral-500 mt-1">
                            ₹{item.price} each
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => removeFromCart(item.cartId)}
                          className="text-neutral-300 hover:text-red-500 transition-colors p-1 outline-none"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>

                      <div className="flex gap-2 overflow-x-auto hide-scrollbar pt-3">
                        {['S', 'M', 'L', 'XL', 'XXL'].map((size) => {
                          const qty = item.sizes[size] || 0;
                          return (
                            <div
                              key={size}
                              className={`flex items-center gap-1.5 rounded-xl p-1 px-1.5 shrink-0 transition-colors border ${qty > 0 ? 'bg-black text-white border-black' : 'bg-neutral-50 text-neutral-500 border-black/5'}`}
                            >
                              <span className="text-[10px] font-extrabold w-5 text-center">
                                {size}
                              </span>
                              <button
                                type="button"
                                onClick={() => updateCartItemQuantity(item.cartId, size, -1)}
                                disabled={qty === 0}
                                className="hover:opacity-70 disabled:opacity-30 outline-none"
                              >
                                <Minus size={12} strokeWidth={3} />
                              </button>
                              <span className="text-[11px] font-bold w-3 text-center">{qty}</span>
                              <button
                                type="button"
                                onClick={() => updateCartItemQuantity(item.cartId, size, 1)}
                                className="hover:opacity-70 outline-none"
                              >
                                <Plus size={12} strokeWidth={3} />
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {cart.length > 0 && (
            <div className="space-y-4 pt-4">
              <div className="flex items-center justify-between pl-1">
                <h3 className="text-[10px] md:text-sm font-extrabold uppercase tracking-widest text-neutral-400">
                  Delivery Address
                </h3>
                {savedAddresses.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setIsAddingNew(!isAddingNew)}
                    className="text-[10px] md:text-xs font-extrabold text-black underline underline-offset-4 hover:opacity-70 transition-opacity outline-none"
                  >
                    {isAddingNew ? 'Select Saved Address' : '+ Add New Address'}
                  </button>
                )}
              </div>

              <div className="bg-white p-5 md:p-6 rounded-[2rem] border border-black/5 shadow-sm">
                {!isAddingNew && savedAddresses.length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {savedAddresses.map((addr) => {
                      const isSelected = activeAddrId === addr.id;
                      return (
                        <button
                          type="button"
                          key={addr.id}
                          onClick={() => setActiveAddrId(addr.id)}
                          className={`p-4 rounded-2xl border-2 cursor-pointer transition-all flex flex-col justify-between text-left w-full outline-none ${isSelected ? 'border-black bg-black text-white shadow-md' : 'border-black/5 bg-neutral-50 text-black hover:border-black/20'}`}
                        >
                          <div className="flex items-center justify-between mb-3 w-full">
                            <span
                              className={`text-[9px] md:text-[10px] font-extrabold uppercase tracking-widest px-2.5 py-1 rounded-full ${isSelected ? 'bg-white/20 text-white' : 'bg-black/10 text-black'}`}
                            >
                              {addr.label}
                            </span>
                            {isSelected && <Check size={16} className="text-white" />}
                          </div>
                          <div className="w-full">
                            <p className="font-extrabold text-sm">{addr.fullName}</p>
                            <p
                              className={`text-[11px] md:text-xs mt-1 font-medium ${isSelected ? 'text-white/80' : 'text-neutral-500'}`}
                            >
                              {addr.address}
                            </p>
                            <p
                              className={`text-[11px] md:text-xs mt-1 font-semibold ${isSelected ? 'text-white/60' : 'text-neutral-400'}`}
                            >
                              Phone: {addr.phone}
                            </p>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <div className="space-y-4 animate-in fade-in duration-300">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <Label
                          htmlFor="newAddrLabel"
                          className="text-[10px] font-extrabold text-neutral-400 uppercase tracking-widest ml-1"
                        >
                          Address Label
                        </Label>
                        <Input
                          id="newAddrLabel"
                          value={newLabel}
                          onChange={(e) => setNewLabel(e.target.value)}
                          placeholder="e.g. Home, Office"
                          className="bg-neutral-50 rounded-xl h-12 font-semibold mt-1 outline-none"
                        />
                      </div>
                      <div>
                        <Label
                          htmlFor="newAddrName"
                          className="text-[10px] font-extrabold text-neutral-400 uppercase tracking-widest ml-1"
                        >
                          Recipient Name
                        </Label>
                        <Input
                          id="newAddrName"
                          value={newFullName}
                          onChange={(e) => setNewFullName(e.target.value)}
                          placeholder="Jane Doe"
                          className="bg-neutral-50 rounded-xl h-12 font-semibold mt-1 outline-none"
                        />
                      </div>
                      <div>
                        <Label
                          htmlFor="newAddrPhone"
                          className="text-[10px] font-extrabold text-neutral-400 uppercase tracking-widest ml-1"
                        >
                          Phone Number
                        </Label>
                        <Input
                          id="newAddrPhone"
                          value={newPhone}
                          onChange={(e) => setNewPhone(e.target.value)}
                          placeholder="+91 98765 43210"
                          className="bg-neutral-50 rounded-xl h-12 font-semibold mt-1 outline-none"
                        />
                      </div>
                      <div>
                        <Label
                          htmlFor="newAddrStr"
                          className="text-[10px] font-extrabold text-neutral-400 uppercase tracking-widest ml-1"
                        >
                          Complete Address
                        </Label>
                        <Input
                          id="newAddrStr"
                          value={newAddressStr}
                          onChange={(e) => setNewAddressStr(e.target.value)}
                          placeholder="123 Fashion Ave, Mumbai"
                          className="bg-neutral-50 rounded-xl h-12 font-semibold mt-1 outline-none"
                        />
                      </div>
                    </div>
                    <label className="flex items-center gap-2 cursor-pointer pt-2 w-max">
                      <input
                        type="checkbox"
                        checked={saveToAccount}
                        onChange={(e) => setSaveToAccount(e.target.checked)}
                        className="w-4 h-4 rounded text-black focus:ring-black border-black/20 outline-none"
                      />
                      <span className="text-xs font-semibold text-neutral-500">
                        Save this address to my profile address book
                      </span>
                    </label>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {cart.length > 0 && (
          <div className="w-full lg:w-[400px] xl:w-[440px] shrink-0 bg-white p-6 md:p-8 rounded-[2rem] border border-black/5 shadow-sm lg:h-max flex flex-col gap-6 mb-8 lg:mb-0">
            <h2 className="text-xs font-extrabold text-neutral-400 uppercase tracking-widest">
              Order Summary
            </h2>

            <div className="space-y-4 pb-6 border-b border-black/5">
              <div className="flex justify-between items-center text-sm font-bold text-neutral-600">
                <span>Subtotal ({totalQuantity} items)</span>
                <span>₹{displayPrice}</span>
              </div>
              <div className="flex justify-between items-center text-sm font-bold text-neutral-600">
                <span>Delivery</span>
                <span className="text-green-500">FREE</span>
              </div>
            </div>

            <div className="flex justify-between items-center pb-2">
              <span className="font-extrabold text-xl">Total</span>
              <span className="font-black text-2xl md:text-3xl">₹{displayPrice}</span>
            </div>

            <button
              type="button"
              onClick={handleCheckoutSubmit}
              disabled={orderStatus === 'processing' || totalQuantity === 0}
              className="w-full h-14 md:h-16 bg-black hover:bg-neutral-800 disabled:bg-neutral-300 text-white rounded-2xl text-sm md:text-base font-extrabold transition-all shadow-[0_12px_30px_rgba(0,0,0,0.15)] flex items-center justify-center outline-none"
            >
              {orderStatus === 'processing' ? (
                <>
                  <Loader2 size={20} className="animate-spin mr-2" /> Initializing Gateway...
                </>
              ) : (
                'Proceed to Payment'
              )}
            </button>
          </div>
        )}
      </main>
    </div>
  );
}
