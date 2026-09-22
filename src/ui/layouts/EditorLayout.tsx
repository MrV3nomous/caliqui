import {
  Check,
  CheckCircle2,
  Hand,
  Layers,
  LayoutGrid,
  Loader2,
  Minus,
  MousePointer2,
  Pencil,
  Plus,
  Save,
  Settings2,
  Shirt,
  ShoppingBag,
  Sparkles,
  Store,
  User as UserIcon,
  X,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router';
import { env } from '@/shared/env';
import { AuthModal } from '@/ui/components/AuthModal';
import { ContextMenu } from '@/ui/components/ContextMenu';
import { DrawingWorkspace } from '@/ui/components/DrawingWorkspace';
import { LayersPanel } from '@/ui/components/LayersPanel';
import { PremiumLoader } from '@/ui/components/PremiumLoader';
import { Preview3D } from '@/ui/components/Preview3D';
import { Toolbar } from '@/ui/components/Toolbar';
import { Workspace } from '@/ui/components/Workspace';
import { IconButton } from '@/ui/design-system';
import { useKeyboardShortcuts } from '@/ui/hooks/useKeyboardShortcuts';
import { useAuthStore } from '@/ui/store/auth-store';
import { useCheckoutStore } from '@/ui/store/checkout-store';
import { useEditorStore } from '@/ui/store/editor-store';

export function EditorLayout() {
  const {
    init,
    isDrawingMode,
    globalToolMode,
    setGlobalToolMode,
    setSelectedId,
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
  const [showMobileNameInput, setShowMobileNameInput] = useState(false);

  const mobileInputRef = useRef<HTMLInputElement>(null);

  const [isOrderModalOpen, setIsOrderModalOpen] = useState(false);
  const [isResetModalOpen, setIsResetModalOpen] = useState(false);

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

  useEffect(() => {
    if (showMobileNameInput && mobileInputRef.current) {
      mobileInputRef.current.focus();
    }
  }, [showMobileNameInput]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        e.target instanceof HTMLSelectElement
      ) {
        return;
      }

      if (e.code === 'Space' || e.key.toLowerCase() === 'v') {
        e.preventDefault();
        const currentMode = useEditorStore.getState().globalToolMode;
        if (currentMode === 'camera') {
          useEditorStore.getState().setGlobalToolMode('default');
        } else {
          useEditorStore.getState().setGlobalToolMode('camera');
          useEditorStore.getState().setSelectedId(null);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const totalCartItems = cart.reduce(
    (acc, item) => acc + Object.values(item.sizes).reduce((a, b) => a + b, 0),
    0,
  );

  const totalQty = Object.values(selectedSizes).reduce((a, b) => a + b, 0);
  const currentPrice = 1499 + decals.length * 150;
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
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
    }
  };

  const handleOrderIntent = async () => {
    if (!isAuthenticated) return openAuthModal();
    try {
      setIsSaving(true);
      await saveDesign();
      setIsSaving(false);
      setIsOrderModalOpen(true);
      setSelectedSizes({ S: 0, M: 1, L: 0, XL: 0, XXL: 0 });
      setFocusedSize('M');
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
    <div className="w-screen h-dvh flex flex-col bg-[#fbfbfd] font-sans overflow-hidden relative selection:bg-neutral-200 text-black select-none">
      {isInitializing && <PremiumLoader fullScreen={true} />}

      <ContextMenu />
      <AuthModal />

      {/* QUICK ACCESS TOGGLE (EDIT & MOVE) - Beautiful Left-Side Vertical Pill */}
      <div className="absolute top-24 left-4 sm:left-6 z-40 flex flex-col p-1.5 bg-white/60 backdrop-blur-3xl shadow-[0_8px_32px_-8px_rgba(0,0,0,0.15)] border border-white/50 ring-1 ring-black/[0.03] rounded-[1.5rem] pointer-events-auto">
        <button
          type="button"
          onClick={() => setGlobalToolMode('default')}
          className={`flex items-center justify-center w-10 h-10 rounded-full transition-all duration-400 ease-[cubic-bezier(0.23,1,0.32,1)] outline-none mb-1.5 ${
            globalToolMode === 'default'
              ? 'bg-black text-white shadow-[0_4px_12px_rgba(0,0,0,0.3)] scale-105'
              : 'text-neutral-500 hover:text-black hover:bg-white hover:shadow-sm active:scale-95'
          }`}
          title="Edit Mode (V)"
        >
          <MousePointer2 size={16} strokeWidth={2} />
        </button>

        <button
          type="button"
          onClick={() => {
            setGlobalToolMode('camera');
            setSelectedId(null);
          }}
          className={`flex items-center justify-center w-10 h-10 rounded-full transition-all duration-400 ease-[cubic-bezier(0.23,1,0.32,1)] outline-none ${
            globalToolMode === 'camera'
              ? 'bg-black text-white shadow-[0_4px_12px_rgba(0,0,0,0.3)] scale-105'
              : 'text-neutral-500 hover:text-black hover:bg-white hover:shadow-sm active:scale-95'
          }`}
          title="Move Camera (Space)"
        >
          <Hand size={16} strokeWidth={2} />
        </button>
      </div>

      {isResetModalOpen && (
        <div className="fixed inset-0 z-600 flex items-center justify-center p-4">
          <button
            type="button"
            aria-label="Close modal"
            className="absolute inset-0 w-full h-full bg-black/40 backdrop-blur-sm outline-none cursor-default border-0 p-0 m-0 animate-in fade-in duration-300"
            onClick={() => setIsResetModalOpen(false)}
          />
          <div
            role="dialog"
            aria-modal="true"
            className="relative z-10 bg-white rounded-3xl p-8 w-full max-w-90 shadow-2xl text-center animate-in zoom-in-95 duration-300 ease-out"
          >
            <h3 className="font-medium text-lg tracking-tight text-black mb-2">Reset Canvas?</h3>
            <p className="text-xs text-neutral-500 mb-8 leading-relaxed">
              This action cannot be undone. All unsaved changes will be permanently lost.
            </p>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setIsResetModalOpen(false)}
                className="flex-1 h-12 rounded-xl text-xs font-medium tracking-wide bg-neutral-100 text-black hover:bg-neutral-200 transition-colors outline-none"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmReset}
                className="flex-1 h-12 rounded-xl text-xs font-medium tracking-wide bg-red-500 text-white hover:bg-red-600 transition-colors outline-none"
              >
                Reset
              </button>
            </div>
          </div>
        </div>
      )}

      {isOrderModalOpen && (
        <div className="fixed inset-0 z-500 flex items-center justify-center p-4">
          <button
            type="button"
            aria-label="Close modal"
            className="absolute inset-0 w-full h-full bg-black/40 backdrop-blur-sm outline-none cursor-default border-0 p-0 m-0 animate-in fade-in duration-300"
            onClick={() => setIsOrderModalOpen(false)}
          />

          <div
            role="dialog"
            aria-modal="true"
            className="relative z-10 bg-white rounded-4xl p-6 sm:p-8 w-full max-w-105 shadow-2xl animate-in zoom-in-95 duration-300 ease-out"
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
                onClick={() => setIsOrderModalOpen(false)}
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

      {isDrawingMode && <DrawingWorkspace />}

      <main className="absolute inset-0 z-0">
        <Preview3D />
        <Workspace />
      </main>

      {isBrushToolActive && (
        <div className="absolute top-20 left-1/2 -translate-x-1/2 z-100 bg-white/95 backdrop-blur-md border border-black/5 shadow-[0_8px_30px_rgba(0,0,0,0.08)] rounded-full px-6 py-2.5 flex items-center gap-6 animate-in zoom-in-95 pointer-events-auto">
          {globalToolMode === 'fill' ? (
            <div className="flex items-center gap-3">
              <span className="text-[9px] font-medium text-neutral-500 uppercase tracking-[0.2em]">
                Fill
              </span>
              <input
                type="color"
                value={brushSettings.color}
                onChange={(e) => setBrushSettings({ color: e.target.value })}
                className="w-6 h-6 rounded-full cursor-pointer p-0 border-0"
              />
            </div>
          ) : (
            <>
              <div className="flex items-center gap-4 w-32 shrink-0">
                <span className="text-[9px] font-medium text-neutral-500 uppercase tracking-[0.2em]">
                  Size
                </span>
                <input
                  type="range"
                  min="1"
                  max="200"
                  value={brushSettings.size}
                  onChange={(e) => setBrushSettings({ size: Number(e.target.value) })}
                  className="w-full accent-black"
                />
              </div>
              <div className="flex items-center gap-4 w-32 shrink-0">
                <span className="text-[9px] font-medium text-neutral-500 uppercase tracking-[0.2em]">
                  Flow
                </span>
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

      <header className="h-17.5 w-full bg-white/95 backdrop-blur-md border-b border-black/4 flex items-center justify-between px-3 sm:px-6 z-40 shrink-0 select-none gap-2 sticky top-0">
        <div
          className={`flex items-center gap-1.5 sm:gap-4 shrink-0 transition-opacity duration-300 min-w-0 ${showMobileNameInput ? 'hidden sm:flex' : 'flex'}`}
        >
          <Link
            to="/"
            className="flex items-center hover:opacity-60 transition-opacity outline-none mr-1 sm:mr-2 shrink-0"
          >
            <img
              src="/logo.png"
              alt={env.VITE_APP_NAME}
              className="h-5 sm:h-6 w-auto object-contain"
            />
          </Link>

          <Link
            to="/marketplace"
            className="flex items-center gap-1.5 px-2 sm:px-3 h-9 rounded-full text-neutral-500 hover:text-black hover:bg-neutral-100 transition-colors outline-none shrink-0"
            title="Collection"
          >
            <Store size={15} strokeWidth={1.5} />
            <span className="hidden md:inline uppercase tracking-[0.15em] text-[10px] font-medium">
              Collection
            </span>
          </Link>

          <Link
            to="/editor"
            className="hidden sm:flex items-center gap-1.5 px-2 sm:px-3 h-9 rounded-full text-black bg-neutral-100 transition-colors outline-none pointer-events-none shrink-0"
            title="Studio"
          >
            <Sparkles size={15} strokeWidth={1.5} />
            <span className="hidden md:inline uppercase tracking-[0.15em] text-[10px] font-medium">
              Studio
            </span>
          </Link>

          {isAuthenticated ? (
            <Link
              to="/dashboard"
              className="flex items-center justify-center w-9 h-9 rounded-full text-neutral-500 hover:text-black hover:bg-neutral-100 transition-colors outline-none shrink-0"
              title="Account"
            >
              <LayoutGrid size={15} strokeWidth={1.5} />
            </Link>
          ) : (
            <button
              type="button"
              onClick={openAuthModal}
              className="flex items-center justify-center w-9 h-9 rounded-full text-neutral-500 hover:text-black hover:bg-neutral-100 transition-colors outline-none shrink-0"
              title="Sign In"
            >
              <UserIcon size={15} strokeWidth={1.5} />
            </button>
          )}

          <Link
            to="/checkout"
            className={`relative flex items-center justify-center w-9 h-9 rounded-full text-neutral-500 hover:text-black hover:bg-neutral-100 transition-colors outline-none shrink-0 ${cartAnim ? 'scale-110' : ''}`}
            title="Cart"
          >
            <ShoppingBag size={16} strokeWidth={1.5} />
            {totalCartItems > 0 && (
              <span className="absolute top-1 right-0 flex items-center justify-center min-w-3.5 h-3.5 bg-black text-white text-[8px] font-bold rounded-full px-1 shadow-sm border border-white">
                {totalCartItems}
              </span>
            )}
          </Link>
        </div>

        <div
          className={`flex items-center gap-1.5 sm:gap-2 min-w-0 ${showMobileNameInput ? 'w-full justify-between' : 'justify-end shrink'}`}
        >
          <div
            className={`flex items-center transition-all min-w-0 ${showMobileNameInput ? 'flex-1 bg-[#fbfbfd] border border-black/5 rounded-full p-1 shadow-sm' : 'sm:bg-[#fbfbfd] sm:border sm:border-black/5 sm:rounded-full sm:p-1 sm:shadow-sm'}`}
          >
            {!showMobileNameInput && (
              <button
                type="button"
                onClick={() => setShowMobileNameInput(true)}
                className="sm:hidden flex items-center justify-center w-8 h-8 rounded-full text-neutral-500 hover:text-black hover:bg-neutral-100 transition-colors outline-none shrink-0"
                title="Edit Design Name"
              >
                <Pencil size={14} strokeWidth={1.5} />
              </button>
            )}

            <div
              className={`relative items-center px-2 min-w-0 ${showMobileNameInput ? 'flex flex-1' : 'hidden sm:flex shrink'}`}
            >
              <input
                ref={mobileInputRef}
                type="text"
                value={designName || ''}
                onChange={(e) => setDesignName(e.target.value)}
                onBlur={() => setShowMobileNameInput(false)}
                className="bg-transparent text-[11px] font-medium tracking-wide text-center w-full sm:max-w-30 md:max-w-40 py-1 outline-none text-black placeholder:text-neutral-400 truncate min-w-0"
                placeholder="Untitled Design"
              />
              <Pencil
                size={10}
                strokeWidth={1.5}
                className="text-neutral-400 ml-1 hidden sm:block pointer-events-none shrink-0"
              />
              {showMobileNameInput && (
                <button
                  type="button"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    setShowMobileNameInput(false);
                  }}
                  className="sm:hidden text-neutral-400 hover:text-black p-1 shrink-0 outline-none ml-1"
                >
                  <Check size={14} strokeWidth={2} />
                </button>
              )}
            </div>

            <div
              className={`w-px h-3 bg-neutral-200 mx-1 shrink-0 ${showMobileNameInput ? 'hidden' : 'hidden sm:block'}`}
            />

            <button
              type="button"
              onClick={() => setIsResetModalOpen(true)}
              className={`items-center justify-center h-7 px-2.5 text-[10px] uppercase tracking-widest font-medium text-neutral-500 hover:text-black hover:bg-neutral-200 rounded-full transition-colors outline-none gap-1 shrink-0 ${showMobileNameInput ? 'hidden sm:flex' : 'flex'}`}
              title="New Design"
            >
              <Plus size={12} strokeWidth={1.5} />
              <span className="hidden xl:inline">New</span>
            </button>

            <button
              type="button"
              onClick={handleManualSave}
              disabled={isSaving}
              className={`items-center justify-center h-7 px-2.5 text-[10px] uppercase tracking-widest font-medium text-neutral-500 hover:text-black hover:bg-neutral-200 rounded-full transition-colors disabled:opacity-50 outline-none gap-1 shrink-0 ${showMobileNameInput ? 'hidden sm:flex' : 'flex'}`}
              title="Save Design"
            >
              {isSaving ? (
                <Loader2 size={12} strokeWidth={1.5} className="animate-spin shrink-0" />
              ) : showSaveSuccess ? (
                <CheckCircle2 size={12} strokeWidth={1.5} className="text-black shrink-0" />
              ) : (
                <Save size={12} strokeWidth={1.5} className="shrink-0" />
              )}
              <span className="hidden xl:inline">Save</span>
            </button>
          </div>

          <button
            type="button"
            onClick={handleOrderIntent}
            className={`items-center justify-center h-8 sm:h-9 px-3 sm:px-4 bg-black text-white hover:bg-neutral-800 rounded-full text-[10px] uppercase tracking-[0.15em] font-medium transition-transform active:scale-95 shadow-md outline-none gap-1.5 shrink-0 ml-1 sm:ml-2 ${showMobileNameInput ? 'hidden sm:flex' : 'flex'}`}
            title="Add to Cart"
          >
            <ShoppingBag size={13} strokeWidth={1.5} className="shrink-0" />
            <span className="hidden lg:inline whitespace-nowrap">Add to Cart</span>
          </button>

          <IconButton
            className={`lg:hidden bg-white border border-black/5 rounded-full shrink-0 w-8 h-8 sm:w-9 sm:h-9 shadow-sm outline-none ml-0.5 sm:ml-2 ${showMobileNameInput ? 'hidden' : 'flex'}`}
            onClick={() => setShowRightDock(!showRightDock)}
            title="Settings & Layers"
          >
            <Settings2 size={14} strokeWidth={1.5} className="text-black" />
          </IconButton>
        </div>
      </header>

      <div className="absolute bottom-4 sm:bottom-6 left-0 w-full z-40 flex justify-center pointer-events-none">
        <Toolbar />
      </div>

      {!showRightDock && (
        <button
          type="button"
          onClick={() => setShowRightDock(true)}
          className="absolute right-0 top-1/2 -translate-y-1/2 z-30 bg-white/95 backdrop-blur-xl shadow-[-8px_0_24px_rgba(0,0,0,0.04)] border border-black/5 border-r-0 rounded-l-2xl py-4 px-2 text-black hover:pr-4 transition-all duration-300 flex items-center justify-center pointer-events-auto outline-none"
          title="Open Layers"
        >
          <Layers size={18} strokeWidth={1.5} className="text-neutral-500" />
        </button>
      )}

      {!showLeftDock && (
        <button
          type="button"
          onClick={() => setShowLeftDock(true)}
          className="absolute left-0 top-1/2 -translate-y-1/2 z-30 bg-white/95 backdrop-blur-xl shadow-[8px_0_24px_rgba(0,0,0,0.04)] border border-black/5 border-l-0 rounded-r-2xl py-4 px-2 text-black hover:pl-4 transition-all duration-300 flex items-center justify-center pointer-events-auto outline-none"
          title="Select Apparel"
        >
          <Shirt size={18} strokeWidth={1.5} className="text-neutral-500" />
        </button>
      )}

      {(showRightDock || showLeftDock) && (
        <button
          type="button"
          aria-label="Close panels"
          className="lg:hidden absolute inset-0 w-full h-full bg-black/20 z-40 backdrop-blur-sm transition-opacity animate-in fade-in outline-none cursor-default border-0 p-0 m-0"
          onClick={() => {
            setShowRightDock(false);
            setShowLeftDock(false);
          }}
        />
      )}

      <div
        className={`absolute top-0 left-0 h-full w-70 z-50 p-0 lg:p-4 lg:pt-21 transition-transform duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] pointer-events-none ${showLeftDock ? 'translate-x-0' : '-translate-x-full'}`}
      >
        <div className="w-full h-auto max-h-[calc(100dvh-2rem)] bg-white/95 backdrop-blur-3xl shadow-[20px_0_40px_rgba(0,0,0,0.06)] lg:border border-black/4 lg:rounded-3xl overflow-hidden flex flex-col pointer-events-auto relative">
          <div className="h-14 flex items-center justify-between px-6 border-b border-black/5 shrink-0">
            <span className="font-medium text-[10px] uppercase tracking-[0.2em] text-neutral-400">
              Apparel
            </span>
            <IconButton onClick={() => setShowLeftDock(false)}>
              <X size={16} strokeWidth={1.5} className="text-black" />
            </IconButton>
          </div>
          <div className="p-4 space-y-3 overflow-y-auto flex-1">
            <button
              type="button"
              onClick={() => setApparelModel('tshirtman')}
              className={`w-full p-4 rounded-2xl border transition-all flex items-center gap-3 font-medium text-xs tracking-wide outline-none ${
                apparelModel === 'tshirtman'
                  ? 'border-black bg-neutral-50/50 text-black shadow-sm'
                  : 'border-transparent text-neutral-500 hover:bg-neutral-100'
              }`}
            >
              <Shirt size={16} strokeWidth={1.5} /> Men's T-Shirt
            </button>
            <button
              type="button"
              onClick={() => setApparelModel('tshirtwoman')}
              className={`w-full p-4 rounded-2xl border transition-all flex items-center gap-3 font-medium text-xs tracking-wide outline-none ${
                apparelModel === 'tshirtwoman'
                  ? 'border-black bg-neutral-50/50 text-black shadow-sm'
                  : 'border-transparent text-neutral-500 hover:bg-neutral-100'
              }`}
            >
              <Shirt size={16} strokeWidth={1.5} /> Women's T-Shirt
            </button>
          </div>
        </div>
      </div>

      <div
        className={`absolute top-0 right-0 h-full w-[320px] lg:w-90 z-50 p-0 lg:p-4 lg:pt-21 transition-transform duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] pointer-events-none ${showRightDock ? 'translate-x-0' : 'translate-x-full'}`}
      >
        <div className="w-full h-full bg-white/95 backdrop-blur-3xl shadow-[-20px_0_40px_rgba(0,0,0,0.06)] lg:border border-black/4 lg:rounded-3xl overflow-hidden flex flex-col pointer-events-auto relative">
          <div className="h-14 flex items-center justify-between px-6 border-b border-black/5 shrink-0">
            <span className="font-medium text-[10px] uppercase tracking-[0.2em] text-neutral-400">
              Layers & Settings
            </span>
            <IconButton onClick={() => setShowRightDock(false)}>
              <X size={16} strokeWidth={1.5} className="text-black" />
            </IconButton>
          </div>
          <LayersPanel />
        </div>
      </div>
    </div>
  );
}
