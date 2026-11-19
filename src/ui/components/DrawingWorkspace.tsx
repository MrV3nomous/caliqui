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
  Undo2,
  Redo2,
  Trash2,
} from 'lucide-react';
import { type PointerEvent, useCallback, useEffect, useRef, useState } from 'react';
import { applyBlur, applyBucketFill, applyBurn, applySaturate } from '@/shared/utils/brush-engine';
import { Input, Label } from '@/ui/design-system';
import { useEditorStore } from '@/ui/store/editor-store';

export type BrushType = 'pen' | 'brush' | 'eraser' | 'fill' | 'blur' | 'burn' | 'saturate';

export function DrawingWorkspace() {
  const { addTool, setDrawingMode, editingDrawingId, setEditingDrawingId, decals, replaceDecalImage } =
    useEditorStore();

  const canvasRef = useRef<HTMLCanvasElement>(null);

  const isDrawingRef = useRef(false);
  const drawingPointerIdRef = useRef<number | null>(null);

  const [activeBrush, setActiveBrush] = useState<BrushType>('brush');
  const [brushColor, setBrushColor] = useState('#000000');
  const [brushSize, setBrushSize] = useState(12);
  const historyRef = useRef<{ past: ImageData[]; future: ImageData[] }>({ past: [], future: [] });
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);
  const [isApplying, setIsApplying] = useState(false);
  const [applyError, setApplyError] = useState<string | null>(null);

  const editingSource = editingDrawingId ? decals.find((d) => d.id === editingDrawingId)?.originalSrc ?? null : null;

  const pushUndoSnapshot = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    try {
      const snapshot = ctx.getImageData(0, 0, canvas.width, canvas.height);
      historyRef.current.past = [...historyRef.current.past.slice(-29), snapshot];
      historyRef.current.future = [];
      setCanUndo(true);
      setCanRedo(false);
    } catch (error) {
      console.error('Could not save drawing history snapshot.', error);
    }
  };

  const syncHistoryAvailability = useCallback(() => {
    setCanUndo(historyRef.current.past.length > 0);
    setCanRedo(historyRef.current.future.length > 0);
  }, []);

  const restoreSnapshot = useCallback((snapshot: ImageData) => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    ctx.putImageData(snapshot, 0, 0);
  }, []);

  const undoDrawing = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx || historyRef.current.past.length === 0) return;
    const current = ctx.getImageData(0, 0, canvas.width, canvas.height);
    historyRef.current.future = [...historyRef.current.future, current];
    const previous = historyRef.current.past.pop();
    if (previous) restoreSnapshot(previous);
    syncHistoryAvailability();
  }, [restoreSnapshot, syncHistoryAvailability]);

  const redoDrawing = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx || historyRef.current.future.length === 0) return;
    const current = ctx.getImageData(0, 0, canvas.width, canvas.height);
    historyRef.current.past = [...historyRef.current.past, current].slice(-30);
    const next = historyRef.current.future.pop();
    if (next) restoreSnapshot(next);
    syncHistoryAvailability();
  }, [restoreSnapshot, syncHistoryAvailability]);

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    const image = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const hasPixels = new Uint32Array(image.data.buffer).some((pixel) => pixel !== 0);
    if (!hasPixels) return;
    pushUndoSnapshot();
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  };

  useEffect(() => {
    const handleHistoryShortcut = (event: Event) => {
      const action = (event as CustomEvent<{ action?: string }>).detail?.action;
      if (action === 'undo') undoDrawing();
      if (action === 'redo') redoDrawing();
    };
    window.addEventListener('caliqui:drawing-history', handleHistoryShortcut);
    return () => window.removeEventListener('caliqui:drawing-history', handleHistoryShortcut);
  }, [redoDrawing, undoDrawing]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let cancelled = false;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    historyRef.current = { past: [], future: [] };
    setCanUndo(false);
    setCanRedo(false);

    const resetBaseline = () => {
      if (cancelled) return;
      historyRef.current = { past: [], future: [] };
      setCanUndo(false);
      setCanRedo(false);
    };

    if (editingSource) {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        if (cancelled) return;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resetBaseline();
      };
      img.onerror = () => {
        if (!cancelled) {
          console.error('Failed to load drawing source for editing.');
          resetBaseline();
        }
      };
      img.src = editingSource;
    } else {
      resetBaseline();
    }

    return () => {
      cancelled = true;
    };
  }, [editingDrawingId, editingSource]);

  const startDrawing = (e: PointerEvent<HTMLCanvasElement>) => {
    if (e.button !== 0 || drawingPointerIdRef.current !== null) return;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;

    if (activeBrush === 'fill') {
      pushUndoSnapshot();
      applyBucketFill(ctx, x, y, brushColor);
      return;
    }

    e.preventDefault();
    pushUndoSnapshot();
    try {
      canvas.setPointerCapture(e.pointerId);
    } catch {}
    drawingPointerIdRef.current = e.pointerId;
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
    if (!isDrawingRef.current || e.pointerId !== drawingPointerIdRef.current || activeBrush === 'fill') return;
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

  const stopDrawing = (e?: PointerEvent<HTMLCanvasElement>) => {
    if (e && drawingPointerIdRef.current !== e.pointerId) return;
    isDrawingRef.current = false;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (ctx) ctx.closePath();
    if (canvas && e) {
      try {
        if (canvas.hasPointerCapture(e.pointerId)) canvas.releasePointerCapture(e.pointerId);
      } catch {}
    }
    drawingPointerIdRef.current = null;
  };

  useEffect(() => () => {
    const pointerId = drawingPointerIdRef.current;
    const canvas = canvasRef.current;
    isDrawingRef.current = false;
    drawingPointerIdRef.current = null;
    if (pointerId !== null && canvas) {
      try { if (canvas.hasPointerCapture(pointerId)) canvas.releasePointerCapture(pointerId); } catch {}
    }
  }, []);

  const handleApply = async () => {
    const canvas = canvasRef.current;
    if (!canvas || isApplying) return;

    setApplyError(null);
    setIsApplying(true);
    try {
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('The drawing canvas is unavailable. Please reopen the drawing workspace.');

      const pixelBuffer = new Uint32Array(ctx.getImageData(0, 0, canvas.width, canvas.height).data.buffer);
      const hasPixels = pixelBuffer.some((color) => color !== 0);

      if (editingDrawingId) {
        const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
        if (!blob) throw new Error('The drawing could not be exported. Please try again.');
        await replaceDecalImage(editingDrawingId, blob, 1);
      } else if (hasPixels) {
        addTool('drawing', canvas.toDataURL('image/png'));
      } else {
        throw new Error('Add a stroke or mark before applying the drawing.');
      }

      setEditingDrawingId(null);
      setDrawingMode(false);
    } catch (error) {
      console.error('Could not apply drawing.', error);
      setApplyError(error instanceof Error ? error.message : 'Could not apply this drawing. Please try again.');
    } finally {
      setIsApplying(false);
    }
  };

  const handleCancel = () => {
    setEditingDrawingId(null);
    setDrawingMode(false);
  };

  return (
    <div className="studio-drawing-overlay absolute inset-0 z-[200] bg-neutral-900/60 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4 animate-in fade-in duration-200">
      <div className="studio-drawing-window bg-surface rounded-2xl shadow-2xl overflow-hidden border border-border flex flex-col w-full max-w-5xl max-h-[calc(100dvh-1rem)]">
        <div className="studio-drawing-header flex items-center justify-between px-4 py-3 border-b border-border bg-white">
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold text-neutral-700 uppercase tracking-wider">
              {editingDrawingId ? 'Edit Drawing' : '2D Raster Overlay'}
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <button type="button" title="Undo drawing" aria-label="Undo drawing" disabled={!canUndo} onClick={undoDrawing} className="rounded-lg border border-stone-200 px-2.5 py-2 text-neutral-600 hover:bg-neutral-50 disabled:opacity-30"><Undo2 size={15} /></button>
            <button type="button" title="Redo drawing" aria-label="Redo drawing" disabled={!canRedo} onClick={redoDrawing} className="rounded-lg border border-stone-200 px-2.5 py-2 text-neutral-600 hover:bg-neutral-50 disabled:opacity-30"><Redo2 size={15} /></button>
            <button type="button" title="Clear drawing" aria-label="Clear drawing" onClick={clearCanvas} className="rounded-lg border border-stone-200 px-2.5 py-2 text-neutral-600 hover:bg-red-50 hover:text-red-600"><Trash2 size={15} /></button>
            <button
              type="button"
              onClick={handleCancel}
              disabled={isApplying}
              className="px-3 py-1.5 text-xs font-bold text-neutral-500 hover:bg-neutral-100 rounded-md transition-colors flex items-center gap-1.5 disabled:opacity-50"
            >
              <X size={14} /> Cancel
            </button>
            <button
              type="button"
              onClick={() => void handleApply()}
              disabled={isApplying}
              className="px-3 py-1.5 text-xs font-bold studio-primary-action rounded-md transition-colors flex items-center gap-1.5 shadow-sm disabled:opacity-60 disabled:cursor-wait"
            >
              <Check size={14} /> {isApplying ? 'Saving…' : editingDrawingId ? 'Save Changes' : 'Apply Drawing'}
            </button>
          </div>
        </div>

        {applyError && <div role="alert" className="mx-3 mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[11px] text-red-700">{applyError}</div>}
        <div className="studio-drawing-body flex flex-col-reverse lg:flex-row bg-neutral-100 p-3 sm:p-6 gap-3 sm:gap-6 overflow-y-auto min-h-0">
          <div className="studio-drawing-sidebar w-full lg:w-48 shrink-0 space-y-4 sm:space-y-6 bg-white p-3 sm:p-4 rounded-xl border border-border shadow-sm">
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
                        ? 'studio-option-active border'
                        : 'studio-option-inactive border border-transparent'
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
                        : 'studio-option-inactive border border-transparent'
                    }`}
                  >
                    {tool.icon} <span className="text-[11px] font-semibold">{tool.label}</span>
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
                  className="w-full studio-range-accent"
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
            className="studio-drawing-canvas relative border border-border shadow-sm rounded-lg overflow-hidden bg-white w-full max-w-[512px] aspect-square h-auto shrink-0 mx-auto"
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
              onPointerCancel={stopDrawing}
              onLostPointerCapture={stopDrawing}
              className={`w-full h-full touch-none ${
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
