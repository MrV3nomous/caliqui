import { Check, X } from 'lucide-react';
import type React from 'react';
import { useEffect, useRef, useState } from 'react';
import { applyImageFilters, useEditorStore } from '@/ui/store/editor-store';

export function ImageCropModal() {
  const { croppingDecalId, decals, updateDecal, setCroppingDecalId, saveHistory } =
    useEditorStore();
  const decal = decals.find((d) => d.id === croppingDecalId);

  const containerRef = useRef<HTMLDivElement>(null);

  const [crop, setCrop] = useState({
    x: decal?.cropX ?? 0,
    y: decal?.cropY ?? 0,
    w: decal?.cropW ?? 100,
    h: decal?.cropH ?? 100,
  });

  const [isDragging, setIsDragging] = useState<{
    handle: string | null;
    startX: number;
    startY: number;
  } | null>(null);

  useEffect(() => {
    if (decal) {
      setCrop({
        x: decal.cropX ?? 0,
        y: decal.cropY ?? 0,
        w: decal.cropW ?? 100,
        h: decal.cropH ?? 100,
      });
    }
  }, [decal]);

  if (!croppingDecalId || !decal?.originalSrc) return null;

  const handlePointerDown = (e: React.PointerEvent, handle: string) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging({ handle, startX: e.clientX, startY: e.clientY });
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDragging || !containerRef.current) return;

    const bounds = containerRef.current.getBoundingClientRect();
    const dx = ((e.clientX - isDragging.startX) / bounds.width) * 100;
    const dy = ((e.clientY - isDragging.startY) / bounds.height) * 100;

    setCrop((prev) => {
      let { x, y, w, h } = prev;

      if (isDragging.handle?.includes('e')) {
        w = Math.min(Math.max(5, w + dx), 100 - x);
      }
      if (isDragging.handle?.includes('w')) {
        const newX = Math.min(Math.max(0, x + dx), x + w - 5);
        w -= newX - x;
        x = newX;
      }
      if (isDragging.handle?.includes('s')) {
        h = Math.min(Math.max(5, h + dy), 100 - y);
      }
      if (isDragging.handle?.includes('n')) {
        const newY = Math.min(Math.max(0, y + dy), y + h - 5);
        h -= newY - y;
        y = newY;
      }
      if (isDragging.handle === 'center') {
        x = Math.min(Math.max(0, x + dx), 100 - w);
        y = Math.min(Math.max(0, y + dy), 100 - h);
      }

      return { x, y, w, h };
    });

    setIsDragging({ ...isDragging, startX: e.clientX, startY: e.clientY });
  };

  const handlePointerUp = () => {
    setIsDragging(null);
  };

  const applyCrop = async () => {
    saveHistory();
    const updates = { cropX: crop.x, cropY: crop.y, cropW: crop.w, cropH: crop.h };
    updateDecal(decal.id, updates);

    const { src, aspectRatio } = await applyImageFilters({ ...decal, ...updates });
    updateDecal(decal.id, { src, aspectRatio });

    setCroppingDecalId(null);
  };

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-end pr-6 md:pr-10 touch-none select-none"
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerLeave={handlePointerUp}
    >
      {/* Subtle blurred overlay that allows the 3D model to peek through */}
      <button
        type="button"
        aria-label="Close Crop Modal"
        className="absolute inset-0 w-full h-full cursor-default bg-black/5 backdrop-blur-[2px] transition-all border-none outline-none"
        onClick={() => setCroppingDecalId(null)}
      />

      {/* Premium Floating Card */}
      {/* biome-ignore lint/a11y/useKeyWithClickEvents: Container block */}
      {/* biome-ignore lint/a11y/noStaticElementInteractions: Container block */}
      <div
        className="relative pointer-events-auto w-full max-w-[360px] bg-white/80 backdrop-blur-2xl border border-white/60 shadow-[0_20px_60px_-15px_rgba(0,0,0,0.15)] rounded-[2rem] p-6 flex flex-col gap-5 transform transition-all"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between">
          <h3 className="uppercase tracking-[0.25em] text-[10px] font-bold text-neutral-400">
            Adjust Asset
          </h3>
          <button
            type="button"
            onClick={() => setCroppingDecalId(null)}
            className="p-2.5 bg-neutral-50/50 hover:bg-neutral-100 rounded-full transition-colors text-neutral-400 hover:text-black outline-none"
            title="Cancel"
          >
            <X size={14} strokeWidth={2} />
          </button>
        </div>

        {/* Image Stage */}
        <div className="relative w-full aspect-square bg-[#F8F8F8] rounded-2xl overflow-hidden border border-black/[0.04] shadow-inner flex items-center justify-center p-6">
          <div
            className="relative w-fit h-fit max-w-full max-h-full flex items-center justify-center"
            ref={containerRef}
          >
            {/* Base Image (Dimmed) */}
            <img
              src={decal.originalSrc}
              alt="To Crop"
              className="max-w-full max-h-full object-contain opacity-30 pointer-events-none"
              draggable={false}
            />

            {/* Premium Cropped Selection Area */}
            <div
              className="absolute ring-1 ring-white shadow-[0_0_0_9999px_rgba(0,0,0,0.3),0_4px_24px_rgba(0,0,0,0.15)] overflow-hidden cursor-move transition-shadow"
              style={{
                left: `${crop.x}%`,
                top: `${crop.y}%`,
                width: `${crop.w}%`,
                height: `${crop.h}%`,
              }}
              onPointerDown={(e) => handlePointerDown(e, 'center')}
            >
              {/* Visible Image Layer */}
              <img
                src={decal.originalSrc}
                alt="Cropped Area"
                className="absolute max-w-none max-h-none pointer-events-none"
                style={{
                  width: `${(100 / crop.w) * 100}%`,
                  height: `${(100 / crop.h) * 100}%`,
                  left: `${-(crop.x / crop.w) * 100}%`,
                  top: `${-(crop.y / crop.h) * 100}%`,
                }}
              />
            </div>

            {/* Invisible Edge Grab Areas (Wider for easier clicking) */}
            <div
              className="absolute cursor-n-resize h-4 -mt-2 -ml-2 z-10"
              style={{ left: `${crop.x}%`, top: `${crop.y}%`, width: `${crop.w}%` }}
              onPointerDown={(e) => handlePointerDown(e, 'n')}
            />
            <div
              className="absolute cursor-s-resize h-4 -mt-2 -ml-2 z-10"
              style={{ left: `${crop.x}%`, top: `${crop.y + crop.h}%`, width: `${crop.w}%` }}
              onPointerDown={(e) => handlePointerDown(e, 's')}
            />
            <div
              className="absolute cursor-e-resize w-4 -mt-2 -ml-2 z-10"
              style={{ left: `${crop.x + crop.w}%`, top: `${crop.y}%`, height: `${crop.h}%` }}
              onPointerDown={(e) => handlePointerDown(e, 'e')}
            />
            <div
              className="absolute cursor-w-resize w-4 -mt-2 -ml-2 z-10"
              style={{ left: `${crop.x}%`, top: `${crop.y}%`, height: `${crop.h}%` }}
              onPointerDown={(e) => handlePointerDown(e, 'w')}
            />

            {/* Clean White Corner Dots */}
            <div
              className="absolute w-3 h-3 bg-white ring-1 ring-black/5 shadow-sm rounded-full cursor-nw-resize -mt-1.5 -ml-1.5 z-20"
              style={{ left: `${crop.x}%`, top: `${crop.y}%` }}
              onPointerDown={(e) => handlePointerDown(e, 'nw')}
            />
            <div
              className="absolute w-3 h-3 bg-white ring-1 ring-black/5 shadow-sm rounded-full cursor-ne-resize -mt-1.5 -ml-1.5 z-20"
              style={{ left: `${crop.x + crop.w}%`, top: `${crop.y}%` }}
              onPointerDown={(e) => handlePointerDown(e, 'ne')}
            />
            <div
              className="absolute w-3 h-3 bg-white ring-1 ring-black/5 shadow-sm rounded-full cursor-sw-resize -mt-1.5 -ml-1.5 z-20"
              style={{ left: `${crop.x}%`, top: `${crop.y + crop.h}%` }}
              onPointerDown={(e) => handlePointerDown(e, 'sw')}
            />
            <div
              className="absolute w-3 h-3 bg-white ring-1 ring-black/5 shadow-sm rounded-full cursor-se-resize -mt-1.5 -ml-1.5 z-20"
              style={{ left: `${crop.x + crop.w}%`, top: `${crop.y + crop.h}%` }}
              onPointerDown={(e) => handlePointerDown(e, 'se')}
            />
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between pt-1">
          <button
            type="button"
            onClick={() => setCroppingDecalId(null)}
            className="text-[11px] font-semibold tracking-wide text-neutral-400 hover:text-black transition-colors px-2 outline-none"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={applyCrop}
            className="flex items-center gap-2 bg-black text-white px-6 py-3 rounded-full text-[10px] font-bold uppercase tracking-widest hover:bg-neutral-800 hover:shadow-lg hover:-translate-y-0.5 transition-all duration-300 outline-none"
          >
            <Check size={14} strokeWidth={2.5} /> Apply Crop
          </button>
        </div>
      </div>
    </div>
  );
}
