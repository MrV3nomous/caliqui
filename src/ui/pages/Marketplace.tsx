import { Check, Minus, Plus, Search, ShoppingBag, SlidersHorizontal, X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router';
import { env } from '@/shared/env';
import { AuthModal } from '@/ui/components/AuthModal';
import { Mini3DViewer } from '@/ui/components/Mini3DViewer';
import { PremiumLoader } from '@/ui/components/PremiumLoader';
import { useAuthStore } from '@/ui/store/auth-store';
import { useCheckoutStore } from '@/ui/store/checkout-store';
import type { MarketplaceItem } from '@/ui/store/marketplace-store';
import { useMarketplaceStore } from '@/ui/store/marketplace-store';

export function Marketplace() {
  const { isAuthenticated, openAuthModal } = useAuthStore();
  const { cart, addToCart } = useCheckoutStore();
  const { items, isLoading, fetchItems } = useMarketplaceStore();

  // Marketplace State
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<string>('All');

  // Product Selection State
  const [selectedProduct, setSelectedProduct] = useState<MarketplaceItem | null>(null);
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

  // Touch & Hold Logic for Mobile Size Removal
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isLongPress = useRef(false);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  const totalCartItems = cart.reduce(
    (acc, item) => acc + Object.values(item.sizes).reduce((a, b) => a + b, 0),
    0,
  );

  const totalQty = Object.values(selectedSizes).reduce((a, b) => a + b, 0);
  const totalPrice = selectedProduct ? totalQty * selectedProduct.price : 0;

  // Dynamically load categories based on fetched data
  const dynamicCategories = useMemo(() => {
    const categories = new Set(items.map((i) => i.collection || 'Core'));
    return ['All', ...Array.from(categories)];
  }, [items]);

  // Deep Search & Filter Logic (Intelligent Multi-word Match)
  const filteredItems = items.filter((item) => {
    const queryWords = searchQuery.toLowerCase().split(' ').filter(Boolean);
    const searchableText =
      `${item.name} ${item.description || ''} ${item.collection || ''}`.toLowerCase();

    // Check if EVERY word in the query exists anywhere in the searchable text
    const matchesSearch = queryWords.every((word) => searchableText.includes(word));
    const matchesCategory = activeCategory === 'All' || item.collection === activeCategory;

    return matchesSearch && matchesCategory;
  });

  const updateLocalSize = (size: string, delta: number) => {
    setSelectedSizes((prev) => ({
      ...prev,
      [size]: Math.max(0, prev[size] + delta),
    }));
  };

  // --- Advanced Luxury Size Interaction Handlers ---
  const handleSizeLeftClick = (e: React.MouseEvent, size: string) => {
    e.preventDefault();
    if (isLongPress.current) {
      isLongPress.current = false; // Reset lock so future taps work
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
    }, 500); // 500ms hold to remove
  };

  const handleTouchEnd = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
    }
  };
  // ------------------------------------------------

  const handleOpenProduct = (product: MarketplaceItem) => {
    setSelectedProduct(product);
    setSelectedSizes({ S: 0, M: 1, L: 0, XL: 0, XXL: 0 });
    setFocusedSize('M');
    document.body.style.overflow = 'hidden';
  };

  const handleCloseProduct = () => {
    setSelectedProduct(null);
    document.body.style.overflow = 'auto';
  };

  useEffect(() => {
    return () => {
      document.body.style.overflow = 'auto';
    };
  }, []);

  const confirmAddToCart = () => {
    if (!selectedProduct) return;
    setIsAdding(true);

    const state = useCheckoutStore.getState();
    let existing = state.cart.find((c) => c.productId === selectedProduct.id);

    if (!existing) {
      addToCart({
        type: 'marketplace',
        productId: selectedProduct.id,
        name: selectedProduct.name,
        thumbnail: selectedProduct.thumbnail_url,
        price: selectedProduct.price,
        canvasState: selectedProduct.canvas_state,
        tshirtColor: selectedProduct.tshirt_color,
        apparelModel: selectedProduct.apparel_model,
      });
      const newState = useCheckoutStore.getState();
      existing = newState.cart.find((c) => c.productId === selectedProduct.id);
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
      handleCloseProduct();
      setTimeout(() => setCartAnim(false), 1000);
    }, 800);
  };

  return (
    <div className="w-full h-[100dvh] flex flex-col bg-white font-sans selection:bg-neutral-200 text-black relative">
      {/* GLOBAL FULLSCREEN LOADER */}
      {isLoading && <PremiumLoader fullScreen={true} />}

      {/* LUXURY PRODUCT DRAWER */}
      {selectedProduct && (
        <div className="fixed inset-0 z-[500] flex justify-end">
          <button
            type="button"
            aria-label="Close product details"
            className="absolute inset-0 w-full h-full bg-black/40 backdrop-blur-sm outline-none cursor-default border-0 p-0 m-0 animate-in fade-in duration-700"
            onClick={handleCloseProduct}
          />

          <div
            role="dialog"
            aria-modal="true"
            className="relative z-10 w-full md:w-[860px] lg:w-[1000px] h-[100dvh] bg-white shadow-2xl flex flex-col md:flex-row animate-in slide-in-from-right duration-500 ease-[cubic-bezier(0.16,1,0.3,1)]"
          >
            <button
              type="button"
              onClick={handleCloseProduct}
              className="md:hidden absolute top-4 right-4 z-50 w-10 h-10 bg-white/90 backdrop-blur flex items-center justify-center rounded-full shadow-sm outline-none"
            >
              <X size={20} strokeWidth={1.5} />
            </button>

            {/* Left Media Area - Full column expansion prevents cropping on zoom */}
            <div className="w-full md:w-1/2 h-[45vh] md:h-full bg-[#f8f8f8] relative shrink-0 flex items-center justify-center border-b md:border-b-0 md:border-r border-black/5 overflow-hidden">
              {selectedProduct.canvas_state ? (
                /* The 3D Viewer is now completely unconstrained from the aspect-square box */
                <div className="absolute inset-0 w-full h-full pointer-events-auto cursor-grab active:cursor-grabbing drop-shadow-2xl mix-blend-multiply">
                  <Mini3DViewer
                    canvasState={selectedProduct.canvas_state}
                    tshirtColor={selectedProduct.tshirt_color || '#ffffff'}
                    fallbackImage={selectedProduct.thumbnail_url}
                    apparelModel={selectedProduct.apparel_model || 'tshirtman'}
                  />
                </div>
              ) : (
                /* Static imagery remains constrained so it doesn't look stretched or distorted */
                <div className="w-full h-full max-w-[400px] aspect-square relative drop-shadow-2xl p-8 lg:p-16">
                  <img
                    src={selectedProduct.thumbnail_url}
                    alt={selectedProduct.name}
                    className="w-full h-full object-contain mix-blend-multiply"
                  />
                </div>
              )}
            </div>

            {/* Right Details Area */}
            <div className="w-full md:w-1/2 h-[55vh] md:h-full flex flex-col bg-white relative">
              <button
                type="button"
                onClick={handleCloseProduct}
                className="hidden md:flex absolute top-6 right-6 z-50 text-neutral-400 hover:text-black transition-colors outline-none"
              >
                <X size={28} strokeWidth={1} />
              </button>

              <div className="px-8 py-10 md:px-12 md:py-16 flex flex-col flex-1 overflow-y-auto hide-scrollbar">
                <div className="mb-10">
                  <span className="text-[10px] font-medium uppercase tracking-[0.2em] text-neutral-400 mb-3 block">
                    {selectedProduct.collection || 'Core Collection'}
                  </span>
                  <h2 className="text-3xl md:text-4xl font-light tracking-tight leading-snug mb-3 text-black">
                    {selectedProduct.name}
                  </h2>
                  <p className="text-base font-normal text-neutral-500 tracking-wider">
                    ₹{selectedProduct.price.toLocaleString('en-IN')}
                  </p>
                </div>

                <div className="prose prose-sm text-neutral-500 font-light leading-relaxed mb-12 text-sm tracking-wide">
                  <p>
                    {selectedProduct.description ||
                      'A quintessential luxury garment, engineered with precision and crafted from the finest sustainably sourced materials. Designed to drape perfectly while maintaining structural integrity.'}
                  </p>
                </div>

                <div className="mt-auto">
                  <div className="flex justify-between items-center mb-6">
                    <span className="text-xs font-medium tracking-[0.1em] uppercase text-black">
                      Select Size
                    </span>
                    <span className="text-[10px] uppercase tracking-[0.1em] text-neutral-400 cursor-pointer hover:text-black transition-colors underline underline-offset-4">
                      Size Guide
                    </span>
                  </div>

                  {/* Minimalist Size Selector */}
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
                          className={`relative h-14 flex items-center justify-center text-[13px] font-medium transition-all outline-none border-b-2 select-none touch-none ${
                            isFocused
                              ? 'border-black text-black bg-neutral-50/50'
                              : 'border-transparent text-neutral-400 hover:text-black hover:border-black/20'
                          }`}
                        >
                          {size}
                          {qty > 0 && !isFocused && (
                            <span className="absolute top-1 right-2 w-[14px] h-[14px] bg-black text-white text-[8px] font-bold flex items-center justify-center rounded-full shadow-sm animate-in zoom-in border border-white">
                              {qty}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>

                  {/* Contextual Stepper for the Focused Size */}
                  <div className="flex items-center justify-between px-5 py-4 bg-[#fbfbfd] border border-black/[0.03] rounded-2xl mb-10 transition-all">
                    <span className="text-[10px] font-medium uppercase tracking-[0.1em] text-neutral-500">
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
                    className="w-full h-[60px] bg-black hover:bg-neutral-800 disabled:bg-neutral-100 disabled:text-neutral-400 text-white font-normal uppercase tracking-[0.2em] text-[11px] rounded-full transition-all flex items-center justify-center outline-none shadow-lg"
                  >
                    {isAdding ? (
                      <span className="flex items-center gap-3">
                        <Check size={18} strokeWidth={1.5} /> Added To Bag
                      </span>
                    ) : (
                      `Add To Bag — ₹${totalPrice.toLocaleString('en-IN')}`
                    )}
                  </button>
                  <p className="text-[9px] text-center text-neutral-400 mt-6 font-medium uppercase tracking-widest">
                    Complimentary Shipping & Returns
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* LUXURY GLOBAL HEADER */}
      <header className="h-[70px] bg-white/95 backdrop-blur-md border-b border-black/[0.04] flex items-center justify-between px-5 sm:px-6 lg:px-12 shrink-0 z-40 sticky top-0">
        <Link to="/" className="hover:opacity-60 transition-opacity outline-none">
          <img
            src="/logo.png"
            alt={env.VITE_APP_NAME}
            className="h-5 md:h-6 w-auto object-contain"
          />
        </Link>

        <div className="flex items-center gap-5 sm:gap-6 md:gap-8">
          <Link
            to="/editor"
            className="text-[10px] font-medium uppercase tracking-[0.15em] text-neutral-500 hover:text-black transition-colors outline-none"
          >
            Studio
          </Link>

          {isAuthenticated ? (
            <Link
              to="/dashboard"
              className="text-[10px] font-medium uppercase tracking-[0.15em] text-neutral-500 hover:text-black transition-colors outline-none"
            >
              Account
            </Link>
          ) : (
            <button
              type="button"
              onClick={openAuthModal}
              className="text-[10px] font-medium uppercase tracking-[0.15em] text-neutral-500 hover:text-black transition-colors flex items-center outline-none"
            >
              Sign In
            </button>
          )}

          <div className="w-px h-3 bg-neutral-200 hidden sm:block" />

          {/* Perfected Cart Icon & Badge */}
          <Link
            to="/checkout"
            className={`relative flex items-center justify-center p-1 transition-all duration-300 outline-none ${cartAnim ? 'scale-110' : 'hover:opacity-60'}`}
          >
            <ShoppingBag size={20} strokeWidth={1.5} className="text-black" />
            {totalCartItems > 0 && (
              <span className="absolute -top-1.5 -right-2 bg-black text-white text-[9px] font-bold min-w-[18px] h-[18px] px-1 rounded-full flex items-center justify-center border-[2px] border-white shadow-sm">
                {totalCartItems}
              </span>
            )}
          </Link>
        </div>
      </header>

      {/* STICKY MARKETPLACE NAVIGATION & SEARCH */}
      <div className="w-full bg-white/95 backdrop-blur-md border-b border-black/[0.04] sticky top-[70px] z-30 shadow-[0_4px_20px_rgba(0,0,0,0.02)]">
        {/* Mobile layout updated: flex-col wraps gracefully so search isn't squished */}
        <div className="max-w-[1600px] mx-auto px-6 lg:px-12 py-3 sm:py-0 sm:h-14 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-6 overflow-x-auto hide-scrollbar w-full sm:w-auto pb-1 sm:pb-0">
            {dynamicCategories.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setActiveCategory(cat)}
                className={`text-[10px] uppercase tracking-[0.15em] whitespace-nowrap outline-none transition-colors ${
                  activeCategory === cat
                    ? 'font-bold text-black border-b border-black pb-1'
                    : 'font-medium text-neutral-400 hover:text-black'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-3 bg-[#fbfbfd] border border-black/5 px-4 py-2 rounded-full w-full sm:w-56 lg:w-72 focus-within:border-black/20 transition-all duration-300">
            <Search size={14} strokeWidth={1.5} className="text-neutral-400 shrink-0" />
            <input
              type="text"
              placeholder="Search pieces..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-transparent border-none text-[10px] uppercase tracking-[0.15em] outline-none w-full text-black placeholder:text-neutral-400 font-medium"
            />
          </div>
        </div>
      </div>

      {/* MAIN GRID */}
      <main className="flex-1 overflow-y-auto overflow-x-hidden w-full relative bg-white">
        <div className="max-w-[1600px] mx-auto px-6 lg:px-12 py-10 pb-32">
          {!isLoading && filteredItems.length === 0 ? (
            <div className="py-40 flex flex-col items-center justify-center text-center">
              <SlidersHorizontal size={32} strokeWidth={1} className="text-neutral-300 mb-6" />
              <p className="text-neutral-500 font-light text-sm tracking-widest uppercase mb-4">
                No pieces found.
              </p>
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  setActiveCategory('All');
                }}
                className="text-[10px] font-medium uppercase tracking-[0.1em] text-black border-b border-black outline-none"
              >
                Clear Filters
              </button>
            </div>
          ) : (
            /* CONCISE, BEAUTIFULLY SPACED GRID: Pure white background, no boxes. */
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-x-4 gap-y-16 sm:gap-x-12 sm:gap-y-24">
              {filteredItems.map((product) => (
                <button
                  key={product.id}
                  type="button"
                  className="group flex flex-col w-full bg-transparent border-0 p-0 m-0 cursor-pointer outline-none text-left"
                  onClick={() => handleOpenProduct(product)}
                >
                  {/* No background box for ultimate minimalism. Just pure floating imagery. */}
                  <div className="relative aspect-[4/5] overflow-hidden mb-6 w-full flex items-center justify-center p-8 sm:p-12 transition-all duration-700">
                    {product.canvas_state ? (
                      <div className="absolute inset-0 pointer-events-none p-4 sm:p-8 transition-transform duration-1000 group-hover:scale-[1.05] drop-shadow-xl">
                        <Mini3DViewer
                          canvasState={product.canvas_state}
                          tshirtColor={product.tshirt_color || '#ffffff'}
                          fallbackImage={product.thumbnail_url}
                          apparelModel={product.apparel_model || 'tshirtman'}
                        />
                      </div>
                    ) : (
                      <img
                        src={product.thumbnail_url}
                        alt={product.name}
                        loading="lazy"
                        className="absolute inset-0 w-full h-full object-contain transition-transform duration-1000 group-hover:scale-[1.05] mix-blend-multiply p-4 sm:p-8"
                      />
                    )}
                  </div>

                  {/* High-Fashion Typography */}
                  <div className="flex flex-col items-center text-center w-full px-2">
                    <h3 className="font-light text-xs tracking-[0.15em] uppercase mb-1.5 text-black truncate w-full">
                      {product.name}
                    </h3>
                    <p className="text-[10px] font-medium text-neutral-400 tracking-widest">
                      ₹{product.price.toLocaleString('en-IN')}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </main>

      <AuthModal />
    </div>
  );
}
