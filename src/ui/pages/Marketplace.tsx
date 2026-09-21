import {
  Box,
  Check,
  ChevronLeft,
  ChevronRight,
  Hand,
  Link as LinkIcon,
  Loader2,
  Maximize,
  Minus,
  Plus,
  Search,
  ShoppingBag,
  SlidersHorizontal,
  Sparkles,
  X,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { env } from '@/shared/env';
import { AuthModal } from '@/ui/components/AuthModal';
import { Mini3DViewer } from '@/ui/components/Mini3DViewer';
import { useAuthStore } from '@/ui/store/auth-store';
import { useCheckoutStore } from '@/ui/store/checkout-store';
import type { MarketplaceItem } from '@/ui/store/marketplace-store';
import { useMarketplaceStore } from '@/ui/store/marketplace-store';

// Helper to calculate the final discounted price safely
const getFinalPrice = (price: number, discount?: number) => {
  if (!discount || discount <= 0) return price;
  return Math.round(price * (1 - discount / 100));
};

// Intelligent sorter that guarantees "front" images appear before "back" images
const getSortedGallery = (item: MarketplaceItem): string[] => {
  const urls =
    Array.isArray(item.gallery_urls) && item.gallery_urls.length > 0
      ? item.gallery_urls
      : item.thumbnail_url
        ? [item.thumbnail_url]
        : [];

  return [...urls].sort((a, b) => {
    const aLower = a.toLowerCase();
    const bLower = b.toLowerCase();
    const aFront = aLower.includes('front');
    const bFront = bLower.includes('front');
    const aBack = aLower.includes('back');
    const bBack = bLower.includes('back');

    if (aFront && !bFront) return -1;
    if (!aFront && bFront) return 1;
    if (aBack && !bBack) return -1;
    if (!aBack && bBack) return 1;
    return 0;
  });
};

// --- DIRECT LIVE 3D RENDERER (Optimized via Spatial Intersection) ---
function Smart3DViewer({ product, onOpen }: { product: MarketplaceItem; onOpen: () => void }) {
  const [isInView, setIsInView] = useState(false);
  const observerRef = useRef<HTMLDivElement>(null);
  const [pointerDownTime, setPointerDownTime] = useState(0);

  // Mount/Unmount WebGL context based on viewport proximity to save massive amounts of memory
  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsInView(entry.isIntersecting);
      },
      { threshold: 0, rootMargin: '500px' }, // Pre-load slightly before it enters screen
    );

    if (observerRef.current) observer.observe(observerRef.current);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={observerRef}
      className="absolute inset-0 w-full h-full touch-none bg-[#f8f8f8] overflow-hidden rounded-2xl cursor-pointer isolate"
      onPointerDown={() => setPointerDownTime(Date.now())}
      onPointerUp={() => {
        // Smart Click: < 250ms = opens drawer. > 250ms = dragging 3D model.
        if (Date.now() - pointerDownTime < 250) {
          onOpen();
        }
      }}
    >
      {!isInView ? (
        <div className="absolute inset-0 flex items-center justify-center">
          <Loader2 size={24} strokeWidth={1.5} className="animate-spin text-neutral-300" />
        </div>
      ) : (
        <div className="absolute inset-0 w-full h-full z-20 cursor-grab active:cursor-grabbing animate-in fade-in duration-700">
          <Mini3DViewer
            canvasState={product.canvas_state}
            tshirtColor={product.tshirt_color || '#ffffff'}
            apparelModel={product.apparel_model || 'tshirtman'}
          />
        </div>
      )}
    </div>
  );
}

// --- SLEEK HOVER & DRAG CAROUSEL FOR GRID CARDS ---
function ProductGridCarousel({
  urls,
  alt,
  onOpen,
}: {
  urls: string[];
  alt: string;
  onOpen: () => void;
}) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [dragStart, setDragStart] = useState<number | null>(null);
  const [dragEnd, setDragEnd] = useState<number | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const handleDragStart = (clientX: number) => {
    setDragStart(clientX);
    setDragEnd(clientX);
    setIsDragging(false);
  };

  const handleDragMove = (clientX: number) => {
    if (dragStart !== null) {
      setDragEnd(clientX);
      if (Math.abs(clientX - dragStart) > 5) {
        setIsDragging(true);
      }
    }
  };

  const handleDragEnd = () => {
    if (dragStart !== null && dragEnd !== null && isDragging) {
      const distance = dragStart - dragEnd;
      const minSwipeDistance = 30;

      if (distance > minSwipeDistance) {
        setCurrentIndex((prev) => (prev + 1) % urls.length);
      } else if (distance < -minSwipeDistance) {
        setCurrentIndex((prev) => (prev - 1 + urls.length) % urls.length);
      }
    } else if (!isDragging) {
      onOpen();
    }
    setDragStart(null);
    setDragEnd(null);
    setIsDragging(false);
  };

  if (urls.length === 0) {
    return (
      <button
        type="button"
        aria-label="Open product"
        className="absolute inset-0 w-full h-full flex items-center justify-center cursor-pointer bg-transparent border-0 outline-none"
        onClick={onOpen}
      >
        <Box size={24} className="text-neutral-300" />
      </button>
    );
  }

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: Custom swipe/drag carousel
    <div
      className={`absolute inset-0 w-full h-full select-none ${isDragging ? 'cursor-grabbing' : 'cursor-pointer'}`}
      onMouseLeave={() => {
        setCurrentIndex(0);
        setIsDragging(false);
        setDragStart(null);
      }}
      onTouchStart={(e) => handleDragStart(e.touches[0].clientX)}
      onTouchMove={(e) => handleDragMove(e.touches[0].clientX)}
      onTouchEnd={handleDragEnd}
      onMouseDown={(e) => handleDragStart(e.clientX)}
      onMouseMove={(e) => handleDragMove(e.clientX)}
      onMouseUp={handleDragEnd}
    >
      <img
        src={urls[currentIndex]}
        alt={alt}
        loading="lazy"
        draggable={false}
        className="w-full h-full object-cover object-top transition-transform duration-1000 group-hover:scale-[1.05] mix-blend-multiply"
      />
      {urls.length > 1 && (
        <div className="absolute bottom-4 left-0 right-0 flex justify-center gap-1.5 z-20">
          {urls.map((url, i) => (
            <button
              key={url}
              type="button"
              aria-label={`View image ${i + 1}`}
              onMouseEnter={(e) => {
                e.stopPropagation();
                setCurrentIndex(i);
              }}
              onClick={(e) => {
                e.stopPropagation();
                setCurrentIndex(i);
              }}
              className={`w-1.5 h-1.5 rounded-full transition-colors p-0 m-0 outline-none border-none ${
                i === currentIndex ? 'bg-black' : 'bg-black/20'
              }`}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// --- INTERACTIVE CAROUSEL FOR THE DETAIL DRAWER & FULLSCREEN ---
function ProductDrawerCarousel({
  urls,
  alt,
  onZoom,
  isFullScreen = false,
}: {
  urls: string[];
  alt: string;
  onZoom?: () => void;
  isFullScreen?: boolean;
}) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [dragStart, setDragStart] = useState<number | null>(null);
  const [dragEnd, setDragEnd] = useState<number | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [showSwipeHint, setShowSwipeHint] = useState(!isFullScreen);

  const handleDragStart = (clientX: number) => {
    setDragEnd(null);
    setDragStart(clientX);
    setIsDragging(false);
    setShowSwipeHint(false);
  };

  const handleDragMove = (clientX: number) => {
    if (dragStart !== null) {
      setDragEnd(clientX);
      if (Math.abs(clientX - dragStart) > 5) {
        setIsDragging(true);
      }
    }
  };

  const handleDragEnd = () => {
    if (dragStart !== null) {
      const distance = dragEnd !== null ? dragStart - dragEnd : 0;
      const minSwipeDistance = 40;

      if (Math.abs(distance) < 5 && !isDragging) {
        onZoom?.();
      } else if (distance > minSwipeDistance) {
        setCurrentIndex((prev) => (prev + 1) % urls.length);
      } else if (distance < -minSwipeDistance) {
        setCurrentIndex((prev) => (prev - 1 + urls.length) % urls.length);
      }
    }

    setIsDragging(false);
    setDragStart(null);
    setDragEnd(null);
  };

  if (urls.length === 0) {
    return (
      <div className="w-full h-full flex items-center justify-center p-8 lg:p-16">
        <Box size={40} className="text-neutral-300" />
      </div>
    );
  }

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: Custom swipe/drag/zoom carousel
    <div
      className={`w-full h-full relative flex items-center justify-center group/carousel bg-[#f8f8f8] overflow-hidden select-none ${isDragging ? 'cursor-grabbing' : onZoom ? 'cursor-zoom-in' : 'cursor-grab'} ${isFullScreen ? 'max-w-none p-4 md:p-16' : 'max-w-[500px] p-6 sm:p-12'}`}
      onTouchStart={(e) => handleDragStart(e.targetTouches[0].clientX)}
      onTouchMove={(e) => handleDragMove(e.targetTouches[0].clientX)}
      onTouchEnd={handleDragEnd}
      onMouseDown={(e) => handleDragStart(e.clientX)}
      onMouseMove={(e) => handleDragMove(e.clientX)}
      onMouseUp={handleDragEnd}
      onMouseLeave={() => {
        if (dragStart !== null) handleDragEnd();
      }}
    >
      <img
        src={urls[currentIndex]}
        alt={alt}
        draggable={false}
        className={`w-full h-full object-contain mix-blend-multiply transition-opacity duration-300 pointer-events-none ${isFullScreen ? 'drop-shadow-2xl' : ''}`}
      />

      {onZoom && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onZoom();
          }}
          className="absolute top-4 right-4 z-20 w-8 h-8 flex items-center justify-center rounded-full bg-white/80 backdrop-blur-sm text-black shadow-sm transition-all hover:bg-white hover:scale-110 outline-none"
          aria-label="View fullscreen"
        >
          <Maximize size={14} strokeWidth={2} />
        </button>
      )}

      {urls.length > 1 && (
        <>
          <div
            className={`md:hidden absolute bottom-12 left-1/2 -translate-x-1/2 flex items-center gap-2 bg-black/80 backdrop-blur-md px-4 py-2 rounded-full shadow-lg z-30 pointer-events-none transition-opacity duration-1000 ${showSwipeHint ? 'opacity-100' : 'opacity-0'}`}
          >
            <Hand size={14} className="text-white animate-pulse" />
            <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-white">
              Swipe
            </span>
          </div>

          <button
            type="button"
            aria-label="Previous image"
            onClick={(e) => {
              e.stopPropagation();
              setCurrentIndex((prev) => (prev - 1 + urls.length) % urls.length);
            }}
            className={`hidden md:flex absolute left-4 lg:left-8 top-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 hover:bg-white text-black shadow-md transition-all z-20 outline-none opacity-0 group-hover/carousel:opacity-100 hover:scale-110 ${isFullScreen ? 'w-14 h-14' : 'w-10 h-10'}`}
          >
            <ChevronLeft size={isFullScreen ? 28 : 20} strokeWidth={2} />
          </button>

          <button
            type="button"
            aria-label="Next image"
            onClick={(e) => {
              e.stopPropagation();
              setCurrentIndex((prev) => (prev + 1) % urls.length);
            }}
            className={`hidden md:flex absolute right-4 lg:right-8 top-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 hover:bg-white text-black shadow-md transition-all z-20 outline-none opacity-0 group-hover/carousel:opacity-100 hover:scale-110 ${isFullScreen ? 'w-14 h-14' : 'w-10 h-10'}`}
          >
            <ChevronRight size={isFullScreen ? 28 : 20} strokeWidth={2} />
          </button>

          <div className="absolute bottom-6 left-0 right-0 flex justify-center gap-2 z-20">
            {urls.map((url, i) => (
              <button
                key={url}
                type="button"
                aria-label={`View image ${i + 1}`}
                onClick={(e) => {
                  e.stopPropagation();
                  setCurrentIndex(i);
                }}
                className={`h-2 rounded-full transition-all outline-none p-0 m-0 border-none ${
                  i === currentIndex ? 'bg-black w-4' : 'bg-black/20 w-2 hover:bg-black/40'
                }`}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// --- UNIVERSAL PRODUCT CARD COMPONENT ---
function ProductCard({
  product,
  onOpen,
}: {
  product: MarketplaceItem;
  onOpen: (p: MarketplaceItem) => void;
}) {
  const sortedUrls = getSortedGallery(product);

  return (
    <div className="group flex flex-col w-full bg-transparent border-0 p-0 m-0 text-left">
      <div className="relative aspect-[4/5] overflow-hidden mb-6 w-full flex items-center justify-center bg-[#f8f8f8] rounded-2xl group-hover:bg-[#f0f0f0] transition-colors duration-500">
        {/* Floating Promotional Tags */}
        <div className="absolute top-4 left-4 z-20 flex flex-col gap-1.5 items-start">
          {product.is_new && (
            <span className="bg-blue-50 text-blue-600 px-2 py-1 text-[8px] font-bold uppercase tracking-widest rounded-md border border-blue-100/50">
              New
            </span>
          )}
          {product.is_bestseller && (
            <span className="bg-amber-50 text-amber-600 px-2 py-1 text-[8px] font-bold uppercase tracking-widest rounded-md border border-amber-100/50">
              Best Seller
            </span>
          )}
          {product.is_trending && (
            <span className="bg-purple-50 text-purple-600 px-2 py-1 text-[8px] font-bold uppercase tracking-widest rounded-md border border-purple-100/50">
              Trending
            </span>
          )}
        </div>

        {product.canvas_state ? (
          <Smart3DViewer product={product} onOpen={() => onOpen(product)} />
        ) : (
          <ProductGridCarousel
            urls={sortedUrls}
            alt={product.name}
            onOpen={() => onOpen(product)}
          />
        )}
      </div>

      {/* High-Fashion Typography */}
      <button
        type="button"
        className="flex flex-col items-center text-center w-full px-2 cursor-pointer outline-none border-0 bg-transparent"
        onClick={() => onOpen(product)}
      >
        <h3 className="font-light text-xs tracking-[0.15em] uppercase mb-1.5 text-black truncate w-full">
          {product.name}
        </h3>
        <div className="flex items-center justify-center gap-2">
          {product.discount_percentage && product.discount_percentage > 0 ? (
            <>
              <span className="text-[10px] font-medium text-neutral-300 line-through tracking-widest">
                ₹{product.price.toLocaleString('en-IN')}
              </span>
              <span className="text-[10px] font-bold text-red-500 tracking-widest">
                ₹{getFinalPrice(product.price, product.discount_percentage).toLocaleString('en-IN')}
              </span>
            </>
          ) : (
            <span className="text-[10px] font-medium text-neutral-400 tracking-widest">
              ₹{product.price.toLocaleString('en-IN')}
            </span>
          )}
        </div>
      </button>
    </div>
  );
}

export function Marketplace() {
  const { isAuthenticated, openAuthModal } = useAuthStore();
  const { cart, addToCart } = useCheckoutStore();

  const {
    items,
    spotlightItems,
    collections,
    isLoading,
    isLoadingMore,
    hasMore,
    currentPage,
    isShuffleMode,
    sortBy,
    fetchCollections,
    fetchSpotlightItems,
    fetchRandomItems,
    fetchItems,
    incrementPopularity,
    setSortBy,
  } = useMarketplaceStore();

  const [searchParams, setSearchParams] = useSearchParams();

  // Marketplace State
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState<string>('All');

  // Product Selection State
  const [selectedProduct, setSelectedProduct] = useState<MarketplaceItem | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [selectedSizes, setSelectedSizes] = useState<Record<string, number>>({
    XS: 0,
    S: 0,
    M: 0,
    L: 0,
    XL: 0,
    XXL: 0,
  });
  const [focusedSize, setFocusedSize] = useState<string>('M');
  const [isAdding, setIsAdding] = useState(false);
  const [cartAnim, setCartAnim] = useState(false);
  const [isCopied, setIsCopied] = useState(false);

  const skeletonKeys = useMemo(() => Array.from({ length: 12 }).map(() => crypto.randomUUID()), []);

  const isNavigating = useRef(false);
  const observerTarget = useRef<HTMLDivElement>(null);

  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isLongPress = useRef(false);

  useEffect(() => {
    fetchCollections();
    fetchSpotlightItems();
  }, [fetchCollections, fetchSpotlightItems]);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(searchQuery);
    }, 400);
    return () => clearTimeout(handler);
  }, [searchQuery]);

  useEffect(() => {
    if (sortBy) {
      fetchItems(activeCategory, debouncedSearch, 1);
    }
  }, [activeCategory, debouncedSearch, sortBy, fetchItems]);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !isLoading && !isLoadingMore) {
          fetchItems(activeCategory, debouncedSearch, currentPage + 1);
        }
      },
      { threshold: 0.1, rootMargin: '100px' },
    );

    const currentTarget = observerTarget.current;
    if (currentTarget) {
      observer.observe(currentTarget);
    }

    return () => {
      if (currentTarget) observer.unobserve(currentTarget);
    };
  }, [hasMore, isLoading, isLoadingMore, activeCategory, debouncedSearch, currentPage, fetchItems]);

  // --- DEEP LINKING ROUTER LOGIC ---
  useEffect(() => {
    if (isNavigating.current) return;

    const itemId = searchParams.get('item');
    if (itemId && items.length > 0) {
      const product = items.find((i) => i.id === itemId);
      if (product && product.id !== selectedProduct?.id) {
        setSelectedProduct(product);
        setSelectedSizes({ XS: 0, S: 0, M: 1, L: 0, XL: 0, XXL: 0 });
        setFocusedSize('M');
        document.body.style.overflow = 'hidden';
      }
    } else if (!itemId && selectedProduct?.id) {
      setSelectedProduct(null);
      document.body.style.overflow = 'auto';
    }
  }, [items, searchParams, selectedProduct?.id]);

  const totalCartItems = cart.reduce(
    (acc, item) => acc + Object.values(item.sizes).reduce((a, b) => a + b, 0),
    0,
  );

  const currentItemPrice = selectedProduct
    ? getFinalPrice(selectedProduct.price, selectedProduct.discount_percentage)
    : 0;
  const totalQty = Object.values(selectedSizes).reduce((a, b) => a + b, 0);
  const totalPrice = totalQty * currentItemPrice;

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

  const handleOpenProduct = (product: MarketplaceItem) => {
    incrementPopularity(product.id);
    isNavigating.current = true;
    setSearchParams({ item: product.id });
    setSelectedProduct(product);
    setSelectedSizes({ XS: 0, S: 0, M: 1, L: 0, XL: 0, XXL: 0 });
    setFocusedSize('M');
    document.body.style.overflow = 'hidden';
    setTimeout(() => {
      isNavigating.current = false;
    }, 50);
  };

  const handleCloseProduct = () => {
    isNavigating.current = true;
    setSearchParams({}, { replace: true });
    setSelectedProduct(null);
    setIsFullscreen(false);
    document.body.style.overflow = 'auto';
    setTimeout(() => {
      isNavigating.current = false;
    }, 50);
  };

  const handleShareLink = async () => {
    if (!selectedProduct) return;
    const url = `${window.location.origin}${window.location.pathname}?item=${selectedProduct.id}`;
    try {
      await navigator.clipboard.writeText(url);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy link', err);
    }
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
      const smartThumbnail = getSortedGallery(selectedProduct)[0];
      addToCart({
        type: 'marketplace',
        productId: selectedProduct.id,
        name: selectedProduct.name,
        thumbnail: smartThumbnail,
        price: currentItemPrice,
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
    <div className="w-full h-dvh flex flex-col bg-white font-sans selection:bg-neutral-200 text-black relative select-none">
      {/* FULLSCREEN INSPECTION MODAL */}
      {isFullscreen && selectedProduct && (
        <div className="fixed inset-0 z-[600] bg-[#f8f8f8] flex flex-col animate-in fade-in zoom-in-95 duration-300">
          <button
            type="button"
            onClick={() => setIsFullscreen(false)}
            className="absolute top-6 right-6 sm:top-8 sm:right-8 z-50 w-12 h-12 flex items-center justify-center bg-white/90 hover:bg-white backdrop-blur-md text-black rounded-full shadow-lg transition-transform hover:scale-110 outline-none"
          >
            <X size={24} strokeWidth={1.5} />
          </button>
          <div className="flex-1 w-full h-full relative p-4 md:p-12">
            {selectedProduct.canvas_state ? (
              <div className="absolute inset-0 w-full h-full cursor-grab active:cursor-grabbing mix-blend-multiply flex items-center justify-center">
                <Mini3DViewer
                  canvasState={selectedProduct.canvas_state}
                  tshirtColor={selectedProduct.tshirt_color || '#ffffff'}
                  fallbackImage={selectedProduct.thumbnail_url}
                  apparelModel={selectedProduct.apparel_model || 'tshirtman'}
                />
              </div>
            ) : (
              <ProductDrawerCarousel
                urls={getSortedGallery(selectedProduct)}
                alt={selectedProduct.name}
                isFullScreen={true}
              />
            )}
          </div>
        </div>
      )}

      {/* LUXURY PRODUCT DRAWER (Clean Mobile Scrolling Layout) */}
      {selectedProduct && (
        <div className="fixed inset-0 z-[500] flex justify-end">
          <button
            type="button"
            aria-label="Close product details"
            className="absolute inset-0 w-full h-full bg-black/40 backdrop-blur-sm outline-none cursor-default border-0 p-0 m-0 animate-in fade-in duration-700"
            onClick={handleCloseProduct}
          />

          {/* Mobile Close Button */}
          <button
            type="button"
            onClick={handleCloseProduct}
            className="md:hidden fixed top-4 right-4 z-[510] w-10 h-10 bg-white/90 backdrop-blur flex items-center justify-center rounded-full shadow-md outline-none animate-in fade-in"
          >
            <X size={20} strokeWidth={1.5} />
          </button>

          <div
            role="dialog"
            aria-modal="true"
            className="relative z-10 w-full md:w-[215px] lg:w-[250px] min-w-[50vw] max-w-full md:max-w-2xl h-[100dvh] bg-white md:shadow-2xl flex flex-col md:flex-row animate-in slide-in-from-bottom md:slide-in-from-right duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] overflow-y-auto md:overflow-hidden hide-scrollbar"
          >
            {/* Left Media Area - Standard Box Layout on Mobile */}
            <div className="w-full md:w-1/2 h-[55vh] md:h-full bg-[#f8f8f8] shrink-0 relative flex items-center justify-center border-b md:border-b-0 md:border-r border-black/5 overflow-hidden z-10">
              {selectedProduct.canvas_state ? (
                <div className="absolute inset-0 w-full h-full pointer-events-auto cursor-grab active:cursor-grabbing mix-blend-multiply flex items-center justify-center p-4 md:p-8">
                  <Mini3DViewer
                    canvasState={selectedProduct.canvas_state}
                    tshirtColor={selectedProduct.tshirt_color || '#ffffff'}
                    fallbackImage={selectedProduct.thumbnail_url}
                    apparelModel={selectedProduct.apparel_model || 'tshirtman'}
                  />
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setIsFullscreen(true);
                    }}
                    className="absolute top-4 right-4 md:top-6 md:right-6 z-20 w-10 h-10 flex items-center justify-center rounded-full bg-white/80 backdrop-blur-md text-black shadow-sm transition-all hover:bg-white hover:scale-110 outline-none"
                    aria-label="View fullscreen"
                  >
                    <Maximize size={16} strokeWidth={2} />
                  </button>
                </div>
              ) : (
                <ProductDrawerCarousel
                  urls={getSortedGallery(selectedProduct)}
                  alt={selectedProduct.name}
                  onZoom={() => setIsFullscreen(true)}
                />
              )}
            </div>

            {/* Right Details Area - Clean Vertical Flow */}
            <div className="w-full md:w-1/2 flex flex-col bg-white relative z-20 md:h-full md:overflow-y-auto min-h-[60vh] pb-12 md:pb-0">
              <button
                type="button"
                onClick={handleCloseProduct}
                className="hidden md:flex absolute top-6 right-6 z-50 text-neutral-400 hover:text-black transition-colors outline-none"
              >
                <X size={28} strokeWidth={1} />
              </button>

              {/* Mobile Drawer Pull Indicator */}
              <div className="w-full flex justify-center pt-4 pb-2 md:hidden">
                <div className="w-12 h-1.5 bg-neutral-200 rounded-full" />
              </div>

              {/* Content Box */}
              <div className="flex flex-col flex-1 px-6 py-6 md:px-12 md:py-16 pb-32 md:pb-16">
                <div className="mb-8 md:mb-10">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex flex-wrap gap-1.5">
                      {selectedProduct.is_new && (
                        <span className="bg-blue-50 text-blue-600 px-2 py-0.5 text-[8px] font-bold uppercase tracking-widest rounded-md border border-blue-100/50">
                          New
                        </span>
                      )}
                      {selectedProduct.is_bestseller && (
                        <span className="bg-amber-50 text-amber-600 px-2 py-0.5 text-[8px] font-bold uppercase tracking-widest rounded-md border border-amber-100/50">
                          Best
                        </span>
                      )}
                      {selectedProduct.is_trending && (
                        <span className="bg-purple-50 text-purple-600 px-2 py-0.5 text-[8px] font-bold uppercase tracking-widest rounded-md border border-purple-100/50">
                          Trend
                        </span>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={handleShareLink}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#fbfbfd] hover:bg-neutral-100 text-neutral-500 hover:text-black transition-colors border border-black/5 outline-none md:mr-8 shrink-0"
                    >
                      {isCopied ? (
                        <Check size={12} strokeWidth={2.5} className="text-green-600" />
                      ) : (
                        <LinkIcon size={12} strokeWidth={2} />
                      )}
                      <span
                        className={`text-[9px] font-bold uppercase tracking-[0.1em] ${isCopied ? 'text-green-600' : ''}`}
                      >
                        {isCopied ? 'Copied' : 'Share'}
                      </span>
                    </button>
                  </div>

                  <p className="text-[10px] font-medium uppercase tracking-[0.2em] text-neutral-400 mb-2 block">
                    {selectedProduct.collection || 'Core Collection'}
                  </p>

                  <h2 className="text-3xl md:text-4xl font-light tracking-tight leading-snug mb-4 text-black pr-8">
                    {selectedProduct.name}
                  </h2>

                  <div className="flex items-center gap-3">
                    {selectedProduct.discount_percentage ? (
                      <>
                        <span className="text-xl font-normal text-red-500 tracking-wider">
                          ₹{currentItemPrice.toLocaleString('en-IN')}
                        </span>
                        <span className="text-sm font-medium text-neutral-300 line-through tracking-wider">
                          ₹{selectedProduct.price.toLocaleString('en-IN')}
                        </span>
                        <span className="text-[9px] font-bold text-red-500 uppercase tracking-widest bg-red-50 px-2 py-1 rounded-md border border-red-100">
                          -{selectedProduct.discount_percentage}% OFF
                        </span>
                      </>
                    ) : (
                      <span className="text-xl font-normal text-neutral-500 tracking-wider">
                        ₹{selectedProduct.price.toLocaleString('en-IN')}
                      </span>
                    )}
                  </div>
                </div>

                <div className="prose prose-sm text-neutral-500 font-light leading-relaxed mb-8 md:mb-12 text-sm tracking-wide">
                  <p>
                    {selectedProduct.description ||
                      'A quintessential luxury garment, engineered with precision and crafted from the finest sustainably sourced materials. Designed to drape perfectly while maintaining structural integrity.'}
                  </p>
                </div>

                <div className="mt-auto md:mt-auto pt-4 border-t border-black/5 md:border-none">
                  <div className="flex justify-between items-center mb-6">
                    <span className="text-xs font-medium tracking-widest uppercase text-black">
                      Select Size
                    </span>
                    <span className="text-[10px] uppercase tracking-widest text-neutral-400 cursor-pointer hover:text-black transition-colors underline underline-offset-4">
                      Size Guide
                    </span>
                  </div>

                  <div className="grid grid-cols-6 gap-2 mb-6">
                    {['XS', 'S', 'M', 'L', 'XL', 'XXL'].map((size) => {
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
                          {qty > 0 && (
                            <span className="absolute top-1 right-2 w-3.5 h-3.5 bg-black text-white text-[8px] font-bold flex items-center justify-center rounded-full shadow-sm animate-in zoom-in border border-white">
                              {qty}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>

                  <div className="flex items-center justify-between px-5 py-4 bg-[#fbfbfd] border border-black/[0.04] rounded-2xl mb-8 md:mb-10 transition-all">
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
                    className="w-full h-14 bg-black hover:bg-neutral-800 disabled:bg-neutral-100 disabled:text-neutral-400 text-white font-normal uppercase tracking-[0.2em] text-[11px] rounded-full transition-all flex items-center justify-center outline-none shadow-lg"
                  >
                    {isAdding ? (
                      <span className="flex items-center gap-3">
                        <Check size={18} strokeWidth={1.5} /> Added To Bag
                      </span>
                    ) : (
                      `Add To Bag - ₹${totalPrice.toLocaleString('en-IN')}`
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
        <div className="max-w-[1600px] mx-auto px-6 lg:px-12 py-3 sm:py-0 sm:h-14 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-6 overflow-x-auto hide-scrollbar w-full sm:w-auto pb-1 sm:pb-0">
            {collections.map((cat) => (
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

          <div className="flex items-center gap-2 sm:gap-3 w-full sm:w-auto mt-2 sm:mt-0 overflow-x-auto hide-scrollbar pb-1 sm:pb-0">
            {/* Sleek Toggle for Sort */}
            <div className="flex items-center bg-[#fbfbfd] border border-black/[0.03] p-1 rounded-full shrink-0">
              <button
                type="button"
                onClick={() => setSortBy('trending')}
                className={`px-3 py-1.5 rounded-full text-[9px] uppercase tracking-[0.15em] transition-all outline-none ${
                  sortBy === 'trending'
                    ? 'bg-white text-black shadow-sm font-bold'
                    : 'text-neutral-400 font-medium hover:text-black'
                }`}
              >
                Trending
              </button>
              <button
                type="button"
                onClick={() => setSortBy('newest')}
                className={`px-3 py-1.5 rounded-full text-[9px] uppercase tracking-[0.15em] transition-all outline-none ${
                  sortBy === 'newest'
                    ? 'bg-white text-black shadow-sm font-bold'
                    : 'text-neutral-400 font-medium hover:text-black'
                }`}
              >
                Newest
              </button>
            </div>

            {/* Shuffle Button */}
            <button
              type="button"
              onClick={fetchRandomItems}
              className={`flex items-center justify-center w-8 h-8 rounded-full transition-all outline-none shrink-0 ${
                isShuffleMode
                  ? 'bg-black text-white shadow-md'
                  : 'bg-[#fbfbfd] border border-black/[0.03] text-black hover:bg-white hover:shadow-sm'
              }`}
              aria-label="Surprise Me"
            >
              <Sparkles size={13} strokeWidth={2} />
            </button>

            {/* Search Bar */}
            <div className="flex items-center gap-3 bg-[#fbfbfd] border border-black/[0.03] px-4 py-2 rounded-full w-full sm:w-56 lg:w-72 focus-within:bg-white focus-within:shadow-sm focus-within:border-black/10 transition-all duration-300">
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
      </div>

      {/* MAIN GRID */}
      <main className="flex-1 overflow-y-auto overflow-x-hidden w-full relative bg-white">
        <div className="max-w-[1600px] mx-auto px-6 lg:px-12 py-10 pb-32">
          {/* SKELETON LOADING STATE */}
          {isLoading && items.length === 0 ? (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-x-4 gap-y-16 sm:gap-x-12 sm:gap-y-24">
              {skeletonKeys.map((key) => (
                <div key={key} className="w-full flex flex-col items-center">
                  <div className="w-full aspect-[4/5] bg-[#f8f8f8] animate-pulse rounded-2xl mb-6" />
                  <div className="w-3/4 h-3 bg-[#f8f8f8] animate-pulse rounded-full mb-3" />
                  <div className="w-1/2 h-3 bg-[#f8f8f8] animate-pulse rounded-full" />
                </div>
              ))}
            </div>
          ) : !isLoading && items.length === 0 ? (
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
                className="text-[10px] font-medium uppercase tracking-widest text-black border-b border-black outline-none"
              >
                Clear Filters
              </button>
            </div>
          ) : (
            <>
              {/* SPOTLIGHT CAROUSEL - Only on default view */}
              {!isShuffleMode &&
                activeCategory === 'All' &&
                !debouncedSearch &&
                spotlightItems.length > 0 && (
                  <div className="mb-20 animate-in fade-in duration-700">
                    <div className="flex items-center gap-4 mb-8">
                      <h2 className="text-[10px] font-bold uppercase tracking-[0.25em] text-black">
                        Curated Spotlight
                      </h2>
                      <div className="h-px flex-1 bg-black/[0.03]" />
                    </div>
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-x-4 gap-y-16 sm:gap-x-12">
                      {spotlightItems.map((product) => (
                        <ProductCard
                          key={`spotlight-${product.id}`}
                          product={product}
                          onOpen={handleOpenProduct}
                        />
                      ))}
                    </div>
                    <div className="w-full h-px bg-black/[0.03] mt-20" />
                  </div>
                )}

              {/* MAIN COLLECTION GRID */}
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-x-4 gap-y-16 sm:gap-x-12 sm:gap-y-24">
                {items.map((product) => (
                  <ProductCard
                    key={`grid-${product.id}`}
                    product={product}
                    onOpen={handleOpenProduct}
                  />
                ))}
              </div>

              {/* INFINITE SCROLL OBSERVER & LOADER */}
              {!isShuffleMode && (
                <div
                  ref={observerTarget}
                  className="w-full py-16 mt-8 flex flex-col items-center justify-center"
                >
                  {isLoadingMore && (
                    <div className="flex flex-col items-center text-neutral-400">
                      <Loader2 size={24} className="animate-spin mb-3" />
                      <span className="text-[9px] font-bold uppercase tracking-[0.2em]">
                        Loading More Pieces
                      </span>
                    </div>
                  )}
                  {!hasMore && items.length > 0 && (
                    <div className="flex items-center gap-4 w-full max-w-md opacity-40">
                      <div className="h-px flex-1 bg-black" />
                      <span className="text-[9px] font-bold uppercase tracking-[0.3em] text-black">
                        End of Collection
                      </span>
                      <div className="h-px flex-1 bg-black" />
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </main>

      <AuthModal />
    </div>
  );
}
