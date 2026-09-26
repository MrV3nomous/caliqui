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
  Shirt,
  ShoppingBag,
  SlidersHorizontal,
  Sparkles,
  User,
  Wand2,
  X,
} from 'lucide-react';
import type React from 'react';
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { env } from '@/shared/env';
import { AuthModal } from '@/ui/components/AuthModal';
import { Mini3DViewer } from '@/ui/components/Mini3DViewer';
import { Mini3DViewerStatic } from '@/ui/components/Mini3DViewerStatic';
import { useAuthStore } from '@/ui/store/auth-store';
import { useCheckoutStore } from '@/ui/store/checkout-store';
import type { MarketplaceItem } from '@/ui/store/marketplace-store';
import { useMarketplaceStore } from '@/ui/store/marketplace-store';

type ApparelModel = 'tshirtman' | 'tshirtwoman' | 'tshirtoversized';
const FIT_OPTIONS: ApparelModel[] = ['tshirtman', 'tshirtwoman', 'tshirtoversized'];

const FIT_LABELS: Record<ApparelModel, string> = {
  tshirtman: "Men's",
  tshirtwoman: "Women's",
  tshirtoversized: 'Oversized',
};

const getFinalPrice = (price: number, discount?: number) => {
  if (!discount || discount <= 0) return price;
  return Math.round(price * (1 - discount / 100));
};

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

function ProductGridCarousel({
  urls,
  alt,
  onOpen,
  priority = false,
}: {
  urls: string[];
  alt: string;
  onOpen: () => void;
  priority?: boolean;
}) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const dragStart = useRef<number | null>(null);
  const isDragging = useRef(false);
  const [isGrabbing, setIsGrabbing] = useState(false);

  const handlePointerDown = (e: React.PointerEvent) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    dragStart.current = e.clientX;
    isDragging.current = false;
    setIsGrabbing(true);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (dragStart.current !== null && Math.abs(e.clientX - dragStart.current) > 10) {
      isDragging.current = true;
    }
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (dragStart.current !== null && isDragging.current) {
      const distance = dragStart.current - e.clientX;
      const minSwipeDistance = 30;

      if (distance > minSwipeDistance) {
        setCurrentIndex((prev) => (prev + 1) % urls.length);
      } else if (distance < -minSwipeDistance) {
        setCurrentIndex((prev) => (prev - 1 + urls.length) % urls.length);
      }
    } else if (!isDragging.current) {
      e.preventDefault();
      e.stopPropagation();
      onOpen();
    }

    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
    dragStart.current = null;
    setIsGrabbing(false);
  };

  const handlePointerCancel = (e: React.PointerEvent) => {
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
    dragStart.current = null;
    isDragging.current = false;
    setIsGrabbing(false);
  };

  if (urls.length === 0) {
    return (
      <button
        type="button"
        aria-label="Open product"
        className="absolute inset-0 w-full h-full flex items-center justify-center cursor-pointer bg-transparent border-0 outline-none focus-visible:ring-1 focus-visible:ring-stone-900/30"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onOpen();
        }}
      >
        <Box size={24} className="text-stone-300" />
      </button>
    );
  }

  return (
    <div
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerCancel}
      className={`absolute inset-0 w-full h-full select-none touch-pan-y outline-none ${isGrabbing ? 'cursor-grabbing' : 'cursor-pointer'}`}
    >
      <img
        src={urls[currentIndex]}
        alt={alt}
        loading={priority ? 'eager' : 'lazy'}
        fetchPriority={priority ? 'high' : 'auto'}
        draggable={false}
        className="w-full h-full object-cover object-top transition-transform duration-1000 group-hover:scale-[1.03] mix-blend-multiply pointer-events-none"
      />
    </div>
  );
}

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
  const dragStart = useRef<number | null>(null);
  const isDragging = useRef(false);
  const [isGrabbing, setIsGrabbing] = useState(false);
  const [showSwipeHint, setShowSwipeHint] = useState(!isFullScreen);

  const handlePointerDown = (e: React.PointerEvent) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    dragStart.current = e.clientX;
    isDragging.current = false;
    setIsGrabbing(true);
    setShowSwipeHint(false);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (dragStart.current !== null && Math.abs(e.clientX - dragStart.current) > 10) {
      isDragging.current = true;
    }
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (dragStart.current !== null && isDragging.current) {
      const distance = dragStart.current - e.clientX;
      const minSwipeDistance = 40;

      if (distance > minSwipeDistance) {
        setCurrentIndex((prev) => (prev + 1) % urls.length);
      } else if (distance < -minSwipeDistance) {
        setCurrentIndex((prev) => (prev - 1 + urls.length) % urls.length);
      }
    } else if (!isDragging.current && onZoom) {
      e.preventDefault();
      e.stopPropagation();
      onZoom();
    }

    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
    dragStart.current = null;
    setIsGrabbing(false);
  };

  const handlePointerCancel = (e: React.PointerEvent) => {
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
    dragStart.current = null;
    isDragging.current = false;
    setIsGrabbing(false);
  };

  if (urls.length === 0) {
    return (
      <div className="w-full h-full flex items-center justify-center p-8 lg:p-16">
        <Box size={40} className="text-stone-200" />
      </div>
    );
  }

  return (
    <div
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerCancel}
      className={`w-full h-full relative flex items-center justify-center group/carousel bg-[#FAFAFA] overflow-hidden select-none touch-pan-y outline-none ${isGrabbing ? 'cursor-grabbing' : onZoom ? 'cursor-zoom-in' : 'cursor-default'} ${isFullScreen ? 'max-w-none p-4 md:p-16' : 'w-full h-full p-6 sm:p-12'}`}
    >
      <img
        src={urls[currentIndex]}
        alt={alt}
        draggable={false}
        className={`w-full h-full object-contain mix-blend-multiply transition-opacity duration-500 pointer-events-none`}
      />

      {onZoom && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onZoom();
          }}
          onPointerDown={(e) => e.stopPropagation()}
          onPointerUp={(e) => e.stopPropagation()}
          className="absolute top-6 right-6 z-20 w-8 h-8 flex items-center justify-center text-stone-400 hover:text-stone-900 transition-colors outline-none focus-visible:ring-1 focus-visible:ring-stone-900/30 rounded-sm cursor-pointer"
          aria-label="View fullscreen"
        >
          <Maximize size={18} strokeWidth={1.5} />
        </button>
      )}

      {urls.length > 1 && (
        <>
          <div
            className={`md:hidden absolute bottom-12 left-1/2 -translate-x-1/2 flex items-center gap-2 bg-stone-900/90 backdrop-blur-md px-4 py-2 rounded-sm shadow-lg z-30 pointer-events-none transition-opacity duration-1000 ${showSwipeHint ? 'opacity-100' : 'opacity-0'}`}
          >
            <Hand size={14} className="text-white animate-pulse" />
            <span className="text-[9px] font-medium uppercase tracking-[0.2em] text-white">
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
            onPointerDown={(e) => e.stopPropagation()}
            onPointerUp={(e) => e.stopPropagation()}
            className={`hidden md:flex absolute left-4 lg:left-8 top-1/2 -translate-y-1/2 items-center justify-center text-stone-400 hover:text-stone-900 transition-all z-20 outline-none opacity-0 group-hover/carousel:opacity-100 cursor-pointer w-10 h-10 focus-visible:ring-1 focus-visible:ring-stone-900/30 rounded-full`}
          >
            <ChevronLeft size={28} strokeWidth={1} />
          </button>

          <button
            type="button"
            aria-label="Next image"
            onClick={(e) => {
              e.stopPropagation();
              setCurrentIndex((prev) => (prev + 1) % urls.length);
            }}
            onPointerDown={(e) => e.stopPropagation()}
            onPointerUp={(e) => e.stopPropagation()}
            className={`hidden md:flex absolute right-4 lg:right-8 top-1/2 -translate-y-1/2 items-center justify-center text-stone-400 hover:text-stone-900 transition-all z-20 outline-none opacity-0 group-hover/carousel:opacity-100 cursor-pointer w-10 h-10 focus-visible:ring-1 focus-visible:ring-stone-900/30 rounded-full`}
          >
            <ChevronRight size={28} strokeWidth={1} />
          </button>

          <div className="absolute bottom-8 left-0 right-0 flex justify-center gap-3 z-20">
            {urls.map((url, i) => (
              <button
                key={url}
                type="button"
                aria-label={`View image ${i + 1}`}
                onClick={(e) => {
                  e.stopPropagation();
                  setCurrentIndex(i);
                }}
                onPointerDown={(e) => e.stopPropagation()}
                onPointerUp={(e) => e.stopPropagation()}
                className={`h-px transition-all outline-none p-0 m-0 border-none cursor-pointer focus-visible:ring-1 focus-visible:ring-stone-900/30 ${
                  i === currentIndex ? 'bg-stone-900 w-8' : 'bg-stone-300 w-4 hover:bg-stone-500'
                }`}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

const ProductCard = memo(function ProductCard({
  product,
  onOpen,
  selectedFit,
  priority = false,
}: {
  product: MarketplaceItem;
  onOpen: (p: MarketplaceItem) => void;
  selectedFit: ApparelModel;
  priority?: boolean;
}) {
  const sortedUrls = getSortedGallery(product);
  const is3DModel = Boolean(product.canvas_state && product.canvas_state.length > 0);

  return (
    <div className="group flex flex-col w-full bg-transparent border-0 p-0 m-0 text-left relative focus-within:z-10">
      <div className="relative aspect-[4/5] overflow-hidden mb-4 w-full flex items-center justify-center bg-transparent">
        {is3DModel ? (
          <Mini3DViewerStatic
            key={`${product.id}-${selectedFit}`}
            canvasState={product.canvas_state}
            tshirtColor={product.tshirt_color || '#ffffff'}
            apparelModel={selectedFit}
            onOpen={() => onOpen(product)}
          />
        ) : (
          <ProductGridCarousel
            urls={sortedUrls}
            alt={product.name}
            onOpen={() => onOpen(product)}
            priority={priority}
          />
        )}
      </div>

      <button
        type="button"
        className="flex flex-col w-full cursor-pointer outline-none border-0 bg-transparent rounded-sm focus-visible:ring-2 focus-visible:ring-stone-900/10 transition-all"
        onClick={() => onOpen(product)}
      >
        <div className="flex flex-col items-start w-full opacity-100 sm:opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity duration-300">
          {product.is_new && (
            <span className="text-[8px] font-bold uppercase tracking-[0.2em] text-stone-400 mb-1">
              New
            </span>
          )}

          <h3 className="font-medium text-[10px] tracking-[0.14em] uppercase mb-1 text-stone-900 truncate w-full flex gap-2 items-center">
            {product.name}
          </h3>

          <div className="flex items-center gap-3">
            {product.discount_percentage && product.discount_percentage > 0 ? (
              <>
                <span className="text-[10px] font-medium text-stone-900 tracking-[0.1em]">
                  ₹
                  {getFinalPrice(product.price, product.discount_percentage).toLocaleString(
                    'en-IN',
                  )}
                </span>
                <span className="text-[10px] text-stone-400 line-through tracking-[0.1em]">
                  ₹{product.price.toLocaleString('en-IN')}
                </span>
              </>
            ) : (
              <span className="text-[10px] font-medium text-stone-500 tracking-[0.1em]">
                ₹{product.price.toLocaleString('en-IN')}
              </span>
            )}
          </div>
        </div>
      </button>
    </div>
  );
});

export function Marketplace() {
  const navigate = useNavigate();
  const { isAuthenticated, openAuthModal } = useAuthStore();
  const { cart, addToCart, updateCartItemQuantity } = useCheckoutStore();

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
    fetchItemById,
    incrementPopularity,
  } = useMarketplaceStore();

  const [searchParams, setSearchParams] = useSearchParams();
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState<string>('All');
  const [selectedProduct, setSelectedProduct] = useState<MarketplaceItem | null>(null);

  const [globalFit, setGlobalFit] = useState<ApparelModel>('tshirtman');
  const [drawerFit, setDrawerFit] = useState<ApparelModel>('tshirtman');

  const [activeDropdown, setActiveDropdown] = useState<'fit' | 'search' | 'surprise' | null>(null);
  const headerActionsRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const [isFullscreen, setIsFullscreen] = useState(false);
  const fullscreenCloseRef = useRef<HTMLButtonElement>(null);

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
  const [_cartAnim, setCartAnim] = useState(false);
  const [isCopied, setIsCopied] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);
  const skeletonKeys = useMemo(() => Array.from({ length: 12 }).map(() => crypto.randomUUID()), []);
  const observerTarget = useRef<HTMLDivElement>(null);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const requestedItemIdRef = useRef<string | null>(null);
  const globalFitRef = useRef(globalFit);

  const isLongPress = useRef(false);
  const isNavigating = useRef(false);
  const drawerMountTime = useRef(0);

  const spotlightIds = useMemo(
    () => new Set(spotlightItems.map((item) => item.id)),
    [spotlightItems],
  );

  const archiveItems = useMemo(
    () => items.filter((item) => !spotlightIds.has(item.id)),
    [items, spotlightIds],
  );

  const shouldShowSpotlight =
    !isShuffleMode && activeCategory === 'All' && !debouncedSearch && spotlightItems.length > 0;

  const hasVisibleProducts = archiveItems.length > 0 || shouldShowSpotlight;

  const clearLongPressTimer = useCallback(() => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  }, []);

  useEffect(() => {
    return () => {
      clearLongPressTimer();
    };
  }, [clearLongPressTimer]);

  useEffect(() => {
    globalFitRef.current = globalFit;
  }, [globalFit]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;

      if (isFullscreen) {
        setIsFullscreen(false);
        return;
      }
      if (selectedProduct) {
        isNavigating.current = true;
        setSearchParams((params) => {
          params.delete('item');
          return params;
        });
        setSelectedProduct(null);
        requestedItemIdRef.current = null;
        if (scrollRef.current) {
          scrollRef.current.style.overflowY = 'auto';
          scrollRef.current.style.overflowX = 'hidden';
        }
        setTimeout(() => {
          isNavigating.current = false;
        }, 150);
        return;
      }
      if (activeDropdown) {
        setActiveDropdown(null);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isFullscreen, selectedProduct, activeDropdown, setSearchParams]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (headerActionsRef.current && !headerActionsRef.current.contains(event.target as Node)) {
        setActiveDropdown(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (activeDropdown !== 'search') return;
    const timer = window.setTimeout(() => {
      searchInputRef.current?.focus();
    }, 100);
    return () => window.clearTimeout(timer);
  }, [activeDropdown]);

  useEffect(() => {
    if (isFullscreen) {
      fullscreenCloseRef.current?.focus();
    }
  }, [isFullscreen]);

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

  const itemId = searchParams.get('item');

  useEffect(() => {
    if (isNavigating.current) return;
    let cancelled = false;

    if (!itemId) {
      requestedItemIdRef.current = null;
      if (selectedProduct?.id) {
        setSelectedProduct(null);
        if (scrollRef.current) {
          scrollRef.current.style.overflowY = 'auto';
          scrollRef.current.style.overflowX = 'hidden';
        }
      }
      return () => {
        cancelled = true;
      };
    }

    const cachedProduct = [...spotlightItems, ...items].find((i) => i.id === itemId);

    if (cachedProduct) {
      requestedItemIdRef.current = null;
      const isNewProduct = selectedProduct?.id !== cachedProduct.id;

      if (isNewProduct) {
        setSelectedProduct(cachedProduct);
        setSelectedSizes({ XS: 0, S: 0, M: 0, L: 0, XL: 0, XXL: 0 });
        setFocusedSize('M');
        setDrawerFit(
          cachedProduct.canvas_state
            ? globalFitRef.current
            : (cachedProduct.apparel_model as ApparelModel) || 'tshirtman',
        );
      }

      if (scrollRef.current) {
        scrollRef.current.style.overflow = 'hidden';
      }

      return () => {
        cancelled = true;
      };
    }

    if (!fetchItemById || requestedItemIdRef.current === itemId) return;
    requestedItemIdRef.current = itemId;

    void fetchItemById(itemId)
      .then((fetchedProduct) => {
        if (cancelled || !fetchedProduct) {
          if (requestedItemIdRef.current === itemId) {
            requestedItemIdRef.current = null;
          }
          return;
        }

        const isNewProduct = selectedProduct?.id !== fetchedProduct.id;

        if (isNewProduct) {
          setSelectedProduct(fetchedProduct);
          setSelectedSizes({ XS: 0, S: 0, M: 0, L: 0, XL: 0, XXL: 0 });
          setFocusedSize('M');
          setDrawerFit(
            fetchedProduct.canvas_state
              ? globalFitRef.current
              : (fetchedProduct.apparel_model as ApparelModel) || 'tshirtman',
          );
        }

        requestedItemIdRef.current = itemId;

        if (scrollRef.current) {
          scrollRef.current.style.overflow = 'hidden';
        }
      })
      .catch((error) => {
        if (!cancelled) {
          console.error('Failed to resolve marketplace item:', error);
        }
        if (requestedItemIdRef.current === itemId) {
          requestedItemIdRef.current = null;
        }
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [itemId, items, spotlightItems, fetchItemById, selectedProduct?.id]);

  useEffect(() => {
    return () => {
      if (scrollRef.current) {
        scrollRef.current.style.overflowY = 'auto';
        scrollRef.current.style.overflowX = 'hidden';
      }
    };
  }, []);

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
    clearLongPressTimer();
  };

  const handleTouchCancel = () => {
    clearLongPressTimer();
  };

  const handleOpenProduct = useCallback(
    (product: MarketplaceItem) => {
      incrementPopularity(product.id);
      drawerMountTime.current = Date.now();
      isNavigating.current = true;

      setSearchParams({ item: product.id });
      setSelectedProduct(product);
      setSelectedSizes({ XS: 0, S: 0, M: 0, L: 0, XL: 0, XXL: 0 });
      setFocusedSize('M');
      requestedItemIdRef.current = product.id;

      setDrawerFit(
        product.canvas_state ? globalFit : (product.apparel_model as ApparelModel) || 'tshirtman',
      );

      if (scrollRef.current) scrollRef.current.style.overflow = 'hidden';

      setTimeout(() => {
        isNavigating.current = false;
      }, 150);
    },
    [incrementPopularity, setSearchParams, globalFit],
  );

  const handleCloseProduct = () => {
    isNavigating.current = true;
    setSearchParams((params) => {
      params.delete('item');
      return params;
    });
    setSelectedProduct(null);
    requestedItemIdRef.current = null;
    setIsFullscreen(false);

    if (scrollRef.current) {
      scrollRef.current.style.overflowY = 'auto';
      scrollRef.current.style.overflowX = 'hidden';
    }

    setTimeout(() => {
      isNavigating.current = false;
    }, 150);
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

  const confirmAddToCart = () => {
    if (!selectedProduct) return;
    setIsAdding(true);

    let existing = cart.find((c) => c.productId === selectedProduct.id);

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
        apparelModel: selectedProduct.canvas_state ? drawerFit : selectedProduct.apparel_model,
      });
      const state = useCheckoutStore.getState();
      existing = state.cart.find((c) => c.productId === selectedProduct.id);
      if (existing) updateCartItemQuantity(existing.cartId, 'M', -1);
    }

    const targetCartId = existing?.cartId;
    if (targetCartId) {
      Object.entries(selectedSizes).forEach(([size, qty]) => {
        if (qty > 0) {
          updateCartItemQuantity(targetCartId, size, qty);
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

  const toggleDropdown = (name: 'fit' | 'search' | 'surprise') => {
    setActiveDropdown((prev) => (prev === name ? null : name));
  };

  return (
    <div
      ref={scrollRef}
      className="relative w-full h-[100dvh] overflow-y-auto overflow-x-hidden bg-[#FAFAFA] font-sans selection:bg-stone-200 text-stone-900 select-none custom-scrollbar"
    >
      <AuthModal />

      {/* FULLSCREEN IMAGE/3D VIEWER */}
      {isFullscreen && selectedProduct && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`${selectedProduct.name} fullscreen viewer`}
          className="fixed inset-0 z-[600] bg-[#FAFAFA] flex flex-col animate-in fade-in duration-500"
        >
          <button
            ref={fullscreenCloseRef}
            type="button"
            aria-label="Close fullscreen"
            onClick={() => setIsFullscreen(false)}
            className="absolute top-8 right-8 z-50 w-12 h-12 flex items-center justify-center text-stone-400 hover:text-stone-900 transition-colors outline-none focus-visible:ring-2 focus-visible:ring-stone-900/30 rounded-full cursor-pointer"
          >
            <X size={24} strokeWidth={1} />
          </button>
          <div className="flex-1 w-full h-full relative">
            {selectedProduct.canvas_state ? (
              <div className="absolute inset-0 w-full h-full cursor-grab active:cursor-grabbing mix-blend-multiply flex items-center justify-center">
                <Mini3DViewer
                  key={`fullscreen-${selectedProduct.id}-${drawerFit}`}
                  canvasState={selectedProduct.canvas_state}
                  tshirtColor={selectedProduct.tshirt_color || '#ffffff'}
                  fallbackImage={selectedProduct.thumbnail_url}
                  apparelModel={drawerFit}
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

      {/* DRAWER MODAL */}
      {selectedProduct && (
        <div className="fixed inset-0 z-[500] flex justify-end">
          <button
            type="button"
            aria-label="Close product details"
            className="absolute inset-0 w-full h-full bg-stone-950/20 backdrop-blur-sm outline-none cursor-default border-0 p-0 m-0 animate-in fade-in duration-500"
            onClick={(_e) => {
              if (Date.now() - drawerMountTime.current < 400) return;
              handleCloseProduct();
            }}
          />

          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="product-dialog-title"
            aria-hidden={isFullscreen ? true : undefined}
            className="relative z-10 w-full md:w-[800px] lg:w-[1000px] h-[100dvh] bg-white flex flex-col md:flex-row animate-in slide-in-from-right duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] overflow-hidden custom-scrollbar"
          >
            <div className="w-full md:w-[55%] h-[55vh] md:h-full bg-[#FAFAFA] shrink-0 relative flex items-center justify-center border-b md:border-b-0 md:border-r border-stone-100">
              {selectedProduct.canvas_state ? (
                <div className="absolute inset-0 w-full h-full pointer-events-auto cursor-grab active:cursor-grabbing mix-blend-multiply flex items-center justify-center p-8">
                  <Mini3DViewer
                    key={`drawer-${selectedProduct.id}-${drawerFit}`}
                    canvasState={selectedProduct.canvas_state}
                    tshirtColor={selectedProduct.tshirt_color || '#ffffff'}
                    fallbackImage={selectedProduct.thumbnail_url}
                    apparelModel={drawerFit}
                  />
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setIsFullscreen(true);
                    }}
                    className="absolute top-6 right-6 z-20 w-8 h-8 flex items-center justify-center text-stone-400 hover:text-stone-900 transition-colors outline-none focus-visible:ring-1 focus-visible:ring-stone-900/30 rounded-sm cursor-pointer"
                    aria-label="View fullscreen"
                  >
                    <Maximize size={16} strokeWidth={1.5} />
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

            <div className="flex flex-col w-full md:w-[45%] flex-1 min-h-0 px-8 py-10 md:px-16 md:py-16 bg-white overflow-y-auto custom-scrollbar relative">
              <button
                type="button"
                onClick={handleCloseProduct}
                className="absolute top-6 right-6 md:top-8 md:right-8 z-50 w-8 h-8 flex items-center justify-center text-stone-400 hover:text-stone-900 transition-colors outline-none focus-visible:ring-1 focus-visible:ring-stone-900/30 rounded-sm cursor-pointer"
                aria-label="Close details"
              >
                <X size={20} strokeWidth={1.5} />
              </button>

              <div className="flex items-center justify-between mb-8 pr-12">
                <p className="text-[9px] font-medium uppercase tracking-[0.2em] text-stone-400">
                  {selectedProduct.collection || 'Collection'}
                </p>
                <button
                  type="button"
                  onClick={handleShareLink}
                  className="flex items-center gap-1.5 text-stone-400 hover:text-stone-900 transition-colors outline-none focus-visible:ring-1 focus-visible:ring-stone-900/30 rounded-sm cursor-pointer"
                >
                  {isCopied ? (
                    <Check size={12} strokeWidth={2} />
                  ) : (
                    <LinkIcon size={12} strokeWidth={1.5} />
                  )}
                  <span className="text-[9px] font-medium uppercase tracking-[0.1em]">
                    {isCopied ? 'Copied' : 'Share'}
                  </span>
                </button>
              </div>

              <h2
                id="product-dialog-title"
                className="text-2xl md:text-3xl font-light tracking-tight leading-snug mb-4 text-stone-900"
              >
                {selectedProduct.name}
              </h2>

              <div className="flex items-center gap-3 mb-8">
                {selectedProduct.discount_percentage && selectedProduct.discount_percentage > 0 ? (
                  <>
                    <span className="text-lg font-light text-stone-900 tracking-wide">
                      ₹{currentItemPrice.toLocaleString('en-IN')}
                    </span>
                    <span className="text-sm font-light text-stone-400 line-through tracking-wide">
                      ₹{selectedProduct.price.toLocaleString('en-IN')}
                    </span>
                    <span className="text-[9px] font-medium text-stone-900 uppercase tracking-widest ml-2">
                      -{selectedProduct.discount_percentage}%
                    </span>
                  </>
                ) : (
                  <span className="text-lg font-light text-stone-500 tracking-wide">
                    ₹{selectedProduct.price.toLocaleString('en-IN')}
                  </span>
                )}
              </div>

              {selectedProduct.description && (
                <div className="prose prose-sm text-stone-500 font-light leading-relaxed mb-12 text-sm tracking-wide">
                  <p>{selectedProduct.description}</p>
                </div>
              )}

              <div className="mt-auto">
                {selectedProduct.canvas_state && (
                  <div className="mb-10">
                    <span className="text-[9px] font-medium tracking-[0.2em] uppercase text-stone-400 block mb-4">
                      Fit
                    </span>
                    <div className="flex items-center gap-6">
                      {FIT_OPTIONS.map((fit) => (
                        <button
                          key={fit}
                          type="button"
                          aria-pressed={drawerFit === fit}
                          onClick={() => setDrawerFit(fit)}
                          className={`text-[10px] uppercase tracking-[0.15em] transition-all outline-none focus-visible:ring-1 focus-visible:ring-stone-900/30 rounded-sm cursor-pointer pb-1 border-b ${
                            drawerFit === fit
                              ? 'text-stone-900 border-stone-900 font-medium'
                              : 'text-stone-400 border-transparent hover:text-stone-600'
                          }`}
                        >
                          {FIT_LABELS[fit]}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <div className="mb-10">
                  <div className="flex justify-between items-center mb-4">
                    <span className="text-[9px] font-medium tracking-[0.2em] uppercase text-stone-400">
                      Size
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-4">
                    {['XS', 'S', 'M', 'L', 'XL', 'XXL'].map((size) => {
                      const qty = selectedSizes[size] || 0;
                      const isFocused = focusedSize === size;
                      return (
                        <button
                          key={size}
                          type="button"
                          aria-label={`${size} size, ${qty} selected`}
                          onClick={(e) => handleSizeLeftClick(e, size)}
                          onContextMenu={(e) => handleSizeRightClick(e, size)}
                          onTouchStart={() => handleTouchStart(size)}
                          onTouchCancel={handleTouchCancel}
                          onTouchEnd={handleTouchEnd}
                          className={`relative h-10 min-w-10 px-2 flex items-center justify-center text-[11px] transition-all outline-none focus-visible:ring-1 focus-visible:ring-stone-900/30 rounded-sm cursor-pointer border-b ${
                            isFocused
                              ? 'border-stone-900 text-stone-900 font-medium'
                              : 'border-transparent text-stone-400 hover:text-stone-900'
                          }`}
                        >
                          {size}
                          {qty > 0 && (
                            <span className="absolute -top-1 -right-2 text-[9px] font-bold text-stone-900">
                              {qty}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="flex items-center justify-between mb-12">
                  <span className="text-[9px] font-medium uppercase tracking-[0.2em] text-stone-400">
                    Quantity <span className="text-stone-900 ml-1">({focusedSize})</span>
                  </span>
                  <div className="flex items-center gap-6 text-stone-900">
                    <button
                      type="button"
                      onClick={() => updateLocalSize(focusedSize, -1)}
                      disabled={selectedSizes[focusedSize] === 0}
                      className="hover:opacity-50 disabled:opacity-20 outline-none focus-visible:ring-1 focus-visible:ring-stone-900/30 rounded-sm transition-opacity cursor-pointer"
                    >
                      <Minus size={14} strokeWidth={1} />
                    </button>
                    <span className="text-sm font-light w-4 text-center">
                      {selectedSizes[focusedSize] || 0}
                    </span>
                    <button
                      type="button"
                      onClick={() => updateLocalSize(focusedSize, 1)}
                      className="hover:opacity-50 outline-none focus-visible:ring-1 focus-visible:ring-stone-900/30 rounded-sm transition-opacity cursor-pointer"
                    >
                      <Plus size={14} strokeWidth={1} />
                    </button>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={confirmAddToCart}
                  disabled={totalQty === 0 || isAdding}
                  className="w-full h-14 bg-stone-950 hover:bg-stone-800 disabled:bg-stone-200 disabled:text-stone-400 text-white font-medium uppercase tracking-[0.2em] text-[10px] rounded-sm transition-all flex items-center justify-center outline-none focus-visible:ring-2 focus-visible:ring-stone-900/50 focus-visible:ring-offset-2 cursor-pointer"
                >
                  {isAdding ? 'Added' : `Add To Bag — ₹${totalPrice.toLocaleString('en-IN')}`}
                </button>

                <div className="w-full flex justify-center mt-6">
                  <button
                    type="button"
                    onClick={() => {
                      handleCloseProduct();
                      navigate('/editor');
                    }}
                    className="text-[9px] text-stone-400 hover:text-stone-900 font-medium uppercase tracking-[0.2em] transition-colors outline-none focus-visible:text-stone-900 focus-visible:ring-1 focus-visible:ring-stone-900/30 rounded-sm pb-1 border-b border-transparent hover:border-stone-900"
                  >
                    Take it into Studio
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* PINNED LUXURY HEADER */}
      <header className="fixed top-0 left-0 right-0 z-50 w-full h-[56px] md:h-[60px] bg-[#FAFAFA]/95 backdrop-blur-md border-b border-stone-200/50 flex items-center justify-between px-6 lg:px-12 pointer-events-auto">
        <Link
          to="/"
          className="hover:opacity-60 transition-opacity duration-300 outline-none focus-visible:ring-1 focus-visible:ring-stone-900/30 rounded-sm flex items-center h-full"
        >
          <img
            src="/logo.png"
            alt={env.VITE_APP_NAME}
            className="h-3.5 md:h-4 w-auto object-contain brightness-0"
          />
        </Link>

        <div ref={headerActionsRef} className="flex items-center gap-4 md:gap-6 h-full relative">
          <button
            type="button"
            aria-label="Search collection"
            onClick={() => toggleDropdown('search')}
            className={`transition-colors outline-none focus-visible:ring-1 focus-visible:ring-stone-900/30 rounded-sm p-1 ${activeDropdown === 'search' ? 'text-stone-900' : 'text-stone-400 hover:text-stone-900'}`}
          >
            <Search size={16} strokeWidth={1.5} />
          </button>

          <button
            type="button"
            aria-label="Choose model"
            onClick={() => toggleDropdown('fit')}
            className={`transition-colors outline-none focus-visible:ring-1 focus-visible:ring-stone-900/30 rounded-sm p-1 ${activeDropdown === 'fit' ? 'text-stone-900' : 'text-stone-400 hover:text-stone-900'}`}
          >
            <Shirt size={16} strokeWidth={1.5} />
          </button>

          <button
            type="button"
            aria-label="Surprise me"
            onClick={() => toggleDropdown('surprise')}
            className={`transition-colors outline-none focus-visible:ring-1 focus-visible:ring-stone-900/30 rounded-sm p-1 ${activeDropdown === 'surprise' ? 'text-stone-900' : 'text-stone-400 hover:text-stone-900'}`}
          >
            <Sparkles size={16} strokeWidth={1.5} />
          </button>

          <div className="w-px h-3 bg-stone-300" />

          <Link
            to="/editor"
            className="text-[10px] font-medium uppercase tracking-[0.2em] text-stone-400 hover:text-stone-900 transition-colors outline-none focus-visible:text-stone-900 focus-visible:ring-1 focus-visible:ring-stone-900/30 rounded-sm p-1 flex items-center gap-1.5"
          >
            <Wand2 size={16} strokeWidth={1.5} className="sm:hidden" />
            <span className="hidden sm:block">Studio</span>
          </Link>

          {isAuthenticated ? (
            <Link
              to="/dashboard"
              className="text-[10px] font-medium uppercase tracking-[0.2em] text-stone-400 hover:text-stone-900 transition-colors outline-none focus-visible:text-stone-900 focus-visible:ring-1 focus-visible:ring-stone-900/30 rounded-sm p-1 flex items-center gap-1.5"
            >
              <User size={16} strokeWidth={1.5} className="sm:hidden" />
              <span className="hidden sm:block">Account</span>
            </Link>
          ) : (
            <button
              type="button"
              onClick={openAuthModal}
              className="text-[10px] font-medium uppercase tracking-[0.2em] text-stone-400 hover:text-stone-900 transition-colors outline-none focus-visible:text-stone-900 focus-visible:ring-1 focus-visible:ring-stone-900/30 rounded-sm p-1 cursor-pointer flex items-center gap-1.5"
            >
              <User size={16} strokeWidth={1.5} className="sm:hidden" />
              <span className="hidden sm:block">Sign In</span>
            </button>
          )}

          <Link
            to="/checkout"
            aria-label="Shopping Bag"
            className={`relative flex items-center justify-center p-1 transition-transform duration-300 outline-none focus-visible:ring-1 focus-visible:ring-stone-900/30 rounded-sm text-stone-900 ${_cartAnim ? 'scale-125' : 'hover:scale-110'}`}
          >
            <ShoppingBag size={16} strokeWidth={1.5} />
            {totalCartItems > 0 && (
              <span className="absolute -top-1.5 -right-2 text-[9px] font-bold min-w-4.5 h-4.5 px-1 rounded-full flex items-center justify-center border-2 bg-stone-900 text-white border-[#FAFAFA]">
                {totalCartItems}
              </span>
            )}
          </Link>

          {/* POPOVERS */}
          {activeDropdown === 'search' && (
            <div className="absolute top-[120%] right-0 w-[280px] bg-[#FAFAFA]/95 backdrop-blur-md border border-stone-200 shadow-xl p-5 animate-in slide-in-from-top-2 fade-in duration-200 cursor-default rounded-sm">
              <div className="flex flex-col gap-4">
                <span className="text-[9px] font-medium uppercase tracking-[0.2em] text-stone-400">
                  Search the collection
                </span>
                <div className="flex items-center gap-3 border-b border-stone-300 pb-1 focus-within:border-stone-900 transition-colors">
                  <Search size={14} strokeWidth={1.5} className="text-stone-400 shrink-0" />
                  <input
                    ref={searchInputRef}
                    type="text"
                    aria-label="Search the collection"
                    placeholder="Find a piece..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="bg-transparent border-none text-[10px] uppercase tracking-[0.15em] outline-none w-full text-stone-900 placeholder:text-stone-400"
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() => setSearchQuery('')}
                      className="text-stone-400 hover:text-stone-900 outline-none focus-visible:ring-1 focus-visible:ring-stone-900/30 rounded-sm"
                    >
                      <X size={12} />
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}

          {activeDropdown === 'fit' && (
            <div className="absolute top-[120%] right-0 w-[240px] bg-[#FAFAFA]/95 backdrop-blur-md border border-stone-200 shadow-xl p-5 animate-in slide-in-from-top-2 fade-in duration-200 cursor-default rounded-sm">
              <span className="text-[9px] font-medium uppercase tracking-[0.2em] text-stone-400 block mb-4">
                Fit
              </span>
              <div className="flex flex-col gap-3">
                {FIT_OPTIONS.map((fit) => (
                  <button
                    key={fit}
                    type="button"
                    aria-pressed={globalFit === fit}
                    onClick={() => {
                      setGlobalFit(fit);
                      setActiveDropdown(null);
                    }}
                    className={`text-[10px] uppercase tracking-[0.15em] transition-colors pb-1 border-b text-left w-full outline-none focus-visible:ring-1 focus-visible:ring-stone-900/30 rounded-sm ${
                      globalFit === fit
                        ? 'text-stone-900 border-stone-900 font-medium'
                        : 'text-stone-400 border-transparent hover:text-stone-900'
                    }`}
                  >
                    {FIT_LABELS[fit]}
                  </button>
                ))}
              </div>
            </div>
          )}

          {activeDropdown === 'surprise' && (
            <div className="absolute top-[120%] right-0 w-[280px] bg-[#FAFAFA]/95 backdrop-blur-md border border-stone-200 shadow-xl p-6 animate-in slide-in-from-top-2 fade-in duration-200 cursor-default rounded-sm flex flex-col gap-4 text-center">
              <span className="text-[9px] font-medium uppercase tracking-[0.2em] text-stone-400">
                Inspire Me
              </span>
              <p className="text-sm font-serif italic text-stone-600">
                Explore an unexpected curation of pieces from our archive.
              </p>
              <button
                type="button"
                onClick={() => {
                  fetchRandomItems();
                  setActiveDropdown(null);
                }}
                className="mt-2 w-full py-3 bg-stone-900 hover:bg-stone-800 text-white font-medium uppercase tracking-[0.2em] text-[9px] transition-colors rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-stone-900/50 focus-visible:ring-offset-2"
              >
                Discover something unexpected
              </button>
            </div>
          )}
        </div>
      </header>

      {/* CATEGORY BAR */}
      <div className="w-full bg-[#FAFAFA]/95 backdrop-blur-md border-b border-stone-200/40 sticky top-[56px] md:top-[60px] z-40">
        <div className="max-w-[1600px] mx-auto px-6 lg:px-12 py-4 flex overflow-x-auto custom-scrollbar">
          <div className="flex items-center gap-8">
            {collections.map((cat) => (
              <button
                key={cat}
                type="button"
                aria-pressed={activeCategory === cat}
                onClick={() => setActiveCategory(cat)}
                className={`text-[9px] uppercase tracking-[0.2em] whitespace-nowrap outline-none focus-visible:ring-1 focus-visible:ring-stone-900/30 rounded-sm transition-colors cursor-pointer pb-1 border-b ${
                  activeCategory === cat
                    ? 'font-medium text-stone-900 border-stone-900'
                    : 'font-normal text-stone-400 border-transparent hover:text-stone-900'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* MAIN GRID */}
      <main className="flex-1 w-full relative">
        <div className="w-full h-24 md:h-36 shrink-0" />

        <div className="max-w-[1600px] mx-auto px-6 lg:px-12 pb-48">
          {isLoading && items.length === 0 ? (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-6 gap-y-16 lg:gap-x-10 lg:gap-y-24">
              {skeletonKeys.map((key) => (
                <div key={key} className="w-full flex flex-col">
                  <div className="w-full aspect-[4/5] bg-stone-100 animate-pulse mb-4" />
                  <div className="w-3/4 h-2 bg-stone-100 animate-pulse mb-2" />
                  <div className="w-1/4 h-2 bg-stone-100 animate-pulse" />
                </div>
              ))}
            </div>
          ) : !isLoading && !hasVisibleProducts ? (
            <div className="py-40 flex flex-col items-center justify-center text-center">
              <SlidersHorizontal size={24} strokeWidth={1} className="text-stone-300 mb-6" />
              {searchQuery ? (
                <>
                  <p className="text-[9px] uppercase tracking-[0.2em] text-stone-400 mb-6">
                    Nothing matched your search.
                  </p>
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="text-[9px] font-medium uppercase tracking-[0.2em] text-stone-900 border-b border-stone-900 pb-1 outline-none focus-visible:ring-1 focus-visible:ring-stone-900/30 rounded-sm cursor-pointer"
                  >
                    Clear Search
                  </button>
                </>
              ) : (
                <>
                  <p className="text-[9px] uppercase tracking-[0.2em] text-stone-400 mb-6">
                    We haven't imagined this yet. But you can.
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      navigate('/editor');
                    }}
                    className="text-[9px] font-medium uppercase tracking-[0.2em] text-stone-900 border-b border-stone-900 pb-1 outline-none focus-visible:ring-1 focus-visible:ring-stone-900/30 rounded-sm cursor-pointer"
                  >
                    Open Studio
                  </button>
                </>
              )}
            </div>
          ) : (
            <>
              {/* EDITORIAL SPOTLIGHT / SELECTED */}
              {shouldShowSpotlight && (
                <div className="mb-24 animate-in fade-in duration-1000">
                  <div className="flex flex-col items-start justify-between mb-12 pr-12">
                    <h2 className="text-[9px] font-medium uppercase tracking-[0.2em] text-stone-900">
                      Selected
                    </h2>
                    <p className="text-sm font-serif italic text-stone-500 mt-2">
                      Things we've imagined.
                    </p>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-6 gap-y-16 lg:gap-x-10 lg:gap-y-24">
                    {spotlightItems.map((product, index) => (
                      <ProductCard
                        key={`spotlight-${product.id}`}
                        product={product}
                        onOpen={handleOpenProduct}
                        selectedFit={globalFit}
                        priority={index < 4}
                      />
                    ))}
                  </div>
                  <div className="w-full h-px bg-stone-200 mt-24" />
                </div>
              )}

              {/* REGULAR ARCHIVE GRID */}
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-6 gap-y-16 lg:gap-x-10 lg:gap-y-24">
                {archiveItems.map((product) => (
                  <ProductCard
                    key={`grid-${product.id}`}
                    product={product}
                    onOpen={handleOpenProduct}
                    selectedFit={globalFit}
                  />
                ))}
              </div>

              {!isShuffleMode && (
                <div
                  ref={observerTarget}
                  className="w-full py-24 mt-12 flex flex-col items-center justify-center"
                >
                  {isLoadingMore && (
                    <div className="flex flex-col items-center text-stone-400">
                      <Loader2 size={16} className="animate-spin mb-4" />
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </main>

      {/* MINIMALIST FOOTER */}
      <footer className="py-24 px-6 lg:px-12 bg-[#FAFAFA] flex flex-col items-center justify-center text-center space-y-8 border-t border-stone-200">
        <img
          src="/logo.png"
          alt={env.VITE_APP_NAME}
          className="h-4 md:h-5 w-auto object-contain brightness-0 transition-transform duration-700 hover:scale-[1.02]"
        />
        <p className="text-[9px] font-medium text-stone-400 tracking-[0.3em] uppercase pt-2">
          © {new Date().getFullYear()} {env.VITE_APP_NAME} STUDIOS.
        </p>
      </footer>
    </div>
  );
}
