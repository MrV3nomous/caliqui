import { useEffect, useState } from 'react';
import { env } from '@/shared/env';

interface PremiumLoaderProps {
  message?: string; // Kept for TS compatibility with other files, but visually ignored
  fullScreen?: boolean;
}

export function PremiumLoader({ fullScreen = true }: PremiumLoaderProps) {
  const [show, setShow] = useState(false);

  // UX FIX: Prevent the "blink of an eye" flash.
  // If the data loads in under 150ms, the loader never renders.
  useEffect(() => {
    const timer = setTimeout(() => setShow(true), 150);
    return () => clearTimeout(timer);
  }, []);

  if (!show) return null;

  // Added a subtle radial gradient to the fullScreen background for depth
  const containerClass = fullScreen
    ? 'fixed inset-0 z-[1000] bg-[#fbfbfd] bg-[radial-gradient(circle_at_center,_#ffffff_0%,_#fbfbfd_100%)]'
    : 'absolute inset-0 z-50 bg-white/50 backdrop-blur-xl rounded-[inherit]';

  return (
    <div
      className={`${containerClass} flex items-center justify-center animate-in fade-in duration-700 select-none`}
    >
      {/* CINEMATIC LUXURY LOGO */}
      <img
        src="/logo.png"
        alt={env.VITE_APP_NAME}
        // Increased base sizes for a much bolder, premium presence
        className={`${fullScreen ? 'h-16 sm:h-20 md:h-24' : 'h-10'} w-auto object-contain premium-logo-reveal`}
      />

      <style>{`
        .premium-logo-reveal {
          /* Two-stage animation: A cinematic reveal, followed by a continuous majestic pulse */
          animation: 
            reveal 1.2s cubic-bezier(0.16, 1, 0.3, 1) forwards,
            breathe 4s cubic-bezier(0.4, 0, 0.2, 1) 1.2s infinite;
          opacity: 0;
        }

        @keyframes reveal {
          0% { 
            opacity: 0; 
            transform: scale(0.85) translateY(10px); 
            filter: blur(10px) drop-shadow(0 0 0 rgba(0,0,0,0)); 
          }
          100% { 
            opacity: 1; 
            transform: scale(1) translateY(0); 
            filter: blur(0px) drop-shadow(0 10px 30px rgba(0,0,0,0.08)); 
          }
        }

        @keyframes breathe {
          0%, 100% { 
            transform: scale(1); 
            filter: drop-shadow(0 10px 30px rgba(0,0,0,0.08)); 
          }
          50% { 
            transform: scale(1.04); 
            filter: drop-shadow(0 20px 40px rgba(0,0,0,0.15)); 
          }
        }
      `}</style>
    </div>
  );
}
