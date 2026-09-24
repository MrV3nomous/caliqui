import { ShoppingBag } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router';

// Unique Assets Defined for Every Section
import heroVideo from '@/assets/home/hero-lifestyle.mp4';
import heroPoster from '@/assets/home/hero-poster.jpg';
import indivBg1 from '@/assets/home/indiv-bg-1.jpg';
import indivBg2 from '@/assets/home/indiv-bg-2.jpg';
import indivBg3 from '@/assets/home/indiv-bg-3.jpg';
import m1Detail from '@/assets/home/market-1-detail.jpg';
import m1Life from '@/assets/home/market-1-life.jpg';
import m2Detail from '@/assets/home/market-2-detail.jpg';
import m2Life from '@/assets/home/market-2-life.jpg';
import m3Detail from '@/assets/home/market-3-detail.jpg';
import m3Life from '@/assets/home/market-3-life.jpg';
import studioFinal from '@/assets/home/studio-final.jpg';
import studioIdea from '@/assets/home/studio-idea.jpg';
import studioInterface from '@/assets/home/studio-interface.jpg';
import studioProduction from '@/assets/home/studio-production.jpg';

import { env } from '@/shared/env';
import { AuthModal } from '@/ui/components/AuthModal';
import { useAuthStore } from '@/ui/store/auth-store';
import { useCheckoutStore } from '@/ui/store/checkout-store';

const products = [
  {
    id: 1,
    title: 'The Oversized Boxy Tee',
    lifestyleImg: m1Life,
    detailImg: m1Detail,
  },
  {
    id: 2,
    title: 'The Vintage Washed Tee',
    lifestyleImg: m2Life,
    detailImg: m2Detail,
  },
  {
    id: 3,
    title: 'The Minimalist Black Tee',
    lifestyleImg: m3Life,
    detailImg: m3Detail,
  },
];

export function Home() {
  const { isAuthenticated, openAuthModal } = useAuthStore();
  const { cart } = useCheckoutStore();
  const [scrolled, setScrolled] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const totalCartItems = cart.reduce(
    (acc, item) => acc + Object.values(item.sizes).reduce((a, b) => a + b, 0),
    0,
  );

  useEffect(() => {
    const container = scrollRef.current;
    if (!container) return;

    const handleScroll = () => {
      setScrolled(container.scrollTop > 60);
    };

    container.addEventListener('scroll', handleScroll, { passive: true });
    return () => container.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <div
      ref={scrollRef}
      id="home-scroll-container"
      className="relative w-full h-dvh overflow-y-auto overflow-x-hidden bg-[#FAFAFA] text-stone-900 font-sans selection:bg-stone-200 custom-scrollbar smooth-scroll"
    >
      <AuthModal />

      {/* LUXURY NAVIGATION */}
      <div className="fixed top-0 left-0 right-0 z-50 flex flex-col w-full pointer-events-none transition-all duration-500">
        <header
          className={`w-full py-6 md:py-8 pointer-events-auto transition-all duration-500 ${scrolled ? 'py-4 md:py-5' : ''}`}
        >
          <div className="max-w-[1600px] mx-auto px-6 lg:px-12 flex items-center justify-between">
            <Link to="/" className="hover:opacity-60 transition-opacity duration-300 outline-none">
              <img
                src="/logo.png"
                alt={env.VITE_APP_NAME}
                className={`h-4 md:h-5 w-auto object-contain transition-all duration-500 ${scrolled ? 'brightness-0' : 'brightness-0 invert'}`}
              />
            </Link>

            <div className="flex items-center gap-6 md:gap-10">
              <Link
                to="/marketplace"
                className={`text-[10px] font-medium uppercase tracking-[0.15em] outline-none hidden sm:block text-white/90 hover:text-white ${scrolled ? 'opacity-0 pointer-events-none absolute' : 'opacity-100 relative'}`}
              >
                Collection
              </Link>
              <Link
                to="/editor"
                className={`text-[10px] font-medium uppercase tracking-[0.15em] outline-none hidden sm:block text-white/90 hover:text-white ${scrolled ? 'opacity-0 pointer-events-none absolute' : 'opacity-100 relative'}`}
              >
                Studio
              </Link>

              <div
                className={`w-px h-3 mx-2 hidden sm:block bg-white/40 ${scrolled ? 'opacity-0 absolute' : 'opacity-100 relative'}`}
              />

              {isAuthenticated ? (
                <Link
                  to="/dashboard"
                  className={`text-[10px] font-medium uppercase tracking-[0.15em] outline-none text-white/90 hover:text-white ${scrolled ? 'opacity-0 pointer-events-none absolute' : 'opacity-100 relative'}`}
                >
                  Account
                </Link>
              ) : (
                <button
                  type="button"
                  onClick={openAuthModal}
                  className={`text-[10px] font-medium uppercase tracking-[0.15em] outline-none text-white/90 hover:text-white ${scrolled ? 'opacity-0 pointer-events-none absolute' : 'opacity-100 relative'}`}
                >
                  Sign In
                </button>
              )}

              <Link
                to="/checkout"
                aria-label="Shopping Bag"
                className={`relative flex items-center justify-center p-1 transition-all duration-300 outline-none hover:scale-105 ${
                  scrolled ? 'text-stone-900 hover:opacity-60' : 'text-white'
                }`}
              >
                <ShoppingBag size={18} strokeWidth={1.2} />
                {totalCartItems > 0 && (
                  <span
                    className={`absolute -top-1.5 -right-2 text-[9px] font-bold min-w-4.5 h-4.5 px-1 rounded-full flex items-center justify-center border-2 transition-colors duration-500 ${scrolled ? 'bg-stone-900 text-white border-[#FAFAFA]' : 'bg-white text-stone-950 border-transparent'}`}
                  >
                    {totalCartItems}
                  </span>
                )}
              </Link>
            </div>
          </div>
        </header>
      </div>

      {/* 1. HERO */}
      <section className="relative w-full h-dvh bg-stone-950 flex flex-col items-center justify-center overflow-hidden">
        <div className="absolute inset-0 w-full h-full">
          <video
            autoPlay
            loop
            muted
            playsInline
            poster={heroPoster}
            className="absolute inset-0 w-full h-full object-cover animate-in fade-in duration-[2s]"
          >
            <source src={heroVideo} type="video/mp4" />
          </video>
        </div>

        <div className="absolute inset-0 bg-stone-950/25 pointer-events-none" />

        <div className="relative z-10 max-w-5xl w-full px-6 flex flex-col items-center text-center">
          <h1 className="text-4xl md:text-6xl lg:text-7xl font-light tracking-tight text-white leading-[1.1] mb-12">
            <span className="block animate-in fade-in slide-in-from-bottom-4 duration-1000 ease-out fill-mode-both delay-300">
              Imagine it.
            </span>
            <span className="block animate-in fade-in slide-in-from-bottom-4 duration-1000 ease-out fill-mode-both delay-500 text-white mt-2">
              Wear it.
            </span>
          </h1>

          <div className="flex flex-col sm:flex-row items-center gap-8 md:gap-12 w-full sm:w-auto animate-in fade-in duration-1000 delay-700 fill-mode-both">
            <Link
              to="/marketplace"
              className="group flex items-center gap-3 text-[10px] font-medium uppercase tracking-[0.15em] text-white outline-none"
            >
              <span className="border-b border-transparent group-hover:border-white transition-colors duration-300 pb-1">
                Shop Collection
              </span>
            </Link>

            <Link
              to="/editor"
              className="group flex items-center gap-3 text-[10px] font-medium uppercase tracking-[0.15em] text-white outline-none"
            >
              <span className="border-b border-transparent group-hover:border-white transition-colors duration-300 pb-1">
                Create Your Own
              </span>
            </Link>
          </div>
        </div>
      </section>

      {/* 2. MADE BY CALIQUI */}
      <section className="py-20 md:py-32 bg-[#FAFAFA] px-6 lg:px-12">
        <div className="max-w-[1600px] mx-auto flex flex-col items-center">
          <h2 className="text-3xl md:text-5xl font-light tracking-tight text-stone-900 leading-[1.2] text-center mb-12 md:mb-16">
            Beautiful things, <br className="md:hidden" />
            <span className="text-stone-500">already imagined.</span>
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 lg:gap-12 w-full">
            {products.map((item) => (
              <Link
                to={`/marketplace`}
                key={item.id}
                className="group relative outline-none flex flex-col items-center pb-2"
              >
                <div className="w-full aspect-3/4 bg-stone-100 overflow-hidden relative mb-4">
                  <img
                    src={item.lifestyleImg}
                    alt={item.title}
                    loading="lazy"
                    className="absolute inset-0 w-full h-full object-cover transition-opacity duration-700 ease-in-out group-hover:opacity-0"
                  />
                  <img
                    src={item.detailImg}
                    alt={`${item.title} detail`}
                    loading="lazy"
                    className="absolute inset-0 w-full h-full object-cover opacity-0 scale-105 transition-all duration-1000 ease-out group-hover:opacity-100 group-hover:scale-100"
                  />
                </div>

                <h3 className="opacity-100 sm:opacity-0 group-hover:opacity-100 transition-all duration-300 transform translate-y-0 sm:translate-y-1 group-hover:translate-y-0 text-[10px] font-medium uppercase tracking-[0.15em] text-stone-500">
                  {item.title}
                </h3>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* 3. MADE BY YOU */}
      <section className="py-20 md:py-24 px-6 lg:px-12 bg-[#FAFAFA] flex flex-col items-center">
        <h2 className="text-3xl md:text-5xl font-light tracking-tight text-stone-900 leading-[1.2] text-center mb-16 md:mb-20 max-w-3xl">
          What if you could wear <br className="hidden md:block" />
          <span className="text-stone-500">the idea in your head?</span>
        </h2>

        <div className="max-w-[1600px] w-full mx-auto">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6 lg:gap-8 mb-16">
            <div className="flex flex-col group">
              <div className="aspect-4/5 bg-stone-50 overflow-hidden relative">
                <img
                  src={studioIdea}
                  className="absolute inset-0 w-full h-full object-cover grayscale opacity-80 transition-all duration-700 group-hover:grayscale-0 group-hover:opacity-100"
                  alt="Design Concept Sketch"
                  loading="lazy"
                />
              </div>
            </div>

            <div className="flex flex-col group md:mt-8">
              <div className="aspect-4/5 bg-stone-50 overflow-hidden relative">
                <img
                  src={studioInterface}
                  className="absolute inset-0 w-full h-full object-cover opacity-90 transition-all duration-700 group-hover:opacity-100"
                  alt="3D Studio Interface"
                  loading="lazy"
                />
              </div>
            </div>

            <div className="flex flex-col group md:mt-16">
              <div className="aspect-4/5 bg-stone-50 overflow-hidden relative">
                <img
                  src={studioProduction}
                  className="absolute inset-0 w-full h-full object-cover opacity-90 transition-all duration-700 group-hover:opacity-100"
                  alt="Physical Garment Production"
                  loading="lazy"
                />
              </div>
            </div>

            <div className="flex flex-col group md:mt-24">
              <div className="aspect-4/5 bg-stone-50 overflow-hidden relative">
                <img
                  src={studioFinal}
                  className="absolute inset-0 w-full h-full object-cover opacity-90 transition-all duration-700 group-hover:opacity-100"
                  alt="Person wearing the design"
                  loading="lazy"
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 4. INDIVIDUALITY STATEMENT */}
      <section className="relative w-full min-h-[80vh] py-28 md:py-40 overflow-hidden bg-[#FAFAFA] flex flex-col items-center justify-center">
        <style>{`
    @media (prefers-reduced-motion: no-preference) {
      @keyframes slowfade {
        0%, 25% { opacity: 1; transform: scale(1); }
        33%, 92% { opacity: 0; transform: scale(1.02); }
        100% { opacity: 1; transform: scale(1); }
      }

      .bg-slow-1 {
        animation: slowfade 36s infinite ease-in-out;
      }

      .bg-slow-2 {
        animation: slowfade 36s infinite ease-in-out;
        animation-delay: 12s;
        opacity: 0;
      }

      .bg-slow-3 {
        animation: slowfade 36s infinite ease-in-out;
        animation-delay: 24s;
        opacity: 0;
      }
    }

    @media (prefers-reduced-motion: reduce) {
      .bg-slow-2,
      .bg-slow-3 {
        display: none;
      }
    }
  `}</style>

        <div className="absolute inset-0 w-full h-full pointer-events-none">
          <img
            src={indivBg1}
            className="absolute inset-0 w-full h-full object-cover bg-slow-1 opacity-[0.06]"
            alt=""
          />

          <img
            src={indivBg2}
            className="absolute inset-0 w-full h-full object-cover bg-slow-2 opacity-[0.06]"
            alt=""
          />

          <img
            src={indivBg3}
            className="absolute inset-0 w-full h-full object-cover bg-slow-3 opacity-[0.06]"
            alt=""
          />

          <div className="absolute inset-0 bg-[#FAFAFA]/65" />
        </div>

        <div className="relative z-10 text-center px-6">
          <h2 className="text-3xl md:text-5xl lg:text-6xl font-light text-stone-950 tracking-tight leading-[1.2] max-w-4xl mx-auto uppercase">
            There is no Caliqui look.
          </h2>

          <p className="text-2xl md:text-4xl lg:text-5xl font-serif italic text-stone-700 mt-4">
            There is yours.
          </p>
        </div>
      </section>

      {/* 5. FOOTER */}
      <footer className="py-12 md:py-16 px-6 lg:px-12 bg-[#FAFAFA] flex flex-col items-center justify-center text-center space-y-8">
        <div className="flex flex-col items-center gap-3 pt-4">
          <img
            src="/logo.png"
            alt={env.VITE_APP_NAME}
            className="h-4 md:h-5 w-auto object-contain brightness-0 transition-opacity hover:opacity-70"
          />
          <p className="text-[9px] font-medium text-stone-400 tracking-[0.2em] uppercase mt-2">
            © {new Date().getFullYear()} {env.VITE_APP_NAME} STUDIOS.
          </p>
        </div>
      </footer>
    </div>
  );
}
