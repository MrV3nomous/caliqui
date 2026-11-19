import {
  Check,
  CheckCircle2,
  ChevronDown,
  Palette,
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
  Sparkles,
  Store,
  User as UserIcon,
  X,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router';
import { env } from '@/shared/env';
import { AuthModal } from '@/ui/components/AuthModal';
import { ContextMenu } from '@/ui/components/ContextMenu';
import { DrawingWorkspace } from '@/ui/components/DrawingWorkspace';
import { LayersPanel } from '@/ui/components/LayersPanel';
import { PremiumLoader } from '@/ui/components/PremiumLoader';
import { Preview3D } from '@/ui/components/Preview3D';
import { Toolbar } from '@/ui/components/Toolbar';
import { getStudioAppearance, isStudioEnvironment, STUDIO_ENVIRONMENTS, type StudioEnvironment } from '@/ui/studio-environments';
import { Workspace } from '@/ui/components/Workspace';
import { IconButton } from '@/ui/design-system';
import { useKeyboardShortcuts } from '@/ui/hooks/useKeyboardShortcuts';
import { useAuthStore } from '@/ui/store/auth-store';
import { useCheckoutStore } from '@/ui/store/checkout-store';
import { useEditorStore } from '@/ui/store/editor-store';

type StudioThemeMenuPosition = {
  left: number;
  top: number;
  width: number;
  maxHeight: number;
  sheet: boolean;
};

function getStudioThemeMenuPosition(anchor: DOMRect): StudioThemeMenuPosition {
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;
  const sheet = viewportWidth < 920;

  if (sheet) {
    const width = Math.max(280, viewportWidth - 24);
    return {
      left: 12,
      top: 0,
      width,
      maxHeight: Math.min(Math.round(viewportHeight * 0.72), 600),
      sheet: true,
    };
  }

  const width = Math.min(432, viewportWidth - 24);
  const maxHeight = Math.min(620, viewportHeight - 104);
  // On desktop the picker opens to the left of its trigger, keeping it clear
  // of the right inspector and reducing overlap with the garment itself.
  const left = Math.max(12, Math.min(anchor.left - width - 12, viewportWidth - width - 12));
  const top = Math.max(78, Math.min(anchor.bottom + 8, viewportHeight - maxHeight - 12));
  return { left, top, width, maxHeight, sheet: false };
}

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
  const [viewportMode, setViewportMode] = useState<'mobile' | 'tablet' | 'desktop'>(() =>
    typeof window === 'undefined' ? 'desktop' : window.innerWidth < 640 ? 'mobile' : window.innerWidth < 1200 ? 'tablet' : 'desktop',
  );
  const [studioEnvironment, setStudioEnvironment] = useState<StudioEnvironment>(() => {
    if (typeof window === 'undefined') return 'pure';
    try {
      const savedPreset = window.localStorage.getItem('caliqui-studio-preset');
      if (isStudioEnvironment(savedPreset)) return savedPreset;

      const legacyEnvironment = window.localStorage.getItem('caliqui-studio-environment');
      const legacyTheme = window.localStorage.getItem('caliqui-studio-theme');
      if (isStudioEnvironment(legacyEnvironment)) {
        const legacyAppearance = getStudioAppearance(legacyEnvironment);
        // Migrate the old independent appearance toggle into a coherent preset.
        if (legacyTheme === 'dark' && legacyAppearance === 'light') return 'graphite';
        if (legacyTheme === 'light' && legacyAppearance === 'dark') return 'pure';
        return legacyEnvironment;
      }
      return legacyTheme === 'dark' ? 'graphite' : 'pure';
    } catch {
      return 'pure';
    }
  });
  const studioTheme = getStudioAppearance(studioEnvironment);
  const activeStudioTheme = STUDIO_ENVIRONMENTS.find((theme) => theme.id === studioEnvironment) ?? STUDIO_ENVIRONMENTS[0];
  const [showStudioThemeMenu, setShowStudioThemeMenu] = useState(false);
  const [studioThemeMenuPosition, setStudioThemeMenuPosition] = useState<StudioThemeMenuPosition | null>(null);
  const studioThemeMenuRef = useRef<HTMLDivElement>(null);
  const studioThemeTriggerRef = useRef<HTMLButtonElement>(null);
  const studioThemePopoverRef = useRef<HTMLDivElement>(null);
  const viewportModeRef = useRef(viewportMode);
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

    return () => {
      mounted = false;
    };
  }, [init]);

  useEffect(() => {
    const updateViewport = () => {
      const width = window.innerWidth;
      const nextMode = width < 640 ? 'mobile' : width < 1200 ? 'tablet' : 'desktop';
      setViewportMode(nextMode);
      if (viewportModeRef.current !== nextMode) {
        viewportModeRef.current = nextMode;
        setShowLeftDock(false);
        setShowRightDock(nextMode === 'desktop');
      }
    };
    if (window.innerWidth >= 1200) setShowRightDock(true);
    updateViewport();
    window.addEventListener('resize', updateViewport);
    window.addEventListener('orientationchange', updateViewport);
    return () => {
      window.removeEventListener('resize', updateViewport);
      window.removeEventListener('orientationchange', updateViewport);
    };
  }, []);

  useEffect(() => {
    document.body.dataset.studioTheme = studioTheme;
    document.body.dataset.studioEnvironment = studioEnvironment;
    document.documentElement.style.colorScheme = studioTheme;
    try {
      // The preset is the single source of truth. Legacy keys stay in sync for
      // users who roll back to a previous Studio build.
      window.localStorage.setItem('caliqui-studio-preset', studioEnvironment);
      window.localStorage.setItem('caliqui-studio-theme', studioTheme);
      window.localStorage.setItem('caliqui-studio-environment', studioEnvironment);
    } catch {
      // The selected preset remains available for the current session.
    }
    return () => {
      delete document.body.dataset.studioTheme;
      delete document.body.dataset.studioEnvironment;
      document.documentElement.style.colorScheme = '';
    };
  }, [studioTheme, studioEnvironment]);

  useEffect(() => {
    if (!showStudioThemeMenu) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setShowStudioThemeMenu(false);
    };
    const reposition = () => {
      const anchor = studioThemeTriggerRef.current?.getBoundingClientRect();
      if (anchor) setStudioThemeMenuPosition(getStudioThemeMenuPosition(anchor));
    };
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('resize', reposition);
    window.addEventListener('orientationchange', reposition);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('resize', reposition);
      window.removeEventListener('orientationchange', reposition);
    };
  }, [showStudioThemeMenu]);

  useEffect(() => {
    if (showMobileNameInput && mobileInputRef.current) {
      mobileInputRef.current.focus();
    }
  }, [showMobileNameInput]);



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
    <div data-studio-theme={studioTheme} data-studio-environment={studioEnvironment} className="studio-shell w-screen h-dvh flex flex-col bg-[#fbfbfd] font-sans overflow-hidden relative selection:bg-neutral-200 text-black select-none">
      {isInitializing && <PremiumLoader fullScreen={true} />}

      <ContextMenu />
      <AuthModal />
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

            <p className="text-xs text-neutral-500 mb-4 text-center">
              Choose the quantity for each size.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-6">
              {['S', 'M', 'L', 'XL', 'XXL'].map((size) => {
                const qty = selectedSizes[size] || 0;
                return (
                  <div key={size} className="flex items-center justify-between gap-3 rounded-xl border border-neutral-200 bg-white px-3 py-2.5">
                    <span className="w-10 text-sm font-semibold text-neutral-800">{size}</span>
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        aria-label={`Remove one size ${size}`}
                        onClick={() => updateLocalSize(size, -1)}
                        disabled={qty === 0}
                        className="w-9 h-9 rounded-lg border border-neutral-200 flex items-center justify-center text-neutral-700 hover:bg-neutral-50 disabled:opacity-30 disabled:cursor-not-allowed"
                      >
                        <Minus size={14} />
                      </button>
                      <output aria-live="polite" className="w-5 text-center text-sm font-semibold tabular-nums">{qty}</output>
                      <button
                        type="button"
                        aria-label={`Add one size ${size}`}
                        onClick={() => updateLocalSize(size, 1)}
                        className="w-9 h-9 rounded-lg bg-neutral-900 text-white flex items-center justify-center hover:bg-neutral-700"
                      >
                        <Plus size={14} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="flex items-center justify-between px-5 py-4 bg-[#fbfbfd] border border-black/4 rounded-2xl mb-8">
              <span className="text-xs font-medium text-neutral-500">Total quantity</span>
              <span className="text-sm font-semibold text-black tabular-nums">{totalQty}</span>
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

      <main
        className="studio-stage absolute inset-0 z-0"
        data-studio-environment={studioEnvironment}
        style={{ top: 70 }}
      >
        <Preview3D />
        <Workspace />
      </main>

      {globalToolMode === 'camera' && !isDrawingMode && (
        <div
          role="status"
          aria-live="polite"
          className="absolute top-20 left-1/2 -translate-x-1/2 z-30 max-w-[calc(100vw-2rem)] rounded-full border border-black/5 bg-white/85 px-4 py-2 text-[11px] sm:text-xs text-neutral-600 shadow-lg backdrop-blur-xl pointer-events-none text-center"
        >
          Temporary view · Drag to rotate · Scroll or pinch to zoom · Release Space to return
        </div>
      )}

      {isBrushToolActive && (
        <div className="absolute bottom-[calc(env(safe-area-inset-bottom)+6rem)] left-1/2 -translate-x-1/2 z-100 max-w-[calc(100vw-1rem)] bg-white/95 backdrop-blur-md border border-black/5 shadow-[0_8px_30px_rgba(0,0,0,0.08)] rounded-2xl sm:rounded-full px-3 sm:px-6 py-2.5 flex flex-wrap items-center justify-center gap-x-4 gap-y-2 sm:gap-6 animate-in zoom-in-95 pointer-events-auto">
          {globalToolMode === 'fill' ? (
            <div className="flex items-center gap-3">
              <label htmlFor="studio-brush-color" className="text-[9px] font-medium text-neutral-500 uppercase tracking-[0.2em]">
                Fill
              </label>
              <input
                id="studio-brush-color"
                type="color"
                value={brushSettings.color}
                onChange={(e) => setBrushSettings({ color: e.target.value })}
                className="w-6 h-6 rounded-full cursor-pointer p-0 border-0"
              />
            </div>
          ) : (
            <>
              <div className="flex items-center gap-3 w-28 sm:w-32 shrink-0">
                <label htmlFor="studio-brush-size" className="text-[9px] font-medium text-neutral-500 uppercase tracking-[0.2em]">
                  Size
                </label>
                <input
                  id="studio-brush-size"
                  type="range"
                  min="1"
                  max="200"
                  value={brushSettings.size}
                  onChange={(e) => setBrushSettings({ size: Number(e.target.value) })}
                  className="w-full accent-black"
                />
              </div>
              <div className="flex items-center gap-3 w-28 sm:w-32 shrink-0">
                <label htmlFor="studio-brush-flow" className="text-[9px] font-medium text-neutral-500 uppercase tracking-[0.2em]">
                  Flow
                </label>
                <input
                  id="studio-brush-flow"
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

      <header className="studio-header h-17.5 w-full bg-white/95 backdrop-blur-md border-b border-black/4 flex items-center justify-between px-3 sm:px-6 z-40 shrink-0 select-none gap-2 sticky top-0">
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
            className="studio-header-action flex items-center gap-1.5 px-2 sm:px-3 h-9 rounded-full text-neutral-500 hover:text-black hover:bg-neutral-100 transition-colors outline-none shrink-0"
            title="Collection"
          >
            <Store size={15} strokeWidth={1.5} />
            <span className="hidden md:inline uppercase tracking-[0.15em] text-[10px] font-medium">
              Collection
            </span>
          </Link>

          <Link
            to="/editor"
            className="studio-header-action studio-header-action--current hidden sm:flex items-center gap-1.5 px-2 sm:px-3 h-9 rounded-full text-black bg-neutral-100 transition-colors outline-none pointer-events-none shrink-0"
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
              className="studio-header-icon flex items-center justify-center w-9 h-9 rounded-full text-neutral-500 hover:text-black hover:bg-neutral-100 transition-colors outline-none shrink-0"
              title="Account"
            >
              <LayoutGrid size={15} strokeWidth={1.5} />
            </Link>
          ) : (
            <button
              type="button"
              onClick={openAuthModal}
              className="studio-header-icon flex items-center justify-center w-9 h-9 rounded-full text-neutral-500 hover:text-black hover:bg-neutral-100 transition-colors outline-none shrink-0"
              title="Sign In"
            >
              <UserIcon size={15} strokeWidth={1.5} />
            </button>
          )}

          <Link
            to="/checkout"
            className={`studio-header-icon relative flex items-center justify-center w-9 h-9 rounded-full text-neutral-500 hover:text-black hover:bg-neutral-100 transition-colors outline-none shrink-0 ${cartAnim ? 'scale-110' : ''}`}
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
            className={`studio-document-controls flex items-center transition-all min-w-0 ${showMobileNameInput ? 'flex-1' : ''}`}
          >
            {!showMobileNameInput && (
              <button
                type="button"
                onClick={() => setShowMobileNameInput(true)}
                className="studio-document-action sm:hidden flex items-center justify-center w-8 h-8 rounded-full text-neutral-500 hover:text-black hover:bg-neutral-100 transition-colors outline-none shrink-0"
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
                className="studio-document-name bg-transparent text-[11px] font-medium tracking-wide text-center w-full sm:max-w-30 md:max-w-40 py-1 outline-none text-black placeholder:text-neutral-400 truncate min-w-0"
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
                  className="studio-document-action sm:hidden text-neutral-400 hover:text-black p-1 shrink-0 outline-none ml-1"
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
              className={`studio-document-action items-center justify-center h-7 px-2.5 text-[10px] uppercase tracking-widest font-medium text-neutral-500 hover:text-black hover:bg-neutral-200 rounded-full transition-colors outline-none gap-1 shrink-0 ${showMobileNameInput ? 'hidden sm:flex' : 'flex'}`}
              title="New Design"
            >
              <Plus size={12} strokeWidth={1.5} />
              <span className="hidden xl:inline">New</span>
            </button>

            <button
              type="button"
              onClick={handleManualSave}
              disabled={isSaving}
              className={`studio-document-action items-center justify-center h-7 px-2.5 text-[10px] uppercase tracking-widest font-medium text-neutral-500 hover:text-black hover:bg-neutral-200 rounded-full transition-colors disabled:opacity-50 outline-none gap-1 shrink-0 ${showMobileNameInput ? 'hidden sm:flex' : 'flex'}`}
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

          <div ref={studioThemeMenuRef} className="studio-theme-menu-wrap relative shrink-0">
            <button
              ref={studioThemeTriggerRef}
              type="button"
              aria-haspopup="dialog"
              aria-expanded={showStudioThemeMenu}
              aria-label={`Studio theme: ${activeStudioTheme.label}`}
              title={`Studio theme: ${activeStudioTheme.label}`}
              onClick={() => {
                if (showStudioThemeMenu) {
                  setShowStudioThemeMenu(false);
                  return;
                }
                const anchor = studioThemeTriggerRef.current?.getBoundingClientRect();
                if (anchor) setStudioThemeMenuPosition(getStudioThemeMenuPosition(anchor));
                setShowStudioThemeMenu(true);
              }}
              className="studio-theme-menu-trigger inline-flex h-8 sm:h-9 items-center justify-center gap-1.5 rounded-full px-2.5 sm:px-3 outline-none transition-colors"
            >
              <span className="studio-theme-trigger-swatch" data-environment={studioEnvironment} aria-hidden="true" />
              <Palette size={14} strokeWidth={1.7} />
              <span className="hidden sm:inline text-[10px] font-semibold tracking-[0.08em]">Themes</span>
              <ChevronDown size={12} className={`hidden sm:block transition-transform ${showStudioThemeMenu ? 'rotate-180' : ''}`} />
            </button>
          </div>

          {showStudioThemeMenu && studioThemeMenuPosition && typeof document !== 'undefined' && createPortal(
            <>
              <button
                type="button"
                aria-label="Close theme selector"
                className={`studio-theme-backdrop ${studioThemeMenuPosition.sheet ? 'is-sheet' : ''}`}
                onClick={() => setShowStudioThemeMenu(false)}
              />
              <div
                ref={studioThemePopoverRef}
                role="dialog"
                aria-modal={studioThemeMenuPosition.sheet}
                aria-label="Choose a Studio theme"
                data-sheet={studioThemeMenuPosition.sheet ? 'true' : 'false'}
                className="studio-theme-menu fixed z-[501] rounded-2xl p-3 sm:p-4 shadow-2xl animate-in fade-in zoom-in-95 duration-150"
                style={{
                  left: studioThemeMenuPosition.left,
                  top: studioThemeMenuPosition.sheet ? 'auto' : studioThemeMenuPosition.top,
                  bottom: studioThemeMenuPosition.sheet ? 'max(10px, env(safe-area-inset-bottom))' : 'auto',
                  width: studioThemeMenuPosition.width,
                  maxHeight: studioThemeMenuPosition.maxHeight,
                }}
              >
                <div className="studio-theme-menu-header mb-3 flex items-center justify-between gap-3 border-b pb-3">
                  <div className="min-w-0">
                    <p className="studio-theme-menu-kicker">Studio collection</p>
                    <p className="studio-theme-menu-title mt-1">Choose your atmosphere</p>
                    <p className="studio-theme-menu-description mt-0.5">A complete workspace identity, not just a backdrop.</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <span className="studio-theme-menu-current hidden sm:inline-flex">{activeStudioTheme.label}</span>
                    <button
                      type="button"
                      aria-label="Close themes"
                      onClick={() => setShowStudioThemeMenu(false)}
                      className="studio-theme-menu-close grid h-8 w-8 shrink-0 place-items-center rounded-full"
                    >
                      <X size={15} />
                    </button>
                  </div>
                </div>
                <div className="studio-theme-menu-grid">
                  {STUDIO_ENVIRONMENTS.map((theme) => {
                    const isActive = studioEnvironment === theme.id;
                    return (
                      <button
                        key={theme.id}
                        type="button"
                        aria-pressed={isActive}
                        onClick={() => {
                          setStudioEnvironment(theme.id);
                          setShowStudioThemeMenu(false);
                        }}
                        className="studio-theme-card min-w-0 rounded-xl border p-2 text-left outline-none transition-all"
                        data-active={isActive ? 'true' : 'false'}
                      >
                        <span className="studio-environment-swatch block" data-environment={theme.id} aria-hidden="true" />
                        <span className="mt-1.5 flex min-w-0 items-center justify-between gap-1">
                          <span className="truncate text-[10px] sm:text-[11px] font-semibold">{theme.label}</span>
                          {isActive && <Check size={13} className="shrink-0" aria-hidden="true" />}
                        </span>
                        <span className="studio-theme-card-description mt-0.5 block text-[9px] leading-snug">{theme.description}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </>,
            document.body,
          )}

          <button
            type="button"
            onClick={handleOrderIntent}
            className={`studio-primary-cta items-center justify-center h-8 sm:h-9 px-3 sm:px-4 bg-black text-white hover:bg-neutral-800 rounded-full text-[10px] uppercase tracking-[0.15em] font-medium transition-transform active:scale-95 shadow-md outline-none gap-1.5 shrink-0 ml-1 sm:ml-2 ${showMobileNameInput ? 'hidden sm:flex' : 'flex'}`}
            title="Add to Cart"
          >
            <ShoppingBag size={13} strokeWidth={1.5} className="shrink-0" />
            <span className="hidden lg:inline whitespace-nowrap">Add to Cart</span>
          </button>

          <IconButton
            className={`${viewportMode === 'mobile' ? 'flex' : 'hidden'} bg-white border border-black/5 rounded-full shrink-0 w-8 h-8 shadow-sm outline-none ml-0.5 ${showMobileNameInput ? 'hidden' : ''}`}
            onClick={() => { setShowRightDock(false); setShowLeftDock(!showLeftDock); }}
            title="Choose Apparel"
            aria-label="Choose apparel"
          >
            <Shirt size={14} strokeWidth={1.5} className="text-black" />
          </IconButton>

          <IconButton
            className={`${viewportMode === 'desktop' ? 'hidden' : 'flex'} bg-white border border-black/5 rounded-full shrink-0 w-8 h-8 sm:w-9 sm:h-9 shadow-sm outline-none ml-0.5 sm:ml-2 ${showMobileNameInput ? 'hidden' : ''}`}
            onClick={() => { setShowLeftDock(false); setShowRightDock(!showRightDock); }}
            title="Settings & Layers"
          >
            <Settings2 size={14} strokeWidth={1.5} className="text-black" />
          </IconButton>
        </div>
      </header>

      <div
        className="studio-toolbar-dock absolute bottom-[max(0.75rem,env(safe-area-inset-bottom))] z-40 flex justify-center px-2 pointer-events-none transition-[left,right] duration-300"
      >
        <Toolbar onOpenApparel={() => { setShowRightDock(false); setShowLeftDock(true); }} />
      </div>

      {!showRightDock && (
        <button
          type="button"
          onClick={() => { setShowLeftDock(false); setShowRightDock(true); }}
          className={`studio-edge-toggle ${viewportMode === 'mobile' ? 'hidden' : 'flex'} absolute right-0 top-1/2 -translate-y-1/2 z-30 bg-white/95 backdrop-blur-xl shadow-[-8px_0_24px_rgba(0,0,0,0.04)] border border-black/5 border-r-0 rounded-l-2xl py-4 px-2 text-black hover:pr-4 transition-all duration-300 items-center justify-center pointer-events-auto outline-none`}
          title="Open Layers"
        >
          <Layers size={18} strokeWidth={1.5} className="text-neutral-500" />
        </button>
      )}

      {(showRightDock || showLeftDock) && (
        <button
          type="button"
          aria-label="Close panels"
          className={`${viewportMode === 'desktop' ? 'hidden' : 'block'} absolute inset-0 w-full h-full bg-black/20 z-40 backdrop-blur-sm transition-opacity animate-in fade-in outline-none cursor-default border-0 p-0 m-0`}
          onClick={() => {
            setShowRightDock(false);
            setShowLeftDock(false);
          }}
        />
      )}

      <div
        className={`absolute z-50 pointer-events-none transition-transform duration-300 ease-out ${viewportMode === 'mobile' ? `left-0 right-0 bottom-0 top-auto w-full h-[min(72dvh,560px)] p-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))] ${showLeftDock ? 'translate-y-0' : 'translate-y-full'}` : `top-0 left-0 h-full ${viewportMode === 'tablet' ? 'w-[min(72vw,320px)] p-2 pt-20' : 'w-[min(86vw,280px)] p-4 pt-21'} ${showLeftDock ? 'translate-x-0' : '-translate-x-full'}`}`}
      >
        <div className={`studio-panel-shell studio-apparel-drawer w-full ${viewportMode === 'mobile' ? 'h-full rounded-t-3xl' : 'h-full max-h-[calc(100dvh-1rem)] rounded-3xl'} bg-white/95 backdrop-blur-3xl shadow-[0_18px_50px_rgba(0,0,0,0.10)] border border-black/5 overflow-hidden flex flex-col pointer-events-auto relative`}>
          <div className="studio-panel-heading h-14 flex items-center justify-between px-6 border-b border-black/5 shrink-0">
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
              data-active={apparelModel === 'tshirtman'}
              className={`studio-drawer-option w-full p-4 rounded-2xl border transition-all flex items-center gap-3 font-medium text-xs tracking-wide outline-none ${
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
              data-active={apparelModel === 'tshirtwoman'}
              className={`studio-drawer-option w-full p-4 rounded-2xl border transition-all flex items-center gap-3 font-medium text-xs tracking-wide outline-none ${
                apparelModel === 'tshirtwoman'
                  ? 'border-black bg-neutral-50/50 text-black shadow-sm'
                  : 'border-transparent text-neutral-500 hover:bg-neutral-100'
              }`}
            >
              <Shirt size={16} strokeWidth={1.5} /> Women's T-Shirt
            </button>
            <button
              type="button"
              onClick={() => setApparelModel('tshirtoversized')}
              data-active={apparelModel === 'tshirtoversized'}
              className={`studio-drawer-option w-full p-4 rounded-2xl border transition-all flex items-center gap-3 font-medium text-xs tracking-wide outline-none ${
                apparelModel === 'tshirtoversized'
                  ? 'border-black bg-neutral-50/50 text-black shadow-sm'
                  : 'border-transparent text-neutral-500 hover:bg-neutral-100'
              }`}
            >
              <Shirt size={16} strokeWidth={1.5} /> Oversized T-Shirt
            </button>
          </div>
        </div>
      </div>

      <div
        className={`absolute z-50 pointer-events-none transition-transform duration-300 ease-out ${viewportMode === 'mobile' ? `left-0 right-0 bottom-0 top-auto w-full h-[min(78dvh,620px)] p-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))] ${showRightDock ? 'translate-y-0' : 'translate-y-full'}` : `top-0 right-0 h-full ${viewportMode === 'tablet' ? 'w-[min(82vw,360px)] p-2 pt-20' : 'w-[min(92vw,360px)] p-4 pt-21'} ${showRightDock ? 'translate-x-0' : 'translate-x-full'}`}`}
      >
        <div className={`studio-panel-shell studio-apparel-drawer w-full ${viewportMode === 'mobile' ? 'h-full rounded-t-3xl' : 'h-full max-h-[calc(100dvh-1rem)] rounded-3xl'} bg-white/95 backdrop-blur-3xl shadow-[0_18px_50px_rgba(0,0,0,0.10)] border border-black/5 overflow-hidden flex flex-col pointer-events-auto relative`}>
          <div className="studio-panel-heading h-14 flex items-center justify-between px-6 border-b border-black/5 shrink-0">
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
