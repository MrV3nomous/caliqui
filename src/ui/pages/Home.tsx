import { ArrowRight, ShoppingBag, Sparkles } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { env } from '@/shared/env';
import { AuthModal } from '@/ui/components/AuthModal';
import { PremiumLoader } from '@/ui/components/PremiumLoader';
import { useAuthStore } from '@/ui/store/auth-store';
import { useCheckoutStore } from '@/ui/store/checkout-store';

const rawImages = import.meta.glob('@/assets/strips/*.{jpg,jpeg,png,webp}', { eager: true });
const stripImages = Object.values(rawImages).map(
  (module) => (module as { default: string }).default,
);

const displayImages = stripImages.length > 0 ? stripImages : Array(36).fill('');

const columnsData = Array.from({ length: 6 }, (_, colIndex) => ({
  id: `col-${colIndex}`,
  images: [] as { id: string; src: string }[],
}));

displayImages.forEach((img, i) => {
  columnsData[i % 6].images.push({
    id: `img-${i}`,
    src: img as string,
  });
});

const animatedColumns = columnsData.map((col) => ({
  ...col,
  duplicatedImages: [...col.images, ...col.images.map((img) => ({ ...img, id: `${img.id}-dup` }))],
}));

export function Home() {
  const { isAuthenticated, openAuthModal } = useAuthStore();
  const { cart } = useCheckoutStore();
  const [scrolled, setScrolled] = useState(false);
  const [fomoIndex, setFomoIndex] = useState(0);
  const [assetsLoaded, setAssetsLoaded] = useState(false);

  const totalCartItems = cart.reduce(
    (acc, item) => acc + Object.values(item.sizes).reduce((a, b) => a + b, 0),
    0,
  );

  const fomoMessages = [
    'LIMITED EDITION DROPS AVAILABLE NOW',
    'FREE GLOBAL SHIPPING ON ALL ORDERS',
    'BESPOKE 3D ATELIER NOW OPEN',
  ];

  useEffect(() => {
    const loadAssets = async () => {
      if (stripImages.length === 0) {
        setAssetsLoaded(true);
        return;
      }
      const promises = stripImages.slice(0, 12).map((src) => {
        return new Promise((resolve) => {
          const img = new Image();
          img.src = src;
          img.onload = resolve;
          img.onerror = resolve;
        });
      });
      await Promise.all(promises);
      setAssetsLoaded(true);
    };
    loadAssets();
  }, []);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 50);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      setFomoIndex((prev) => (prev + 1) % fomoMessages.length);
    }, 4000);
    return () => clearInterval(interval);
  }, [fomoMessages.length]);

  return (
    <div className="w-full min-h-dvh flex flex-col bg-white text-black font-sans selection:bg-neutral-200 overflow-x-hidden select-none">
      <style>{`
        @keyframes scroll-up { 0% { transform: translateY(0); } 100% { transform: translateY(-50%); } }
        @keyframes scroll-down { 0% { transform: translateY(-50%); } 100% { transform: translateY(0); } }
        .animate-scroll-up { animation: scroll-up 60s linear infinite; }
        .animate-scroll-down { animation: scroll-down 60s linear infinite; }
        .hide-scrollbar::-webkit-scrollbar { display: none; }
        .hide-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>

      {/* DYNAMIC ASSET LOADER */}
      {!assetsLoaded && <PremiumLoader />}

      {/* GLOBAL AUTH MODAL */}
      <AuthModal />

      {/* ROTATING EDITORIAL BANNER */}
      <div className="w-full bg-black text-white text-[9px] md:text-[10px] font-medium tracking-[0.2em] uppercase text-center py-2.5 relative z-60">
        <div className="max-w-[1600px] mx-auto px-6 overflow-hidden relative">
          <span
            key={fomoIndex}
            className="block animate-in fade-in slide-in-from-bottom-1 duration-700"
          >
            {fomoMessages[fomoIndex]}
          </span>
        </div>
      </div>

      {/* LUXURY GLOBAL HEADER - Synced with Marketplace */}
      <header
        className={`fixed w-full z-50 transition-all duration-500 ${
          scrolled
            ? 'top-0 bg-white/95 backdrop-blur-md border-b border-black/4 py-4 shadow-[0_4px_20px_rgba(0,0,0,0.01)]'
            : 'top-8 bg-transparent py-6'
        }`}
      >
        <div className="max-w-[1600px] mx-auto px-6 lg:px-12 flex items-center justify-between">
          <Link to="/" className="hover:opacity-60 transition-opacity outline-none">
            <img
              src="/logo.png"
              alt={env.VITE_APP_NAME}
              className={`h-5 md:h-6 w-auto object-contain transition-all duration-500 ${scrolled ? '' : 'brightness-0 invert'}`}
            />
          </Link>

          <div className="flex items-center gap-5 sm:gap-6 md:gap-8">
            <Link
              to="/marketplace"
              className={`text-[10px] font-medium uppercase tracking-[0.15em] transition-colors outline-none hidden sm:block ${
                scrolled ? 'text-neutral-500 hover:text-black' : 'text-white/70 hover:text-white'
              }`}
            >
              Collection
            </Link>
            <Link
              to="/editor"
              className={`text-[10px] font-medium uppercase tracking-[0.15em] transition-colors outline-none hidden sm:block ${
                scrolled ? 'text-neutral-500 hover:text-black' : 'text-white/70 hover:text-white'
              }`}
            >
              Studio
            </Link>

            <div
              className={`w-px h-3 mx-1 sm:mx-0 hidden sm:block ${scrolled ? 'bg-neutral-200' : 'bg-white/20'}`}
            />

            {isAuthenticated ? (
              <Link
                to="/dashboard"
                className={`text-[10px] font-medium uppercase tracking-[0.15em] transition-colors flex items-center outline-none ${
                  scrolled ? 'text-neutral-500 hover:text-black' : 'text-white/70 hover:text-white'
                }`}
              >
                Account
              </Link>
            ) : (
              <button
                type="button"
                onClick={openAuthModal}
                className={`text-[10px] font-medium uppercase tracking-[0.15em] transition-colors flex items-center outline-none ${
                  scrolled ? 'text-neutral-500 hover:text-black' : 'text-white/70 hover:text-white'
                }`}
              >
                Sign In
              </button>
            )}

            {/* Perfected Cart Icon & Badge */}
            <Link
              to="/checkout"
              className={`relative flex items-center justify-center p-1 transition-all duration-300 outline-none ${
                scrolled ? 'text-black hover:opacity-60' : 'text-white hover:opacity-70'
              }`}
            >
              <ShoppingBag size={20} strokeWidth={1.2} />
              {totalCartItems > 0 && (
                <span
                  className={`absolute -top-1.5 -right-2 text-[9px] font-bold min-w-4.5 h-4.5 px-1 rounded-full flex items-center justify-center border-2 shadow-sm ${
                    scrolled
                      ? 'bg-black text-white border-white'
                      : 'bg-white text-black border-black/20'
                  }`}
                >
                  {totalCartItems}
                </span>
              )}
            </Link>
          </div>
        </div>
      </header>

      {/* EDITORIAL HERO SECTION */}
      <section className="relative w-full h-dvh bg-[#050505] flex items-center justify-center overflow-hidden">
        {/* Subdued, slower background animation */}
        <div className="absolute inset-0 w-[110%] left-[-5%] grid grid-cols-3 md:grid-cols-6 gap-2 md:gap-4 opacity-30 -rotate-1 scale-110 pointer-events-none">
          {animatedColumns.map((col, i) => (
            <div
              key={col.id}
              className={`flex-1 relative overflow-visible ${i > 2 ? 'hidden md:block' : ''}`}
            >
              <div
                className={`absolute w-full flex flex-col ${i % 2 === 0 ? 'animate-scroll-up' : 'animate-scroll-down'}`}
              >
                {col.duplicatedImages.map((imgObj) => (
                  <div
                    key={imgObj.id}
                    className="w-full aspect-3/4 bg-neutral-900 rounded-sm overflow-hidden shrink-0 shadow-lg mb-2 md:mb-4"
                  >
                    {imgObj.src ? (
                      <img
                        src={imgObj.src}
                        alt="Fashion Campaign"
                        loading="lazy"
                        className="w-full h-full object-cover saturate-50"
                      />
                    ) : (
                      <div className="w-full h-full bg-[#0a0a0a]" />
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="absolute inset-0 bg-linear-to-b from-black/80 via-black/30 to-black/90 pointer-events-none" />

        <div className="relative z-10 max-w-300 w-full px-6 flex flex-col items-center text-center animate-in fade-in slide-in-from-bottom-8 duration-1000 mt-12">
          <span className="text-white/50 text-[9px] md:text-[10px] font-medium uppercase tracking-[0.4em] mb-6">
            Welcome to {env.VITE_APP_NAME}
          </span>

          <h1 className="text-5xl md:text-7xl lg:text-8xl font-light tracking-tight text-white leading-[1.1] mb-6">
            Define Your <br className="hidden md:block" />
            <span className="font-medium text-transparent bg-clip-text bg-linear-to-r from-neutral-100 to-neutral-400">
              Aesthetic.
            </span>
          </h1>

          <p className="max-w-xl text-neutral-400 text-xs md:text-sm font-light mb-12 leading-relaxed tracking-wide">
            Premium ready-to-wear pieces designed for the modern minimalist, or bespoke luxury
            apparel engineered entirely by you in our 3D Atelier.
          </p>

          <div className="flex flex-col sm:flex-row items-center gap-4 w-full sm:w-auto">
            <Link
              to="/editor"
              className="w-full sm:w-auto flex items-center justify-center gap-3 px-10 h-12 bg-white text-black rounded-full font-medium text-[10px] uppercase tracking-[0.15em] transition-colors hover:bg-neutral-200 outline-none"
            >
              <Sparkles size={14} strokeWidth={1.5} />
              <span>Enter The Studio</span>
            </Link>

            <Link
              to="/marketplace"
              className="w-full sm:w-auto flex items-center justify-center gap-3 px-10 h-12 bg-white/5 backdrop-blur-md border border-white/10 text-white rounded-full font-medium text-[10px] uppercase tracking-[0.15em] transition-colors hover:bg-white/10 outline-none"
            >
              <span>Explore Collection</span>
            </Link>
          </div>
        </div>
      </section>

      {/* THE ATELIER SECTION - Stripped of extreme rotations and heavy borders */}
      <section className="flex-1 py-24 lg:py-40 px-6 lg:px-12 max-w-[1600px] w-full mx-auto grid grid-cols-1 lg:grid-cols-2 gap-16 items-center bg-white">
        <div className="order-2 lg:order-1 aspect-square bg-[#f8f8f8] overflow-hidden relative flex items-center justify-center">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,#ffffff_0%,transparent_100%)] opacity-50" />
          <div className="relative z-10 w-2/3 h-2/3 bg-white shadow-[0_20px_60px_rgba(0,0,0,0.04)] flex items-center justify-center transition-transform duration-1000 hover:scale-105">
            <div className="text-center space-y-4">
              <img src="/logo.png" alt="Logo" className="w-12 h-12 mx-auto opacity-30" />
              <p className="text-[10px] font-medium tracking-[0.2em] text-neutral-400 uppercase">
                3D Atelier
              </p>
            </div>
          </div>
        </div>

        <div className="order-1 lg:order-2 space-y-8 lg:pl-12">
          <span className="text-neutral-400 text-[10px] font-medium uppercase tracking-[0.3em]">
            Bespoke Engineering
          </span>
          <h2 className="text-4xl md:text-5xl lg:text-6xl font-light tracking-tight text-black leading-tight">
            The Atelier, <br /> Digitized.
          </h2>
          <p className="text-neutral-500 font-light text-sm md:text-base leading-relaxed max-w-md tracking-wide">
            Experience our groundbreaking 3D design studio. Import your artwork, manipulate
            typography, and direct the exact placement of your vision onto our premium luxury
            blanks.
          </p>
          <Link
            to="/editor"
            className="inline-flex items-center gap-3 font-medium text-[11px] uppercase tracking-[0.15em] text-black hover:text-neutral-400 transition-colors border-b border-black hover:border-neutral-400 pb-1 outline-none"
          >
            Start Creating <ArrowRight size={14} strokeWidth={1.5} />
          </Link>
        </div>
      </section>

      {/* CURATED COLLECTION SECTION - Clean, sharp edges */}
      <section className="py-24 lg:py-40 bg-[#fbfbfd] px-6 lg:px-12 border-t border-black/2">
        <div className="max-w-[1600px] mx-auto">
          <div className="flex flex-col md:flex-row justify-between items-end gap-8 mb-16">
            <div className="space-y-4 max-w-xl">
              <span className="text-neutral-400 text-[10px] font-medium uppercase tracking-[0.3em]">
                Ready-to-Wear
              </span>
              <h2 className="text-4xl md:text-5xl lg:text-6xl font-light tracking-tight text-black leading-tight">
                Curated Precision.
              </h2>
            </div>
            <Link
              to="/marketplace"
              className="inline-flex items-center gap-3 px-8 h-12 bg-black text-white rounded-full font-medium text-[10px] uppercase tracking-[0.15em] transition-all hover:bg-neutral-800 whitespace-nowrap outline-none"
            >
              View Full Collection
            </Link>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 lg:gap-6">
            {[1, 2, 3].map((item) => (
              <div
                key={`teaser-${item}`}
                className="aspect-3/4 bg-[#f0f0f0] overflow-hidden group cursor-pointer relative"
              >
                {stripImages[item + 5] ? (
                  <img
                    src={stripImages[item + 5] as string}
                    alt="Campaign"
                    loading="lazy"
                    className="w-full h-full object-cover transition-transform duration-1000 group-hover:scale-105 saturate-[0.85]"
                  />
                ) : (
                  <div className="w-full h-full bg-[#f5f5f7] transition-transform duration-1000 group-hover:scale-105" />
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* EDITORIAL FOOTER */}
      <footer className="py-16 border-t border-black/4 px-6 lg:px-12 text-center flex flex-col items-center shrink-0 bg-white">
        <img
          src="/logo.png"
          alt={env.VITE_APP_NAME}
          className="h-5 w-auto object-contain mb-8 opacity-40 grayscale"
        />
        <p className="text-[10px] font-medium text-neutral-400 tracking-[0.2em] uppercase">
          © {new Date().getFullYear()} {env.VITE_APP_NAME}. All rights reserved.
        </p>
      </footer>
    </div>
  );
}
