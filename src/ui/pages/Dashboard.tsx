import {
  ArrowRight,
  Check,
  ChevronDown,
  Image as ImageIcon,
  Loader2,
  LogOut,
  MapPin,
  Minus,
  Package,
  Pencil,
  Plus,
  Settings2,
  ShoppingBag,
  Sparkles,
  Store,
  Trash2,
  X,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router';
import { env } from '@/shared/env';
import { supabase } from '@/shared/lib/supabase';
import { Mini3DViewer } from '@/ui/components/Mini3DViewer';
import { PremiumLoader } from '@/ui/components/PremiumLoader';
import { Input, Label } from '@/ui/design-system';
import { useAuthStore } from '@/ui/store/auth-store';
import { type ShippingAddress, useCheckoutStore } from '@/ui/store/checkout-store';
import type {
  Order,
  OrderLineItem,
  SavedDesign,
  StoreMarketplaceItem,
} from '@/ui/store/dashboard-store';
import { useDashboardStore } from '@/ui/store/dashboard-store';
import { useEditorStore } from '@/ui/store/editor-store';

type Tab = 'orders' | 'designs' | 'addresses' | 'settings';

// --- ELEGANT COMPACT ITEM CARD ---
function CustomerItemCard({
  item,
  order,
  marketplaceItems,
  designs,
  formatDate,
}: {
  item: OrderLineItem;
  order: Order;
  marketplaceItems: StoreMarketplaceItem[];
  designs: SavedDesign[];
  formatDate: (iso: string | undefined) => string;
}) {
  const navigate = useNavigate();
  const [showTracking, setShowTracking] = useState(false);
  const trackingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Auto-Dismiss Logic
  const startDismissTimer = () => {
    if (trackingTimeoutRef.current) clearTimeout(trackingTimeoutRef.current);
    trackingTimeoutRef.current = setTimeout(() => {
      setShowTracking(false);
    }, 5000); // Elegantly dismiss after 5 seconds
  };

  const handleTrackingClick = () => {
    if (showTracking) {
      setShowTracking(false);
      if (trackingTimeoutRef.current) clearTimeout(trackingTimeoutRef.current);
    } else {
      setShowTracking(true);
      startDismissTimer();
    }
  };

  const handlePopupInteraction = () => {
    if (trackingTimeoutRef.current) clearTimeout(trackingTimeoutRef.current);
  };

  const handlePopupLeave = () => {
    startDismissTimer();
  };

  useEffect(() => {
    return () => {
      if (trackingTimeoutRef.current) clearTimeout(trackingTimeoutRef.current);
    };
  }, []);

  // Visual Resolvers & Collection Naming
  let thumbnail = '';
  let canvasState = null;
  let tshirtColor = '#ffffff';
  let apparelModel = 'tshirtman';
  let collectionName = item.type === 'custom' ? 'Studio Bespoke' : 'Marketplace Piece';

  if (item.type === 'marketplace') {
    const catItem = marketplaceItems.find((c) => c.id === item.product_id);
    if (catItem) {
      thumbnail = catItem.thumbnail_url || '';
      canvasState = catItem.canvas_state;
      tshirtColor = catItem.tshirt_color || '#ffffff';
      apparelModel = catItem.apparel_model || 'tshirtman';
      if (catItem.collection) collectionName = catItem.collection;
    }
  } else if (item.type === 'custom') {
    const desItem = designs.find((d) => d.id === item.product_id);
    if (desItem) {
      thumbnail = desItem.thumbnail_url || '';
      canvasState = desItem.canvas_state;
      tshirtColor = desItem.tshirt_color || '#ffffff';
      apparelModel = (desItem as { apparel_model?: string }).apparel_model || 'tshirtman';
    }
  }

  const itemAddress = item.shipping_snapshot || order.shipping_snapshot;
  const isDraft = item.status === 'draft';
  const isProcessing =
    item.status === 'processing' || item.status === 'shipped' || item.status === 'delivered';
  const isShipped = item.status === 'shipped' || item.status === 'delivered';
  const isDelivered = item.status === 'delivered';
  const progressWidth = isDelivered ? 'w-full' : isShipped ? 'w-1/2' : 'w-0';

  // --- ITEM ROUTING NAVIGATION ---
  const handleProductClick = () => {
    if (item.type === 'marketplace') {
      navigate(`/marketplace?item=${item.product_id}`);
    } else if (item.type === 'custom') {
      // Intelligently load the design into the editor workspace
      const workspaceStr = localStorage.getItem('caliqui_workspace');
      if (workspaceStr) {
        try {
          const parsed = JSON.parse(workspaceStr);
          parsed.activeDesignId = item.product_id;
          localStorage.setItem('caliqui_workspace', JSON.stringify(parsed));
        } catch (e) {
          console.error(e);
        }
      }
      navigate('/editor');
    }
  };

  return (
    <div className="flex flex-col p-4 sm:p-5 bg-white border border-black/[0.06] rounded-2xl shadow-sm hover:shadow-md transition-all">
      {/* Top: Item Visuals & Details (Now Clickable) */}
      <button
        type="button"
        onClick={handleProductClick}
        className="flex gap-4 items-start w-full text-left outline-none group cursor-pointer"
      >
        <div className="w-16 h-20 shrink-0 bg-[#fbfbfd] rounded-xl flex items-center justify-center relative overflow-hidden border border-black/5 p-1 transition-colors group-hover:border-black/15 group-hover:bg-[#f5f5f7]">
          {canvasState && canvasState.length > 0 ? (
            <div className="absolute inset-0 pointer-events-none mix-blend-multiply p-1">
              <Mini3DViewer
                canvasState={canvasState}
                tshirtColor={tshirtColor}
                apparelModel={apparelModel}
                fallbackImage={thumbnail || undefined}
              />
            </div>
          ) : thumbnail ? (
            <img
              src={thumbnail}
              className="w-full h-full object-cover mix-blend-multiply transition-transform duration-500 group-hover:scale-105"
              alt={item.name}
              onError={(e) => {
                e.currentTarget.style.display = 'none';
              }}
            />
          ) : (
            <Package
              size={16}
              className="text-neutral-300 transition-transform duration-500 group-hover:scale-110"
            />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex justify-between items-start mb-0.5">
            <h4 className="text-sm font-medium text-black truncate pr-2 group-hover:underline underline-offset-4">
              {item.name}
            </h4>
            <span className="text-xs font-semibold text-black shrink-0">
              ₹{(item.price * item.quantity).toLocaleString('en-IN')}
            </span>
          </div>
          <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-neutral-400 mb-2">
            {collectionName}
          </p>
          <div className="flex flex-wrap gap-1.5">
            {item.sizes &&
              Object.entries(item.sizes)
                .filter(([_, q]) => (q as number) > 0)
                .map(([s, q]) => (
                  <span
                    key={s}
                    className="text-[9px] font-medium bg-[#fbfbfd] px-1.5 py-0.5 rounded border border-black/5 text-neutral-600"
                  >
                    {s}: <strong className="text-black">{q as number}</strong>
                  </span>
                ))}
          </div>
        </div>
      </button>

      <div className="h-px w-full bg-black/5 my-4" />

      {/* Middle: Compact Delivery Address */}
      <div className="flex items-center gap-2 mb-4 px-1 text-xs">
        <MapPin size={12} className="text-neutral-400 shrink-0" />
        <p className="text-[10px] text-neutral-500 truncate">
          <span className="font-medium text-black">
            {itemAddress?.customer_name || itemAddress?.label || order.customer_name}
          </span>
          <span className="mx-1.5 text-neutral-300">•</span>
          {itemAddress?.address}
        </p>
      </div>

      {/* Bottom: Visual Tracking Timeline */}
      {isDraft ? (
        <div className="flex items-center justify-center p-3 bg-neutral-50 rounded-xl border border-neutral-100 border-dashed">
          <span className="text-[9px] font-bold uppercase tracking-widest text-neutral-400">
            Awaiting Payment Sync
          </span>
        </div>
      ) : (
        <div className="relative pt-1 pb-1">
          {/* Progress Lines */}
          <div className="absolute top-2.5 left-8 right-8 h-[2px] bg-neutral-100 -z-10 rounded-full" />
          <div className="absolute top-2.5 left-8 right-8 h-[2px] -z-10">
            <div
              className={`h-full bg-black transition-all duration-700 rounded-full ${progressWidth}`}
            />
          </div>

          <div className="flex justify-between items-start px-2">
            {/* Step 1: Processing */}
            <div className="flex flex-col items-center w-14 gap-1.5">
              <div
                className={`w-3.5 h-3.5 rounded-full border-2 ${isProcessing ? 'bg-black border-black' : 'bg-white border-neutral-200'}`}
              />
              <span
                className={`text-[8px] font-bold uppercase tracking-widest ${isProcessing ? 'text-black' : 'text-neutral-400'}`}
              >
                Prep
              </span>
              <span className="text-[7px] text-neutral-400 tracking-wider text-center leading-tight">
                {formatDate(order.created_at)}
              </span>
            </div>

            {/* Step 2: Shipped (Interactive Popover) */}
            <div className="relative flex flex-col items-center w-20 gap-1.5">
              {/* The Floating Logistics Bubble */}
              {showTracking && isShipped && item.tracking_number && (
                <div
                  role="tooltip"
                  onMouseEnter={handlePopupInteraction}
                  onMouseLeave={handlePopupLeave}
                  onTouchStart={handlePopupInteraction}
                  className="absolute bottom-[110%] mb-2 left-1/2 -translate-x-1/2 w-48 bg-white/95 backdrop-blur-xl border border-black/10 rounded-2xl shadow-[0_20px_40px_-10px_rgba(0,0,0,0.15)] p-4 z-50 animate-in zoom-in-95 fade-in duration-200"
                >
                  <div className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-3 h-3 bg-white border-b border-r border-black/10 rotate-45" />

                  <div className="relative z-10 flex flex-col items-center text-center">
                    <span className="text-[8px] font-bold uppercase tracking-[0.2em] text-neutral-400 mb-0.5">
                      Logistics Partner
                    </span>
                    <span className="text-xs font-semibold text-black mb-3">
                      {item.courier_name || 'Standard Courier'}
                    </span>

                    <span className="text-[8px] font-bold uppercase tracking-[0.2em] text-neutral-400 mb-1">
                      Tracking Number
                    </span>
                    <span className="text-[11px] font-mono font-medium text-black select-all bg-[#fbfbfd] px-2 py-1.5 rounded-lg border border-black/5 cursor-text w-full text-center hover:bg-neutral-100 transition-colors">
                      {item.tracking_number}
                    </span>
                  </div>
                </div>
              )}

              {/* Shipped Node Trigger */}
              <button
                type="button"
                disabled={!isShipped || !item.tracking_number}
                onClick={handleTrackingClick}
                className={`w-3.5 h-3.5 rounded-full border-2 transition-transform outline-none ${isShipped && item.tracking_number ? 'bg-black border-black cursor-pointer hover:scale-125 hover:shadow-md' : isShipped ? 'bg-black border-black cursor-default' : 'bg-white border-neutral-200 cursor-default'}`}
              />
              <button
                type="button"
                disabled={!isShipped || !item.tracking_number}
                onClick={handleTrackingClick}
                className={`text-[8px] font-bold uppercase tracking-widest flex items-center gap-0.5 outline-none transition-colors ${isShipped && item.tracking_number ? 'text-black hover:text-blue-600 cursor-pointer' : isShipped ? 'text-black cursor-default' : 'text-neutral-400 cursor-default'}`}
              >
                Shipped
                {isShipped && item.tracking_number && (
                  <ChevronDown
                    size={8}
                    className={`transition-transform ${showTracking ? 'rotate-180' : ''}`}
                  />
                )}
              </button>
              {isShipped && !isDelivered && (
                <span className="text-[7px] text-neutral-400 tracking-wider text-center leading-tight">
                  {formatDate(item.updated_at)}
                </span>
              )}
            </div>

            {/* Step 3: Delivered */}
            <div className="flex flex-col items-center w-14 gap-1.5">
              <div
                className={`w-3.5 h-3.5 rounded-full border-2 ${isDelivered ? 'bg-black border-black' : 'bg-white border-neutral-200'}`}
              />
              <span
                className={`text-[8px] font-bold uppercase tracking-widest ${isDelivered ? 'text-black' : 'text-neutral-400'}`}
              >
                Done
              </span>
              {isDelivered && (
                <span className="text-[7px] text-neutral-400 tracking-wider text-center leading-tight">
                  {formatDate(item.updated_at)}
                </span>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ------------------------------------
// MAIN DASHBOARD COMPONENT
// ------------------------------------

export function Dashboard() {
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();
  const {
    orders,
    designs,
    marketplaceItems,
    profile,
    isLoading,
    isUpdatingProfile,
    fetchDashboardData,
    deleteDesign,
    updateProfile,
  } = useDashboardStore();
  const { init } = useEditorStore();
  const { cart, addToCart } = useCheckoutStore();

  const [activeTab, setActiveTab] = useState<Tab>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('caliqui_dashboard_tab');
      if (
        saved === 'orders' ||
        saved === 'designs' ||
        saved === 'addresses' ||
        saved === 'settings'
      ) {
        return saved as Tab;
      }
    }
    return 'orders';
  });

  const [editName, setEditName] = useState('');
  const [editAddress, setEditAddress] = useState('');

  // Address Book State
  const [addresses, setAddresses] = useState<ShippingAddress[]>([]);
  const [isAddressFormOpen, setIsAddressFormOpen] = useState(false);
  const [editingAddrId, setEditingAddrId] = useState<string | null>(null);
  const [addrForm, setAddrForm] = useState({ label: '', fullName: '', phone: '', address: '' });

  const [selectedDesign, setSelectedDesign] = useState<SavedDesign | null>(null);
  const [selectedSizes, setSelectedSizes] = useState<Record<string, number>>({
    S: 0,
    M: 0,
    L: 0,
    XL: 0,
    XXL: 0,
  });
  const [focusedSize, setFocusedSize] = useState<string>('M');
  const [isAdding, setIsAdding] = useState(false);
  const [cartAnim, setCartAnim] = useState(false);

  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isLongPress = useRef(false);

  useEffect(() => {
    localStorage.setItem('caliqui_dashboard_tab', activeTab);
  }, [activeTab]);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  useEffect(() => {
    if (profile) {
      setEditName(profile.full_name || '');
      setEditAddress(profile.default_shipping_address?.address || '');

      const loadAddresses = async () => {
        const { data } = await supabase
          .from('profiles')
          .select('saved_addresses')
          .eq('id', profile.id)
          .single();
        if (data?.saved_addresses) {
          setAddresses(data.saved_addresses);
        }
      };
      loadAddresses();
    }
  }, [profile]);

  const totalCartItems = cart.reduce(
    (acc, item) => acc + Object.values(item.sizes).reduce((a, b) => a + b, 0),
    0,
  );

  const currentPrice = selectedDesign ? 1499 + (selectedDesign.canvas_state?.length || 0) * 150 : 0;
  const totalQty = Object.values(selectedSizes).reduce((a, b) => a + b, 0);
  const totalPrice = totalQty > 0 ? totalQty * currentPrice : currentPrice;

  const updateLocalSize = (size: string, delta: number) => {
    setSelectedSizes((prev) => ({
      ...prev,
      [size]: Math.max(0, prev[size] + delta),
    }));
  };

  const handleSizeLeftClick = (e: React.MouseEvent, size: string) => {
    e.preventDefault();
    if (isLongPress.current) {
      isLongPress.current = false;
      return;
    }
    setFocusedSize(size);
    updateLocalSize(size, 1);
  };

  const handleSizeRightClick = (e: React.MouseEvent, size: string) => {
    e.preventDefault();
    setFocusedSize(size);
    updateLocalSize(size, -1);
  };

  const handleTouchStart = (size: string) => {
    isLongPress.current = false;
    longPressTimer.current = setTimeout(() => {
      isLongPress.current = true;
      setFocusedSize(size);
      updateLocalSize(size, -1);
    }, 500);
  };

  const handleTouchEnd = () => {
    if (longPressTimer.current) clearTimeout(longPressTimer.current);
  };

  const handleEditDesign = (designId: string) => {
    const workspaceStr = localStorage.getItem('caliqui_workspace');
    if (workspaceStr) {
      try {
        const parsed = JSON.parse(workspaceStr);
        parsed.activeDesignId = designId;
        localStorage.setItem('caliqui_workspace', JSON.stringify(parsed));
        init();
      } catch (e) {
        console.error(e);
      }
    }
    navigate('/editor');
  };

  const handleOpenSizeModal = (design: SavedDesign) => {
    setSelectedDesign(design);
    setSelectedSizes({ S: 0, M: 1, L: 0, XL: 0, XXL: 0 });
    setFocusedSize('M');
  };

  const confirmAddToCart = () => {
    if (!selectedDesign) return;
    setIsAdding(true);

    const state = useCheckoutStore.getState();
    let existing = state.cart.find((c) => c.productId === selectedDesign.id);

    if (!existing) {
      addToCart({
        type: 'custom',
        productId: selectedDesign.id,
        name: selectedDesign.name || 'Custom Studio Design',
        thumbnail: selectedDesign.thumbnail_url,
        canvasState: selectedDesign.canvas_state,
        tshirtColor: selectedDesign.tshirt_color || '#ffffff',
        apparelModel: (selectedDesign as { apparel_model?: string }).apparel_model || 'tshirtman',
        price: currentPrice,
      });
      const newState = useCheckoutStore.getState();
      existing = newState.cart.find((c) => c.productId === selectedDesign.id);
      if (existing) newState.updateCartItemQuantity(existing.cartId, 'M', -1);
    }

    const targetCartId = existing?.cartId;
    if (targetCartId) {
      Object.entries(selectedSizes).forEach(([size, qty]) => {
        if (qty > 0) {
          useCheckoutStore.getState().updateCartItemQuantity(targetCartId, size, qty);
        }
      });
    }

    setCartAnim(true);
    setTimeout(() => {
      setIsAdding(false);
      setSelectedDesign(null);
      setTimeout(() => setCartAnim(false), 1000);
    }, 800);
  };

  const handleSaveProfile = async () => {
    await updateProfile(editName, editAddress);
  };

  const openAddAddress = () => {
    setAddrForm({ label: '', fullName: '', phone: '', address: '' });
    setEditingAddrId(null);
    setIsAddressFormOpen(true);
  };

  const openEditAddress = (addr: ShippingAddress) => {
    setAddrForm({
      label: addr.label,
      fullName: addr.fullName,
      phone: addr.phone,
      address: addr.address,
    });
    setEditingAddrId(addr.id);
    setIsAddressFormOpen(true);
  };

  const handleSaveAddress = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;

    let updated: ShippingAddress[];
    if (editingAddrId) {
      updated = addresses.map((a) =>
        a.id === editingAddrId ? { id: editingAddrId, ...addrForm } : a,
      );
    } else {
      updated = [...addresses, { id: crypto.randomUUID(), ...addrForm }];
    }

    setAddresses(updated);
    await supabase.from('profiles').update({ saved_addresses: updated }).eq('id', profile.id);
    setIsAddressFormOpen(false);
    setEditingAddrId(null);
    setAddrForm({ label: '', fullName: '', phone: '', address: '' });
  };

  const handleDeleteAddress = async (id: string) => {
    if (!profile) return;
    const updated = addresses.filter((a) => a.id !== id);
    setAddresses(updated);
    await supabase.from('profiles').update({ saved_addresses: updated }).eq('id', profile.id);
  };

  const handleSignOut = async () => {
    await logout();
    navigate('/');
  };

  const formatDate = (isoString: string | undefined) => {
    if (!isoString) return 'Pending';
    return new Date(isoString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  if (isLoading) return <PremiumLoader fullScreen={true} />;
  if (!profile) return <Navigate to="/marketplace" replace />;

  return (
    <div className="w-full h-dvh bg-white text-black font-sans flex flex-col selection:bg-neutral-200 overflow-y-auto overflow-x-hidden select-none">
      <style>{`
        .hide-scrollbar::-webkit-scrollbar { display: none; }
        .hide-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>

      {/* QUICK ADD TO CART MODAL */}
      {selectedDesign && (
        <div className="fixed inset-0 z-[500] flex items-center justify-center p-4">
          <button
            type="button"
            aria-label="Close modal"
            className="absolute inset-0 w-full h-full bg-black/40 backdrop-blur-sm outline-none cursor-default border-0 p-0 m-0 animate-in fade-in duration-300"
            onClick={() => setSelectedDesign(null)}
          />
          <div
            role="dialog"
            aria-modal="true"
            className="relative z-10 bg-white rounded-4xl p-6 sm:p-8 w-full max-w-[420px] shadow-2xl animate-in zoom-in-95 duration-300 ease-out"
          >
            <div className="flex justify-between items-center mb-6">
              <div>
                <h3 className="font-medium tracking-tight text-xl text-black">Select Sizes</h3>
                <p className="text-[10px] text-neutral-400 mt-1 uppercase tracking-widest">
                  ₹{currentPrice.toLocaleString('en-IN')} per unit
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedDesign(null)}
                className="w-8 h-8 flex items-center justify-center bg-neutral-100 hover:bg-neutral-200 text-black rounded-full transition-colors outline-none"
              >
                <X size={16} strokeWidth={1.5} />
              </button>
            </div>

            <p className="text-[10px] text-neutral-400 mb-4 tracking-wide text-center">
              Left-click to add, right-click to remove. Mobile: tap to add, press & hold to remove.
            </p>

            <div className="grid grid-cols-5 gap-2 mb-6">
              {['S', 'M', 'L', 'XL', 'XXL'].map((size) => {
                const qty = selectedSizes[size] || 0;
                const isFocused = focusedSize === size;
                return (
                  <button
                    key={size}
                    type="button"
                    onClick={(e) => handleSizeLeftClick(e, size)}
                    onContextMenu={(e) => handleSizeRightClick(e, size)}
                    onTouchStart={() => handleTouchStart(size)}
                    onTouchEnd={handleTouchEnd}
                    className={`relative h-12 rounded-xl flex items-center justify-center text-xs font-medium transition-all outline-none border select-none touch-none ${
                      isFocused
                        ? 'border-black border-[1.5px] text-black shadow-sm bg-neutral-50/30'
                        : 'border-neutral-200 text-neutral-400 hover:border-black/40 hover:text-black'
                    }`}
                  >
                    {size}
                    {qty > 0 && (
                      <span className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-black text-white text-[8px] font-bold flex items-center justify-center rounded-full shadow-sm animate-in zoom-in border-2 border-white">
                        {qty}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            <div className="flex items-center justify-between px-5 py-4 bg-[#fbfbfd] border border-black/4 rounded-2xl mb-8 transition-all">
              <span className="text-[10px] font-medium uppercase tracking-widest text-neutral-500">
                Quantity <span className="text-black font-bold ml-1">({focusedSize})</span>
              </span>
              <div className="flex items-center gap-6 text-black">
                <button
                  type="button"
                  onClick={() => updateLocalSize(focusedSize, -1)}
                  disabled={selectedSizes[focusedSize] === 0}
                  className="hover:opacity-50 disabled:opacity-20 outline-none p-1.5 transition-opacity bg-white rounded-md shadow-sm border border-black/5"
                >
                  <Minus size={14} strokeWidth={1.5} />
                </button>
                <span className="text-sm font-semibold w-6 text-center">
                  {selectedSizes[focusedSize] || 0}
                </span>
                <button
                  type="button"
                  onClick={() => updateLocalSize(focusedSize, 1)}
                  className="hover:opacity-50 outline-none p-1.5 transition-opacity bg-white rounded-md shadow-sm border border-black/5"
                >
                  <Plus size={14} strokeWidth={1.5} />
                </button>
              </div>
            </div>

            <button
              type="button"
              onClick={confirmAddToCart}
              disabled={totalQty === 0 || isAdding}
              className="w-full h-14 bg-black hover:bg-neutral-800 disabled:bg-neutral-200 disabled:text-neutral-400 text-white font-medium uppercase tracking-[0.15em] text-[11px] rounded-full transition-all flex items-center justify-center outline-none shadow-lg"
            >
              {isAdding ? (
                <span className="flex items-center gap-3">
                  <Check size={16} strokeWidth={1.5} /> Added To Bag
                </span>
              ) : (
                `Add To Bag — ₹${totalPrice.toLocaleString('en-IN')}`
              )}
            </button>
          </div>
        </div>
      )}

      {/* LUXURY GLOBAL HEADER - Synced with Marketplace & Editor */}
      <header className="h-[70px] bg-white/95 backdrop-blur-md border-b border-black/4 flex items-center justify-between px-5 sm:px-6 lg:px-12 shrink-0 z-40 sticky top-0">
        <Link to="/" className="hover:opacity-60 transition-opacity outline-none">
          <img
            src="/logo.png"
            alt={env.VITE_APP_NAME}
            className="h-5 md:h-6 w-auto object-contain"
          />
        </Link>

        <div className="flex items-center gap-4 sm:gap-6 md:gap-8">
          <Link
            to="/marketplace"
            className="flex items-center gap-1.5 px-2 sm:px-3 h-9 rounded-full text-neutral-500 hover:text-black hover:bg-neutral-100 transition-colors outline-none shrink-0"
            title="Collection"
          >
            <Store size={20} strokeWidth={1.5} />
            <span className="hidden md:inline uppercase tracking-[0.15em] text-[10px] font-medium">
              Collection
            </span>
          </Link>

          <Link
            to="/editor"
            className="flex items-center gap-1.5 px-2 sm:px-3 h-9 rounded-full text-neutral-500 hover:text-black hover:bg-neutral-100 transition-colors outline-none shrink-0"
            title="Studio"
          >
            <Sparkles size={20} strokeWidth={1.5} />
            <span className="hidden md:inline uppercase tracking-[0.15em] text-[10px] font-medium">
              Studio
            </span>
          </Link>

          <div className="hidden sm:block w-px h-3 bg-neutral-200 mx-1" />

          {/* Cart Notification */}
          <Link
            to="/checkout"
            className={`relative flex items-center justify-center p-1 transition-all duration-300 outline-none ${cartAnim ? 'scale-110' : 'hover:opacity-60'}`}
            title="Cart"
          >
            <ShoppingBag size={20} strokeWidth={1.5} className="text-black" />
            {totalCartItems > 0 && (
              <span className="absolute -top-1.5 -right-2 bg-black text-white text-[9px] font-bold min-w-4.5 h-4.5 px-1 rounded-full flex items-center justify-center border-2 border-white shadow-sm">
                {totalCartItems}
              </span>
            )}
          </Link>

          {/* Minimal Sign Out */}
          <button
            type="button"
            onClick={handleSignOut}
            className="text-[10px] font-medium uppercase tracking-[0.15em] text-neutral-400 hover:text-black transition-colors flex items-center gap-1.5 outline-none ml-2"
          >
            <LogOut size={14} strokeWidth={1.5} className="hidden sm:block" />
            <span>Sign Out</span>
          </button>
        </div>
      </header>

      {/* DASHBOARD CONTENT */}
      <main className="flex-1 max-w-[1600px] w-full mx-auto px-6 lg:px-12 py-10 pb-32">
        <div className="mb-10 md:mb-14">
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-light tracking-tight text-black mb-3">
            Account
          </h1>
          <p className="text-neutral-400 font-medium text-[11px] sm:text-xs tracking-widest uppercase">
            {profile?.full_name ? `Welcome, ${profile.full_name}` : user?.email}
          </p>
        </div>

        {/* Minimal Tab Bar */}
        <div className="relative border-b border-black/4 mb-10 md:mb-12">
          <div className="flex items-center gap-8 overflow-x-auto w-full hide-scrollbar pb-px">
            {[
              {
                id: 'orders',
                label: 'Order History',
                icon: <Package size={14} strokeWidth={1.5} />,
              },
              {
                id: 'designs',
                label: 'Saved Designs',
                icon: <ImageIcon size={14} strokeWidth={1.5} />,
              },
              { id: 'addresses', label: 'Addresses', icon: <MapPin size={14} strokeWidth={1.5} /> },
              {
                id: 'settings',
                label: 'Preferences',
                icon: <Settings2 size={14} strokeWidth={1.5} />,
              },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id as Tab)}
                className={`flex items-center gap-2.5 pb-4 text-[10px] font-medium uppercase tracking-[0.15em] transition-all whitespace-nowrap outline-none border-b-2 shrink-0 ${
                  activeTab === tab.id
                    ? 'text-black border-black'
                    : 'text-neutral-400 border-transparent hover:text-black hover:border-black/20'
                }`}
              >
                {tab.icon} {tab.label}
              </button>
            ))}
          </div>
        </div>

        <div className="animate-in fade-in slide-in-from-bottom-4 duration-700">
          {/* ORDERS TAB */}
          {activeTab === 'orders' && (
            <div>
              {orders.length === 0 ? (
                <div className="flex flex-col items-center justify-center text-center py-32 bg-[#fbfbfd] rounded-[2.5rem] border border-black/3">
                  <Package size={32} strokeWidth={1} className="text-neutral-300 mb-6" />
                  <p className="text-neutral-500 font-medium text-sm tracking-wide mb-6">
                    You haven't placed any orders yet.
                  </p>
                  <Link
                    to="/marketplace"
                    className="inline-flex items-center justify-center px-8 h-12 bg-black text-white text-[10px] uppercase tracking-[0.15em] font-medium rounded-full hover:bg-neutral-800 transition-colors shadow-sm outline-none"
                  >
                    Explore Collection
                  </Link>
                </div>
              ) : (
                <div className="space-y-8">
                  {orders.map((order) => (
                    <div
                      key={order.id}
                      className="flex flex-col p-6 sm:p-8 bg-[#fbfbfd] border border-black/4 rounded-[2.5rem] gap-6"
                    >
                      {/* Global Order Header */}
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-black/5 pb-6">
                        <div>
                          <p className="text-xs font-mono font-medium text-black uppercase tracking-widest">
                            Order #{order.id.split('-')[0]}
                          </p>
                          <p className="text-[10px] text-neutral-400 mt-1 tracking-wider">
                            Placed on {formatDate(order.created_at)}
                          </p>
                        </div>
                        <div className="text-left sm:text-right">
                          <p className="font-medium text-lg sm:text-xl tracking-tight mb-1 text-black">
                            ₹{order.amount.toLocaleString('en-IN')}
                          </p>
                          <p className="text-[10px] text-neutral-400 uppercase tracking-widest font-medium">
                            {order.order_items?.length || 0} Items
                          </p>
                        </div>
                      </div>

                      {/* Items Grid Layout - Compact Cards */}
                      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-5">
                        {order.order_items?.map((item) => (
                          <CustomerItemCard
                            key={item.id}
                            item={item}
                            order={order}
                            marketplaceItems={marketplaceItems}
                            designs={designs}
                            formatDate={formatDate}
                          />
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* DESIGNS TAB */}
          {activeTab === 'designs' && (
            <div>
              {designs.length === 0 ? (
                <div className="flex flex-col items-center justify-center text-center py-32 bg-[#fbfbfd] rounded-[2.5rem] border border-black/3">
                  <ImageIcon size={32} strokeWidth={1} className="text-neutral-300 mb-6" />
                  <p className="text-neutral-500 font-medium text-sm tracking-wide mb-6">
                    Your studio canvas is empty.
                  </p>
                  <Link
                    to="/editor"
                    className="inline-flex items-center justify-center px-8 h-12 bg-black text-white text-[10px] uppercase tracking-[0.15em] font-medium rounded-full hover:bg-neutral-800 transition-colors shadow-sm outline-none"
                  >
                    Open Studio
                  </Link>
                </div>
              ) : (
                <div className="grid grid-cols-1 min-[480px]:grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 md:gap-6">
                  {designs.map((design) => (
                    <div key={design.id} className="group relative bg-transparent flex flex-col">
                      {/* Apple-style floating thumbnail box */}
                      <div className="aspect-[4/5] bg-[#f8f8f8] rounded-2xl overflow-hidden relative w-full mb-3 transition-colors duration-500 group-hover:bg-[#f0f0f0] p-6 sm:p-8">
                        <div className="absolute inset-0 p-6 sm:p-8 transition-transform duration-1000 group-hover:scale-[1.03] cursor-grab active:cursor-grabbing">
                          <Mini3DViewer
                            canvasState={design.canvas_state as Record<string, unknown>[]}
                            tshirtColor={design.tshirt_color}
                            fallbackImage={design.thumbnail_url}
                            apparelModel={
                              (design as { apparel_model?: string }).apparel_model || 'tshirtman'
                            }
                          />
                        </div>

                        {/* Overlay Controls */}
                        <div className="absolute inset-0 bg-black/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />

                        <div className="absolute top-3 right-3 flex flex-col gap-2 translate-x-4 opacity-0 group-hover:translate-x-0 group-hover:opacity-100 transition-all duration-300 z-10">
                          <button
                            type="button"
                            onClick={() => handleOpenSizeModal(design)}
                            className="w-8 h-8 rounded-full bg-white text-black flex items-center justify-center hover:scale-110 transition-transform outline-none shadow-sm"
                            title="Add to Cart"
                          >
                            <ShoppingBag size={13} strokeWidth={2} />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleEditDesign(design.id)}
                            className="w-8 h-8 rounded-full bg-white text-black flex items-center justify-center hover:scale-110 transition-transform outline-none shadow-sm"
                            title="Edit Design"
                          >
                            <ArrowRight size={13} strokeWidth={2} />
                          </button>
                          <button
                            type="button"
                            onClick={() => deleteDesign(design.id)}
                            className="w-8 h-8 rounded-full bg-white text-red-500 flex items-center justify-center hover:scale-110 transition-transform outline-none shadow-sm"
                            title="Delete"
                          >
                            <Trash2 size={13} strokeWidth={2} />
                          </button>
                        </div>
                      </div>

                      <div className="flex flex-col px-1 w-full">
                        <h3 className="font-medium text-xs tracking-tight text-black truncate mb-1">
                          {design.name || 'Untitled Design'}
                        </h3>
                        <p className="text-[10px] font-medium text-neutral-400 tracking-widest uppercase">
                          {formatDate(design.created_at)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ADDRESSES TAB */}
          {activeTab === 'addresses' && (
            <div className="space-y-6 max-w-4xl">
              <div className="flex justify-between items-center bg-[#fbfbfd] border border-black/4 rounded-[2rem] p-6 shadow-sm">
                <div>
                  <h2 className="text-[11px] font-medium uppercase tracking-[0.2em] text-black mb-1">
                    Address Book
                  </h2>
                  <p className="text-xs font-light text-neutral-500 tracking-wide">
                    Manage your delivery destinations.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={openAddAddress}
                  className="bg-black text-white px-5 h-10 rounded-full text-[10px] uppercase tracking-widest font-medium flex items-center gap-2 hover:bg-neutral-800 transition-colors shrink-0 outline-none"
                >
                  <Plus size={14} strokeWidth={1.5} /> Add New
                </button>
              </div>

              {isAddressFormOpen && (
                <form
                  onSubmit={handleSaveAddress}
                  className="bg-white border border-black/5 rounded-[2rem] p-6 sm:p-8 shadow-sm space-y-5 animate-in slide-in-from-top-4"
                >
                  <h3 className="text-[10px] font-medium uppercase tracking-[0.2em] text-neutral-400 mb-6">
                    {editingAddrId ? 'Edit Delivery Address' : 'New Delivery Address'}
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <div>
                      <Label
                        htmlFor="new-label"
                        className="text-[9px] font-medium text-neutral-400 uppercase tracking-[0.2em] ml-1 mb-2 block"
                      >
                        Label (e.g. Home, Office)
                      </Label>
                      <Input
                        id="new-label"
                        value={addrForm.label}
                        onChange={(e) => setAddrForm({ ...addrForm, label: e.target.value })}
                        className="bg-[#fbfbfd] border-black/5 h-12 rounded-2xl text-xs font-medium focus:border-black/20 focus:bg-white transition-colors"
                        required
                      />
                    </div>
                    <div>
                      <Label
                        htmlFor="new-fullname"
                        className="text-[9px] font-medium text-neutral-400 uppercase tracking-[0.2em] ml-1 mb-2 block"
                      >
                        Recipient Name
                      </Label>
                      <Input
                        id="new-fullname"
                        value={addrForm.fullName}
                        onChange={(e) => setAddrForm({ ...addrForm, fullName: e.target.value })}
                        className="bg-[#fbfbfd] border-black/5 h-12 rounded-2xl text-xs font-medium focus:border-black/20 focus:bg-white transition-colors"
                        required
                      />
                    </div>
                    <div>
                      <Label
                        htmlFor="new-phone"
                        className="text-[9px] font-medium text-neutral-400 uppercase tracking-[0.2em] ml-1 mb-2 block"
                      >
                        Phone Number
                      </Label>
                      <Input
                        id="new-phone"
                        value={addrForm.phone}
                        onChange={(e) => setAddrForm({ ...addrForm, phone: e.target.value })}
                        className="bg-[#fbfbfd] border-black/5 h-12 rounded-2xl text-xs font-medium focus:border-black/20 focus:bg-white transition-colors"
                        required
                      />
                    </div>
                    <div>
                      <Label
                        htmlFor="new-address"
                        className="text-[9px] font-medium text-neutral-400 uppercase tracking-[0.2em] ml-1 mb-2 block"
                      >
                        Complete Address
                      </Label>
                      <Input
                        id="new-address"
                        value={addrForm.address}
                        onChange={(e) => setAddrForm({ ...addrForm, address: e.target.value })}
                        className="bg-[#fbfbfd] border-black/5 h-12 rounded-2xl text-xs font-medium focus:border-black/20 focus:bg-white transition-colors"
                        required
                      />
                    </div>
                  </div>
                  <div className="flex justify-end pt-4 gap-3">
                    <button
                      type="button"
                      onClick={() => {
                        setIsAddressFormOpen(false);
                        setEditingAddrId(null);
                      }}
                      className="px-6 h-10 rounded-full text-[10px] uppercase tracking-widest font-medium text-neutral-500 hover:bg-neutral-100 transition-colors outline-none"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="px-8 h-10 rounded-full text-[10px] uppercase tracking-widest font-medium bg-black text-white hover:bg-neutral-800 transition-colors shadow-sm outline-none"
                    >
                      Save Address
                    </button>
                  </div>
                </form>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {addresses.map((addr) => (
                  <div
                    key={addr.id}
                    className="p-6 bg-[#fbfbfd] border border-black/4 rounded-[2rem] flex flex-col justify-between relative group hover:border-black/10 transition-colors"
                  >
                    <div className="absolute top-5 right-5 flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        type="button"
                        onClick={() => openEditAddress(addr)}
                        className="p-2 text-neutral-400 hover:text-blue-500 transition-colors outline-none bg-white rounded-full shadow-sm border border-black/5"
                        title="Edit Address"
                      >
                        <Pencil size={12} strokeWidth={2} />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteAddress(addr.id)}
                        className="p-2 text-neutral-400 hover:text-red-500 transition-colors outline-none bg-white rounded-full shadow-sm border border-black/5"
                        title="Delete Address"
                      >
                        <Trash2 size={12} strokeWidth={2} />
                      </button>
                    </div>

                    <div className="mb-5">
                      <span className="text-[9px] font-medium uppercase tracking-[0.2em] bg-white border border-black/5 text-black px-3 py-1.5 rounded-full shadow-sm">
                        {addr.label}
                      </span>
                    </div>
                    <div>
                      <p className="font-medium text-sm tracking-wide text-black mb-1.5">
                        {addr.fullName}
                      </p>
                      <p className="text-xs font-light text-neutral-500 leading-relaxed mb-1">
                        {addr.address}
                      </p>
                      <p className="text-[11px] font-medium text-neutral-400 tracking-wider">
                        T: {addr.phone}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* SETTINGS TAB */}
          {activeTab === 'settings' && (
            <div className="max-w-xl">
              <div className="bg-[#fbfbfd] border border-black/4 rounded-[2rem] p-6 sm:p-10 shadow-sm">
                <h2 className="text-[10px] font-medium uppercase tracking-[0.2em] text-neutral-400 mb-8">
                  Profile Information
                </h2>
                <div className="space-y-6">
                  <div>
                    <label
                      htmlFor="profile-email"
                      className="block text-[9px] font-medium text-neutral-400 uppercase tracking-[0.2em] mb-2 pl-1"
                    >
                      Email Address
                    </label>
                    <input
                      id="profile-email"
                      type="email"
                      disabled
                      readOnly
                      value={user?.email || ''}
                      className="w-full bg-transparent border border-black/4 text-neutral-400 rounded-2xl h-12 px-4 text-xs font-medium outline-none cursor-not-allowed"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="profile-name"
                      className="block text-[9px] font-medium text-neutral-400 uppercase tracking-[0.2em] mb-2 pl-1"
                    >
                      Full Name
                    </label>
                    <input
                      id="profile-name"
                      type="text"
                      placeholder="Add your name"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      className="w-full bg-white border border-black/4 focus:border-black/20 rounded-2xl h-12 px-4 text-xs font-medium outline-none transition-colors text-black placeholder:text-neutral-400"
                    />
                  </div>
                  <div className="pt-4">
                    <button
                      type="button"
                      onClick={handleSaveProfile}
                      disabled={isUpdatingProfile}
                      className="w-full sm:w-auto h-12 px-8 bg-black text-white text-[10px] uppercase tracking-widest font-medium rounded-full hover:bg-neutral-800 disabled:bg-neutral-200 disabled:text-neutral-400 transition-colors shadow-md flex items-center justify-center gap-2 outline-none"
                    >
                      {isUpdatingProfile && (
                        <Loader2 size={14} className="animate-spin" strokeWidth={1.5} />
                      )}
                      Save Changes
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
