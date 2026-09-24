import {
  AlertCircle,
  ArrowRight,
  Badge,
  Bookmark,
  Box,
  Camera,
  Circle,
  ClipboardPaste,
  Cloud,
  Command,
  Copy,
  CopyPlus,
  Cross,
  Diamond,
  Droplet,
  Eraser,
  Files,
  Flame,
  Hand,
  Heart,
  Hexagon,
  Library,
  Loader2,
  MessageCircle,
  MousePointer2,
  Octagon,
  PaintBucket,
  Paintbrush,
  Palette,
  Pentagon,
  Pill,
  RectangleHorizontal,
  Redo2,
  RefreshCw,
  Scissors,
  Shapes,
  Shield,
  Sparkles,
  Square,
  SquareDashed,
  Star,
  Sun,
  Trash2,
  Triangle,
  Type,
  Undo2,
  UploadCloud,
  Wand2,
} from 'lucide-react';
import type React from 'react';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { processAndCompressImage } from '@/shared/utils/image-processing';
import {
  type CameraView,
  type GlobalToolType,
  type ShapeType,
  useEditorStore,
} from '@/ui/store/editor-store';

const SHAPE_LIBRARY: { type: ShapeType; icon: React.ReactNode; label: string }[] = [
  { type: 'rectangle', icon: <Square size={14} strokeWidth={1.5} />, label: 'Rectangle' },
  { type: 'circle', icon: <Circle size={14} strokeWidth={1.5} />, label: 'Circle' },
  { type: 'triangle', icon: <Triangle size={14} strokeWidth={1.5} />, label: 'Triangle' },
  { type: 'star', icon: <Star size={14} strokeWidth={1.5} />, label: 'Star' },
  { type: 'diamond', icon: <Diamond size={14} strokeWidth={1.5} />, label: 'Diamond' },
  { type: 'hexagon', icon: <Hexagon size={14} strokeWidth={1.5} />, label: 'Hexagon' },
  { type: 'octagon', icon: <Octagon size={14} strokeWidth={1.5} />, label: 'Octagon' },
  { type: 'pentagon', icon: <Pentagon size={14} strokeWidth={1.5} />, label: 'Pentagon' },
  {
    type: 'ellipse',
    icon: <Circle size={14} strokeWidth={1.5} className="scale-x-125" />,
    label: 'Ellipse',
  },
  { type: 'capsule', icon: <Pill size={14} strokeWidth={1.5} />, label: 'Capsule' },
  { type: 'cross', icon: <Cross size={14} strokeWidth={1.5} />, label: 'Cross' },
  { type: 'heart', icon: <Heart size={14} strokeWidth={1.5} />, label: 'Heart' },
  { type: 'cloud', icon: <Cloud size={14} strokeWidth={1.5} />, label: 'Cloud' },
  { type: 'arrow', icon: <ArrowRight size={14} strokeWidth={1.5} />, label: 'Arrow' },
  {
    type: 'parallelogram',
    icon: <RectangleHorizontal size={14} strokeWidth={1.5} className="skew-x-12" />,
    label: 'Parallelo',
  },
  { type: 'trapezoid', icon: <Box size={14} strokeWidth={1.5} />, label: 'Trapezoid' },
  { type: 'chat-bubble', icon: <MessageCircle size={14} strokeWidth={1.5} />, label: 'Bubble' },
  { type: 'shield', icon: <Shield size={14} strokeWidth={1.5} />, label: 'Shield' },
  { type: 'badge', icon: <Badge size={14} strokeWidth={1.5} />, label: 'Badge' },
  { type: 'bookmark', icon: <Bookmark size={14} strokeWidth={1.5} />, label: 'Bookmark' },
];

const EFFECTS_LIBRARY: { id: GlobalToolType; icon: React.ReactNode; label: string }[] = [
  { id: 'fill', icon: <PaintBucket size={14} strokeWidth={1.5} />, label: 'Fill' },
  { id: 'blur', icon: <Droplet size={14} strokeWidth={1.5} />, label: 'Blur' },
  { id: 'burn', icon: <Flame size={14} strokeWidth={1.5} />, label: 'Burn' },
  { id: 'saturate', icon: <Sun size={14} strokeWidth={1.5} />, label: 'Saturate' },
];

// Refined, ultra-clear glassmorphism matching VisionOS
const GLASS_BASE =
  'bg-white/70 backdrop-blur-[40px] saturate-[1.8] border border-white/60 ring-1 ring-black/[0.04]';

export function Toolbar() {
  const {
    addTool,
    setDrawingMode,
    isDrawingMode,
    globalToolMode,
    setGlobalToolMode,
    userAssets,
    addUserAsset,
    removeUserAsset,
    replaceUserAsset,
    undo,
    redo,
    cut,
    copy,
    paste,
    duplicate,
    deleteSelected,
    past,
    future,
    dispatchAiCommand,
    isAiProcessing,
    aiFeedbackMessage,
    setCameraView,
    setSelectedId,
  } = useEditorStore();

  const fileInputRef = useRef<HTMLInputElement>(null);
  const replaceInputRef = useRef<HTMLInputElement>(null);

  // Smart Pane Architecture State
  const [activePane, setActivePane] = useState<0 | 1 | 2>(0);
  const [activePopup, setActivePopup] = useState<
    'library' | 'shapes' | 'effects' | 'ai' | 'camera' | null
  >(null);

  const [aiPrompt, setAiPrompt] = useState('');
  const [replaceTargetId, setReplaceTargetId] = useState<string | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const popupRef = useRef<HTMLDivElement>(null); // Added dedicated ref for the portals

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;

      const isOutsideContainer = containerRef.current && !containerRef.current.contains(target);
      const isOutsidePopup = !popupRef.current?.contains(target);

      if (isOutsideContainer && isOutsidePopup) {
        setActivePopup(null);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const togglePopup = (popup: 'library' | 'shapes' | 'effects' | 'ai' | 'camera') => {
    setActivePopup(activePopup === popup ? null : popup);
  };

  const cyclePane = () => {
    setActivePane((prev) => ((prev + 1) % 3) as 0 | 1 | 2);
    setActivePopup(null);
  };

  const processFile = async (file: File) => {
    try {
      const { blob, aspectRatio } = await processAndCompressImage(file);
      const blobUrl = await addUserAsset(blob, aspectRatio);
      addTool('image', blobUrl, undefined, { aspectRatio });
      setActivePopup(null);
    } catch (error) {
      console.error('Upload failed', error);
      alert((error as Error).message);
    }
  };

  const processReplacement = async (file: File) => {
    if (!replaceTargetId) return;
    try {
      const { blob, aspectRatio } = await processAndCompressImage(file);
      await replaceUserAsset(replaceTargetId, blob, aspectRatio);
      setReplaceTargetId(null);
    } catch (error) {
      console.error('Replacement failed', error);
      alert((error as Error).message);
    }
  };

  const handleAiSubmit = async () => {
    if (!aiPrompt.trim() || isAiProcessing) return;
    await dispatchAiCommand(aiPrompt);
    if (!useEditorStore.getState().aiFeedbackMessage) {
      setAiPrompt('');
      setActivePopup(null);
    }
  };

  const activeEffect = EFFECTS_LIBRARY.find((effect) => effect.id === globalToolMode);

  // Exquisitely crafted internal tool buttons
  const ToolButton = ({
    active,
    onClick,
    children,
    title,
    className = '',
  }: {
    active?: boolean;
    onClick: (e: React.MouseEvent<HTMLButtonElement>) => void;
    children: React.ReactNode;
    title: string;
    className?: string;
  }) => (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className={`w-9 h-9 sm:w-10 sm:h-10 flex items-center justify-center rounded-full shrink-0 transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] outline-none ${
        active
          ? 'bg-neutral-900 text-white shadow-[0_4px_16px_rgba(0,0,0,0.25)] scale-105'
          : 'text-neutral-500 hover:bg-black/5 hover:text-black hover:scale-105 active:scale-95'
      } ${className}`}
    >
      {children}
    </button>
  );

  const Divider = () => <div className="w-px h-5 bg-black/[0.08] mx-0.5 sm:mx-1 shrink-0" />;

  const renderPortal = (content: React.ReactNode) => {
    if (typeof document === 'undefined') return null;
    return createPortal(content, document.body);
  };

  // Popups dynamically inherit the luxurious ambient glow of the active pane
  const popupClasses = `fixed bottom-24 left-1/2 -translate-x-1/2 z-[500] p-6 rounded-[2rem] animate-in zoom-in-95 slide-in-from-bottom-2 duration-400 ease-[cubic-bezier(0.16,1,0.3,1)] cursor-default transition-all ${GLASS_BASE} ${
    activePane === 0
      ? 'shadow-[0_24px_64px_-12px_rgba(79,70,229,0.25)]'
      : activePane === 1
        ? 'shadow-[0_24px_64px_-12px_rgba(244,63,94,0.25)]'
        : 'shadow-[0_24px_64px_-12px_rgba(245,158,11,0.25)]'
  }`;

  return (
    <div
      ref={containerRef}
      className="relative flex flex-col items-center justify-end w-full select-none"
    >
      {/* ---------------------------------------------------- */}
      {/* SECONDARY LAYER: LUXURY FLOATING POPUPS                */}
      {/* ---------------------------------------------------- */}
      {activePopup === 'library' &&
        renderPortal(
          <div ref={popupRef} className={`${popupClasses} w-[340px]`}>
            <div className="pb-4 mb-4 border-b border-black/[0.04] flex justify-between items-center px-1">
              <span className="text-[10px] font-semibold text-neutral-500 uppercase tracking-[0.2em]">
                My Assets
              </span>
              <span
                className={`text-[9px] font-bold px-2 py-0.5 rounded-full tracking-widest ${userAssets.length >= 6 ? 'bg-red-50 text-red-500' : 'bg-neutral-100 text-neutral-500'}`}
              >
                {userAssets.length}/6 Saved
              </span>
            </div>

            <input
              type="file"
              ref={fileInputRef}
              onChange={(e) => {
                if (e.target.files?.[0]) processFile(e.target.files[0]);
                e.target.value = '';
              }}
              accept="image/*"
              className="hidden"
            />
            <input
              type="file"
              ref={replaceInputRef}
              onChange={(e) => {
                if (e.target.files?.[0]) processReplacement(e.target.files[0]);
                e.target.value = '';
              }}
              accept="image/*"
              className="hidden"
            />

            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={userAssets.length >= 6}
              className={`w-full flex flex-col items-center justify-center gap-3 bg-black/[0.02] border border-black/[0.04] rounded-[1.5rem] p-6 transition-all duration-400 ease-out mb-5 outline-none ${userAssets.length >= 6 ? 'opacity-50 cursor-not-allowed' : 'hover:bg-white hover:border-black/10 hover:shadow-sm hover:scale-[1.02] active:scale-95'}`}
            >
              <UploadCloud size={20} strokeWidth={1.5} className="text-neutral-400" />
              <span className="text-[10px] uppercase tracking-[0.1em] font-semibold text-neutral-500">
                {userAssets.length >= 6 ? 'Storage Full' : 'Click to Upload'}
              </span>
            </button>

            <div className="grid grid-cols-3 gap-3 max-h-[220px] overflow-y-auto pr-1 hide-scrollbar">
              {userAssets.map((asset) => (
                <div
                  key={asset.id}
                  className="relative group aspect-square rounded-[1.2rem] overflow-hidden bg-black/[0.03] transition-all hover:shadow-md"
                >
                  <button
                    type="button"
                    className="w-full h-full p-2.5 flex items-center justify-center outline-none"
                    onClick={() => {
                      addTool('image', asset.src, undefined, { aspectRatio: asset.aspectRatio });
                      setActivePopup(null);
                    }}
                  >
                    <img
                      src={asset.src}
                      alt="Saved"
                      className="max-w-full max-h-full object-contain drop-shadow-sm transition-transform duration-500 ease-out group-hover:scale-110"
                    />
                  </button>
                  <div className="absolute top-1.5 right-1.5 flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-all duration-300">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setReplaceTargetId(asset.id);
                        replaceInputRef.current?.click();
                      }}
                      title="Replace Asset"
                      className="p-1.5 bg-white/95 text-neutral-500 hover:text-blue-500 rounded-full shadow-sm outline-none hover:scale-110 active:scale-95 transition-transform"
                    >
                      <RefreshCw size={12} strokeWidth={2} />
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        removeUserAsset(asset.id);
                      }}
                      title="Delete Asset"
                      className="p-1.5 bg-white/95 text-neutral-500 hover:text-red-500 rounded-full shadow-sm outline-none hover:scale-110 active:scale-95 transition-transform"
                    >
                      <Trash2 size={12} strokeWidth={1.5} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>,
        )}

      {activePopup === 'shapes' &&
        renderPortal(
          <div ref={popupRef} className={`${popupClasses} w-[300px] md:w-[360px]`}>
            <div className="pb-4 mb-4 border-b border-black/[0.04] text-[10px] font-semibold text-neutral-500 uppercase tracking-[0.2em] px-1">
              Shape Library
            </div>
            <div className="grid grid-cols-4 gap-2">
              {SHAPE_LIBRARY.map((shape) => (
                <button
                  key={shape.type}
                  type="button"
                  onClick={() => {
                    addTool('shape', undefined, shape.type);
                    setActivePopup(null);
                  }}
                  className="flex flex-col items-center justify-center gap-2 p-3 text-[9px] uppercase tracking-widest font-semibold text-neutral-500 hover:bg-white hover:shadow-sm hover:text-black rounded-[1.2rem] transition-all duration-300 hover:scale-105 active:scale-95 outline-none"
                >
                  {shape.icon}
                  <span className="truncate w-full text-center">{shape.label}</span>
                </button>
              ))}
            </div>
          </div>,
        )}

      {activePopup === 'effects' &&
        renderPortal(
          <div ref={popupRef} className={`${popupClasses} w-[280px]`}>
            <div className="pb-4 mb-4 border-b border-black/[0.04] flex justify-between items-center px-1">
              <span className="text-[10px] font-semibold text-neutral-500 uppercase tracking-[0.2em]">
                Magic Effects
              </span>
              {!!activeEffect && (
                <button
                  type="button"
                  onClick={() => {
                    setGlobalToolMode('default');
                    setActivePopup(null);
                  }}
                  className="px-3 py-1 bg-red-50 text-red-500 hover:bg-red-100 text-[9px] font-bold uppercase tracking-widest rounded-full transition-colors outline-none"
                >
                  Clear
                </button>
              )}
            </div>
            <div className="grid grid-cols-2 gap-3">
              {EFFECTS_LIBRARY.map((effect) => (
                <button
                  key={effect.id}
                  type="button"
                  onClick={() => {
                    setGlobalToolMode(globalToolMode === effect.id ? 'default' : effect.id);
                    setActivePopup(null);
                  }}
                  className={`flex flex-col items-center justify-center gap-2 p-4 text-[10px] uppercase tracking-widest font-semibold rounded-[1.2rem] transition-all duration-300 outline-none active:scale-95 ${globalToolMode === effect.id ? 'bg-black text-white shadow-md scale-105' : 'text-neutral-500 bg-black/[0.02] hover:bg-white hover:shadow-sm hover:text-black hover:scale-105'}`}
                >
                  {effect.icon}
                  <span>{effect.label}</span>
                </button>
              ))}
            </div>
          </div>,
        )}

      {activePopup === 'camera' &&
        renderPortal(
          <div ref={popupRef} className={`${popupClasses} w-[260px]`}>
            <div className="pb-4 mb-4 border-b border-black/[0.04] text-[10px] font-semibold text-neutral-500 uppercase tracking-[0.2em] px-1">
              Camera Views
            </div>
            <div className="grid grid-cols-2 gap-2">
              {(['front', 'back', 'left', 'right', 'top'] as CameraView[]).map((view) => (
                <button
                  key={view}
                  type="button"
                  onClick={() => {
                    setCameraView(view);
                    setActivePopup(null);
                  }}
                  className={`flex items-center justify-center p-3 text-[10px] uppercase tracking-[0.1em] font-semibold rounded-xl transition-all duration-300 outline-none bg-black/[0.02] hover:bg-white hover:shadow-sm text-neutral-600 hover:text-black hover:scale-105 active:scale-95 ${view === 'top' ? 'col-span-2' : ''}`}
                >
                  {view}
                </button>
              ))}
            </div>
          </div>,
        )}

      {activePopup === 'ai' &&
        renderPortal(
          <div ref={popupRef} className={`${popupClasses} w-[320px] md:w-[400px]`}>
            <div className="pb-4 mb-4 border-b border-black/[0.04] text-[10px] font-semibold text-neutral-500 uppercase tracking-[0.2em] px-1 flex items-center gap-2">
              <Sparkles size={14} strokeWidth={1.5} /> AI Studio Assistant
            </div>
            <textarea
              value={aiPrompt}
              onChange={(e) => setAiPrompt(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleAiSubmit();
                }
              }}
              placeholder="Describe edits (e.g. 'Make the logo smaller and red')..."
              className="w-full bg-black/[0.02] border border-black/5 rounded-2xl p-4 text-xs tracking-wide text-black focus:bg-white focus:border-black/20 focus:shadow-sm outline-none resize-none min-h-[120px] placeholder:text-neutral-400 transition-all duration-300"
              disabled={isAiProcessing}
            />
            <div className="mt-4 flex justify-between items-center px-1">
              <span className="text-[10px] text-neutral-400 tracking-wider">
                Press Enter to send
              </span>
              <button
                type="button"
                onClick={handleAiSubmit}
                disabled={isAiProcessing || !aiPrompt.trim()}
                className="bg-black hover:bg-neutral-800 disabled:bg-neutral-200 disabled:text-neutral-400 text-white px-6 py-2.5 rounded-full text-[10px] uppercase tracking-[0.1em] font-bold transition-all duration-300 shadow-[0_4px_12px_rgba(0,0,0,0.2)] flex items-center gap-2 outline-none hover:scale-105 active:scale-95"
              >
                {isAiProcessing ? (
                  <Loader2 size={14} strokeWidth={1.5} className="animate-spin" />
                ) : (
                  'Apply'
                )}
              </button>
            </div>
            {aiFeedbackMessage && (
              <div className="mt-4 p-3.5 bg-red-50 text-red-600 text-[11px] font-medium tracking-wide rounded-xl flex items-start gap-2 border border-red-100">
                <AlertCircle size={14} strokeWidth={1.5} className="shrink-0 mt-0.5" />
                {aiFeedbackMessage}
              </div>
            )}
          </div>,
        )}

      {/* ---------------------------------------------------- */}
      {/* TIER 1: THE SMART GLOWING SWITCH CAPSULE               */}
      {/* ---------------------------------------------------- */}
      <div
        className={`p-1.5 sm:p-2 rounded-full pointer-events-auto flex items-center z-50 transition-all duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] ${GLASS_BASE} ${
          activePane === 0
            ? 'shadow-[0_8px_40px_-10px_rgba(79,70,229,0.35)]'
            : activePane === 1
              ? 'shadow-[0_8px_40px_-10px_rgba(244,63,94,0.35)]'
              : 'shadow-[0_8px_40px_-10px_rgba(245,158,11,0.35)]'
        }`}
      >
        {/* The Master Toggle: Dark Border with Ultralight Color Fill */}
        <button
          type="button"
          onClick={cyclePane}
          title="Switch Tools"
          className={`relative flex flex-col items-center justify-center w-11 h-11 sm:w-12 sm:h-12 rounded-full shrink-0 transition-all duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] outline-none hover:scale-[1.08] active:scale-95 border-[1.5px] border-neutral-800 ${
            activePane === 0
              ? 'bg-gradient-to-b from-white to-indigo-100/80 text-neutral-900 shadow-[0_4px_20px_rgba(79,70,229,0.3)]'
              : activePane === 1
                ? 'bg-gradient-to-b from-white to-rose-100/80 text-neutral-900 shadow-[0_4px_20px_rgba(244,63,94,0.3)]'
                : 'bg-gradient-to-b from-white to-amber-100/80 text-neutral-900 shadow-[0_4px_20px_rgba(245,158,11,0.3)]'
          }`}
        >
          {/* Refined Semantic Icons */}
          {activePane === 0 && (
            <Command
              key="p0"
              size={18}
              strokeWidth={2.5}
              className="mb-0.5 animate-in zoom-in duration-500"
            />
          )}
          {activePane === 1 && (
            <Files
              key="p1"
              size={18}
              strokeWidth={2.5}
              className="mb-0.5 animate-in zoom-in duration-500"
            />
          )}
          {activePane === 2 && (
            <Palette
              key="p2"
              size={18}
              strokeWidth={2.5}
              className="mb-0.5 animate-in zoom-in duration-500"
            />
          )}

          {/* Ultra-precise Dark Dots */}
          <div className="absolute bottom-1.5 flex gap-[3px]">
            <div
              className={`w-1 h-1 rounded-full transition-all duration-500 ${activePane === 0 ? 'bg-neutral-800 scale-125' : 'bg-neutral-800/20'}`}
            />
            <div
              className={`w-1 h-1 rounded-full transition-all duration-500 ${activePane === 1 ? 'bg-neutral-800 scale-125' : 'bg-neutral-800/20'}`}
            />
            <div
              className={`w-1 h-1 rounded-full transition-all duration-500 ${activePane === 2 ? 'bg-neutral-800 scale-125' : 'bg-neutral-800/20'}`}
            />
          </div>
        </button>

        <div className="w-px h-7 bg-black/[0.08] mx-1 sm:mx-1.5 shrink-0" />

        {/* Dynamic Tool Wrapper */}
        <div
          key={`pane-${activePane}`}
          className="flex items-center gap-0.5 animate-in fade-in zoom-in-95 slide-in-from-left-2 duration-500 ease-[cubic-bezier(0.16,1,0.3,1)]"
        >
          {/* PANE 0: Navigation & Basic Edit (Command / Cosmic Indigo) */}
          {activePane === 0 && (
            <>
              <ToolButton
                title="Select Area"
                active={globalToolMode === 'select'}
                onClick={() => setGlobalToolMode('select')}
              >
                <SquareDashed size={16} strokeWidth={1.5} />
              </ToolButton>
              <ToolButton
                title="Edit (V)"
                active={globalToolMode === 'default'}
                onClick={() => setGlobalToolMode('default')}
              >
                <MousePointer2 size={16} strokeWidth={1.5} />
              </ToolButton>
              <ToolButton
                title="Move Camera (Space)"
                active={globalToolMode === 'camera'}
                onClick={() => {
                  setGlobalToolMode('camera');
                  setSelectedId(null);
                }}
              >
                <Hand size={16} strokeWidth={1.5} />
              </ToolButton>

              <Divider />

              <ToolButton
                title="Undo"
                onClick={undo}
                className={past.length === 0 ? 'opacity-30 pointer-events-none' : ''}
              >
                <Undo2 size={16} strokeWidth={1.5} />
              </ToolButton>
              <ToolButton
                title="Redo"
                onClick={redo}
                className={future.length === 0 ? 'opacity-30 pointer-events-none' : ''}
              >
                <Redo2 size={16} strokeWidth={1.5} />
              </ToolButton>

              <Divider />

              <ToolButton
                title="Camera Views"
                active={activePopup === 'camera'}
                onClick={() => togglePopup('camera')}
              >
                <Camera size={16} strokeWidth={1.5} />
              </ToolButton>
            </>
          )}

          {/* PANE 1: Clipboard & Deletion Actions (Files / Aura Rose) */}
          {activePane === 1 && (
            <>
              <ToolButton title="Cut" onClick={cut}>
                <Scissors size={16} strokeWidth={1.5} />
              </ToolButton>
              <ToolButton title="Copy" onClick={copy}>
                <Copy size={16} strokeWidth={1.5} />
              </ToolButton>
              <ToolButton title="Paste" onClick={paste}>
                <ClipboardPaste size={16} strokeWidth={1.5} />
              </ToolButton>
              <ToolButton title="Duplicate" onClick={duplicate}>
                <CopyPlus size={16} strokeWidth={1.5} />
              </ToolButton>
              <Divider />
              <ToolButton
                title="Delete"
                onClick={deleteSelected}
                className="hover:!bg-red-50 hover:!text-red-600 text-red-500"
              >
                <Trash2 size={16} strokeWidth={1.5} />
              </ToolButton>
            </>
          )}

          {/* PANE 2: Creative & Generative Tools (Palette / Sunset Gold) */}
          {activePane === 2 && (
            <>
              <ToolButton title="Add Text" onClick={() => addTool('text')}>
                <Type size={16} strokeWidth={1.5} />
              </ToolButton>
              <ToolButton
                title="My Assets"
                active={activePopup === 'library'}
                onClick={() => togglePopup('library')}
              >
                <Library size={16} strokeWidth={1.5} />
              </ToolButton>
              <ToolButton
                title="Shapes"
                active={activePopup === 'shapes'}
                onClick={() => togglePopup('shapes')}
              >
                <Shapes size={16} strokeWidth={1.5} />
              </ToolButton>
              <Divider />
              <ToolButton
                title="Freehand Draw"
                active={isDrawingMode}
                onClick={() => {
                  setDrawingMode(true);
                  setGlobalToolMode('default');
                }}
              >
                <Paintbrush size={16} strokeWidth={1.5} />
              </ToolButton>
              <ToolButton
                title="Eraser"
                active={globalToolMode === 'erase'}
                onClick={() => setGlobalToolMode(globalToolMode === 'erase' ? 'default' : 'erase')}
              >
                <Eraser size={16} strokeWidth={1.5} />
              </ToolButton>
              <ToolButton
                title="Magic Effects"
                active={activePopup === 'effects' || !!activeEffect}
                onClick={() => togglePopup('effects')}
              >
                <Wand2 size={16} strokeWidth={1.5} />
              </ToolButton>
              <Divider />
              <ToolButton
                title="AI Assistant"
                active={activePopup === 'ai'}
                onClick={() => togglePopup('ai')}
                className={isAiProcessing ? '!bg-black !text-white shadow-md animate-pulse' : ''}
              >
                <Sparkles size={16} strokeWidth={1.5} />
              </ToolButton>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
