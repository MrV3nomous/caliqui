import { ArrowRight, Box, Sparkles } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { env } from '@/shared/env';

// Dynamically import all images from the strips folder at build time
const rawImages = import.meta.glob('@/assets/strips/*.{jpg,jpeg,png,webp}', { eager: true });
const stripImages = Object.values(rawImages).map(
  (module) => (module as { default: string }).default,
);

// Distribute the images across 6 columns evenly outside the component to keep references stable
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

// Double the array for seamless infinite looping, assigning unique IDs to duplicates
const animatedColumns = columnsData.map((col) => ({
  ...col,
  duplicatedImages: [...col.images, ...col.images.map((img) => ({ ...img, id: `${img.id}-dup` }))],
}));

export function Home() {
  const [scrolled, setScrolled] = useState(false);
  const [fomoIndex, setFomoIndex] = useState(0);

  const fomoMessages = [
    'LIMITED EDITION DROPS AVAILABLE NOW',
    'FREE GLOBAL SHIPPING ON ALL ORDERS',
    'BESPOKE 3D ATELIER NOW OPEN',
  ];

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
    <div className="w-full min-h-[100dvh] flex flex-col bg-[#fbfbfd] text-black font-sans selection:bg-neutral-300">
      {/* INJECTED CSS FOR SEAMLESS INFINITE SCROLL */}
      <style>{`
        @keyframes scroll-up {
          0% { transform: translateY(0); }
          100% { transform: translateY(-50%); }
        }
        @keyframes scroll-down {
          0% { transform: translateY(-50%); }
          100% { transform: translateY(0); }
        }
        .animate-scroll-up { animation: scroll-up 45s linear infinite; }
        .animate-scroll-down { animation: scroll-down 45s linear infinite; }
      `}</style>

      {/* ROTATING FOMO MARQUEE */}
      <div className="w-full bg-black text-white text-[10px] md:text-xs font-bold tracking-[0.2em] uppercase text-center py-2 relative z-[60]">
        <div className="max-w-[1400px] mx-auto px-4 overflow-hidden relative">
          <span
            key={fomoIndex}
            className="block animate-in fade-in slide-in-from-bottom-2 duration-500"
          >
            {fomoMessages[fomoIndex]}
          </span>
        </div>
      </div>

      {/* SCROLL-ADAPTIVE HEADER */}
      <header
        className={`fixed w-full z-50 transition-all duration-500 ${
          scrolled
            ? 'top-0 bg-white/90 backdrop-blur-2xl border-b border-black/5 py-4'
            : 'top-8 bg-transparent py-6'
        }`}
      >
        <div className="max-w-[1400px] mx-auto px-6 lg:px-12 flex items-center justify-between">
          <Link to="/" className="hover:opacity-70 transition-opacity outline-none">
            {/* INVERT LOGO ON DARK BACKGROUND WHEN AT TOP */}
            <img
              src="/logo.png"
              alt={env.VITE_APP_NAME}
              className={`h-7 md:h-9 w-auto object-contain transition-all duration-500 ${scrolled ? 'drop-shadow-sm' : 'brightness-0 invert'}`}
            />
          </Link>

          <div className="flex items-center gap-6 sm:gap-8">
            <Link
              to="/marketplace"
              className={`text-[10px] sm:text-xs font-extrabold uppercase tracking-widest transition-colors outline-none ${
                scrolled ? 'text-neutral-500 hover:text-black' : 'text-white/70 hover:text-white'
              }`}
            >
              Collection
            </Link>
            <Link
              to="/editor"
              className={`text-[10px] sm:text-xs font-extrabold uppercase tracking-widest transition-colors outline-none ${
                scrolled ? 'text-neutral-500 hover:text-black' : 'text-white/70 hover:text-white'
              }`}
            >
              Studio
            </Link>
          </div>
        </div>
      </header>

      {/* HERO SECTION - THE SCROLLING STRIPS GRID */}
      <section className="relative w-full h-[100dvh] bg-[#0a0a0a] flex items-center justify-center overflow-hidden">
        {/* Animated Background Grid */}
        <div className="absolute inset-0 w-[110%] -left-[5%] grid grid-cols-3 md:grid-cols-6 gap-3 md:gap-5 opacity-40 rotate-[-2deg] scale-110 pointer-events-none">
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
                    className="w-full aspect-[3/4] bg-neutral-900 rounded-xl md:rounded-3xl overflow-hidden shrink-0 shadow-2xl border border-white/5 mb-3 md:mb-5"
                  >
                    {imgObj.src ? (
                      <img
                        src={imgObj.src}
                        alt="Fashion Campaign"
                        loading="lazy"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full bg-neutral-800" />
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Heavy Vignette & Dark Overlay for text legibility */}
        <div className="absolute inset-0 bg-gradient-to-b from-black/90 via-black/40 to-black/90 pointer-events-none" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_transparent_0%,_#0a0a0a_100%)] opacity-80 pointer-events-none" />

        <div className="relative z-10 max-w-[1200px] w-full px-6 lg:px-12 flex flex-col items-center text-center animate-in fade-in slide-in-from-bottom-8 duration-1000 mt-12">
          <span className="text-white/50 text-[10px] md:text-xs font-extrabold uppercase tracking-[0.3em] mb-6 drop-shadow-md">
            Welcome to {env.VITE_APP_NAME}
          </span>

          <h1 className="text-5xl md:text-7xl lg:text-8xl font-extrabold tracking-tighter text-white leading-[1.1] mb-8 drop-shadow-2xl">
            Define Your <br className="hidden md:block" />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-neutral-200 to-white">
              Aesthetic.
            </span>
          </h1>

          <p className="max-w-xl text-neutral-300 text-sm md:text-base font-medium mb-12 leading-relaxed drop-shadow-md">
            Premium ready-to-wear pieces designed for the modern minimalist, or bespoke luxury
            apparel engineered entirely by you.
          </p>

          <div className="flex flex-col sm:flex-row items-center gap-4 sm:gap-6 w-full sm:w-auto">
            <Link
              to="/editor"
              className="w-full sm:w-auto group relative flex items-center justify-center gap-3 px-8 h-14 bg-white text-black rounded-full font-extrabold text-sm transition-all hover:scale-105 active:scale-95 overflow-hidden shadow-[0_0_40px_rgba(255,255,255,0.15)] outline-none"
            >
              <div className="absolute inset-0 bg-neutral-200 translate-y-full group-hover:translate-y-0 transition-transform duration-300 ease-out" />
              <Sparkles size={16} className="relative z-10" />
              <span className="relative z-10">Enter The Studio</span>
            </Link>

            <Link
              to="/marketplace"
              className="w-full sm:w-auto group flex items-center justify-center gap-3 px-8 h-14 bg-black/50 backdrop-blur-xl border border-white/20 text-white rounded-full font-extrabold text-sm transition-all hover:bg-white/10 active:scale-95 outline-none"
            >
              <Box size={16} />
              <span>Explore Collection</span>
            </Link>
          </div>
        </div>
      </section>

      {/* THE STUDIO HIGHLIGHT (WHITE THEME) */}
      <section className="flex-1 py-24 lg:py-40 px-6 lg:px-12 max-w-[1400px] w-full mx-auto grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
        <div className="order-2 lg:order-1 aspect-square bg-neutral-100 rounded-[3rem] overflow-hidden relative shadow-inner border border-black/5 flex items-center justify-center">
          <div className="absolute inset-0 bg-gradient-to-br from-neutral-50 to-neutral-200" />
          <div className="relative z-10 w-3/4 h-3/4 bg-white shadow-2xl rounded-2xl border border-black/5 flex items-center justify-center -rotate-6 transition-transform duration-700 hover:rotate-0">
            <div className="text-center space-y-4">
              <img src="/logo.png" alt="Logo" className="w-16 h-16 mx-auto opacity-20" />
              <p className="text-xs font-extrabold tracking-widest text-neutral-400 uppercase">
                3D Atelier
              </p>
            </div>
          </div>
        </div>

        <div className="order-1 lg:order-2 space-y-8">
          <span className="text-black text-[10px] md:text-xs font-extrabold uppercase tracking-[0.3em]">
            Bespoke Engineering
          </span>
          <h2 className="text-4xl md:text-5xl lg:text-6xl font-extrabold tracking-tighter text-black leading-tight">
            The Atelier, <br /> Digitized.
          </h2>
          <p className="text-neutral-500 font-medium text-lg leading-relaxed max-w-md">
            Experience our groundbreaking 3D design studio. Import your artwork, manipulate
            typography, and direct the exact placement of your vision onto our premium luxury
            blanks.
          </p>
          <Link
            to="/editor"
            className="inline-flex items-center gap-3 font-extrabold text-sm hover:opacity-70 transition-opacity border-b-2 border-black pb-1 outline-none"
          >
            Start Creating <ArrowRight size={16} />
          </Link>
        </div>
      </section>

      {/* THE COLLECTION HIGHLIGHT (LIGHT GRAY THEME) */}
      <section className="py-24 lg:py-40 bg-[#f5f5f7] px-6 lg:px-12">
        <div className="max-w-[1400px] mx-auto">
          <div className="flex flex-col md:flex-row justify-between items-end gap-8 mb-16">
            <div className="space-y-4 max-w-xl">
              <span className="text-black text-[10px] md:text-xs font-extrabold uppercase tracking-[0.3em]">
                Ready-to-Wear
              </span>
              <h2 className="text-4xl md:text-5xl lg:text-6xl font-extrabold tracking-tighter text-black leading-tight">
                Curated Precision.
              </h2>
            </div>
            <Link
              to="/marketplace"
              className="inline-flex items-center gap-3 px-6 h-12 bg-black text-white rounded-full font-extrabold text-sm transition-all hover:bg-neutral-800 active:scale-95 whitespace-nowrap outline-none"
            >
              View Full Collection
            </Link>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[1, 2, 3].map((item) => (
              <div
                key={`teaser-${item}`}
                className="aspect-[3/4] bg-neutral-200 rounded-[2rem] overflow-hidden group cursor-pointer border border-black/5 relative"
              >
                {stripImages[item + 5] ? (
                  <img
                    src={stripImages[item + 5] as string}
                    alt="Campaign"
                    loading="lazy"
                    className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                  />
                ) : (
                  <div className="w-full h-full bg-neutral-300 transition-transform duration-700 group-hover:scale-105" />
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      <footer className="py-12 border-t border-black/5 px-6 lg:px-12 text-center flex flex-col items-center shrink-0">
        <img
          src="/logo.png"
          alt={env.VITE_APP_NAME}
          className="h-6 w-auto object-contain mb-6 opacity-30 grayscale"
        />
        <p className="text-xs font-bold text-neutral-400 tracking-widest uppercase">
          © {new Date().getFullYear()} {env.VITE_APP_NAME}. All rights reserved.
        </p>
      </footer>
    </div>
  );
}
