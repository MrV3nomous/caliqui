import {
  Check,
  CheckCircle2,
  Layers,
  LayoutGrid,
  Loader2,
  Minus,
  Pencil,
  Plus,
  Save,
  Settings2,
  Shirt,
  ShoppingBag,
  Store,
  User as UserIcon,
  X,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { env } from '@/shared/env';
import { AuthModal } from '@/ui/components/AuthModal';
import { ContextMenu } from '@/ui/components/ContextMenu';
import { DrawingWorkspace } from '@/ui/components/DrawingWorkspace';
import { LayersPanel } from '@/ui/components/LayersPanel';
import { Preview3D } from '@/ui/components/Preview3D';
import { Toolbar } from '@/ui/components/Toolbar';
import { Workspace } from '@/ui/components/Workspace';
import { IconButton, Label } from '@/ui/design-system';
import { useKeyboardShortcuts } from '@/ui/hooks/useKeyboardShortcuts';
import { useAuthStore } from '@/ui/store/auth-store';
import { useCheckoutStore } from '@/ui/store/checkout-store';
import { useEditorStore } from '@/ui/store/editor-store';

export function EditorLayout() {
  const {
    init,
    isDrawingMode,
    globalToolMode,
    brushSettings,
    setBrushSettings,
    designName,
    setDesignName,
    saveDesign,
    resetDesign,
    apparelModel,
    setApparelModel,
    decals,
    tshirtColor,
  } = useEditorStore();

  const { isAuthenticated, openAuthModal } = useAuthStore();
  const { cart, addToCart } = useCheckoutStore();

  useKeyboardShortcuts();

  const [isInitializing, setIsInitializing] = useState(true);
  const [showRightDock, setShowRightDock] = useState(false);
  const [showLeftDock, setShowLeftDock] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [showSaveSuccess, setShowSaveSuccess] = useState(false);

  // Modals State
  const [isOrderModalOpen, setIsOrderModalOpen] = useState(false);
  const [isResetModalOpen, setIsResetModalOpen] = useState(false);

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
    let mounted = true;

    const initializeEditor = async () => {
      try {
        await init();
      } finally {
        if (mounted) setIsInitializing(false);
      }
    };

    initializeEditor();

    if (typeof window !== 'undefined' && window.innerWidth >= 1024) {
      setShowRightDock(true);
    }

    return () => {
      mounted = false;
    };
  }, [init]);

  const totalCartItems = cart.reduce(
    (acc, item) => acc + Object.values(item.sizes).reduce((a, b) => a + b, 0),
    0,
  );

  const totalQty = Object.values(selectedSizes).reduce((a, b) => a + b, 0);
  const currentPrice = 1499 + decals.length * 150;
  const totalPrice = totalQty * currentPrice;

  const updateLocalSize = (size: string, delta: number) => {
    setSelectedSizes((prev) => ({
      ...prev,
      [size]: Math.max(0, prev[size] + delta),
    }));
  };

  const handleOrderIntent = async () => {
    if (!isAuthenticated) return openAuthModal();
    try {
      setIsSaving(true);
      await saveDesign();
      setIsSaving(false);
      setIsOrderModalOpen(true);
      setSelectedSizes({ S: 0, M: 1, L: 0, XL: 0, XXL: 0 });
    } catch (error) {
      setIsSaving(false);
      console.error('Failed to save design:', error);
    }
  };

  const confirmAddToCart = () => {
    setIsAdding(true);
    const state = useCheckoutStore.getState();
    const currentDesignId = useEditorStore.getState().activeDesignId;

    let existing = state.cart.find((c) => c.productId === currentDesignId);

    if (!existing && currentDesignId) {
      addToCart({
        type: 'custom',
        productId: currentDesignId,
        name: designName || 'Custom Studio Design',
        thumbnail: 'https://via.placeholder.com/512?text=3D+Model',
        canvasState: decals as unknown as Record<string, unknown>[],
        tshirtColor: tshirtColor,
        apparelModel: apparelModel,
        price: currentPrice,
      });
      const newState = useCheckoutStore.getState();
      existing = newState.cart.find((c) => c.productId === currentDesignId);
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
      setIsOrderModalOpen(false);
      setTimeout(() => setCartAnim(false), 1000);
    }, 800);
  };

  const handleManualSave = async () => {
    if (!isAuthenticated) return openAuthModal();
    setIsSaving(true);
    try {
      await saveDesign();
      setShowSaveSuccess(true);
      setTimeout(() => setShowSaveSuccess(false), 2000);
    } catch (error) {
      console.error('Failed to save design:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const confirmReset = () => {
    resetDesign();
    setIsResetModalOpen(false);
  };

  const isBrushToolActive = ['fill', 'blur', 'burn', 'saturate', 'erase'].includes(globalToolMode);

  return (
    <div className="w-screen h-[100dvh] flex flex-col bg-[#fbfbfd] font-sans overflow-hidden relative selection:bg-neutral-200">
      <style>{`
        .hide-scrollbar::-webkit-scrollbar {
          display: none;
        }
        .hide-scrollbar {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
      `}</style>

      {/* BOOTSTRAP INITIALIZATION OVERLAY */}
      {isInitializing && (
        <div className="fixed inset-0 z-[1000] bg-[#fbfbfd] flex flex-col items-center justify-center animate-out fade-out duration-500">
          <img
            src="/logo.png"
            alt={env.VITE_APP_NAME}
            className="h-8 mb-6 animate-pulse opacity-50 drop-shadow-sm"
          />
          <Loader2 size={24} className="animate-spin text-black" />
          <p className="text-[10px] font-extrabold text-neutral-400 uppercase tracking-widest mt-6">
            Initializing Studio
          </p>
        </div>
      )}

      <ContextMenu />
      <AuthModal />

      {/* CUSTOM RESET CANVAS MODAL */}
      {isResetModalOpen && (
        // biome-ignore lint/a11y/useKeyWithClickEvents: Modal backdrop overlay
        // biome-ignore lint/a11y/noStaticElementInteractions: Modal backdrop overlay
        <div
          className="fixed inset-0 z-[600] bg-black/40 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in"
          onClick={() => setIsResetModalOpen(false)}
        >
          {/* biome-ignore lint/a11y/useKeyWithClickEvents: Modal content container */}
          {/* biome-ignore lint/a11y/noStaticElementInteractions: Modal content container */}
          <div
            className="bg-white rounded-[2rem] p-6 sm:p-8 w-full max-w-sm shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="font-extrabold text-xl mb-2">Start Fresh?</h3>
            <p className="text-neutral-500 font-medium text-sm mb-8">
              Any unsaved changes will be lost. Are you sure you want to completely reset your
              canvas?
            </p>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setIsResetModalOpen(false)}
                className="flex-1 h-12 rounded-xl text-sm font-bold bg-neutral-100 text-neutral-600 hover:bg-neutral-200 transition-colors outline-none"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmReset}
                className="flex-1 h-12 rounded-xl text-sm font-bold bg-red-500 text-white hover:bg-red-600 transition-colors outline-none"
              >
                Reset Canvas
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SIZE SELECTION & ADD TO CART MODAL */}
      {isOrderModalOpen && (
        // biome-ignore lint/a11y/useKeyWithClickEvents: Modal backdrop overlay
        // biome-ignore lint/a11y/noStaticElementInteractions: Modal backdrop overlay
        <div
          className="fixed inset-0 z-[500] bg-black/40 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in"
          onClick={() => setIsOrderModalOpen(false)}
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
                onClick={() => setIsOrderModalOpen(false)}
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

      {isDrawingMode && <DrawingWorkspace />}

      {/* BACKGROUND 3D CANVAS */}
      <main className="absolute inset-0 z-0">
        <Preview3D />
        <Workspace />
      </main>

      {/* FLOATING BRUSH SETTINGS */}
      {isBrushToolActive && (
        <div className="absolute top-20 left-1/2 -translate-x-1/2 z-[100] bg-white/95 backdrop-blur-3xl border border-black/5 shadow-[0_8px_30px_rgb(0,0,0,0.08)] rounded-full px-6 py-2.5 flex items-center gap-6 animate-in zoom-in-95 pointer-events-auto">
          {globalToolMode === 'fill' ? (
            <div className="flex items-center gap-3">
              <Label className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest m-0">
                Fill
              </Label>
              <input
                type="color"
                value={brushSettings.color}
                onChange={(e) => setBrushSettings({ color: e.target.value })}
                className="w-6 h-6 rounded-full cursor-pointer p-0 border-0"
              />
            </div>
          ) : (
            <>
              <div className="flex items-center gap-3 w-32 shrink-0">
                <Label className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest m-0">
                  Size
                </Label>
                <input
                  type="range"
                  min="1"
                  max="200"
                  value={brushSettings.size}
                  onChange={(e) => setBrushSettings({ size: Number(e.target.value) })}
                  className="w-full accent-black"
                />
              </div>
              <div className="flex items-center gap-3 w-32 shrink-0">
                <Label className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest m-0">
                  Flow
                </Label>
                <input
                  type="range"
                  min="1"
                  max="100"
                  value={brushSettings.intensity}
                  onChange={(e) => setBrushSettings({ intensity: Number(e.target.value) })}
                  className="w-full accent-black"
                />
              </div>
            </>
          )}
        </div>
      )}

      {/* SEAMLESS LUXURY STUDIO HEADER */}
      <header className="h-16 w-full bg-[#fbfbfd]/80 backdrop-blur-2xl border-b border-black/[0.04] flex items-center justify-between px-3 sm:px-6 z-40 shrink-0 select-none gap-2">
        {/* LEFT: Logo & Store Navigation */}
        <div className="flex items-center gap-1 sm:gap-3 shrink-0">
          <Link
            to="/"
            className="flex items-center hover:opacity-70 transition-opacity outline-none mr-1"
          >
            <img
              src="/logo.png"
              alt={env.VITE_APP_NAME}
              className="h-6 sm:h-7 w-auto object-contain drop-shadow-sm"
            />
          </Link>

          <Link
            to="/marketplace"
            className="flex items-center gap-1.5 px-2.5 sm:px-3 h-9 rounded-full text-neutral-600 hover:text-black hover:bg-black/5 transition-all text-xs font-bold outline-none"
            title="Collection & Store"
          >
            <Store size={15} />
            <span className="hidden md:inline uppercase tracking-widest text-[10px]">
              Collection
            </span>
          </Link>

          <Link
            to="/checkout"
            className={`relative flex items-center justify-center w-9 h-9 rounded-full text-neutral-600 hover:text-black hover:bg-black/5 transition-all outline-none ${cartAnim ? 'scale-125 text-green-600' : ''}`}
            title="Cart"
          >
            <ShoppingBag size={16} />
            {totalCartItems > 0 && (
              <span className="absolute top-1 right-1 flex items-center justify-center min-w-[14px] h-[14px] bg-red-500 text-white text-[9px] font-black rounded-full px-1 shadow-sm border border-white">
                {totalCartItems}
              </span>
            )}
          </Link>

          {isAuthenticated ? (
            <Link
              to="/dashboard"
              className="flex items-center justify-center w-9 h-9 rounded-full text-neutral-600 hover:text-black hover:bg-black/5 transition-all outline-none"
              title="Dashboard"
            >
              <LayoutGrid size={15} />
            </Link>
          ) : (
            <button
              type="button"
              onClick={openAuthModal}
              className="flex items-center justify-center w-9 h-9 rounded-full text-neutral-600 hover:text-black hover:bg-black/5 transition-all outline-none"
              title="Sign In"
            >
              <UserIcon size={15} />
            </button>
          )}
        </div>

        {/* RIGHT: Unified Studio Suite (8. Rename, 2. New, 3. Save, 4. Add to Cart) */}
        <div className="flex items-center gap-1.5 shrink-0 min-w-0">
          <div className="flex items-center bg-white border border-black/5 rounded-full p-1 shadow-sm max-w-full">
            {/* 8. Rename Option */}
            <div className="relative flex items-center px-2 min-w-0">
              <input
                type="text"
                value={designName || ''}
                onChange={(e) => setDesignName(e.target.value)}
                className="bg-transparent text-xs sm:text-sm font-bold text-center w-20 sm:w-32 md:w-44 py-1 px-1 outline-none text-black placeholder:text-neutral-400 truncate"
                placeholder="Untitled"
              />
              <Pencil
                size={11}
                className="text-neutral-400 ml-1 hidden sm:block pointer-events-none shrink-0"
              />
            </div>

            <div className="w-px h-4 bg-black/10 mx-0.5 shrink-0" />

            {/* 2. New Design */}
            <button
              type="button"
              onClick={() => setIsResetModalOpen(true)}
              className="flex items-center justify-center h-8 px-2.5 text-xs font-bold text-neutral-500 hover:text-black hover:bg-neutral-100 rounded-full transition-all outline-none shrink-0 gap-1"
              title="Start New Design"
            >
              <Plus size={14} />
              <span className="hidden md:inline">New</span>
            </button>

            {/* 3. Save Design */}
            <button
              type="button"
              onClick={handleManualSave}
              disabled={isSaving}
              className="flex items-center justify-center h-8 px-2.5 text-xs font-bold text-neutral-500 hover:text-black hover:bg-neutral-100 rounded-full transition-all disabled:opacity-50 outline-none shrink-0 gap-1"
              title="Save Design"
            >
              {isSaving ? (
                <Loader2 size={14} className="animate-spin" />
              ) : showSaveSuccess ? (
                <CheckCircle2 size={14} className="text-green-500" />
              ) : (
                <Save size={14} />
              )}
              <span className="hidden md:inline">Save</span>
            </button>

            {/* 4. Add to Cart */}
            <button
              type="button"
              onClick={handleOrderIntent}
              className="flex items-center justify-center h-8 px-3.5 bg-black text-white hover:bg-neutral-800 rounded-full text-xs font-extrabold transition-transform active:scale-95 shadow-sm outline-none shrink-0 gap-1.5 ml-0.5"
              title="Add to Cart"
            >
              <ShoppingBag size={13} className="shrink-0" />
              <span className="whitespace-nowrap">Add to Cart</span>
            </button>
          </div>

          {/* Settings / Layers Dock Toggle on Mobile */}
          <IconButton
            className="lg:hidden bg-white border border-black/5 rounded-full shrink-0 w-9 h-9 shadow-sm outline-none ml-0.5"
            onClick={() => setShowRightDock(!showRightDock)}
            title="Settings & Layers"
          >
            <Settings2 size={15} className="text-neutral-700" />
          </IconButton>
        </div>
      </header>

      {/* HORIZONTAL BOTTOM DOCK (Unified Toolbar with Scrollbar Removed) */}
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-40 flex justify-center pointer-events-none w-[95vw] md:w-auto">
        <div className="bg-white/90 backdrop-blur-2xl shadow-[0_20px_60px_rgba(0,0,0,0.08)] border border-black/5 rounded-[2rem] p-1.5 pointer-events-auto max-w-full overflow-x-auto hide-scrollbar">
          <Toolbar />
        </div>
      </div>

      {/* UNIVERSAL RIGHT DOCK TOGGLE */}
      {!showRightDock && (
        <button
          type="button"
          onClick={() => setShowRightDock(true)}
          className="absolute right-0 top-1/2 -translate-y-1/2 z-30 bg-white/90 backdrop-blur-xl shadow-[-8px_0_24px_rgba(0,0,0,0.06)] border border-black/5 border-r-0 rounded-l-2xl py-4 px-2 text-black hover:pr-4 transition-all duration-300 flex items-center justify-center pointer-events-auto outline-none"
          title="Open Layers & Properties"
        >
          <Layers size={20} className="text-neutral-600" />
        </button>
      )}

      {/* UNIVERSAL LEFT DOCK TOGGLE (Apparel Switcher) */}
      {!showLeftDock && (
        <button
          type="button"
          onClick={() => setShowLeftDock(true)}
          className="absolute left-0 top-1/2 -translate-y-1/2 z-30 bg-white/90 backdrop-blur-xl shadow-[8px_0_24px_rgba(0,0,0,0.06)] border border-black/5 border-l-0 rounded-r-2xl py-4 px-2 text-black hover:pl-4 transition-all duration-300 flex items-center justify-center pointer-events-auto outline-none"
          title="Select Apparel"
        >
          <Shirt size={20} className="text-neutral-600" />
        </button>
      )}

      {/* BACKDROPS FOR MOBILE/TABLET */}
      {(showRightDock || showLeftDock) && (
        // biome-ignore lint/a11y/useKeyWithClickEvents: Mobile overlay backdrop
        // biome-ignore lint/a11y/noStaticElementInteractions: Mobile overlay backdrop
        <div
          className="lg:hidden absolute inset-0 bg-black/10 z-40 backdrop-blur-sm transition-opacity animate-in fade-in"
          onClick={() => {
            setShowRightDock(false);
            setShowLeftDock(false);
          }}
        />
      )}

      {/* LEFT DOCK: Apparel Switcher */}
      <div
        className={`absolute top-0 left-0 h-full w-[280px] z-50 p-0 lg:p-4 lg:pt-20 transition-transform duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] pointer-events-none ${showLeftDock ? 'translate-x-0' : '-translate-x-full'}`}
      >
        <div className="w-full h-auto max-h-[calc(100dvh-2rem)] bg-white/95 backdrop-blur-3xl shadow-[20px_0_40px_rgba(0,0,0,0.08)] lg:border border-black/5 lg:rounded-3xl overflow-hidden flex flex-col pointer-events-auto relative">
          <div className="h-14 flex items-center justify-between px-5 border-b border-black/5 shrink-0">
            <span className="font-extrabold text-sm uppercase tracking-widest text-neutral-400">
              Apparel
            </span>
            <IconButton onClick={() => setShowLeftDock(false)}>
              <X size={18} className="text-neutral-600" />
            </IconButton>
          </div>
          <div className="p-4 space-y-3 overflow-y-auto flex-1">
            <button
              type="button"
              onClick={() => setApparelModel('tshirtman')}
              className={`w-full p-4 rounded-2xl border-2 transition-all flex items-center gap-3 font-bold text-sm outline-none ${apparelModel === 'tshirtman' ? 'border-black bg-black/5' : 'border-transparent hover:bg-neutral-100'}`}
            >
              <Shirt size={18} /> Men's T-Shirt
            </button>
            <button
              type="button"
              onClick={() => setApparelModel('tshirtwoman')}
              className={`w-full p-4 rounded-2xl border-2 transition-all flex items-center gap-3 font-bold text-sm outline-none ${apparelModel === 'tshirtwoman' ? 'border-black bg-black/5' : 'border-transparent hover:bg-neutral-100'}`}
            >
              <Shirt size={18} /> Women's T-Shirt
            </button>
          </div>
        </div>
      </div>

      {/* RIGHT DOCK: Unified Layers & Properties */}
      <div
        className={`absolute top-0 right-0 h-full w-[320px] lg:w-[360px] z-50 p-0 lg:p-4 lg:pt-20 transition-transform duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] pointer-events-none ${showRightDock ? 'translate-x-0' : 'translate-x-full'}`}
      >
        <div className="w-full h-full bg-white/95 backdrop-blur-3xl shadow-[-20px_0_40px_rgba(0,0,0,0.08)] lg:shadow-[0_24px_48px_rgba(0,0,0,0.08)] lg:border border-black/5 lg:rounded-3xl overflow-hidden flex flex-col pointer-events-auto relative">
          <div className="h-14 flex items-center justify-between px-5 border-b border-black/5 lg:hidden shrink-0">
            <span className="font-extrabold text-sm uppercase tracking-widest text-neutral-400">
              Layers & Settings
            </span>
            <IconButton onClick={() => setShowRightDock(false)}>
              <X size={18} className="text-neutral-600" />
            </IconButton>
          </div>
          <LayersPanel />
        </div>
      </div>
    </div>
  );
}
