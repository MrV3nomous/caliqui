import { Loader2, RotateCcw, Sparkles } from 'lucide-react';
import type React from 'react';
import { useRef, useState } from 'react';
import { Label } from '@/ui/design-system';
import {
  applyImageFilters,
  type DecalData,
  generateAssetTexture,
  getDefaultConfig,
  useEditorStore,
} from '@/ui/store/editor-store';
import { type PropertyDef, TOOL_CONFIG_MAP } from './properties/config';

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

  const rawValue = isScale
    ? (activeDecal.scaleX ?? activeDecal.scale)
    : activeDecal[prop.id as keyof DecalData];

  const effectiveValue = typeof rawValue === 'number' ? rawValue : (prop.min ?? 0);

  let calculatedDisplay = 0;
  if (isRotation) {
    calculatedDisplay = Math.round(effectiveValue * (180 / Math.PI));
  } else if (isScale) {
    calculatedDisplay = Math.round(effectiveValue * 100);
  } else {
    calculatedDisplay = Number(Number(effectiveValue).toFixed(2));
  }

  const [localText, setLocalText] = useState<string>(String(calculatedDisplay));
  const [isFocused, setIsFocused] = useState(false);

  const commitValue = (valStr: string) => {
    let num = Number(valStr);
    if (Number.isNaN(num)) return;

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
    <div className="space-y-3 min-w-0" key={prop.id}>
      <div className="flex justify-between items-center">
        <Label className="text-[9px] font-medium text-neutral-400 uppercase tracking-[0.2em] block m-0">
          {prop.label}
        </Label>
      </div>
      <div className="flex gap-4 items-center bg-[#fbfbfd] border border-black/[0.04] p-2 rounded-2xl transition-all hover:border-black/10">
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
        <div className="flex items-center justify-center w-12 shrink-0 bg-white border border-black/5 rounded-xl px-1 py-1.5 shadow-sm">
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
  const safeColorValue = value === 'transparent' || !value ? '#000000' : value;
  const storeDisplayValue = value === 'transparent' ? 'TRANSPARENT' : safeColorValue;

  const [localText, setLocalText] = useState(storeDisplayValue);
  const [isFocused, setIsFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <div className="space-y-3 min-w-0" key={prop.id}>
      <Label className="text-[9px] font-medium text-neutral-400 uppercase tracking-[0.2em] block m-0">
        {prop.label}
      </Label>
      <div className="flex gap-3 p-2 bg-[#fbfbfd] border border-black/[0.04] hover:border-black/10 transition-all rounded-2xl items-center">
        {/* FLAWLESS COLOR PICKER: Hidden input triggered by a pure CSS circle */}
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="w-8 h-8 rounded-full border border-black/10 shrink-0 shadow-inner relative overflow-hidden outline-none flex items-center justify-center bg-[url('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAwAAAAMCAIAAADZF8uwAAAAGUlEQVQYV2M4gwH+YwCGIasIUwhT25BVBADtzYNYnXFmQAAAAABJRU5ErkJggg==')]"
        >
          <div
            className="absolute inset-0"
            style={{
              backgroundColor: safeColorValue === 'transparent' ? 'transparent' : safeColorValue,
            }}
          />
          <input
            ref={inputRef}
            type="color"
            value={safeColorValue === 'transparent' ? '#000000' : safeColorValue}
            onPointerDown={() => saveHistory()}
            onChange={(e) => updateVisuals({ [prop.id]: e.target.value })}
            className="opacity-0 absolute inset-0 w-full h-full cursor-pointer"
          />
        </button>

        <input
          type="text"
          value={isFocused ? localText : storeDisplayValue}
          onFocus={() => {
            setLocalText(storeDisplayValue);
            setIsFocused(true);
            saveHistory();
          }}
          onChange={(e) => setLocalText(e.target.value)}
          onBlur={() => {
            setIsFocused(false);
            let finalColor = localText.trim();
            if (finalColor.toLowerCase() === 'transparent') {
              updateVisuals({ [prop.id]: 'transparent' });
              return;
            }
            const ctx = document.createElement('canvas').getContext('2d');
            if (ctx && finalColor) {
              ctx.fillStyle = finalColor;
              finalColor = ctx.fillStyle;
            }
            if (finalColor !== value) updateVisuals({ [prop.id]: finalColor });
          }}
          onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
          className="flex-1 font-mono uppercase text-[11px] tracking-widest font-medium bg-transparent border-0 text-black px-2 outline-none"
        />
      </div>
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

  return (
    <div className="space-y-3 min-w-0" key={prop.id}>
      <Label className="text-[9px] font-medium text-neutral-400 uppercase tracking-[0.2em] block m-0">
        {prop.label}
      </Label>
      <div className="bg-[#fbfbfd] border border-black/[0.04] p-1.5 rounded-2xl transition-all hover:border-black/10">
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
          className="w-full bg-transparent border-0 rounded-xl text-[11px] tracking-wide font-medium text-black p-2 outline-none"
        />
      </div>
    </div>
  );
}

export function PropertiesPanel({ activeDecalId }: { activeDecalId: string }) {
  const { decals, updateDecal, saveHistory, applyBackgroundRemoval, isProcessingBgRemoval } =
    useEditorStore();

  const activeDecal = decals.find((d) => d.id === activeDecalId);
  if (!activeDecal) return null;

  const defaults = getDefaultConfig(activeDecal.type);
  const isImageOrDrawing = activeDecal.type === 'image' || activeDecal.type === 'drawing';

  const updateVisuals = async (updates: Partial<DecalData>) => {
    updateDecal(activeDecalId, updates);

    const nonRedrawProps = ['position', 'rotation', 'scale', 'scaleX', 'scaleY', 'rotationOffset'];
    const needsRedraw = Object.keys(updates).some((key) => !nonRedrawProps.includes(key));
    if (!needsRedraw) return;

    const decal = useEditorStore.getState().decals.find((d) => d.id === activeDecalId);
    if (!decal) return;

    const updatedDecal = { ...decal, ...updates };

    if (updatedDecal.type === 'image' || updatedDecal.type === 'drawing') {
      const { src: newSrc, aspectRatio } = await applyImageFilters(updatedDecal);
      updateDecal(activeDecalId, { src: newSrc, aspectRatio });
    } else {
      const baseSrc = generateAssetTexture(updatedDecal);
      const { src: finalSrc, aspectRatio } = await applyImageFilters({
        ...updatedDecal,
        originalSrc: baseSrc,
      });
      updateDecal(activeDecalId, { src: finalSrc, aspectRatio });
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
          <div className="space-y-3 min-w-0" key={prop.id}>
            <Label className="text-[9px] font-medium text-neutral-400 uppercase tracking-[0.2em] block m-0">
              {prop.label}
            </Label>
            <div className="bg-[#fbfbfd] border border-black/[0.04] hover:border-black/10 p-1.5 rounded-2xl transition-all">
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
      case 'button-group':
        return (
          <div className="space-y-3 min-w-0" key={prop.id}>
            <Label className="text-[9px] font-medium text-neutral-400 uppercase tracking-[0.2em] block m-0">
              {prop.label}
            </Label>
            <div className="flex bg-[#fbfbfd] border border-black/[0.04] p-1.5 rounded-2xl justify-between gap-1 overflow-hidden">
              {prop.options?.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  className={`flex-1 flex justify-center items-center text-[11px] py-2 rounded-xl transition-all outline-none min-w-0 ${
                    value === opt.value
                      ? 'bg-white shadow-sm text-black font-medium border border-black/5'
                      : 'text-neutral-400 hover:text-black font-medium'
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

  return (
    <div className="flex flex-col gap-8 pt-4 pb-6">
      {isImageOrDrawing && (
        <button
          type="button"
          onClick={() => applyBackgroundRemoval(activeDecalId)}
          disabled={isProcessingBgRemoval}
          className="w-full flex items-center justify-center gap-2 bg-gradient-to-tr from-neutral-50 to-neutral-100 hover:from-neutral-100 hover:to-neutral-200 border border-black/[0.04] hover:border-black/10 disabled:opacity-50 text-black rounded-2xl p-3 text-[11px] uppercase tracking-[0.1em] font-medium transition-all shadow-sm outline-none"
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

      {activeConfigGroups.map((group) => (
        <div key={group.id} className="space-y-4 min-w-0">
          <div className="flex items-center justify-between pr-1 border-b border-black/[0.02] pb-2">
            <h4 className="text-[10px] font-medium text-neutral-500 uppercase tracking-[0.25em] pl-1">
              {group.title}
            </h4>
            <button
              type="button"
              onClick={() => {
                saveHistory();
                group.properties.forEach((p) => {
                  updateVisuals({ [p.id]: defaults[p.id as keyof DecalData] });
                });
              }}
              className="text-neutral-400 hover:text-black transition-colors outline-none"
              title="Reset Section"
            >
              <RotateCcw size={12} strokeWidth={1.5} />
            </button>
          </div>
          <div className="space-y-6">{group.properties.map(renderControl)}</div>
        </div>
      ))}
    </div>
  );
}
