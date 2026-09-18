import {
  ArrowRight,
  Check,
  Loader2,
  Minus,
  Plus,
  ShoppingBag,
  User as UserIcon,
  X,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { env } from '@/shared/env';
import { AuthModal } from '@/ui/components/AuthModal';
import { Mini3DViewer } from '@/ui/components/Mini3DViewer';
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
    M: 1,
    L: 0,
    XL: 0,
    XXL: 0,
  });
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

  const handleOpenSizeModal = (product: MarketplaceItem, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedProduct(product);
    setSelectedSizes({ S: 0, M: 1, L: 0, XL: 0, XXL: 0 });
  };

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
        // Pass the 3D data so the checkout process can auto-generate print files
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
      setSelectedProduct(null);
      setTimeout(() => setCartAnim(false), 1000);
    }, 800);
  };

  return (
    <div className="w-full h-[100dvh] flex flex-col bg-[#fbfbfd] font-sans overflow-hidden selection:bg-neutral-200 text-black">
      {/* QUICK ADD TO CART MODAL */}
      {selectedProduct && (
        // biome-ignore lint/a11y/useKeyWithClickEvents: Modal backdrop overlay
        // biome-ignore lint/a11y/noStaticElementInteractions: Modal backdrop overlay
        <div
          className="fixed inset-0 z-[500] bg-black/40 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in"
          onClick={() => setSelectedProduct(null)}
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
                onClick={() => setSelectedProduct(null)}
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
              className="w-full h-14 bg-black hover:bg-neutral-800 disabled:bg-neutral-300 text-white rounded-xl font-extrabold flex items-center justify-center transition-all shadow-[0_8px_20px_rgba(0,0,0,0.12)] outline-none"
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

      <header className="h-16 bg-white/80 backdrop-blur-2xl border-b border-black/5 flex items-center justify-between px-6 lg:px-10 shrink-0 z-20 sticky top-0">
        <Link to="/" className="hover:opacity-70 transition-opacity outline-none">
          <img
            src="/logo.png"
            alt={env.VITE_APP_NAME}
            className="h-7 md:h-8 w-auto object-contain drop-shadow-sm"
          />
        </Link>

        <div className="flex items-center gap-6">
          <Link
            to="/editor"
            className="text-[10px] sm:text-xs font-bold uppercase tracking-widest text-neutral-500 hover:text-black transition-colors hidden sm:block outline-none"
          >
            Studio
          </Link>

          {isAuthenticated ? (
            <Link
              to="/dashboard"
              className="text-[10px] sm:text-xs font-bold uppercase tracking-widest text-neutral-500 hover:text-black transition-colors outline-none"
            >
              Dashboard
            </Link>
          ) : (
            <button
              type="button"
              onClick={openAuthModal}
              className="text-[10px] sm:text-xs font-bold uppercase tracking-widest text-neutral-500 hover:text-black transition-colors flex items-center gap-1.5 outline-none"
            >
              <UserIcon size={14} className="hidden sm:block" /> Sign In
            </button>
          )}

          <div className="w-px h-4 bg-black/10 mx-1 sm:mx-2 hidden sm:block" />

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
        </div>
      </header>

      <main className="flex-1 overflow-y-auto w-full">
        <div className="max-w-[1400px] mx-auto px-6 lg:px-10 py-12 lg:py-20 pb-32 space-y-16">
          <div className="flex flex-col md:flex-row justify-between items-end gap-8 pb-8 border-b border-black/10">
            <div className="max-w-xl">
              <h1 className="text-4xl md:text-6xl font-extrabold tracking-tighter mb-4">
                Core Collection
              </h1>
              <p className="text-neutral-500 font-medium leading-relaxed">
                Precision-engineered apparel designed for the modern minimalist. Sustainably
                sourced, meticulously crafted.
              </p>
            </div>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-32">
              <Loader2 size={32} className="animate-spin text-black" />
            </div>
          ) : items.length === 0 ? (
            <div className="py-32 text-neutral-400 font-medium text-lg">
              The collection drops soon. Check back later.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-x-6 gap-y-16">
              {items.map((product) => (
                <div
                  key={product.id}
                  className="group flex flex-col w-full bg-transparent border-0 p-0 m-0"
                >
                  <div className="aspect-[3/4] bg-neutral-100 overflow-hidden mb-5 relative rounded-xl shadow-sm group-hover:shadow-md transition-shadow cursor-pointer">
                    {/* DYNAMIC RENDERING: 3D vs Photo */}
                    {product.canvas_state ? (
                      <div className="absolute inset-0 pointer-events-none">
                        <Mini3DViewer
                          canvasState={product.canvas_state}
                          tshirtColor={product.tshirt_color || '#ffffff'}
                          fallbackImage={product.thumbnail_url}
                          apparelModel={product.apparel_model || 'tshirtman'}
                        />
                      </div>
                    ) : (
                      <>
                        <img
                          src={product.thumbnail_url}
                          alt={product.name}
                          loading="lazy"
                          className={`w-full h-full object-cover transition-opacity duration-700 ${product.gallery_urls?.length > 0 ? 'group-hover:opacity-0' : 'group-hover:scale-105 transition-transform'}`}
                        />
                        {product.gallery_urls?.length > 0 && (
                          <img
                            src={product.gallery_urls[0]}
                            alt={`${product.name} Alternate`}
                            loading="lazy"
                            className="absolute inset-0 w-full h-full object-cover opacity-0 group-hover:opacity-100 transition-opacity duration-700"
                          />
                        )}
                      </>
                    )}
                  </div>

                  <div className="flex items-start justify-between gap-4 px-1">
                    <div>
                      <h3 className="font-bold text-lg leading-tight mb-1">{product.name}</h3>
                      <p className="text-sm font-semibold text-neutral-500">₹{product.price}</p>
                    </div>
                    <button
                      type="button"
                      onClick={(e) => handleOpenSizeModal(product, e)}
                      className="w-10 h-10 rounded-full bg-black/5 flex items-center justify-center opacity-0 -translate-x-4 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-300 shrink-0 hover:bg-black hover:text-white cursor-pointer outline-none"
                      title="Select Size & Add to Cart"
                    >
                      <ArrowRight size={16} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>

      <AuthModal />
    </div>
  );
}
