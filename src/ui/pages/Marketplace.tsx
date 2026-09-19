import { Check, Minus, Plus, ShoppingBag, X } from 'lucide-react';
import { useEffect, useState } from 'react';
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

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  const totalCartItems = cart.reduce(
    (acc, item) => acc + Object.values(item.sizes).reduce((a, b) => a + b, 0),
    0,
  );

  const totalQty = Object.values(selectedSizes).reduce((a, b) => a + b, 0);
  const totalPrice = selectedProduct ? totalQty * selectedProduct.price : 0;

  const updateLocalSize = (size: string, delta: number) => {
    setSelectedSizes((prev) => ({
      ...prev,
      [size]: Math.max(0, prev[size] + delta),
    }));
  };

  const handleSizeSelect = (size: string) => {
    setFocusedSize(size);
    // Auto-add 1 if the user selects a size that currently has 0 quantity
    if (selectedSizes[size] === 0) {
      updateLocalSize(size, 1);
    }
  };

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
      {/* LUXURY PRODUCT DRAWER (Slide-over) */}
      {selectedProduct && (
        <div className="fixed inset-0 z-[500] flex justify-end">
          <button
            type="button"
            aria-label="Close product details"
            className="absolute inset-0 w-full h-full bg-black/20 backdrop-blur-sm outline-none cursor-default border-0 p-0 m-0 animate-in fade-in duration-500"
            onClick={handleCloseProduct}
          />

          <div
            role="dialog"
            aria-modal="true"
            className="relative z-10 w-full md:w-[760px] lg:w-[900px] h-[100dvh] bg-white shadow-2xl flex flex-col md:flex-row animate-in slide-in-from-right duration-500 ease-[cubic-bezier(0.16,1,0.3,1)]"
          >
            <button
              type="button"
              onClick={handleCloseProduct}
              className="md:hidden absolute top-4 right-4 z-50 w-10 h-10 bg-white/90 backdrop-blur flex items-center justify-center rounded-full shadow-sm outline-none"
            >
              <X size={20} strokeWidth={1.5} />
            </button>

            {/* Left Media Area - Framed elegantly */}
            <div className="w-full md:w-1/2 h-[45vh] md:h-full bg-[#f5f5f7] relative shrink-0 flex items-center justify-center p-8 lg:p-16">
              <div className="w-full max-w-[320px] aspect-square relative drop-shadow-xl">
                {selectedProduct.canvas_state ? (
                  <div className="absolute inset-0 pointer-events-auto cursor-grab active:cursor-grabbing">
                    <Mini3DViewer
                      canvasState={selectedProduct.canvas_state}
                      tshirtColor={selectedProduct.tshirt_color || '#ffffff'}
                      fallbackImage={selectedProduct.thumbnail_url}
                      apparelModel={selectedProduct.apparel_model || 'tshirtman'}
                    />
                  </div>
                ) : (
                  <img
                    src={selectedProduct.thumbnail_url}
                    alt={selectedProduct.name}
                    className="w-full h-full object-contain mix-blend-multiply"
                  />
                )}
              </div>
            </div>

            {/* Right Details Area */}
            <div className="w-full md:w-1/2 h-[55vh] md:h-full flex flex-col bg-white relative">
              <button
                type="button"
                onClick={handleCloseProduct}
                className="hidden md:flex absolute top-6 right-6 z-50 text-neutral-400 hover:text-black transition-colors outline-none"
              >
                <X size={24} strokeWidth={1.5} />
              </button>

              <div className="p-8 md:p-12 flex flex-col flex-1 overflow-y-auto hide-scrollbar">
                <div className="mb-8 mt-2">
                  <span className="text-[10px] font-semibold uppercase tracking-[0.1em] text-neutral-400 mb-2 block">
                    {selectedProduct.collection || 'Core Collection'}
                  </span>
                  <h2 className="text-2xl md:text-3xl font-medium tracking-tight leading-snug mb-3 text-black">
                    {selectedProduct.name}
                  </h2>
                  <p className="text-base font-normal text-neutral-600">
                    ₹{selectedProduct.price.toLocaleString('en-IN')}
                  </p>
                </div>

                <div className="prose prose-sm text-neutral-500 font-normal leading-relaxed mb-10 text-sm">
                  <p>
                    {selectedProduct.description ||
                      'A quintessential luxury garment, engineered with precision and crafted from the finest sustainably sourced materials. Designed to drape perfectly while maintaining structural integrity.'}
                  </p>
                </div>

                <div className="mt-auto">
                  <div className="flex justify-between items-center mb-4">
                    <span className="text-xs font-medium text-black">Select Size</span>
                    <span className="text-[10px] uppercase tracking-wider text-neutral-400 cursor-pointer hover:text-black transition-colors underline underline-offset-4">
                      Size Guide
                    </span>
                  </div>

                  {/* Minimalist Size Selector */}
                  <div className="grid grid-cols-5 gap-2 mb-4">
                    {['S', 'M', 'L', 'XL', 'XXL'].map((size) => {
                      const qty = selectedSizes[size] || 0;
                      const isFocused = focusedSize === size;
                      return (
                        <button
                          key={size}
                          type="button"
                          onClick={() => handleSizeSelect(size)}
                          className={`relative h-12 rounded-xl flex items-center justify-center text-xs font-medium transition-all outline-none border ${
                            isFocused
                              ? 'border-black border-2 text-black'
                              : 'border-neutral-200 text-neutral-600 hover:border-black'
                          }`}
                        >
                          {size}
                          {qty > 0 && !isFocused && (
                            <span className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-black text-white text-[9px] font-bold flex items-center justify-center rounded-full">
                              {qty}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>

                  {/* Contextual Stepper for the Focused Size */}
                  <div className="flex items-center justify-between px-5 py-4 bg-[#f5f5f7] rounded-2xl mb-8 transition-all">
                    <span className="text-xs font-medium text-neutral-600">
                      Quantity <span className="text-black font-bold ml-1">({focusedSize})</span>
                    </span>
                    <div className="flex items-center gap-6 text-black">
                      <button
                        type="button"
                        onClick={() => updateLocalSize(focusedSize, -1)}
                        disabled={selectedSizes[focusedSize] === 0}
                        className="hover:opacity-50 disabled:opacity-20 outline-none p-1 transition-opacity"
                      >
                        <Minus size={16} strokeWidth={2} />
                      </button>
                      <span className="text-sm font-semibold w-4 text-center">
                        {selectedSizes[focusedSize] || 0}
                      </span>
                      <button
                        type="button"
                        onClick={() => updateLocalSize(focusedSize, 1)}
                        className="hover:opacity-50 outline-none p-1 transition-opacity"
                      >
                        <Plus size={16} strokeWidth={2} />
                      </button>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={confirmAddToCart}
                    disabled={totalQty === 0 || isAdding}
                    className="w-full h-14 bg-black hover:bg-neutral-800 disabled:bg-neutral-200 disabled:text-neutral-400 text-white font-medium text-sm rounded-full transition-all flex items-center justify-center outline-none"
                  >
                    {isAdding ? (
                      <span className="flex items-center gap-2">
                        <Check size={18} strokeWidth={2} /> Added To Bag
                      </span>
                    ) : (
                      `Add To Bag — ₹${totalPrice.toLocaleString('en-IN')}`
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* LUXURY GLOBAL HEADER */}
      <header className="h-[72px] bg-white border-b border-black/[0.04] flex items-center justify-between px-6 lg:px-12 shrink-0 z-20">
        <Link to="/" className="hover:opacity-60 transition-opacity outline-none">
          <img
            src="/logo.png"
            alt={env.VITE_APP_NAME}
            className="h-5 md:h-6 w-auto object-contain"
          />
        </Link>

        <div className="flex items-center gap-6 md:gap-8">
          <Link
            to="/editor"
            className="text-xs font-medium text-neutral-500 hover:text-black transition-colors hidden sm:block outline-none"
          >
            Studio
          </Link>

          {isAuthenticated ? (
            <Link
              to="/dashboard"
              className="text-xs font-medium text-neutral-500 hover:text-black transition-colors outline-none"
            >
              Account
            </Link>
          ) : (
            <button
              type="button"
              onClick={openAuthModal}
              className="text-xs font-medium text-neutral-500 hover:text-black transition-colors flex items-center gap-2 outline-none"
            >
              Sign In
            </button>
          )}

          <div className="w-px h-4 bg-neutral-200 hidden sm:block" />

          {/* Perfected Cart Icon & Badge */}
          <Link
            to="/checkout"
            className={`relative flex items-center justify-center p-1 transition-all duration-300 outline-none ${cartAnim ? 'scale-110' : 'hover:opacity-60'}`}
          >
            <ShoppingBag size={20} strokeWidth={1.5} className="text-black" />
            {totalCartItems > 0 && (
              <span className="absolute -top-1 -right-1 bg-black text-white text-[9px] font-bold w-[18px] h-[18px] rounded-full flex items-center justify-center border-2 border-white">
                {totalCartItems}
              </span>
            )}
          </Link>
        </div>
      </header>

      {/* MAIN MARKETPLACE CONTENT */}
      <main className="flex-1 overflow-y-auto overflow-x-hidden w-full relative">
        <div className="max-w-[1400px] mx-auto px-4 sm:px-8 lg:px-12 py-8 pb-32">
          {/* INLINE EDITORIAL HEADER */}
          <div className="flex items-end justify-between border-b border-black/[0.04] pb-6 mb-8 lg:mb-12 mt-4">
            <div>
              <h1 className="text-2xl md:text-3xl font-medium tracking-tight text-black">
                Collection
              </h1>
              <p className="text-xs font-normal text-neutral-400 mt-1.5">
                Ready-to-Wear & Studio Bespoke
              </p>
            </div>
            <span className="text-xs font-medium text-neutral-400 hidden sm:block">
              {items.length} {items.length === 1 ? 'Piece' : 'Pieces'}
            </span>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-32 relative min-h-[400px] w-full">
              <PremiumLoader fullScreen={false} />
            </div>
          ) : items.length === 0 ? (
            <div className="py-32 text-center">
              <p className="text-neutral-400 font-medium text-sm tracking-wide">
                The collection drops soon.
              </p>
            </div>
          ) : (
            /* CONSTRAINED, SPACIOUS GRID */
            <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-x-4 gap-y-12 sm:gap-x-8 sm:gap-y-16">
              {items.map((product) => (
                <button
                  key={product.id}
                  type="button"
                  className="group flex flex-col w-full bg-transparent border-0 p-0 m-0 cursor-pointer outline-none text-left"
                  onClick={() => handleOpenProduct(product)}
                >
                  {/* Aspect Ratio perfectly contained with significant padding so items aren't massive */}
                  <div className="relative aspect-[3/4] bg-[#f5f5f7] rounded-[1.5rem] overflow-hidden mb-5 w-full flex items-center justify-center p-8 sm:p-12 transition-all duration-500 group-hover:bg-[#ebebeb]">
                    {product.canvas_state ? (
                      <div className="absolute inset-0 pointer-events-none p-8 sm:p-12 transition-transform duration-1000 group-hover:scale-105">
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
                        className="absolute inset-0 w-full h-full object-contain transition-transform duration-1000 group-hover:scale-105 mix-blend-multiply p-8 sm:p-12"
                      />
                    )}
                  </div>

                  {/* Clean, Apple-like Typography */}
                  <div className="flex flex-col px-2 w-full">
                    <h3 className="font-medium text-sm tracking-tight text-black truncate mb-1">
                      {product.name}
                    </h3>
                    <p className="text-sm font-normal text-neutral-500">
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
