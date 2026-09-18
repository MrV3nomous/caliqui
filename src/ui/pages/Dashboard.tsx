import {
  ArrowRight,
  Check,
  ImageIcon,
  Loader2,
  LogOut,
  MapPin,
  Minus,
  Package,
  Plus,
  Settings2,
  ShoppingBag,
  Trash2,
  X,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router';
import { env } from '@/shared/env';
import { supabase } from '@/shared/lib/supabase';
import { Mini3DViewer } from '@/ui/components/Mini3DViewer';
import { Input, Label } from '@/ui/design-system';
import { useAuthStore } from '@/ui/store/auth-store';
import { type ShippingAddress, useCheckoutStore } from '@/ui/store/checkout-store';
import type { SavedDesign } from '@/ui/store/dashboard-store';
import { useDashboardStore } from '@/ui/store/dashboard-store';
import { useEditorStore } from '@/ui/store/editor-store';

type Tab = 'orders' | 'designs' | 'addresses' | 'settings';

export function Dashboard() {
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();
  const {
    orders,
    designs,
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

  const [addresses, setAddresses] = useState<ShippingAddress[]>([]);
  const [isAddingAddr, setIsAddingAddr] = useState(false);
  const [newAddr, setNewAddr] = useState({ label: '', fullName: '', phone: '', address: '' });

  // Cart Modal State
  const [selectedDesign, setSelectedDesign] = useState<SavedDesign | null>(null);
  const [selectedSizes, setSelectedSizes] = useState<Record<string, number>>({
    S: 0,
    M: 1,
    L: 0,
    XL: 0,
    XXL: 0,
  });
  const [isAdding, setIsAdding] = useState(false);
  const [cartAnim, setCartAnim] = useState(false);

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

  const totalQty = Object.values(selectedSizes).reduce((a, b) => a + b, 0);
  const currentPrice = selectedDesign ? 1499 + (selectedDesign.canvas_state?.length || 0) * 150 : 0;
  const totalPrice = totalQty * currentPrice;

  const updateLocalSize = (size: string, delta: number) => {
    setSelectedSizes((prev) => ({
      ...prev,
      [size]: Math.max(0, prev[size] + delta),
    }));
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

  const handleSaveNewAddress = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;
    const updated = [...addresses, { id: crypto.randomUUID(), ...newAddr }];
    setAddresses(updated);
    await supabase.from('profiles').update({ saved_addresses: updated }).eq('id', profile.id);
    setIsAddingAddr(false);
    setNewAddr({ label: '', fullName: '', phone: '', address: '' });
  };

  const handleDeleteAddress = async (id: string) => {
    if (!profile) return;
    const updated = addresses.filter((a) => a.id !== id);
    setAddresses(updated);
    await supabase.from('profiles').update({ saved_addresses: updated }).eq('id', profile.id);
  };

  const formatDate = (isoString: string) => {
    return new Date(isoString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  if (isLoading) {
    return (
      <div className="w-full h-[100dvh] flex items-center justify-center bg-[#fbfbfd]">
        <Loader2 size={32} className="animate-spin text-neutral-300" />
      </div>
    );
  }

  if (!profile) return <Navigate to="/marketplace" replace />;

  return (
    <div className="w-full h-[100dvh] bg-[#fbfbfd] text-black font-sans flex flex-col selection:bg-neutral-200 overflow-y-auto overflow-x-hidden">
      <style>{`
        .hide-scrollbar::-webkit-scrollbar { display: none; }
      `}</style>

      {/* QUICK ADD TO CART MODAL */}
      {selectedDesign && (
        // biome-ignore lint/a11y/useKeyWithClickEvents: Modal backdrop overlay
        // biome-ignore lint/a11y/noStaticElementInteractions: Modal backdrop overlay
        <div
          className="fixed inset-0 z-[500] bg-black/40 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in"
          onClick={() => setSelectedDesign(null)}
        >
          {/* biome-ignore lint/a11y/useKeyWithClickEvents: Modal content container */}
          {/* biome-ignore lint/a11y/noStaticElementInteractions: Modal content container */}
          <div
            className="bg-white rounded-[2rem] p-6 sm:p-8 w-full max-w-sm shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center mb-6">
              <h3 className="font-extrabold text-xl">Select Sizes</h3>
              <button
                type="button"
                onClick={() => setSelectedDesign(null)}
                className="text-neutral-400 hover:text-black outline-none"
              >
                <X size={20} />
              </button>
            </div>

            <div className="space-y-3 mb-8">
              {['S', 'M', 'L', 'XL', 'XXL'].map((size) => (
                <div
                  key={size}
                  className="flex items-center justify-between p-2 rounded-xl hover:bg-neutral-50 transition-colors"
                >
                  <span className="font-extrabold text-sm w-12">{size}</span>
                  <div className="flex items-center gap-4 bg-white border border-black/10 rounded-xl p-1 shadow-sm">
                    <button
                      type="button"
                      onClick={() => updateLocalSize(size, -1)}
                      disabled={selectedSizes[size] === 0}
                      className="w-8 h-8 flex items-center justify-center text-neutral-400 hover:text-black disabled:opacity-30 transition-colors outline-none"
                    >
                      <Minus size={14} strokeWidth={3} />
                    </button>
                    <span className="font-bold w-4 text-center text-sm">{selectedSizes[size]}</span>
                    <button
                      type="button"
                      onClick={() => updateLocalSize(size, 1)}
                      className="w-8 h-8 flex items-center justify-center text-neutral-400 hover:text-black transition-colors outline-none"
                    >
                      <Plus size={14} strokeWidth={3} />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <button
              type="button"
              onClick={confirmAddToCart}
              disabled={totalQty === 0 || isAdding}
              className="w-full h-14 bg-black hover:bg-neutral-800 disabled:bg-neutral-300 text-white rounded-xl font-extrabold flex items-center justify-center transition-all shadow-[0_8px_20px_rgba(0,0,0,0.12)]"
            >
              {isAdding ? (
                <span className="flex items-center gap-2">
                  <Check size={18} /> Added to Cart
                </span>
              ) : (
                `Add to Cart • ₹${totalPrice}`
              )}
            </button>
          </div>
        </div>
      )}

      <header className="h-16 bg-white/80 backdrop-blur-2xl border-b border-black/5 flex items-center justify-between px-4 sm:px-6 lg:px-10 shrink-0 z-20 sticky top-0">
        <Link to="/" className="hover:opacity-70 transition-opacity outline-none">
          <img
            src="/logo.png"
            alt={env.VITE_APP_NAME}
            className="h-7 md:h-8 w-auto object-contain drop-shadow-sm"
          />
        </Link>
        <div className="flex items-center gap-5 sm:gap-6">
          <Link
            to="/marketplace"
            className="text-[10px] sm:text-xs font-bold uppercase tracking-widest text-neutral-500 hover:text-black transition-colors outline-none"
          >
            Collection
          </Link>
          <Link
            to="/editor"
            className="text-[10px] sm:text-xs font-bold uppercase tracking-widest text-neutral-500 hover:text-black transition-colors outline-none"
          >
            Studio
          </Link>

          <div className="w-px h-4 bg-black/10 mx-1 sm:mx-2" />

          {/* Global Cart Icon */}
          <Link
            to="/checkout"
            className={`relative flex items-center justify-center transition-all duration-300 outline-none ${cartAnim ? 'scale-125 text-green-600 drop-shadow-md' : 'text-black hover:opacity-70'}`}
          >
            <ShoppingBag size={20} />
            {totalCartItems > 0 && (
              <span className="absolute -top-1.5 -right-2 bg-red-500 text-white text-[9px] font-extrabold w-4 h-4 rounded-full flex items-center justify-center">
                {totalCartItems}
              </span>
            )}
          </Link>

          <button
            type="button"
            onClick={logout}
            className="text-[10px] sm:text-xs font-bold uppercase tracking-widest text-red-400 hover:text-red-600 transition-colors sm:ml-2 flex items-center gap-1.5 outline-none"
          >
            <LogOut size={14} className="hidden sm:block" /> Sign Out
          </button>
        </div>
      </header>

      <main className="flex-1 max-w-[1200px] w-full mx-auto px-4 sm:px-6 lg:px-10 py-6 sm:py-8 lg:py-16 pb-24">
        <div className="mb-6 md:mb-16">
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-extrabold tracking-tight mb-2">
            Account
          </h1>
          <p className="text-neutral-500 font-medium text-sm md:text-base truncate">
            {profile?.full_name ? `Welcome back, ${profile.full_name}.` : user?.email}
          </p>
        </div>

        <div className="relative border-b border-black/10 mb-8 md:mb-12">
          <div
            className="flex items-center gap-6 sm:gap-8 overflow-x-auto w-full hide-scrollbar pt-1"
            style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
          >
            {[
              { id: 'orders', label: 'Order History', icon: <Package size={16} /> },
              { id: 'designs', label: 'Saved Designs', icon: <ImageIcon size={16} /> },
              { id: 'addresses', label: 'Addresses', icon: <MapPin size={16} /> },
              { id: 'settings', label: 'Preferences', icon: <Settings2 size={16} /> },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id as Tab)}
                className={`flex items-center gap-2 pb-4 text-[10px] sm:text-xs font-extrabold uppercase tracking-widest transition-all whitespace-nowrap outline-none border-b-2 shrink-0 ${
                  activeTab === tab.id
                    ? 'text-black border-black'
                    : 'text-neutral-400 border-transparent hover:text-neutral-600'
                }`}
              >
                {tab.icon} {tab.label}
              </button>
            ))}
          </div>
        </div>

        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
          {activeTab === 'orders' && (
            <div>
              {orders.length === 0 ? (
                <div className="text-center py-16 md:py-20 bg-neutral-50 rounded-[2rem] border border-black/5">
                  <p className="text-neutral-400 font-medium mb-4 text-sm md:text-base">
                    You haven't placed any orders yet.
                  </p>
                  <Link
                    to="/marketplace"
                    className="inline-flex items-center justify-center px-6 py-3 bg-black text-white text-xs font-bold rounded-full hover:bg-neutral-800 transition-colors"
                  >
                    Explore Collection
                  </Link>
                </div>
              ) : (
                <div className="space-y-4">
                  {orders.map((order) => (
                    <div
                      key={order.id}
                      className="flex flex-col md:flex-row md:items-center justify-between p-4 sm:p-6 bg-white border border-black/5 rounded-[2rem] shadow-sm gap-4 hover:shadow-md transition-shadow"
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-14 h-14 sm:w-16 sm:h-16 bg-neutral-100 rounded-2xl flex items-center justify-center shrink-0 overflow-hidden relative cursor-grab active:cursor-grabbing">
                          {order.design_id && order.designs ? (
                            <Mini3DViewer
                              canvasState={order.designs.canvas_state as Record<string, unknown>[]}
                              tshirtColor={order.designs.tshirt_color}
                              fallbackImage={order.designs.thumbnail_url}
                              apparelModel={
                                (order.designs as { apparel_model?: string }).apparel_model ||
                                'tshirtman'
                              }
                            />
                          ) : (
                            <Package size={20} className="text-neutral-500" />
                          )}
                        </div>
                        <div>
                          <p className="font-bold text-sm">
                            {order.marketplace_item_id ? 'Premium Apparel' : 'Custom Studio Design'}
                          </p>
                          <p className="text-[10px] md:text-xs text-neutral-500 font-medium mt-0.5">
                            {formatDate(order.created_at)} • Size {order.size} • Qty{' '}
                            {order.quantity}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center justify-between md:justify-end gap-6 md:w-1/3 border-t border-black/5 md:border-0 pt-3 md:pt-0">
                        <div className="text-left md:text-right">
                          <p className="font-extrabold text-sm">₹{order.amount}</p>
                          <span
                            className={`inline-block mt-1 px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest rounded-full ${
                              order.status === 'processing'
                                ? 'bg-amber-100 text-amber-700'
                                : order.status === 'shipped'
                                  ? 'bg-blue-100 text-blue-700'
                                  : order.status === 'delivered'
                                    ? 'bg-green-100 text-green-700'
                                    : 'bg-neutral-100 text-neutral-500'
                            }`}
                          >
                            {order.status}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'designs' && (
            <div>
              {designs.length === 0 ? (
                <div className="text-center py-16 md:py-20 bg-neutral-50 rounded-[2rem] border border-black/5">
                  <p className="text-neutral-400 font-medium mb-4 text-sm md:text-base">
                    Your studio canvas is empty.
                  </p>
                  <Link
                    to="/editor"
                    className="inline-flex items-center justify-center px-6 py-3 bg-black text-white text-xs font-bold rounded-full hover:bg-neutral-800 transition-colors"
                  >
                    Open Studio
                  </Link>
                </div>
              ) : (
                <div className="grid grid-cols-1 min-[480px]:grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">
                  {designs.map((design) => (
                    <div
                      key={design.id}
                      className="group relative bg-white border border-black/5 rounded-3xl overflow-hidden shadow-sm hover:shadow-md transition-all flex flex-col"
                    >
                      <div className="aspect-square bg-neutral-100 relative cursor-grab active:cursor-grabbing w-full">
                        <Mini3DViewer
                          canvasState={design.canvas_state as Record<string, unknown>[]}
                          tshirtColor={design.tshirt_color}
                          fallbackImage={design.thumbnail_url}
                          apparelModel={
                            (design as { apparel_model?: string }).apparel_model || 'tshirtman'
                          }
                        />
                        <button
                          type="button"
                          onClick={() => deleteDesign(design.id)}
                          className="absolute top-3 right-3 p-2 bg-white/90 backdrop-blur-md rounded-full text-neutral-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all shadow-sm outline-none z-10"
                          title="Delete Design"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                      <div className="p-4 border-t border-black/5 flex items-center justify-between bg-white z-10">
                        <div className="truncate pr-2">
                          <h3 className="text-xs font-bold truncate">
                            {design.name || 'Untitled'}
                          </h3>
                          <p className="text-[10px] text-neutral-500 mt-0.5">
                            {formatDate(design.created_at)}
                          </p>
                        </div>
                        <div className="flex gap-2 shrink-0">
                          <button
                            type="button"
                            onClick={() => handleOpenSizeModal(design)}
                            className="w-8 h-8 rounded-full bg-black/5 flex items-center justify-center hover:bg-black hover:text-white transition-colors outline-none"
                            title="Select Size & Add to Cart"
                          >
                            <ShoppingBag size={14} />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleEditDesign(design.id)}
                            className="w-8 h-8 rounded-full bg-black/5 flex items-center justify-center hover:bg-black hover:text-white transition-colors outline-none"
                            title="Edit Design"
                          >
                            <ArrowRight size={14} />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'addresses' && (
            <div className="space-y-6 max-w-4xl">
              <div className="flex justify-between items-center bg-white border border-black/5 rounded-[2rem] p-5 sm:p-6 shadow-sm">
                <div>
                  <h2 className="text-xs sm:text-sm font-extrabold uppercase tracking-widest text-black">
                    Address Book
                  </h2>
                  <p className="text-[10px] sm:text-xs font-semibold text-neutral-500 mt-1">
                    Manage your delivery destinations.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsAddingAddr(!isAddingAddr)}
                  className="bg-black text-white px-3 sm:px-4 py-2 rounded-xl text-[10px] sm:text-xs font-bold flex items-center gap-1.5 hover:bg-neutral-800 transition-colors shrink-0 outline-none"
                >
                  <Plus size={14} /> Add New
                </button>
              </div>

              {isAddingAddr && (
                <form
                  onSubmit={handleSaveNewAddress}
                  className="bg-white border border-black/5 rounded-[2rem] p-5 sm:p-8 shadow-sm space-y-4 animate-in slide-in-from-top-4"
                >
                  <h3 className="text-xs font-extrabold uppercase tracking-widest text-neutral-400 mb-4">
                    New Delivery Address
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label
                        htmlFor="new-label"
                        className="text-[10px] font-extrabold text-neutral-400 uppercase tracking-widest ml-1"
                      >
                        Label (e.g. Home, Office)
                      </Label>
                      <Input
                        id="new-label"
                        value={newAddr.label}
                        onChange={(e) => setNewAddr({ ...newAddr, label: e.target.value })}
                        className="bg-neutral-50 h-12 rounded-xl mt-1"
                        required
                      />
                    </div>
                    <div>
                      <Label
                        htmlFor="new-fullname"
                        className="text-[10px] font-extrabold text-neutral-400 uppercase tracking-widest ml-1"
                      >
                        Recipient Name
                      </Label>
                      <Input
                        id="new-fullname"
                        value={newAddr.fullName}
                        onChange={(e) => setNewAddr({ ...newAddr, fullName: e.target.value })}
                        className="bg-neutral-50 h-12 rounded-xl mt-1"
                        required
                      />
                    </div>
                    <div>
                      <Label
                        htmlFor="new-phone"
                        className="text-[10px] font-extrabold text-neutral-400 uppercase tracking-widest ml-1"
                      >
                        Phone Number
                      </Label>
                      <Input
                        id="new-phone"
                        value={newAddr.phone}
                        onChange={(e) => setNewAddr({ ...newAddr, phone: e.target.value })}
                        className="bg-neutral-50 h-12 rounded-xl mt-1"
                        required
                      />
                    </div>
                    <div>
                      <Label
                        htmlFor="new-address"
                        className="text-[10px] font-extrabold text-neutral-400 uppercase tracking-widest ml-1"
                      >
                        Complete Address
                      </Label>
                      <Input
                        id="new-address"
                        value={newAddr.address}
                        onChange={(e) => setNewAddr({ ...newAddr, address: e.target.value })}
                        className="bg-neutral-50 h-12 rounded-xl mt-1"
                        required
                      />
                    </div>
                  </div>
                  <div className="flex justify-end pt-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setIsAddingAddr(false)}
                      className="px-4 sm:px-5 h-12 rounded-xl text-[10px] sm:text-xs font-bold text-neutral-500 hover:bg-neutral-100 transition-colors outline-none"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="px-5 sm:px-6 h-12 rounded-xl text-[10px] sm:text-xs font-bold bg-black text-white hover:bg-neutral-800 transition-colors shadow-md outline-none"
                    >
                      Save Address
                    </button>
                  </div>
                </form>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {addresses.map((addr) => (
                  <div
                    key={addr.id}
                    className="p-5 sm:p-6 bg-white border border-black/5 rounded-3xl shadow-sm flex flex-col justify-between relative group hover:shadow-md transition-shadow"
                  >
                    <button
                      type="button"
                      onClick={() => handleDeleteAddress(addr.id)}
                      className="absolute top-4 right-4 p-2 text-neutral-300 hover:text-red-500 transition-colors focus:text-red-500 outline-none"
                      title="Delete Address"
                    >
                      <Trash2 size={16} />
                    </button>
                    <div className="mb-4">
                      <span className="text-[10px] font-extrabold uppercase tracking-widest bg-neutral-100 text-neutral-600 px-3 py-1 rounded-full">
                        {addr.label}
                      </span>
                    </div>
                    <div>
                      <p className="font-extrabold text-sm">{addr.fullName}</p>
                      <p className="text-xs mt-1 font-medium text-neutral-500">{addr.address}</p>
                      <p className="text-xs mt-1 font-semibold text-neutral-400">
                        Phone: {addr.phone}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'settings' && (
            <div className="max-w-xl">
              <div className="bg-white border border-black/5 rounded-[2rem] p-5 sm:p-8 shadow-sm">
                <h2 className="text-xs sm:text-sm font-extrabold uppercase tracking-widest mb-6">
                  Profile details
                </h2>
                <div className="space-y-6">
                  <div>
                    <label
                      htmlFor="profile-email"
                      className="block text-[10px] font-extrabold text-neutral-400 uppercase tracking-widest mb-2"
                    >
                      Email Address
                    </label>
                    <input
                      id="profile-email"
                      type="email"
                      disabled
                      readOnly
                      value={user?.email || ''}
                      className="w-full bg-neutral-50 border-transparent text-neutral-500 rounded-xl h-12 px-4 font-semibold outline-none cursor-not-allowed"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="profile-name"
                      className="block text-[10px] font-extrabold text-neutral-400 uppercase tracking-widest mb-2"
                    >
                      Full Name
                    </label>
                    <input
                      id="profile-name"
                      type="text"
                      placeholder="Add your name"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      className="w-full bg-neutral-50 border-transparent focus:bg-white focus:ring-2 focus:ring-black/10 rounded-xl h-12 px-4 font-semibold outline-none transition-all"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={handleSaveProfile}
                    disabled={isUpdatingProfile}
                    className="w-full sm:w-auto h-12 px-6 bg-black text-white text-xs font-bold rounded-xl hover:bg-neutral-800 disabled:bg-neutral-300 transition-all shadow-[0_8px_20px_rgba(0,0,0,0.12)] flex items-center justify-center gap-2 outline-none"
                  >
                    {isUpdatingProfile && <Loader2 size={14} className="animate-spin" />} Save
                    Changes
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
