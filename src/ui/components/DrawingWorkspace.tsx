import {
  Check,
  Droplet,
  Eraser,
  Flame,
  PaintBucket,
  Paintbrush,
  PenTool,
  Sun,
  X,
} from 'lucide-react';
import { type PointerEvent, useEffect, useRef, useState } from 'react';
import { applyBlur, applyBucketFill, applyBurn, applySaturate } from '@/shared/utils/brush-engine';
import { Input, Label } from '@/ui/design-system';
import { applyImageFilters, useEditorStore } from '@/ui/store/editor-store';

export type BrushType = 'pen' | 'brush' | 'eraser' | 'fill' | 'blur' | 'burn' | 'saturate';

export function DrawingWorkspace() {
  const { addTool, setDrawingMode, editingDrawingId, setEditingDrawingId, decals, updateDecal } =
    useEditorStore();

  const canvasRef = useRef<HTMLCanvasElement>(null);

  const isDrawingRef = useRef(false);

  const [activeBrush, setActiveBrush] = useState<BrushType>('brush');
  const [brushColor, setBrushColor] = useState('#000000');
  const [brushSize, setBrushSize] = useState(12);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, 512, 512);

    if (editingDrawingId) {
      const decal = decals.find((d) => d.id === editingDrawingId);
      if (decal?.originalSrc) {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.src = decal.originalSrc;
        img.onload = () => {
          ctx.drawImage(img, 0, 0, 512, 512);
        };
      }
    }
  }, [editingDrawingId, decals]);

  const startDrawing = (e: PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;

    if (activeBrush === 'fill') {
      applyBucketFill(ctx, x, y, brushColor);
      return;
    }

    ctx.beginPath();
    ctx.moveTo(x, y);
    isDrawingRef.current = true;

    if (activeBrush === 'blur') applyBlur(ctx, x, y, brushSize);
    else if (activeBrush === 'burn') applyBurn(ctx, x, y, brushSize);
    else if (activeBrush === 'saturate') applySaturate(ctx, x, y, brushSize);
    else {
      ctx.lineTo(x + 0.1, y + 0.1);
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.lineWidth = brushSize;

      if (activeBrush === 'eraser') {
        ctx.globalCompositeOperation = 'destination-out';
        ctx.strokeStyle = 'rgba(0,0,0,1)';
      } else {
        ctx.globalCompositeOperation = 'source-over';
        ctx.strokeStyle = brushColor;
        if (activeBrush === 'brush') {
          ctx.shadowBlur = brushSize / 4;
          ctx.shadowColor = brushColor;
        } else {
          ctx.shadowBlur = 0;
        }
      }
      ctx.stroke();
    }
  };

  const draw = (e: PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawingRef.current || activeBrush === 'fill') return;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;

    if (activeBrush === 'blur') {
      applyBlur(ctx, x, y, brushSize);
      return;
    }
    if (activeBrush === 'burn') {
      applyBurn(ctx, x, y, brushSize);
      return;
    }
    if (activeBrush === 'saturate') {
      applySaturate(ctx, x, y, brushSize);
      return;
    }

    ctx.lineTo(x, y);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.lineWidth = brushSize;

    if (activeBrush === 'eraser') {
      ctx.globalCompositeOperation = 'destination-out';
      ctx.strokeStyle = 'rgba(0,0,0,1)';
    } else {
      ctx.globalCompositeOperation = 'source-over';
      ctx.strokeStyle = brushColor;
      if (activeBrush === 'brush') {
        ctx.shadowBlur = brushSize / 4;
        ctx.shadowColor = brushColor;
      } else {
        ctx.shadowBlur = 0;
      }
    }

    ctx.stroke();
  };

  const stopDrawing = () => {
    isDrawingRef.current = false;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (ctx) ctx.closePath();
  };

  const handleApply = async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const dataUrl = canvas.toDataURL('image/png');

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const pixelBuffer = new Uint32Array(ctx.getImageData(0, 0, 512, 512).data.buffer);
    const hasPixels = pixelBuffer.some((color) => color !== 0);

    if (editingDrawingId) {
      const decal = decals.find((d) => d.id === editingDrawingId);
      let finalSrc = dataUrl;
      let finalAspectRatio = 1;

      if (decal) {
        // FIX: Destructure the new object payload from applyImageFilters
        const result = await applyImageFilters({ ...decal, originalSrc: dataUrl });
        finalSrc = result.src;
        finalAspectRatio = result.aspectRatio;
      }

      updateDecal(editingDrawingId, {
        src: finalSrc,
        originalSrc: dataUrl,
        aspectRatio: finalAspectRatio,
      });
    } else if (hasPixels) {
      addTool('drawing', dataUrl);
    }

    setEditingDrawingId(null);
    setDrawingMode(false);
  };

  const handleCancel = () => {
    setEditingDrawingId(null);
    setDrawingMode(false);
  };

  return (
    <div className="absolute inset-0 z-[200] bg-neutral-900/60 backdrop-blur-sm flex items-center justify-center animate-in fade-in duration-200">
      <div className="bg-surface rounded-2xl shadow-2xl overflow-hidden border border-border flex flex-col">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-white">
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold text-neutral-700 uppercase tracking-wider">
              {editingDrawingId ? 'Edit Drawing' : '2D Raster Overlay'}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleCancel}
              className="px-3 py-1.5 text-xs font-bold text-neutral-500 hover:bg-neutral-100 rounded-md transition-colors flex items-center gap-1.5"
            >
              <X size={14} /> Cancel
            </button>
            <button
              type="button"
              onClick={handleApply}
              className="px-3 py-1.5 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-md transition-colors flex items-center gap-1.5 shadow-sm"
            >
              <Check size={14} /> {editingDrawingId ? 'Save Changes' : 'Apply Drawing'}
            </button>
          </div>
        </div>

        <div className="flex bg-neutral-100 p-6 gap-6">
          <div className="w-48 space-y-6 bg-white p-4 rounded-xl border border-border shadow-sm">
            <div className="space-y-2">
              <Label className="text-xs uppercase font-bold text-neutral-400">Brushes</Label>
              <div className="grid grid-cols-3 gap-1">
                {[
                  { id: 'pen', icon: <PenTool size={16} />, label: 'Pen' },
                  { id: 'brush', icon: <Paintbrush size={16} />, label: 'Brush' },
                  { id: 'eraser', icon: <Eraser size={16} />, label: 'Eraser' },
                ].map((tool) => (
                  <button
                    key={tool.id}
                    type="button"
                    title={tool.label}
                    onClick={() => setActiveBrush(tool.id as BrushType)}
                    className={`p-2 rounded-lg flex items-center justify-center transition-all ${
                      activeBrush === tool.id
                        ? 'bg-blue-100 text-blue-600 border border-blue-200'
                        : 'text-neutral-500 hover:bg-neutral-50 border border-transparent'
                    }`}
                  >
                    {tool.icon}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-xs uppercase font-bold text-neutral-400">Advanced</Label>
              <div className="grid grid-cols-2 gap-1">
                {[
                  { id: 'fill', icon: <PaintBucket size={16} />, label: 'Fill' },
                  { id: 'blur', icon: <Droplet size={16} />, label: 'Blur' },
                  { id: 'burn', icon: <Flame size={16} />, label: 'Burn' },
                  { id: 'saturate', icon: <Sun size={16} />, label: 'Sat' },
                ].map((tool) => (
                  <button
                    key={tool.id}
                    type="button"
                    title={tool.label}
                    onClick={() => setActiveBrush(tool.id as BrushType)}
                    className={`p-2 rounded-lg flex items-center justify-center gap-1.5 transition-all ${
                      activeBrush === tool.id
                        ? 'bg-purple-100 text-purple-600 border border-purple-200'
                        : 'text-neutral-500 hover:bg-neutral-50 border border-transparent'
                    }`}
                  >
                    {tool.icon} <span className="text-[10px] font-semibold">{tool.label}</span>
                  </button>
                ))}
              </div>
            </div>

            <hr className="border-border" />

            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label className="text-xs">Brush Size: {brushSize}px</Label>
                <input
                  type="range"
                  min="1"
                  max="100"
                  value={brushSize}
                  onChange={(e) => setBrushSize(Number(e.target.value))}
                  className="w-full accent-blue-600"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">Color</Label>
                <div className="flex gap-2">
                  <Input
                    type="color"
                    value={brushColor}
                    onChange={(e) => setBrushColor(e.target.value)}
                    className="w-10 p-0.5 min-h-8 cursor-pointer shrink-0"
                  />
                  <Input
                    key={`brush-color-input-${brushColor}`}
                    type="text"
                    defaultValue={brushColor}
                    onBlur={(e) => {
                      let finalColor = e.target.value.trim();
                      const ctx = document.createElement('canvas').getContext('2d');
                      if (ctx && finalColor) {
                        ctx.fillStyle = finalColor;
                        finalColor = ctx.fillStyle;
                      }
                      setBrushColor(finalColor);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') e.currentTarget.blur();
                    }}
                    className="flex-1 text-xs uppercase font-mono"
                  />
                </div>
              </div>
            </div>
          </div>

          <div
            className="relative border border-border shadow-sm rounded-lg overflow-hidden bg-white w-[512px] h-[512px] shrink-0"
            style={{
              backgroundImage:
                'repeating-linear-gradient(45deg, #f0f0f0 25%, transparent 25%, transparent 75%, #f0f0f0 75%, #f0f0f0), repeating-linear-gradient(45deg, #f0f0f0 25%, #ffffff 25%, #ffffff 75%, #f0f0f0 75%, #f0f0f0)',
              backgroundPosition: '0 0, 8px 8px',
              backgroundSize: '16px 16px',
            }}
          >
            <canvas
              ref={canvasRef}
              width={512}
              height={512}
              onPointerDown={startDrawing}
              onPointerMove={draw}
              onPointerUp={stopDrawing}
              onPointerLeave={stopDrawing}
              className={`w-full h-full ${
                activeBrush === 'eraser'
                  ? 'cursor-crosshair'
                  : activeBrush === 'fill'
                    ? 'cursor-default'
                    : 'cursor-crosshair'
              }`}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
