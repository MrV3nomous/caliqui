import { Ban, Check, Dices } from 'lucide-react';
import type React from 'react';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

const CHECKERBOARD =
  "url('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAwAAAAMCAIAAADZF8uwAAAAGUlEQVQYV2M4gwH+YwCGIasIUwhT25BVBADtzYNYnXFmQAAAAABJRU5ErkJggg==')";

const PRESET_SWATCHES = [
  '#000000',
  '#1C1C1E',
  '#333333',
  '#4D4D4D',
  '#666666',
  '#808080',
  '#B3B3B3',
  '#E5E5EA',
  '#FF3B30',
  '#FF9500',
  '#FFCC00',
  '#34C759',
  '#00C7BE',
  '#32ADE6',
  '#007AFF',
  '#5856D6',
  '#FFE4E1',
  '#FFDAB9',
  '#EEE8AA',
  '#98FB98',
  '#AFEEEE',
  '#ADD8E6',
  '#D8BFD8',
  '#FFB6C1',
  '#FA8072',
  '#FFA500',
  '#BDB76B',
  '#3CB371',
  '#40E0D0',
  '#87CEEB',
  '#BA55D3',
  '#DB7093',
  '#DC143C',
  '#D2691E',
  '#DAA520',
  '#2E8B57',
  '#20B2AA',
  '#4682B4',
  '#9932CC',
  '#C71585',
  '#8B0000',
  '#8B4513',
  '#808000',
  '#006400',
  '#008080',
  '#000080',
  '#4B0082',
  '#800080',
  '#F5F5DC',
  '#F5DEB3',
  '#D2B48C',
  '#BC8F8F',
  '#F08080',
  '#778899',
  '#708090',
  '#FFFFFF',
];

interface HSVA {
  h: number;
  s: number;
  v: number;
  a: number;
}

function parseColorToHsva(color: string): HSVA {
  let r = 0,
    g = 0,
    b = 0,
    a = 1;
  if (!color || color === 'transparent') return { h: 0, s: 0, v: 0, a: 0 };

  if (color.startsWith('#')) {
    let hex = color.slice(1);
    if (hex.length === 3)
      hex = hex
        .split('')
        .map((c) => c + c)
        .join('');
    if (hex.length === 8) {
      a = parseInt(hex.slice(6, 8), 16) / 255;
      hex = hex.slice(0, 6);
    }
    r = parseInt(hex.slice(0, 2), 16) / 255;
    g = parseInt(hex.slice(2, 4), 16) / 255;
    b = parseInt(hex.slice(4, 6), 16) / 255;
  } else if (color.startsWith('rgb')) {
    const match = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/);
    if (match) {
      r = parseInt(match[1], 10) / 255;
      g = parseInt(match[2], 10) / 255;
      b = parseInt(match[3], 10) / 255;
      a = match[4] !== undefined ? parseFloat(match[4]) : 1;
    }
  }

  const max = Math.max(r, g, b),
    min = Math.min(r, g, b),
    d = max - min;
  const v = max,
    s = max === 0 ? 0 : d / max;
  let h = 0;

  if (max !== min) {
    switch (max) {
      case r:
        h = (g - b) / d + (g < b ? 6 : 0);
        break;
      case g:
        h = (b - r) / d + 2;
        break;
      case b:
        h = (r - g) / d + 4;
        break;
    }
    h /= 6;
  }
  return { h: Math.round(h * 360), s: Math.round(s * 100), v: Math.round(v * 100), a };
}

function hsvaToHex(h: number, s: number, v: number, a: number): string {
  if (a === 0) return 'transparent';
  const sNorm = s / 100,
    vNorm = v / 100;
  const i = Math.floor((h / 360) * 6),
    f = (h / 360) * 6 - i;
  const p = vNorm * (1 - sNorm),
    q = vNorm * (1 - f * sNorm),
    t = vNorm * (1 - (1 - f) * sNorm);

  let r = 0,
    g = 0,
    b = 0;
  switch (i % 6) {
    case 0:
      r = vNorm;
      g = t;
      b = p;
      break;
    case 1:
      r = q;
      g = vNorm;
      b = p;
      break;
    case 2:
      r = p;
      g = vNorm;
      b = t;
      break;
    case 3:
      r = p;
      g = q;
      b = vNorm;
      break;
    case 4:
      r = t;
      g = p;
      b = vNorm;
      break;
    case 5:
      r = vNorm;
      g = p;
      b = q;
      break;
  }

  const toHex = (n: number) =>
    Math.round(n * 255)
      .toString(16)
      .padStart(2, '0');
  let hex = `#${toHex(r)}${toHex(g)}${toHex(b)}`;
  if (a < 1) hex += toHex(a);
  return hex.toUpperCase();
}

export function ColorPicker({
  color,
  onChange,
  onPointerDown,
  disableAlpha = false,
}: {
  color: string;
  onChange: (color: string) => void;
  onPointerDown?: () => void;
  disableAlpha?: boolean;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'presets' | 'custom'>('presets');
  const [hsva, setHsva] = useState<HSVA>(() => parseColorToHsva(color));
  const [localText, setLocalText] = useState(color);

  const initialColorRef = useRef(color);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  // Setting coords to null initially prevents the 0,0 fly-in animation
  const [coords, setCoords] = useState<{ top: number; left: number } | null>(null);

  useEffect(() => {
    if (!isOpen) {
      initialColorRef.current = color;
      setCoords(null);
    }
    setHsva(parseColorToHsva(color));
    setLocalText(color);
  }, [color, isOpen]);

  useEffect(() => {
    if (!isOpen) return;

    const updatePosition = () => {
      if (triggerRef.current) {
        const rect = triggerRef.current.getBoundingClientRect();
        const popoverWidth = 300;
        const popoverHeight = 420;
        const padding = 12;
        const isMobile = window.innerWidth < 640;

        if (isMobile) {
          setCoords({
            top: Math.max(padding, (window.innerHeight - popoverHeight) / 2),
            left: Math.max(padding, (window.innerWidth - popoverWidth) / 2),
          });
          return;
        }

        let newTop = rect.bottom + padding;
        let newLeft = rect.right - popoverWidth;

        if (newTop + popoverHeight > window.innerHeight - padding) {
          newTop = rect.top - popoverHeight - padding;
        }

        if (newLeft < padding) {
          newLeft = padding;
        }

        setCoords({ top: newTop, left: newLeft });
      }
    };

    updatePosition();
    window.addEventListener('resize', updatePosition);

    const handleOutsideInteraction = (e: MouseEvent | TouchEvent | Event) => {
      if (
        popoverRef.current &&
        !popoverRef.current.contains(e.target as Node) &&
        triggerRef.current &&
        !triggerRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleOutsideInteraction);
    document.addEventListener('touchstart', handleOutsideInteraction);
    document.addEventListener('wheel', handleOutsideInteraction, { passive: true });

    return () => {
      window.removeEventListener('resize', updatePosition);
      document.removeEventListener('mousedown', handleOutsideInteraction);
      document.removeEventListener('touchstart', handleOutsideInteraction);
      document.removeEventListener('wheel', handleOutsideInteraction);
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;

    let timeoutId: ReturnType<typeof setTimeout>;
    const resetTimer = () => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => setIsOpen(false), 5000);
    };

    resetTimer();
    const activityEvents = ['mousemove', 'keydown', 'pointerdown', 'touchstart'];

    activityEvents.forEach((evt) => {
      document.addEventListener(evt, resetTimer);
    });

    return () => {
      clearTimeout(timeoutId);
      activityEvents.forEach((evt) => {
        document.removeEventListener(evt, resetTimer);
      });
    };
  }, [isOpen]);

  const updateHsva = (updates: Partial<HSVA>) => {
    const newHsva = { ...hsva, ...updates };
    setHsva(newHsva);
    const newHex = hsvaToHex(newHsva.h, newHsva.s, newHsva.v, newHsva.a);
    setLocalText(newHex);
    onChange(newHex);
  };

  const handleSvPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    onPointerDown?.();
    const rect = e.currentTarget.getBoundingClientRect();

    const update = (evt: PointerEvent | React.PointerEvent) => {
      const x = Math.max(0, Math.min(1, (evt.clientX - rect.left) / rect.width));
      const y = Math.max(0, Math.min(1, (evt.clientY - rect.top) / rect.height));
      updateHsva({ s: Math.round(x * 100), v: Math.round((1 - y) * 100) });
    };
    update(e);

    const handlePointerMove = (evt: PointerEvent) => {
      evt.preventDefault();
      update(evt);
    };

    const handlePointerUp = () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };

    window.addEventListener('pointermove', handlePointerMove, { passive: false });
    window.addEventListener('pointerup', handlePointerUp);
  };

  const handleHuePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    onPointerDown?.();
    const rect = e.currentTarget.getBoundingClientRect();

    const update = (evt: PointerEvent | React.PointerEvent) => {
      const y = Math.max(0, Math.min(1, (evt.clientY - rect.top) / rect.height));
      updateHsva({ h: Math.round(y * 360) });
    };
    update(e);

    const handlePointerMove = (evt: PointerEvent) => {
      evt.preventDefault();
      update(evt);
    };

    const handlePointerUp = () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };

    window.addEventListener('pointermove', handlePointerMove, { passive: false });
    window.addEventListener('pointerup', handlePointerUp);
  };

  const handleRandomColor = () => {
    onPointerDown?.();
    updateHsva({
      h: Math.floor(Math.random() * 360),
      s: Math.floor(Math.random() * 60) + 40,
      v: Math.floor(Math.random() * 40) + 60,
      a: 1,
    });
  };

  const handleHexSubmit = (newHex: string) => {
    let finalColor = newHex.trim();
    if (!finalColor) {
      setLocalText(color);
      return;
    }
    if (finalColor.toLowerCase() === 'transparent') {
      if (disableAlpha) {
        setLocalText(color);
        return;
      }
      updateHsva({ a: 0 });
      return;
    }
    const ctx = document.createElement('canvas').getContext('2d');
    if (ctx && finalColor) {
      ctx.fillStyle = finalColor;
      finalColor = ctx.fillStyle.toUpperCase();
    } else {
      finalColor = color;
    }
    onPointerDown?.();
    setHsva(parseColorToHsva(finalColor));
    setLocalText(finalColor);
    onChange(finalColor);
  };

  const handleCancel = () => {
    setHsva(parseColorToHsva(initialColorRef.current));
    setLocalText(initialColorRef.current);
    onChange(initialColorRef.current);
    setIsOpen(false);
  };

  const currentHex = hsvaToHex(hsva.h, hsva.s, hsva.v, disableAlpha ? 1 : hsva.a);
  const opaqueHex = hsvaToHex(hsva.h, hsva.s, hsva.v, 1);

  return (
    <div className="flex gap-3 p-2 bg-[#fbfbfd] border border-black/[0.04] hover:border-black/10 transition-all rounded-[14px] items-center w-full min-w-0 relative">
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className="w-7 h-7 rounded-[8px] border border-black/10 shrink-0 shadow-inner relative overflow-hidden outline-none flex items-center justify-center transition-transform hover:scale-105 active:scale-95"
        style={{ backgroundImage: CHECKERBOARD }}
      >
        <div className="absolute inset-0" style={{ backgroundColor: currentHex }} />
      </button>

      <input
        type="text"
        value={localText}
        onChange={(e) => setLocalText(e.target.value)}
        onBlur={(e) => handleHexSubmit(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
        className="flex-1 font-mono uppercase text-[11px] tracking-widest font-medium bg-transparent border-0 text-black px-1 outline-none min-w-0"
      />

      {isOpen &&
        coords &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            ref={popoverRef}
            style={{ top: coords.top, left: coords.left }}
            className="fixed z-[1000] w-full max-w-[300px] bg-white/95 backdrop-blur-3xl saturate-150 rounded-[24px] p-4 shadow-[0_24px_48px_-12px_rgba(0,0,0,0.18),0_0_2px_rgba(0,0,0,0.08)] animate-in fade-in zoom-in-[0.98] duration-200 ease-out border border-black/5 flex flex-col"
          >
            {/* iOS-Style Segmented Control */}
            <div className="flex bg-black/[0.06] p-0.5 rounded-[10px] mb-4 relative shrink-0">
              <div
                className="absolute inset-y-0.5 w-[calc(50%-2px)] bg-white rounded-[7px] shadow-[0_1px_3px_rgba(0,0,0,0.1),0_1px_2px_rgba(0,0,0,0.06)] ring-1 ring-black/[0.04] transition-transform duration-300 ease-[cubic-bezier(0.2,0,0,1)]"
                style={{
                  transform:
                    activeTab === 'presets' ? 'translateX(2px)' : 'translateX(calc(100% + 2px))',
                }}
              />
              <button
                type="button"
                onClick={() => setActiveTab('presets')}
                className={`flex-1 relative z-10 text-[11px] font-semibold tracking-wide py-1.5 rounded-lg transition-colors outline-none ${activeTab === 'presets' ? 'text-black' : 'text-black/50 hover:text-black/70'}`}
              >
                Presets
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('custom')}
                className={`flex-1 relative z-10 text-[11px] font-semibold tracking-wide py-1.5 rounded-lg transition-colors outline-none ${activeTab === 'custom' ? 'text-black' : 'text-black/50 hover:text-black/70'}`}
              >
                Custom
              </button>
            </div>

            {/* TAB CONTENT: PRESETS */}
            {activeTab === 'presets' && (
              <div className="grid grid-cols-8 gap-1.5 animate-in fade-in slide-in-from-left-2 duration-200 flex-1 content-start mb-2">
                {PRESET_SWATCHES.map((swatch) => (
                  <button
                    key={swatch}
                    type="button"
                    onClick={() => {
                      onPointerDown?.();
                      setHsva(parseColorToHsva(swatch));
                      onChange(swatch);
                    }}
                    className={`w-full aspect-square rounded-[4px] flex items-center justify-center transition-all duration-200 outline-none ring-1 ring-black/5 shadow-sm
                      ${
                        currentHex === swatch
                          ? 'scale-[1.15] ring-2 ring-black/20 ring-offset-1 z-10'
                          : 'hover:scale-110 hover:shadow-md hover:z-10 hover:ring-black/15'
                      }`}
                    style={{ backgroundColor: swatch }}
                  >
                    {currentHex === swatch && (
                      <Check
                        size={12}
                        className={`${['#FFFFFF', '#F5F5DC', '#F5DEB3', '#FFF8DC', '#E5E5EA'].includes(swatch) ? 'text-black' : 'text-white'}`}
                        strokeWidth={3}
                      />
                    )}
                  </button>
                ))}
              </div>
            )}

            {/* TAB CONTENT: CUSTOM */}
            {activeTab === 'custom' && (
              <div className="flex flex-col gap-4 animate-in fade-in slide-in-from-right-2 duration-200 flex-1 mb-2">
                <div className="flex gap-3 h-[180px]">
                  {/* 2D Saturation / Value Picker */}
                  <div
                    className="relative flex-1 rounded-xl overflow-hidden cursor-crosshair shadow-[inset_0_0_0_1px_rgba(0,0,0,0.1)] touch-none select-none"
                    style={{ backgroundColor: `hsl(${hsva.h}, 100%, 50%)` }}
                    onPointerDown={handleSvPointerDown}
                  >
                    <div className="absolute inset-0 bg-gradient-to-r from-white to-transparent pointer-events-none" />
                    <div className="absolute inset-0 bg-gradient-to-t from-black to-transparent pointer-events-none" />
                    <div
                      className="absolute w-4 h-4 rounded-full border-[2px] border-white shadow-[0_2px_4px_rgba(0,0,0,0.4)] pointer-events-none transition-none bg-transparent"
                      style={{
                        left: `${hsva.s}%`,
                        top: `${100 - hsva.v}%`,
                        transform: 'translate(-50%, -50%)',
                      }}
                    />
                  </div>

                  {/* Vertical Hue Slider & Clear Transparent Button */}
                  <div className="w-4 flex flex-col gap-2 items-center">
                    {!disableAlpha && (
                      <button
                        type="button"
                        onClick={() => {
                          updateHsva({ a: 0 });
                          onPointerDown?.();
                        }}
                        className="w-5 h-5 shrink-0 flex items-center justify-center text-neutral-400 hover:text-red-500 hover:bg-red-50 rounded-full transition-colors outline-none"
                        title="Transparent"
                      >
                        <Ban size={14} strokeWidth={2.5} />
                      </button>
                    )}

                    <div
                      className="relative w-3 flex-1 rounded-full shadow-[inset_0_0_0_1px_rgba(0,0,0,0.1)] touch-none select-none cursor-pointer"
                      style={{
                        background:
                          'linear-gradient(to bottom, #f00 0%, #ff0 17%, #0f0 33%, #0ff 50%, #00f 67%, #f0f 83%, #f00 100%)',
                      }}
                      onPointerDown={handleHuePointerDown}
                    >
                      <div
                        className="absolute w-4 h-4 bg-white rounded-full shadow-[0_2px_4px_rgba(0,0,0,0.2),0_0_1px_rgba(0,0,0,0.3)] pointer-events-none left-1/2 -translate-x-1/2"
                        style={{ top: `calc(${(hsva.h / 360) * 100}% - 8px)` }}
                      />
                    </div>
                  </div>
                </div>

                <div className="space-y-3">
                  {/* Alpha Slider */}
                  {!disableAlpha && (
                    <div
                      className="relative w-full h-3 rounded-full shadow-[inset_0_0_0_1px_rgba(0,0,0,0.1)] overflow-hidden touch-none select-none"
                      style={{ backgroundImage: CHECKERBOARD }}
                    >
                      <div
                        className="absolute inset-0 pointer-events-none"
                        style={{
                          background: `linear-gradient(to right, transparent, ${opaqueHex})`,
                        }}
                      />
                      <input
                        type="range"
                        min="0"
                        max="100"
                        value={Math.round(hsva.a * 100)}
                        onPointerDown={() => onPointerDown?.()}
                        onChange={(e) => updateHsva({ a: Number(e.target.value) / 100 })}
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer touch-none"
                      />
                      <div
                        className="absolute w-4 h-4 bg-white rounded-full shadow-[0_2px_4px_rgba(0,0,0,0.2),0_0_1px_rgba(0,0,0,0.3)] pointer-events-none top-1/2 -translate-y-1/2"
                        style={{ left: `calc(${hsva.a * 100}% - 8px)` }}
                      />
                    </div>
                  )}

                  {/* Bottom Inputs Area */}
                  <div className="flex items-center gap-2">
                    <div className="flex-1 bg-black/[0.03] border border-black/[0.04] rounded-lg px-2.5 h-8 flex items-center shadow-inner">
                      <span className="text-[10px] font-semibold text-neutral-400 mr-2 uppercase tracking-wide">
                        HEX
                      </span>
                      <input
                        type="text"
                        value={localText}
                        onChange={(e) => setLocalText(e.target.value)}
                        onBlur={(e) => handleHexSubmit(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
                        className="flex-1 font-mono uppercase text-[11px] tracking-wider font-medium bg-transparent border-0 text-black/80 outline-none w-full"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={handleRandomColor}
                      className="h-8 px-3 flex items-center justify-center bg-white hover:bg-neutral-50 border border-black/10 text-black/80 rounded-lg transition-all outline-none shadow-sm active:scale-95 shrink-0"
                      title="Random Color"
                    >
                      <Dices size={14} strokeWidth={2} />
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Persistent Footer Actions */}
            <div className="flex justify-between items-center mt-3 pt-3 border-t border-black/[0.04] shrink-0">
              <button
                type="button"
                onClick={handleCancel}
                className="px-3 py-1.5 text-[11px] font-semibold text-neutral-500 hover:text-black hover:bg-black/5 rounded-lg transition-colors outline-none"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="px-5 py-1.5 text-[11px] font-semibold bg-blue-500 hover:bg-blue-600 text-white rounded-lg shadow-sm transition-colors outline-none active:scale-95"
              >
                Choose
              </button>
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}
