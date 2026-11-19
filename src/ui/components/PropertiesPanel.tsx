import { AlignCenter, Box, ChevronDown, Copy, FlipHorizontal, FlipVertical, Layers, Loader2, Pencil, RotateCcw, Sparkles, Upload } from 'lucide-react';
import type React from 'react';
import { useEffect, useRef, useState } from 'react';
import { processAndCompressImage } from '@/shared/utils/image-processing';
import { ColorPicker } from '@/ui/components/ColorPicker';
import { Label } from '@/ui/design-system';
import {
  applyImageFilters,
  type DecalData,
  generateAssetTexture,
  getDefaultConfig,
  useEditorStore,
} from '@/ui/store/editor-store';
// FIX: Corrected import path to point into the preview3d subfolder
import { ImageCropModal } from './preview3d/ImageCropModal';
import { type PropertyDef, TOOL_CONFIG_MAP } from './properties/config';

function PropertySection({
  title,
  children,
  defaultOpen = false,
  id,
}: {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
  id?: string;
}) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  return (
    <details
      id={id}
      open={isOpen}
      onToggle={(event) => setIsOpen(event.currentTarget.open)}
      className="studio-property-section group rounded-xl border border-stone-200/80 bg-white/70"
    >
      <summary className="studio-property-summary flex min-h-10 cursor-pointer list-none items-center justify-between gap-3 px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-neutral-600 outline-none hover:bg-stone-50 studio-focusable rounded-xl">
        <span>{title}</span>
        <ChevronDown size={14} className={`shrink-0 text-neutral-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </summary>
      <div className="studio-property-content border-t border-stone-100 px-3 py-3 space-y-4">{children}</div>
    </details>
  );
}

const formatPlacementValue = (value: number) => Number.isFinite(value) ? String(Number(value.toFixed(3))) : '0';

function PositionControls({
  decal,
  updateVisuals,
  saveHistory,
}: {
  decal: DecalData;
  updateVisuals: (updates: Partial<DecalData>) => void;
  saveHistory: () => void;
}) {
  const aspect = Math.max(0.01, Number.isFinite(decal.aspectRatio) ? (decal.aspectRatio || 1) : 1);
  const visualWidth = decal.scaleX ?? (decal.scale * Math.max(1, aspect));
  const visualHeight = decal.scaleY ?? (decal.scale * Math.max(1, 1 / aspect));

  const [positionDraft, setPositionDraft] = useState({
    x: formatPlacementValue(decal.position[0]),
    y: formatPlacementValue(decal.position[1]),
  });
  const [sizeDraft, setSizeDraft] = useState({
    width: formatPlacementValue(visualWidth),
    height: formatPlacementValue(visualHeight),
  });
  const [editingPosition, setEditingPosition] = useState<'x' | 'y' | null>(null);
  const [editingSize, setEditingSize] = useState<'width' | 'height' | null>(null);
  const cancelledPlacementFieldRef = useRef<'x' | 'y' | 'width' | 'height' | null>(null);

  useEffect(() => {
    if (!editingPosition) {
      setPositionDraft({ x: formatPlacementValue(decal.position[0]), y: formatPlacementValue(decal.position[1]) });
    }
    if (!editingSize) {
      setSizeDraft({ width: formatPlacementValue(visualWidth), height: formatPlacementValue(visualHeight) });
    }
  }, [decal.position, visualWidth, visualHeight, editingPosition, editingSize]);

  const commitPosition = (axis: 'x' | 'y') => {
    setEditingPosition(null);
    const index = axis === 'x' ? 0 : 1;
    const currentValue = decal.position[index];
    if (cancelledPlacementFieldRef.current === axis) {
      cancelledPlacementFieldRef.current = null;
      setPositionDraft((current) => ({ ...current, [axis]: formatPlacementValue(currentValue) }));
      return;
    }
    const raw = positionDraft[axis].trim();
    const nextValue = Number(raw);
    if (!raw || !Number.isFinite(nextValue)) {
      setPositionDraft((current) => ({ ...current, [axis]: formatPlacementValue(currentValue) }));
      return;
    }
    if (Math.abs(nextValue - currentValue) < 0.000001) return;
    const nextPosition: [number, number, number] = [
      decal.position[0],
      decal.position[1],
      decal.position[2],
    ];
    nextPosition[index] = nextValue;
    saveHistory();
    updateVisuals({ position: nextPosition });
  };

  const commitSize = (axis: 'width' | 'height') => {
    setEditingSize(null);
    if (cancelledPlacementFieldRef.current === axis) {
      cancelledPlacementFieldRef.current = null;
      setSizeDraft({ width: formatPlacementValue(visualWidth), height: formatPlacementValue(visualHeight) });
      return;
    }
    const raw = sizeDraft[axis].trim();
    const nextValue = Number(raw);
    if (!raw || !Number.isFinite(nextValue) || nextValue <= 0) {
      setSizeDraft({ width: formatPlacementValue(visualWidth), height: formatPlacementValue(visualHeight) });
      return;
    }

    const locked = decal.lockAspectRatio !== false;
    const currentWidth = Math.max(0.001, visualWidth);
    const currentHeight = Math.max(0.001, visualHeight);
    const currentRatio = currentWidth / currentHeight;
    let nextWidth = currentWidth;
    let nextHeight = currentHeight;

    if (axis === 'width') {
      nextWidth = nextValue;
      if (locked) nextHeight = nextValue / currentRatio;
    } else {
      nextHeight = nextValue;
      if (locked) nextWidth = nextValue * currentRatio;
    }

    nextWidth = Math.max(0.01, nextWidth);
    nextHeight = Math.max(0.01, nextHeight);
    if (Math.abs(nextWidth - currentWidth) < 0.000001 && Math.abs(nextHeight - currentHeight) < 0.000001) return;

    saveHistory();
    updateVisuals({
      scaleX: nextWidth,
      scaleY: nextHeight,
      scale: Math.max(nextWidth, nextHeight),
    });
  };

  const centerOnOrigin = () => {
    if (Math.abs(decal.position[0]) < 0.000001 && Math.abs(decal.position[1]) < 0.000001) return;
    saveHistory();
    updateVisuals({ position: [0, 0, decal.position[2]] });
  };

  return (
    <div className="studio-placement-controls space-y-3 min-w-0">
      <section className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <span className="studio-property-kicker text-[10px] font-medium uppercase tracking-[0.14em] text-neutral-500">Position</span>
          <button
            type="button"
            onClick={centerOnOrigin}
            disabled={Math.abs(decal.position[0]) < 0.000001 && Math.abs(decal.position[1]) < 0.000001}
            className="studio-subtle-action inline-flex h-7 items-center gap-1.5 rounded-lg px-2 text-[10px] font-medium disabled:opacity-35"
            title="Center artwork on the garment design origin"
          >
            <AlignCenter size={13} /> Center
          </button>
        </div>
        <div className="grid grid-cols-2 gap-2">
          {(['x', 'y'] as const).map((axis) => (
            <label key={axis} className="studio-property-field flex h-10 min-w-0 items-center gap-2 rounded-lg border px-2.5 text-[10px]">
              <span className="studio-axis-tag">{axis.toUpperCase()}</span>
              <input
                type="number"
                step="0.01"
                value={positionDraft[axis]}
                onFocus={() => { cancelledPlacementFieldRef.current = null; setEditingPosition(axis); }}
                onChange={(event) => setPositionDraft((current) => ({ ...current, [axis]: event.target.value }))}
                onBlur={() => commitPosition(axis)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') event.currentTarget.blur();
                  if (event.key === 'Escape') {
                    cancelledPlacementFieldRef.current = axis;
                    event.currentTarget.blur();
                  }
                }}
                aria-label={`${axis.toUpperCase()} position`}
                className="studio-property-number min-w-0 flex-1 bg-transparent text-right font-mono text-[11px] outline-none"
              />
            </label>
          ))}
        </div>
      </section>

      <section className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <span className="studio-property-kicker text-[10px] font-medium uppercase tracking-[0.14em] text-neutral-500">Dimensions</span>
          <span className="studio-property-hint text-[9px]">Garment units</span>
        </div>
        <div className="grid grid-cols-2 gap-2">
          {([
            ['width', 'W'],
            ['height', 'H'],
          ] as const).map(([axis, label]) => (
            <label key={axis} className="studio-property-field flex h-10 min-w-0 items-center gap-2 rounded-lg border px-2.5 text-[10px]">
              <span className="studio-axis-tag">{label}</span>
              <input
                type="number"
                min="0.01"
                step="0.01"
                value={sizeDraft[axis]}
                onFocus={() => { cancelledPlacementFieldRef.current = null; setEditingSize(axis); }}
                onChange={(event) => setSizeDraft((current) => ({ ...current, [axis]: event.target.value }))}
                onBlur={() => commitSize(axis)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') event.currentTarget.blur();
                  if (event.key === 'Escape') {
                    cancelledPlacementFieldRef.current = axis;
                    event.currentTarget.blur();
                  }
                }}
                aria-label={`${label === 'W' ? 'Width' : 'Height'} in garment units`}
                className="studio-property-number min-w-0 flex-1 bg-transparent text-right font-mono text-[11px] outline-none"
              />
            </label>
          ))}
        </div>
      </section>

      <div className="studio-property-actions flex flex-wrap items-center justify-between gap-2 border-t pt-2">
        <label className="studio-property-checkbox flex items-center gap-2 text-[10px]">
          <input
            type="checkbox"
            checked={decal.lockAspectRatio !== false}
            onChange={(event) => { saveHistory(); updateVisuals({ lockAspectRatio: event.target.checked }); }}
          />
          Lock proportions
        </label>
        <div className="flex items-center gap-1">
          <button type="button" title="Flip horizontally" aria-pressed={Boolean(decal.flipX)} onClick={() => { saveHistory(); updateVisuals({ flipX: !decal.flipX }); }} className="studio-icon-control"><FlipHorizontal size={14} /></button>
          <button type="button" title="Flip vertically" aria-pressed={Boolean(decal.flipY)} onClick={() => { saveHistory(); updateVisuals({ flipY: !decal.flipY }); }} className="studio-icon-control"><FlipVertical size={14} /></button>
        </div>
      </div>
    </div>
  );
}

function SliderControl({
  prop,
  activeDecal,
  updateVisuals,
  saveHistory,
}: {
  prop: PropertyDef;
  activeDecal: DecalData;
  updateVisuals: (updates: Partial<DecalData>) => void;
  saveHistory: () => void;
}) {
  const isRotation = prop.id === 'rotationOffset';
  const isScale = prop.id === 'scale';
  const isDepth = prop.id === 'zDepth';

  const rawValue = isScale
    ? (activeDecal.scaleX ?? activeDecal.scale)
    : activeDecal[prop.id as keyof DecalData];

  const effectiveValue = typeof rawValue === 'number' ? rawValue : (prop.min ?? 0);

  let calculatedDisplay = 0;
  if (isRotation) {
    calculatedDisplay = Math.round(effectiveValue * (180 / Math.PI));
  } else if (isScale) {
    calculatedDisplay = Math.round(effectiveValue * 100);
  } else if (isDepth) {
    calculatedDisplay = Number(Number(effectiveValue).toFixed(2));
  } else {
    calculatedDisplay = Number(Number(effectiveValue).toFixed(2));
  }

  const [localText, setLocalText] = useState<string>(String(calculatedDisplay));
  const [isFocused, setIsFocused] = useState(false);

  useEffect(() => {
    if (!isFocused) setLocalText(String(calculatedDisplay));
  }, [calculatedDisplay, isFocused]);

  const commitValue = (valStr: string) => {
    let num = Number(valStr);
    if (!Number.isFinite(num)) return;

    if (prop.min !== undefined) num = Math.max(prop.min, num);
    if (prop.max !== undefined) num = Math.min(prop.max, num);

    let storeNum = num;
    if (isRotation) storeNum = num * (Math.PI / 180);
    else if (isScale) storeNum = num / 100;

    const updates: Partial<DecalData> = { [prop.id]: storeNum };
    if (isScale) {
      updates.scaleX = undefined;
      updates.scaleY = undefined;
    }
    updateVisuals(updates);
  };

  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const num = Number(e.target.value);

    let storeNum = num;
    if (isRotation) storeNum = num * (Math.PI / 180);
    else if (isScale) storeNum = num / 100;

    const updates: Partial<DecalData> = { [prop.id]: storeNum };
    if (isScale) {
      updates.scaleX = undefined;
      updates.scaleY = undefined;
    }
    updateVisuals(updates);
  };

  return (
    <div className="space-y-2 min-w-0" key={prop.id}>
      <div className="flex justify-between items-center">
        <Label className="text-[10px] font-medium text-neutral-500 uppercase tracking-[0.16em] block m-0">
          {prop.label}
        </Label>
      </div>
      <div className="studio-slider-control flex gap-3 items-center px-2 py-1.5 rounded-xl transition-colors">
        <input
          type="range"
          min={prop.min}
          max={prop.max}
          step={prop.step ?? 1}
          value={calculatedDisplay}
          onPointerDown={() => saveHistory()}
          onChange={handleSliderChange}
          className="flex-1 accent-black h-1 bg-black/10 rounded-full appearance-none ml-2 cursor-pointer outline-none"
        />
        <div className="studio-slider-value flex items-center justify-center w-11 shrink-0 rounded-lg px-1 py-1">
          <input
            type="text"
            value={isFocused ? localText : calculatedDisplay}
            onFocus={() => {
              setLocalText(String(calculatedDisplay));
              setIsFocused(true);
              saveHistory();
            }}
            onChange={(e) => setLocalText(e.target.value)}
            onBlur={(e) => {
              setIsFocused(false);
              commitValue(e.target.value);
            }}
            onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
            className="w-full bg-transparent text-[11px] font-medium tracking-wider text-center font-mono outline-none text-black"
          />
        </div>
      </div>
    </div>
  );
}

function ColorControl({
  prop,
  activeDecal,
  updateVisuals,
  saveHistory,
}: {
  prop: PropertyDef;
  activeDecal: DecalData;
  updateVisuals: (updates: Partial<DecalData>) => void;
  saveHistory: () => void;
}) {
  const value = (activeDecal[prop.id as keyof DecalData] as string) || '';
  const safeColorValue = value === 'transparent' || !value ? 'transparent' : value;

  return (
    <div className="space-y-2 min-w-0" key={prop.id}>
      <Label className="text-[10px] font-medium text-neutral-500 uppercase tracking-[0.16em] block m-0">
        {prop.label}
      </Label>
      <ColorPicker
        color={safeColorValue}
        onChange={(newColor) => updateVisuals({ [prop.id]: newColor })}
        onPointerDown={() => saveHistory()}
      />
    </div>
  );
}

function TextControl({
  prop,
  activeDecal,
  updateVisuals,
  saveHistory,
}: {
  prop: PropertyDef;
  activeDecal: DecalData;
  updateVisuals: (updates: Partial<DecalData>) => void;
  saveHistory: () => void;
}) {
  const value = (activeDecal[prop.id as keyof DecalData] as string) || '';
  const [localText, setLocalText] = useState(value);
  const [isFocused, setIsFocused] = useState(false);

  useEffect(() => {
    if (!isFocused) setLocalText(value);
  }, [value, isFocused]);

  return (
    <div className="space-y-2 min-w-0" key={prop.id}>
      <Label className="text-[10px] font-medium text-neutral-500 uppercase tracking-[0.16em] block m-0">
        {prop.label}
      </Label>
      <div className="studio-text-control p-1 rounded-lg transition-colors">
        <input
          type="text"
          value={isFocused ? localText : value}
          onFocus={() => {
            setLocalText(value);
            setIsFocused(true);
            saveHistory();
          }}
          onChange={(e) => setLocalText(e.target.value)}
          onBlur={() => {
            setIsFocused(false);
            if (localText !== value) updateVisuals({ [prop.id]: localText });
          }}
          onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
          className="w-full bg-transparent border-0 rounded-lg text-[11px] tracking-wide font-medium text-black px-2 py-1.5 outline-none"
        />
      </div>
    </div>
  );
}

export function PropertiesPanel({ activeDecalId }: { activeDecalId: string }) {
  const {
    decals, updateDecal, saveHistory, applyBackgroundRemoval, isProcessingBgRemoval,
    replaceDecalImage, setEditingDrawingId, setDrawingMode,
  } = useEditorStore();

  const activeDecal = decals.find((d) => d.id === activeDecalId);
  const filterRevisionRef = useRef(0);
  const filterTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const replaceInputRef = useRef<HTMLInputElement>(null);
  const [isReplacing, setIsReplacing] = useState(false);
  const [replaceError, setReplaceError] = useState<string | null>(null);
  const [activePropertyTab, setActivePropertyTab] = useState<'layout' | 'content' | 'style' | 'effects'>('layout');

  useEffect(() => () => {
    filterRevisionRef.current += 1;
    if (filterTimerRef.current) clearTimeout(filterTimerRef.current);
  }, []);

  useEffect(() => {
    setActivePropertyTab('layout');
  }, [activeDecalId]);

  if (!activeDecal) return null;

  const defaults = getDefaultConfig(activeDecal.type);
  const isImageOrDrawing = activeDecal.type === 'image' || activeDecal.type === 'drawing';

  const updateVisuals = (updates: Partial<DecalData>) => {
    updateDecal(activeDecalId, updates);

    const nonRedrawProps = [
      'position', 'rotation', 'scale', 'scaleX', 'scaleY', 'rotationOffset',
      'zDepth', 'angleLimit', 'placementMode', 'visible', 'locked',
      'lockAspectRatio', 'flipX', 'flipY',
    ];
    const needsRedraw = Object.keys(updates).some((key) => !nonRedrawProps.includes(key));
    if (!needsRedraw) return;

    const requestId = ++filterRevisionRef.current;
    if (filterTimerRef.current) clearTimeout(filterTimerRef.current);

    // Slider movements are previewed immediately in state, while expensive raster
    // processing is coalesced so one drag doesn't queue dozens of filter renders.
    filterTimerRef.current = setTimeout(() => {
      filterTimerRef.current = null;
      void (async () => {
        const decal = useEditorStore.getState().decals.find((d) => d.id === activeDecalId);
        if (!decal) return;
        try {
          if (decal.type === 'image' || decal.type === 'drawing') {
            const { src: newSrc, aspectRatio } = await applyImageFilters(decal);
            if (requestId !== filterRevisionRef.current) return;
            if (!useEditorStore.getState().decals.some((item) => item.id === activeDecalId)) return;
            updateDecal(activeDecalId, { src: newSrc, aspectRatio });
          } else {
            const baseSrc = generateAssetTexture(decal);
            const { src: finalSrc, aspectRatio } = await applyImageFilters({ ...decal, originalSrc: baseSrc });
            if (requestId !== filterRevisionRef.current) return;
            if (!useEditorStore.getState().decals.some((item) => item.id === activeDecalId)) return;
            updateDecal(activeDecalId, { src: finalSrc, aspectRatio });
          }
        } catch (error) {
          console.error('Could not refresh artwork preview after property change.', error);
        }
      })();
    }, 90);
  };

  const handleReplaceImage = async (file?: File) => {
    if (!file || isReplacing) return;
    setIsReplacing(true);
    setReplaceError(null);
    try {
      const { blob, aspectRatio } = await processAndCompressImage(file);
      await replaceDecalImage(activeDecalId, blob, aspectRatio);
    } catch (error) {
      console.error('Could not replace artwork.', error);
      setReplaceError(error instanceof Error ? error.message : 'Could not replace this image. Please try again.');
    } finally {
      setIsReplacing(false);
      if (replaceInputRef.current) replaceInputRef.current.value = '';
    }
  };


  const renderControl = (prop: PropertyDef) => {
    const value = (activeDecal[prop.id as keyof DecalData] as unknown as string | number) ?? '';

    switch (prop.type) {
      case 'slider':
        return (
          <SliderControl
            key={prop.id}
            prop={prop}
            activeDecal={activeDecal}
            updateVisuals={updateVisuals}
            saveHistory={saveHistory}
          />
        );
      case 'color':
        return (
          <ColorControl
            key={prop.id}
            prop={prop}
            activeDecal={activeDecal}
            updateVisuals={updateVisuals}
            saveHistory={saveHistory}
          />
        );
      case 'text':
        return (
          <TextControl
            key={prop.id}
            prop={prop}
            activeDecal={activeDecal}
            updateVisuals={updateVisuals}
            saveHistory={saveHistory}
          />
        );
      case 'select':
        return (
          <div className="space-y-2 min-w-0" key={prop.id}>
            <Label className="text-[10px] font-medium text-neutral-500 uppercase tracking-[0.16em] block m-0">
              {prop.label}
            </Label>
            <div className="studio-select-control p-1.5 rounded-xl transition-all">
              <select
                className="w-full bg-transparent border-0 rounded-xl text-[11px] tracking-wide font-medium text-black p-2 outline-none cursor-pointer"
                value={value}
                onFocus={() => saveHistory()}
                onChange={(e) => updateVisuals({ [prop.id]: e.target.value })}
                style={prop.id === 'fontFamily' ? { fontFamily: String(value) } : undefined}
              >
                {prop.options?.map((opt) => (
                  <option
                    key={opt.value}
                    value={opt.value}
                    style={prop.id === 'fontFamily' ? { fontFamily: String(opt.value) } : undefined}
                  >
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        );
      case 'action':
        if (prop.actionType === 'replace-image' && isImageOrDrawing) {
          return <button key={prop.id} type="button" onClick={() => replaceInputRef.current?.click()} disabled={isReplacing} className="studio-property-action flex w-full items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-[11px] font-medium disabled:opacity-50">{isReplacing ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />} {isReplacing ? 'Replacing…' : prop.label}</button>;
        }
        if (prop.actionType === 'edit-drawing' && activeDecal.type === 'drawing') {
          return <button key={prop.id} type="button" onClick={() => { setEditingDrawingId(activeDecalId); setDrawingMode(true); }} className="studio-property-action flex w-full items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-[11px] font-medium"><Pencil size={14} /> {prop.label}</button>;
        }
        return null;
      case 'button-group':
        return (
          <div className="space-y-2 min-w-0" key={prop.id}>
            <Label className="text-[10px] font-medium text-neutral-500 uppercase tracking-[0.16em] block m-0">
              {prop.label}
            </Label>
            <div className="studio-button-group flex p-1 rounded-xl justify-between gap-1 overflow-hidden">
              {prop.options?.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  className={`flex-1 flex justify-center items-center text-[11px] py-2 rounded-xl transition-all outline-none min-w-0 ${
                    value === opt.value
                      ? 'studio-option-active font-medium'
                      : 'studio-option-inactive font-medium'
                  }`}
                  onClick={() => {
                    saveHistory();
                    updateVisuals({ [prop.id]: opt.value });
                  }}
                >
                  {opt.icon ? (
                    opt.icon
                  ) : (
                    <span className="truncate tracking-wide">{opt.label}</span>
                  )}
                </button>
              ))}
            </div>
          </div>
        );
      default:
        return null;
    }
  };

  const activeConfigGroups = TOOL_CONFIG_MAP[activeDecal.type] || [];
  const groupsForTab = (tab: 'layout' | 'content' | 'style' | 'effects') => activeConfigGroups.filter((group) => {
    if (tab === 'layout') return group.id === 'transform';
    if (tab === 'content') return ['shape-type', 'typography', 'image-actions', 'drawing-actions'].includes(group.id);
    if (tab === 'style') return ['appearance', 'image-appearance', 'stroke', 'radius'].includes(group.id);
    return ['filters', 'blend-mode', 'shadow', 'text-distortion'].includes(group.id);
  });
  const propertyTabs = [
    { id: 'layout' as const, label: 'Layout', description: 'Placement, dimensions and transformation' },
    { id: 'content' as const, label: 'Content', description: 'Artwork content and source settings' },
    { id: 'style' as const, label: 'Style', description: 'Colour, opacity and visual finish' },
    { id: 'effects' as const, label: 'Effects', description: 'Filters, blend modes and shadows' },
  ];
  const currentTab = propertyTabs.find((tab) => tab.id === activePropertyTab) ?? propertyTabs[0];

  return (
    <>
      <ImageCropModal />
      <input ref={replaceInputRef} type="file" accept="image/*" className="hidden" onChange={(event) => { const file = event.target.files?.[0]; if (file) void handleReplaceImage(file); }} />
      {replaceError && <div role="alert" className="mx-3 mt-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[10px] leading-relaxed text-red-700">{replaceError}</div>}
      <div className="studio-properties-panel flex flex-col gap-3 pb-6">
        <div className="studio-property-navigation sticky top-0 z-20 -mx-4 sm:-mx-5 px-3 sm:px-4 pt-2 pb-2">
          <div className="studio-property-tabs grid grid-cols-4 gap-1" role="tablist" aria-label="Property categories">
            {propertyTabs.map((tab) => (
              <button
                key={tab.id}
                id={`property-tab-${tab.id}`}
                type="button"
                role="tab"
                aria-selected={activePropertyTab === tab.id}
                aria-controls="studio-property-tabpanel"
                data-active={activePropertyTab === tab.id}
                className="studio-property-tab min-w-0 rounded-lg px-1 py-2 text-[10px] font-semibold transition-colors"
                onClick={() => setActivePropertyTab(tab.id)}
              >
                {tab.label}
              </button>
            ))}
          </div>
          <p className="studio-property-tab-description mt-2 px-1 text-[9px] leading-relaxed">{currentTab.description}</p>
        </div>
        <div id="studio-property-tabpanel" role="tabpanel" aria-labelledby={`property-tab-${activePropertyTab}`} className="flex flex-col gap-3 px-0">
        {activePropertyTab === 'layout' && <>
        {/* 3-Mode Selector */}
        <PropertySection id="property-placement" title="Placement" defaultOpen>
          <div className="space-y-3 min-w-0">
            <div className="studio-placement-switcher grid grid-cols-3 gap-1 rounded-xl border p-1" role="group" aria-label="Artwork placement mode">
              <button
                type="button"
                data-active={!activeDecal.placementMode || activeDecal.placementMode === 'front' || activeDecal.placementMode === 'back'}
                aria-pressed={!activeDecal.placementMode || activeDecal.placementMode === 'front' || activeDecal.placementMode === 'back'}
                title="Place on the selected front or back garment panel"
                className="studio-placement-option flex min-w-0 flex-col items-center justify-center gap-1 rounded-lg px-1.5 py-2.5 text-center"
                onClick={() => {
                  if (activeDecal.placementMode === 'front' || activeDecal.placementMode === 'back') return;
                  saveHistory();
                  const needsReSnap = activeDecal.placementMode === 'wrap';
                  updateVisuals({ placementMode: 'front', ...(needsReSnap ? { position: [0, 0, 0], rotation: [0, 0, 0] } : {}) });
                }}
              >
                <Box size={15} />
                <span>Single panel</span>
              </button>
              <button
                type="button"
                data-active={activeDecal.placementMode === 'pass-through'}
                aria-pressed={activeDecal.placementMode === 'pass-through'}
                title="Project through the fabric onto both sides"
                className="studio-placement-option flex min-w-0 flex-col items-center justify-center gap-1 rounded-lg px-1.5 py-2.5 text-center"
                onClick={() => {
                  if (activeDecal.placementMode === 'pass-through') return;
                  saveHistory();
                  const needsReSnap = activeDecal.placementMode === 'wrap';
                  updateVisuals({ placementMode: 'pass-through', ...(needsReSnap ? { position: [0, 0, 0], rotation: [0, 0, 0] } : {}) });
                }}
              >
                <Copy size={15} />
                <span>Both sides</span>
              </button>
              <button
                type="button"
                data-active={activeDecal.placementMode === 'wrap'}
                aria-pressed={activeDecal.placementMode === 'wrap'}
                title="Wrap artwork around the garment"
                className="studio-placement-option flex min-w-0 flex-col items-center justify-center gap-1 rounded-lg px-1.5 py-2.5 text-center"
                onClick={() => {
                  if (activeDecal.placementMode === 'wrap') return;
                  saveHistory();
                  updateVisuals({ placementMode: 'wrap', scale: 1.0, scaleX: 1.0, scaleY: 1.0, rotation: [0, 0, 0] });
                }}
              >
                <Layers size={15} />
                <span>Wrap 360°</span>
              </button>
            </div>
            <p className="studio-placement-description text-[10px] leading-relaxed">
              {activeDecal.placementMode === 'pass-through'
                ? 'The artwork projects through the fabric, appearing on both front and back panels.'
                : activeDecal.placementMode === 'wrap'
                  ? 'The artwork follows the garment surface around its circumference.'
                  : 'The artwork is attached to one garment panel. Choose the front or back by rotating the shirt.'}
            </p>
          </div>
        </PropertySection>

        <PropertySection id="property-position" title="Position & Size" defaultOpen>
          <PositionControls key={activeDecalId} decal={activeDecal} updateVisuals={updateVisuals} saveHistory={saveHistory} />
        </PropertySection>

        {/* Z-Depth & Smear Controllers */}
        {activeDecal.placementMode !== 'wrap' && (
          <PropertySection id="property-projection" title="3D Projection">
            <div className="flex items-center justify-end pr-1 border-b border-black/[0.02] pb-2">
              <button
                type="button"
                onClick={() => {
                  saveHistory();
                  updateVisuals({
                    zDepth: defaults.zDepth ?? 0.12,
                    angleLimit: defaults.angleLimit ?? 65,
                  });
                }}
                className="text-neutral-400 hover:text-black transition-colors outline-none"
                title="Reset Projection"
              >
                <RotateCcw size={12} strokeWidth={1.5} />
              </button>
            </div>

            <SliderControl
              prop={{
                id: 'zDepth',
                label: 'Projection Depth',
                type: 'slider',
                min: 0.01,
                max: 15,
                step: 0.01,
              }}
              activeDecal={activeDecal}
              updateVisuals={updateVisuals}
              saveHistory={saveHistory}
            />

            <p className="text-[10px] leading-relaxed text-neutral-400">Higher projection depth can reach around curved fabric and may affect unintended surfaces. Increase it gradually.</p>
            <SliderControl
              prop={{
                id: 'angleLimit',
                label: 'Surface Angle Limit',
                type: 'slider',
                min: 10,
                max: 90,
                step: 1,
              }}
              activeDecal={activeDecal}
              updateVisuals={updateVisuals}
              saveHistory={saveHistory}
            />
          </PropertySection>
        )}

        {groupsForTab('layout').map((group) => (
          <PropertySection key={group.id} id={`property-${group.id}`} title={group.title}>
            <div className="space-y-4">{group.properties.map(renderControl)}</div>
          </PropertySection>
        ))}
        </>}

        {activePropertyTab === 'content' && <>
        {isImageOrDrawing && (
          <button
            type="button"
            onClick={() => applyBackgroundRemoval(activeDecalId)}
            disabled={isProcessingBgRemoval}
            className="studio-property-action w-full flex items-center justify-center gap-2 disabled:opacity-50 rounded-xl p-3 text-[11px] uppercase tracking-[0.1em] font-medium transition-all outline-none"
          >
            {isProcessingBgRemoval ? (
              <>
                <Loader2 className="animate-spin" size={14} strokeWidth={1.5} /> Processing
              </>
            ) : (
              <>
                <Sparkles size={14} strokeWidth={1.5} /> Remove Background
              </>
            )}
          </button>
        )}

        {/* Font Size Controller */}
        {activeDecal.type === 'text' && (
          <PropertySection id="property-font-size" title="Font Size" defaultOpen>
            <div className="flex items-center justify-end pr-1 border-b border-black/[0.02] pb-2">
              <button
                type="button"
                onClick={() => {
                  saveHistory();
                  updateVisuals({ fontSize: defaults.fontSize });
                }}
                className="text-neutral-400 hover:text-black transition-colors outline-none"
                title="Reset Font Size"
              >
                <RotateCcw size={12} strokeWidth={1.5} />
              </button>
            </div>
            <SliderControl
              prop={{
                id: 'fontSize',
                label: 'Font Size',
                type: 'slider',
                min: 8,
                max: 400,
                step: 1,
              }}
              activeDecal={activeDecal}
              updateVisuals={updateVisuals}
              saveHistory={saveHistory}
            />
          </PropertySection>
        )}

        {groupsForTab('content').map((group) => (
          <PropertySection key={group.id} id={`property-${group.id}`} title={group.title} defaultOpen>
            <div className="flex items-center justify-end border-b border-black/[0.02] pb-2">
              <button type="button" onClick={() => { saveHistory(); const resetValues: Partial<DecalData> = {}; group.properties.forEach((property) => { (resetValues as Record<string, unknown>)[property.id] = defaults[property.id as keyof DecalData]; }); updateVisuals(resetValues); }} className="studio-reset-action text-[10px]" title={`Reset ${group.title}`}>
                <RotateCcw size={12} strokeWidth={1.5} /> Reset
              </button>
            </div>
            <div className="space-y-4">{group.properties.map(renderControl)}</div>
          </PropertySection>
        ))}
        </>}

        {activePropertyTab === 'style' && groupsForTab('style').map((group) => (
          <PropertySection key={group.id} id={`property-${group.id}`} title={group.title} defaultOpen={group.id === 'appearance' || group.id === 'image-appearance'}>
            <div className="flex items-center justify-end border-b border-black/[0.02] pb-2">
              <button type="button" onClick={() => { saveHistory(); const resetValues: Partial<DecalData> = {}; group.properties.forEach((property) => { (resetValues as Record<string, unknown>)[property.id] = defaults[property.id as keyof DecalData]; }); updateVisuals(resetValues); }} className="studio-reset-action text-[10px]" title={`Reset ${group.title}`}>
                <RotateCcw size={12} strokeWidth={1.5} /> Reset
              </button>
            </div>
            <div className="space-y-4">{group.properties.map(renderControl)}</div>
          </PropertySection>
        ))}

        {activePropertyTab === 'effects' && groupsForTab('effects').map((group) => (
          <PropertySection key={group.id} id={`property-${group.id}`} title={group.title}>
            <div className="flex items-center justify-end border-b border-black/[0.02] pb-2">
              <button type="button" onClick={() => { saveHistory(); const resetValues: Partial<DecalData> = {}; group.properties.forEach((property) => { (resetValues as Record<string, unknown>)[property.id] = defaults[property.id as keyof DecalData]; }); updateVisuals(resetValues); }} className="studio-reset-action text-[10px]" title={`Reset ${group.title}`}>
                <RotateCcw size={12} strokeWidth={1.5} /> Reset
              </button>
            </div>
            <div className="space-y-4">{group.properties.map(renderControl)}</div>
          </PropertySection>
        ))}
        </div>
      </div>
    </>
  );
}
