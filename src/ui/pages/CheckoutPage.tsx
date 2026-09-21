import {
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  ChevronDown,
  Loader2,
  Lock,
  MapPin,
  ShoppingBag,
  Trash2,
  XCircle,
} from 'lucide-react';
import type React from 'react';
import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { env } from '@/shared/env';
import { AuthModal } from '@/ui/components/AuthModal';
import { Mini3DViewer } from '@/ui/components/Mini3DViewer';
import { Input } from '@/ui/design-system';
import { useAuthStore } from '@/ui/store/auth-store';
import { useCheckoutStore } from '@/ui/store/checkout-store';

function ItemAddressWidget({
  cartId: _cartId,
  selectedId,
  onSelect,
  onApplyToAll,
}: {
  cartId: string;
  selectedId: string | null;
  onSelect: (id: string) => void;
  onApplyToAll: (addrId: string) => void;
}) {
  const { savedAddresses, addAddress } = useCheckoutStore();
  const { isAuthenticated, openAuthModal } = useAuthStore();

  const [isOpen, setIsOpen] = useState(false);
  const [isAddingNew, setIsAddingNew] = useState(false);
  const [applyAll, setApplyAll] = useState(true);

  const [newLabel, setNewLabel] = useState('Home');
  const [newFullName, setNewFullName] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newAddressStr, setNewAddressStr] = useState('');

  const dropdownRef = useRef<HTMLDivElement>(null);
  const selectedAddr = savedAddresses.find((a) => a.id === selectedId);

  // Close dropdown on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setIsAddingNew(false);
      }
    }
    if (isOpen) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const handleSaveNew = async () => {
    if (!isAuthenticated) return openAuthModal();
    if (!newFullName.trim() || !newPhone.trim() || !newAddressStr.trim()) {
      alert('Please fill out all address fields.');
      return;
    }
    const created = await addAddress({
      label: newLabel || 'Home',
      fullName: newFullName,
      phone: newPhone,
      address: newAddressStr,
    });
    if (created) {
      onSelect(created.id);
      if (applyAll) onApplyToAll(created.id);
      setIsAddingNew(false);
      setIsOpen(false);
    }
  };

  return (
    <div className="mt-6 pt-5 border-t border-black/[0.04] relative" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="group flex items-center gap-2.5 px-3.5 py-2 bg-[#fbfbfd] border border-black/5 hover:border-black/20 rounded-full transition-colors outline-none w-max max-w-full"
      >
        <MapPin size={12} className="text-black shrink-0" />
        <span className="text-[10px] font-bold uppercase tracking-widest text-neutral-500 shrink-0">
          Deliver To:
        </span>
        <span className="text-xs font-semibold text-black truncate max-w-[120px] sm:max-w-[200px]">
          {selectedAddr ? selectedAddr.label : 'Select Address'}
        </span>
        <ChevronDown
          size={14}
          className={`text-neutral-400 shrink-0 transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`}
        />
      </button>

      {/* Floating Dropdown - Absolute positioned to avoid layout jumping */}
      {isOpen && (
        <div className="absolute top-[calc(100%+8px)] left-0 w-[280px] sm:w-[320px] bg-white border border-black/10 rounded-2xl shadow-2xl z-50 p-4 animate-in zoom-in-95 duration-200">
          <label className="flex items-center gap-2.5 mb-4 cursor-pointer group w-max">
            <div
              className={`w-4 h-4 rounded-[4px] border flex items-center justify-center transition-colors ${applyAll ? 'bg-black border-black text-white' : 'bg-white border-black/20 group-hover:border-black/40 text-transparent'}`}
            >
              <Check size={10} strokeWidth={3} />
            </div>
            <input
              type="checkbox"
              checked={applyAll}
              onChange={(e) => setApplyAll(e.target.checked)}
              className="hidden"
            />
            <span className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest">
              Use this address for all orders
            </span>
          </label>

          {!isAddingNew ? (
            <div className="flex flex-col gap-3">
              {savedAddresses.length > 0 ? (
                savedAddresses.map((addr) => {
                  const isSelected = selectedId === addr.id;
                  return (
                    <button
                      key={addr.id}
                      type="button"
                      onClick={(e) => {
                        if (!isAuthenticated) {
                          e.preventDefault();
                          return openAuthModal();
                        }
                        onSelect(addr.id);
                        if (applyAll) onApplyToAll(addr.id);
                        setIsOpen(false);
                      }}
                      className={`text-left p-3.5 rounded-xl border transition-all outline-none ${isSelected ? 'border-black bg-black text-white shadow-md' : 'border-black/5 hover:border-black/20 bg-[#fbfbfd] text-black'}`}
                    >
                      <div className="flex justify-between items-center mb-1">
                        <span
                          className={`text-[9px] font-bold uppercase tracking-widest ${isSelected ? 'text-white/80' : 'text-neutral-500'}`}
                        >
                          {addr.label}
                        </span>
                        {isSelected && <Check size={14} strokeWidth={3} />}
                      </div>
                      <p className="text-xs font-semibold truncate">{addr.fullName}</p>
                      <p
                        className={`text-[10px] mt-0.5 truncate ${isSelected ? 'text-white/70' : 'text-neutral-400'}`}
                      >
                        {addr.address}
                      </p>
                    </button>
                  );
                })
              ) : (
                <p className="text-xs text-neutral-500 text-center py-4">
                  No saved addresses found.
                </p>
              )}

              <button
                type="button"
                onClick={() => setIsAddingNew(true)}
                className="mt-2 w-full py-3 text-[10px] font-bold uppercase tracking-widest text-black underline underline-offset-4 hover:opacity-60 transition-opacity outline-none"
              >
                + Add New Address
              </button>
            </div>
          ) : (
            <div className="space-y-3 animate-in fade-in duration-300">
              <Input
                value={newLabel}
                onChange={(e) => setNewLabel(e.target.value)}
                placeholder="Label (e.g. Home, Office)"
                className="bg-[#fbfbfd] rounded-xl h-10 text-xs outline-none focus:border-black/20 focus:ring-4 focus:ring-black/5 transition-all"
              />
              <Input
                value={newFullName}
                onChange={(e) => setNewFullName(e.target.value)}
                placeholder="Recipient Full Name"
                className="bg-[#fbfbfd] rounded-xl h-10 text-xs outline-none focus:border-black/20 focus:ring-4 focus:ring-black/5 transition-all"
              />
              <Input
                value={newPhone}
                onChange={(e) => setNewPhone(e.target.value)}
                placeholder="Phone Number"
                className="bg-[#fbfbfd] rounded-xl h-10 text-xs outline-none focus:border-black/20 focus:ring-4 focus:ring-black/5 transition-all"
              />
              <Input
                value={newAddressStr}
                onChange={(e) => setNewAddressStr(e.target.value)}
                placeholder="Complete Address"
                className="bg-[#fbfbfd] rounded-xl h-10 text-xs outline-none focus:border-black/20 focus:ring-4 focus:ring-black/5 transition-all"
              />
              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsAddingNew(false)}
                  className="flex-1 h-10 bg-neutral-100 text-black text-[10px] font-bold uppercase tracking-widest rounded-xl hover:bg-neutral-200 transition-colors outline-none"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSaveNew}
                  className="flex-1 h-10 bg-black text-white text-[10px] font-bold uppercase tracking-widest rounded-xl hover:bg-neutral-800 transition-colors outline-none shadow-sm"
                >
                  Save
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function CheckoutPage() {
  const navigate = useNavigate();
  const { isAuthenticated, openAuthModal } = useAuthStore();
  const {
    cart,
    savedAddresses,
    orderStatus,
    lastOrderId,
    setOrderStatus,
    fetchAddresses,
    initCheckout,
    processPayment,
    updateCartItemQuantity,
    removeFromCart,
    syncCart,
  } = useCheckoutStore();

  const [itemAddrIds, setItemAddrIds] = useState<Record<string, string>>({});

  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isLongPress = useRef(false);

  // 1. Initialize checkout, fetch addresses, and hydrate cart unconditionally on mount
  useEffect(() => {
    initCheckout('custom');
    fetchAddresses();
    syncCart();
  }, [initCheckout, fetchAddresses, syncCart]);

  // 2. Fallback refetch if the user logs in dynamically while the page is open
  useEffect(() => {
    if (isAuthenticated) {
      fetchAddresses();
    }
  }, [isAuthenticated, fetchAddresses]);

  // Auto-Populate First Saved Address Across Cart
  useEffect(() => {
    if (savedAddresses.length > 0 && cart.length > 0) {
      setItemAddrIds((prev) => {
        const next = { ...prev };
        let modified = false;
        cart.forEach((item) => {
          if (!next[item.cartId] || !savedAddresses.some((a) => a.id === next[item.cartId])) {
            next[item.cartId] = savedAddresses[0].id;
            modified = true;
          }
        });
        return modified ? next : prev;
      });
    }
  }, [savedAddresses, cart]);

  const totalQuantity = cart.reduce(
    (acc, item) => acc + Object.values(item.sizes).reduce((a, b) => a + b, 0),
    0,
  );

  const displayPrice = cart.reduce((sum, item) => {
    const qty = Object.values(item.sizes).reduce((a, b) => a + b, 0);
    return sum + item.price * qty;
  }, 0);

  // --- Solid Touch & Click Engine ---
  const handleTouchStart = (cartId: string, size: string) => {
    isLongPress.current = false;
    longPressTimer.current = setTimeout(() => {
      isLongPress.current = true;
      updateCartItemQuantity(cartId, size, -1);
      if (navigator.vibrate) navigator.vibrate(50);
    }, 500);
  };

  const handleTouchEnd = () => {
    if (longPressTimer.current) clearTimeout(longPressTimer.current);
  };

  const handleSizeClick = (
    e: React.MouseEvent | React.TouchEvent,
    cartId: string,
    size: string,
  ) => {
    e.preventDefault();
    if (isLongPress.current) {
      isLongPress.current = false;
      return;
    }
    updateCartItemQuantity(cartId, size, 1);
  };

  const handleSizeRightClick = (e: React.MouseEvent, cartId: string, size: string) => {
    e.preventDefault();
    updateCartItemQuantity(cartId, size, -1);
  };

  const handleApplyToAll = (addressId: string) => {
    const updated: Record<string, string> = {};
    cart.forEach((item) => {
      updated[item.cartId] = addressId;
    });
    setItemAddrIds(updated);
  };
  // ----------------------------------

  const handleCheckoutSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!isAuthenticated) return openAuthModal();
    if (totalQuantity === 0)
      return alert('Your cart items have zero quantity. Please add sizes before checking out.');

    const activeItems = cart.filter((item) => Object.values(item.sizes).some((q) => q > 0));
    for (const item of activeItems) {
      const addrId = itemAddrIds[item.cartId];
      if (!addrId) return alert(`Please select a delivery address for ${item.name}`);
      const found = savedAddresses.find((a) => a.id === addrId);
      if (!found) return alert(`Selected address not found for ${item.name}`);
    }

    await processPayment(itemAddrIds);
  };

  // --- LUXURY SUCCESS STATE ---
  if (orderStatus === 'success') {
    return (
      <div className="w-full min-h-dvh overflow-y-auto bg-[#fbfbfd] text-black font-sans flex flex-col items-center justify-center p-4 sm:p-6 selection:bg-neutral-200 select-none">
        <div className="max-w-md w-full bg-white rounded-[2.5rem] p-8 sm:p-12 shadow-[0_20px_60px_rgba(0,0,0,0.08)] text-center animate-in zoom-in-95 duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] border border-black/[0.04]">
          <div className="w-20 h-20 bg-green-50 rounded-full flex items-center justify-center mx-auto mb-8 border border-green-100 shadow-inner">
            <CheckCircle2 size={32} className="text-green-500" strokeWidth={2.5} />
          </div>
          <h1 className="text-3xl font-light tracking-tight mb-3 text-black">Order Confirmed</h1>
          <p className="text-sm font-light text-neutral-500 leading-relaxed mb-8">
            Thank you for your purchase. We have received your order and will begin processing it
            immediately.
          </p>
          <div className="bg-[#fbfbfd] rounded-2xl p-5 mb-10 border border-black/[0.04] shadow-sm">
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-neutral-400 mb-1.5">
              Order Reference
            </p>
            <p className="font-mono text-sm font-semibold tracking-widest text-black">
              {lastOrderId?.toUpperCase().split('-')[0] || 'PROCESSING...'}
            </p>
          </div>
          <div className="flex flex-col gap-3">
            <Link
              to="/marketplace"
              onClick={() => setOrderStatus('idle')}
              className="w-full h-14 bg-black hover:bg-neutral-800 text-white rounded-2xl font-bold text-[11px] uppercase tracking-[0.2em] flex items-center justify-center transition-all shadow-[0_8px_20px_rgba(0,0,0,0.12)] outline-none"
            >
              Continue Shopping
            </Link>
            <Link
              to="/editor"
              onClick={() => setOrderStatus('idle')}
              className="w-full h-14 bg-white hover:bg-neutral-50 border border-black/10 text-black rounded-2xl font-bold text-[11px] uppercase tracking-[0.2em] flex items-center justify-center transition-colors outline-none"
            >
              Return to Studio
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // --- LUXURY FAILED STATE ---
  if (orderStatus === 'failed') {
    return (
      <div className="w-full min-h-dvh overflow-y-auto bg-[#fbfbfd] text-black font-sans flex flex-col items-center justify-center p-4 sm:p-6 selection:bg-neutral-200 select-none">
        <div className="max-w-md w-full bg-white rounded-[2.5rem] p-8 sm:p-12 shadow-[0_20px_60px_rgba(0,0,0,0.08)] text-center animate-in zoom-in-95 duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] border border-black/[0.04]">
          <div className="w-20 h-20 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-8 border border-red-100 shadow-inner">
            <XCircle size={32} className="text-red-500" strokeWidth={2.5} />
          </div>
          <h1 className="text-3xl font-light tracking-tight mb-3 text-black">Payment Failed</h1>
          <p className="text-sm font-light text-neutral-500 leading-relaxed mb-10">
            We couldn't process your payment. No charges were made. Please check your payment
            details and try again.
          </p>
          <div className="flex flex-col gap-3">
            <button
              type="button"
              onClick={() => setOrderStatus('idle')}
              className="w-full h-14 bg-black hover:bg-neutral-800 text-white rounded-2xl font-bold text-[11px] uppercase tracking-[0.2em] flex items-center justify-center transition-all shadow-[0_8px_20px_rgba(0,0,0,0.12)] outline-none"
            >
              Try Again
            </button>
            <button
              type="button"
              onClick={() => {
                setOrderStatus('idle');
                navigate('/');
              }}
              className="w-full h-14 bg-white hover:bg-neutral-50 border border-black/10 text-black rounded-2xl font-bold text-[11px] uppercase tracking-[0.2em] flex items-center justify-center transition-colors outline-none"
            >
              Return to Home
            </button>
          </div>
        </div>
      </div>
    );
  }

  // --- CHECKOUT UI ---
  return (
    // Explicit overflow-y-auto forces this specific container to handle scrolling, bypassing parent blocks.
    <div className="w-full h-dvh overflow-y-auto overflow-x-hidden bg-white text-black font-sans flex flex-col selection:bg-neutral-200 select-none">
      {/* LUXURY HEADER */}
      <header className="h-[70px] bg-white/95 backdrop-blur-xl border-b border-black/[0.04] flex items-center justify-between px-5 lg:px-12 shrink-0 z-40 sticky top-0">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="inline-flex items-center gap-2 text-[10px] md:text-xs font-bold uppercase tracking-[0.15em] text-neutral-400 hover:text-black transition-colors outline-none"
        >
          <ArrowLeft size={16} strokeWidth={1.5} /> <span className="hidden sm:inline">Return</span>
        </button>
        <Link to="/" className="hover:opacity-60 transition-opacity outline-none">
          <img
            src="/logo.png"
            alt={env.VITE_APP_NAME}
            className="h-5 sm:h-6 w-auto object-contain"
          />
        </Link>
        <div className="flex items-center gap-2 text-neutral-400">
          <Lock size={14} strokeWidth={1.5} />
          <span className="text-[10px] font-bold uppercase tracking-[0.2em] hidden sm:inline">
            Secure Checkout
          </span>
        </div>
      </header>

      {/* Main Container - Responsive Stack */}
      <main className="flex-1 w-full max-w-[1200px] mx-auto p-4 sm:p-6 lg:p-12 flex flex-col lg:flex-row gap-8 lg:gap-16 items-start bg-white">
        {/* LEFT COLUMN: CART ITEMS */}
        <div className="flex-1 w-full flex flex-col gap-6 lg:gap-8 pb-10 min-w-0">
          <div className="flex items-center justify-between border-b border-black/[0.04] pb-4 sm:pb-6">
            <h1 className="text-2xl sm:text-3xl font-light tracking-tight text-black">Your Bag</h1>
            <span className="text-[11px] font-medium tracking-[0.2em] text-neutral-400 uppercase">
              {totalQuantity} {totalQuantity === 1 ? 'Item' : 'Items'}
            </span>
          </div>

          {cart.length === 0 ? (
            <div className="py-24 text-center flex flex-col items-center animate-in fade-in duration-700">
              <ShoppingBag size={48} strokeWidth={1} className="text-neutral-200 mb-6" />
              <h2 className="text-xl font-light tracking-tight mb-4">Your bag is empty</h2>
              <p className="text-sm font-light text-neutral-400 mb-10 max-w-sm">
                Discover our latest releases and premium essentials.
              </p>
              <Link
                to="/marketplace"
                className="h-14 px-10 bg-black text-white text-[11px] uppercase tracking-[0.2em] font-bold rounded-full hover:bg-neutral-800 transition-colors outline-none flex items-center justify-center shadow-lg hover:shadow-xl hover:-translate-y-0.5 duration-300"
              >
                Continue Shopping
              </Link>
            </div>
          ) : (
            <div className="flex flex-col gap-6 sm:gap-8 animate-in slide-in-from-bottom-8 fade-in duration-700 ease-out">
              {cart.map((item) => {
                const itemTotalQty = Object.values(item.sizes).reduce((a, b) => a + b, 0);

                return (
                  <div
                    key={item.cartId}
                    className="flex flex-col bg-white p-4 sm:p-6 rounded-[2rem] shadow-sm border border-black/[0.04]"
                  >
                    <div className="flex flex-col sm:flex-row gap-5 sm:gap-6 group">
                      {/* Media Showcase - Strictly constrained width on mobile */}
                      <div className="w-24 h-32 sm:w-36 sm:h-48 bg-[#fbfbfd] rounded-2xl sm:rounded-3xl overflow-hidden shrink-0 flex items-center justify-center border border-black/[0.04] cursor-grab active:cursor-grabbing relative">
                        {item.canvasState && item.canvasState.length > 0 ? (
                          <div className="absolute inset-0 w-full h-full pointer-events-auto mix-blend-multiply p-2 sm:p-4 transition-transform duration-700 group-hover:scale-105">
                            <Mini3DViewer
                              canvasState={item.canvasState}
                              tshirtColor={item.tshirtColor || '#ffffff'}
                              apparelModel={item.apparelModel || 'tshirtman'}
                            />
                          </div>
                        ) : (
                          <img
                            src={item.thumbnail || ''}
                            alt={item.name}
                            className="absolute inset-0 w-full h-full object-contain mix-blend-multiply p-4 transition-transform duration-700 group-hover:scale-105"
                          />
                        )}
                      </div>

                      <div className="flex-1 flex flex-col justify-start min-w-0">
                        <div className="flex justify-between items-start gap-4 mb-4">
                          <div className="min-w-0 flex-1 pr-2">
                            <h4 className="font-medium text-base sm:text-xl tracking-tight text-black leading-tight truncate">
                              {item.name}
                            </h4>
                            <p className="text-[9px] sm:text-[10px] font-bold text-neutral-400 uppercase tracking-[0.2em] mt-1.5 truncate">
                              {item.collection ||
                                (item.type === 'marketplace'
                                  ? 'Collection Piece'
                                  : 'Studio Custom')}
                            </p>
                          </div>

                          <div className="flex flex-col items-end gap-1 shrink-0">
                            <div className="flex items-center">
                              {item.originalPrice && item.originalPrice > item.price && (
                                <span className="text-[10px] sm:text-xs font-medium text-neutral-400 line-through mr-1.5">
                                  ₹
                                  {(
                                    item.originalPrice * (itemTotalQty === 0 ? 1 : itemTotalQty)
                                  ).toLocaleString('en-IN')}
                                </span>
                              )}
                              <span className="text-sm sm:text-base font-medium tracking-wider text-black">
                                ₹
                                {(
                                  item.price * (itemTotalQty === 0 ? 1 : itemTotalQty)
                                ).toLocaleString('en-IN')}
                              </span>
                            </div>
                            {item.discountPercentage && item.discountPercentage > 0 ? (
                              <span className="text-[8px] sm:text-[9px] font-bold text-red-500 bg-red-50 px-2 py-0.5 rounded border border-red-100 uppercase tracking-widest mt-0.5">
                                -{item.discountPercentage}% OFF
                              </span>
                            ) : null}
                          </div>
                        </div>

                        {/* Immutable Size Selector Grid */}
                        <div className="mb-2">
                          <p className="text-[9px] font-bold uppercase tracking-widest text-neutral-400 mb-3">
                            Select Sizes
                          </p>
                          <div className="flex flex-wrap gap-2 w-full">
                            {['XS', 'S', 'M', 'L', 'XL', 'XXL'].map((size) => {
                              const qty = item.sizes[size] || 0;
                              return (
                                <button
                                  key={size}
                                  type="button"
                                  onClick={(e) => handleSizeClick(e, item.cartId, size)}
                                  onContextMenu={(e) => handleSizeRightClick(e, item.cartId, size)}
                                  onTouchStart={() => handleTouchStart(item.cartId, size)}
                                  onTouchEnd={handleTouchEnd}
                                  onTouchCancel={handleTouchEnd}
                                  className={`relative w-11 h-11 shrink-0 rounded-full flex items-center justify-center text-[10px] sm:text-xs font-bold transition-all outline-none touch-none select-none
                                    ${
                                      qty > 0
                                        ? 'bg-black text-white shadow-md'
                                        : 'bg-white border border-black/10 text-neutral-400 hover:border-black hover:text-black'
                                    }
                                  `}
                                >
                                  {size}
                                  {qty > 0 && (
                                    <span className="absolute -top-1 -right-1 w-4 h-4 bg-white border border-black/10 text-black rounded-full flex items-center justify-center text-[9px] shadow-sm font-extrabold animate-in zoom-in">
                                      {qty}
                                    </span>
                                  )}
                                </button>
                              );
                            })}
                          </div>
                          <p className="text-[9px] text-neutral-400 mt-3 font-medium">
                            <span className="hidden sm:inline">
                              Left-click to add. Right-click to remove.
                            </span>
                            <span className="inline sm:hidden">
                              Tap to add. Press & hold to remove.
                            </span>
                          </p>
                        </div>

                        <div className="mt-auto pt-4 flex items-center justify-between">
                          <button
                            type="button"
                            onClick={() => removeFromCart(item.cartId)}
                            className="text-[9px] font-bold uppercase tracking-[0.2em] text-neutral-400 hover:text-red-500 transition-colors flex items-center gap-1.5 outline-none"
                          >
                            <Trash2 size={12} strokeWidth={1.5} />
                            Remove Item
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Per-Item Address Widget - Compact and absolute dropdown */}
                    <ItemAddressWidget
                      cartId={item.cartId}
                      selectedId={itemAddrIds[item.cartId] || null}
                      onSelect={(id) => setItemAddrIds((prev) => ({ ...prev, [item.cartId]: id }))}
                      onApplyToAll={handleApplyToAll}
                    />
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* RIGHT COLUMN: SLIM ORDER SUMMARY ONLY */}
        {cart.length > 0 && (
          <div className="w-full lg:w-[320px] xl:w-[360px] shrink-0 animate-in fade-in slide-in-from-bottom-12 duration-700 ease-out delay-150 pb-10">
            {/* Sticky works perfectly now because the parent container is scrolling */}
            <div className="bg-[#fbfbfd] border border-black/[0.04] rounded-[2.5rem] p-6 sm:p-8 lg:sticky lg:top-[10px] shadow-[0_8px_30px_rgba(0,0,0,0.02)]">
              <h2 className="text-lg font-light tracking-tight mb-6 sm:mb-8 text-black">
                Order Summary
              </h2>

              <div className="space-y-4 sm:space-y-5 text-sm mb-6 sm:mb-8 border-b border-black/[0.04] pb-6 sm:pb-8">
                <div className="flex justify-between items-center text-neutral-500">
                  <span className="font-light tracking-wide">Subtotal</span>
                  <span className="font-medium tracking-wider text-black">
                    ₹{displayPrice.toLocaleString('en-IN')}
                  </span>
                </div>
                <div className="flex justify-between items-center text-neutral-500">
                  <span className="font-light tracking-wide">Shipping</span>
                  <span className="font-bold tracking-widest text-[9px] uppercase text-black bg-black/5 px-2 py-1 rounded-md">
                    Complimentary
                  </span>
                </div>
                <div className="flex justify-between items-center text-neutral-500">
                  <span className="font-light tracking-wide">Taxes</span>
                  <span className="font-bold tracking-widest text-[9px] uppercase text-black bg-black/5 px-2 py-1 rounded-md">
                    Included
                  </span>
                </div>
              </div>

              <div className="flex justify-between items-end mb-8">
                <span className="text-[10px] font-bold tracking-[0.2em] uppercase text-neutral-400">
                  Total
                </span>
                <span className="text-2xl sm:text-3xl font-light tracking-tight text-black">
                  ₹{displayPrice.toLocaleString('en-IN')}
                </span>
              </div>

              <button
                type="button"
                onClick={handleCheckoutSubmit}
                disabled={orderStatus === 'processing' || totalQuantity === 0}
                className="w-full h-14 bg-black hover:bg-neutral-800 disabled:bg-neutral-200 disabled:text-neutral-400 text-white rounded-2xl font-bold text-[11px] uppercase tracking-[0.2em] flex items-center justify-center transition-all shadow-[0_8px_20px_rgba(0,0,0,0.12)] outline-none group"
              >
                {orderStatus === 'processing' ? (
                  <span className="flex items-center gap-2">
                    <Loader2 size={16} className="animate-spin" strokeWidth={2} /> Processing...
                  </span>
                ) : isAuthenticated ? (
                  <span className="flex items-center gap-2">
                    Checkout{' '}
                    <ArrowRight
                      size={14}
                      className="group-hover:translate-x-1 transition-transform"
                    />
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    <Lock size={12} strokeWidth={2} /> Sign In to Checkout
                  </span>
                )}
              </button>

              <p className="text-[8px] sm:text-[9px] text-center text-neutral-400 font-bold uppercase tracking-[0.2em] pt-5 flex items-center justify-center gap-1.5">
                <Lock size={10} /> Secured by 256-bit Encryption
              </p>
            </div>
          </div>
        )}
      </main>

      <AuthModal />
    </div>
  );
}
