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
  Computer,
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

// Apple visionOS inspired glass material - high blur, low opacity, vibrant saturation
const GLASS_BASE =
  'bg-white/35 backdrop-blur-[48px] saturate-[1.8] border border-white/50 shadow-[0_8px_32px_rgba(0,0,0,0.08),0_1px_2px_rgba(0,0,0,0.04)]';
const SPRING_EASING = 'ease-[cubic-bezier(0.32,0.72,0,1)]';

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
  const [activePane, setActivePane] = useState<0 | 1 | 2 | 3>(0);
  const [activePopup, setActivePopup] = useState<
    'library' | 'shapes' | 'effects' | 'ai' | 'camera' | null
  >(null);

  const [aiPrompt, setAiPrompt] = useState('');
  const [replaceTargetId, setReplaceTargetId] = useState<string | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const popupRef = useRef<HTMLDivElement>(null);

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
    setActivePane((prev) => ((prev + 1) % 4) as 0 | 1 | 2 | 3);
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

  // Matte Space Black premium button for active states
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
      className={`w-9 h-9 sm:w-10 sm:h-10 flex items-center justify-center rounded-full shrink-0 transition-all duration-500 ${SPRING_EASING} outline-none ${
        active
          ? 'bg-[#1c1c1e] text-white shadow-[0_4px_12px_rgba(0,0,0,0.2),inset_0_1px_1px_rgba(255,255,255,0.15)] scale-[1.02]'
          : 'text-stone-600 hover:bg-stone-900/10 hover:text-stone-900 hover:scale-105 active:scale-95'
      } ${className}`}
    >
      {children}
    </button>
  );

  const Divider = () => (
    <div className="w-[1.5px] h-5 bg-stone-900/[0.08] rounded-full mx-0.5 sm:mx-1 shrink-0" />
  );

  const renderPortal = (content: React.ReactNode) => {
    if (typeof document === 'undefined') return null;
    return createPortal(content, document.body);
  };

  // Popups dramatically inherit ambient glowing RGB ambient diffusions
  const popupClasses = `fixed bottom-24 left-1/2 -translate-x-1/2 z-[500] p-6 rounded-[2rem] animate-in zoom-in-95 slide-in-from-bottom-2 duration-500 ${SPRING_EASING} cursor-default transition-all ${GLASS_BASE} ${
    activePane === 0
      ? 'shadow-[0_24px_80px_-12px_rgba(168,85,247,0.25)]' // Purple
      : activePane === 1
        ? 'shadow-[0_24px_80px_-12px_rgba(236,72,153,0.25)]' // Pink
        : activePane === 2
          ? 'shadow-[0_24px_80px_-12px_rgba(251,146,60,0.25)]' // Peach
          : 'shadow-[0_24px_80px_-12px_rgba(250,204,21,0.25)]' // Gold
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
            <div className="pb-4 mb-4 border-b border-stone-900/[0.06] flex justify-between items-center px-1">
              <span className="text-[10px] font-semibold text-stone-500 uppercase tracking-[0.2em]">
                My Assets
              </span>
              <span
                className={`text-[9px] font-bold px-2 py-0.5 rounded-full tracking-widest ${userAssets.length >= 6 ? 'bg-red-50 text-red-500' : 'bg-stone-900/5 text-stone-600'}`}
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
              className={`w-full flex flex-col items-center justify-center gap-3 bg-white/40 border border-white/60 rounded-[1.5rem] p-6 transition-all duration-500 ${SPRING_EASING} mb-5 outline-none ${userAssets.length >= 6 ? 'opacity-50 cursor-not-allowed' : 'hover:bg-white/60 hover:shadow-sm hover:scale-[1.02] active:scale-95'}`}
            >
              <UploadCloud size={20} strokeWidth={1.5} className="text-stone-500" />
              <span className="text-[10px] uppercase tracking-[0.1em] font-semibold text-stone-600">
                {userAssets.length >= 6 ? 'Storage Full' : 'Click to Upload'}
              </span>
            </button>

            <div className="grid grid-cols-3 gap-3 max-h-[220px] overflow-y-auto pr-1 hide-scrollbar">
              {userAssets.map((asset) => (
                <div
                  key={asset.id}
                  className="relative group aspect-square rounded-[1.2rem] overflow-hidden bg-white/40 border border-white/50 transition-all hover:shadow-md"
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
                      className={`max-w-full max-h-full object-contain drop-shadow-sm transition-transform duration-500 ${SPRING_EASING} group-hover:scale-110`}
                    />
                  </button>
                  <div
                    className={`absolute top-1.5 right-1.5 flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-all duration-300 ${SPRING_EASING}`}
                  >
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setReplaceTargetId(asset.id);
                        replaceInputRef.current?.click();
                      }}
                      title="Replace Asset"
                      className={`p-1.5 bg-white/90 backdrop-blur-md text-stone-600 hover:text-blue-500 rounded-full shadow-sm outline-none hover:scale-110 active:scale-95 transition-transform duration-300 ${SPRING_EASING}`}
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
                      className={`p-1.5 bg-white/90 backdrop-blur-md text-stone-600 hover:text-red-500 rounded-full shadow-sm outline-none hover:scale-110 active:scale-95 transition-transform duration-300 ${SPRING_EASING}`}
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
            <div className="pb-4 mb-4 border-b border-stone-900/[0.06] text-[10px] font-semibold text-stone-500 uppercase tracking-[0.2em] px-1">
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
                  className={`flex flex-col items-center justify-center gap-2 p-3 text-[9px] uppercase tracking-widest font-semibold text-stone-500 hover:bg-white/60 hover:shadow-sm hover:text-stone-900 rounded-[1.2rem] transition-all duration-300 ${SPRING_EASING} hover:scale-105 active:scale-95 outline-none`}
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
            <div className="pb-4 mb-4 border-b border-stone-900/[0.06] flex justify-between items-center px-1">
              <span className="text-[10px] font-semibold text-stone-500 uppercase tracking-[0.2em]">
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
                  className={`flex flex-col items-center justify-center gap-2 p-4 text-[10px] uppercase tracking-widest font-semibold rounded-[1.2rem] transition-all duration-500 ${SPRING_EASING} outline-none active:scale-95 ${
                    globalToolMode === effect.id
                      ? 'bg-[#1c1c1e] text-white shadow-[0_4px_12px_rgba(0,0,0,0.2),inset_0_1px_1px_rgba(255,255,255,0.15)] scale-[1.02]'
                      : 'text-stone-500 bg-white/40 border border-white/50 hover:bg-white/70 hover:shadow-sm hover:text-stone-900 hover:scale-105'
                  }`}
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
            <div className="pb-4 mb-4 border-b border-stone-900/[0.06] text-[10px] font-semibold text-stone-500 uppercase tracking-[0.2em] px-1">
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
                  className={`flex items-center justify-center p-3 text-[10px] uppercase tracking-[0.1em] font-semibold rounded-xl transition-all duration-500 ${SPRING_EASING} outline-none bg-white/40 border border-white/50 hover:bg-white/70 hover:shadow-sm text-stone-600 hover:text-stone-900 hover:scale-105 active:scale-95 ${view === 'top' ? 'col-span-2' : ''}`}
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
            <div className="pb-4 mb-4 border-b border-stone-900/[0.06] text-[10px] font-semibold text-stone-500 uppercase tracking-[0.2em] px-1 flex items-center gap-2">
              <Computer size={14} strokeWidth={1.5} /> AI Studio Assistant
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
              className={`w-full bg-white/40 border border-white/60 rounded-2xl p-4 text-xs tracking-wide text-stone-900 focus:bg-white/70 focus:border-white/80 focus:ring-4 focus:ring-stone-900/5 focus:shadow-sm outline-none resize-none min-h-[120px] placeholder:text-stone-400 transition-all duration-500 ${SPRING_EASING}`}
              disabled={isAiProcessing}
            />
            <div className="mt-4 flex justify-between items-center px-1">
              <span className="text-[10px] text-stone-400 tracking-wider">Press Enter to send</span>
              <button
                type="button"
                onClick={handleAiSubmit}
                disabled={isAiProcessing || !aiPrompt.trim()}
                className={`bg-[#1c1c1e] hover:bg-black disabled:bg-stone-200/50 disabled:text-stone-400 text-white px-6 py-2.5 rounded-full text-[10px] uppercase tracking-[0.1em] font-bold transition-all duration-500 ${SPRING_EASING} shadow-[0_4px_12px_rgba(0,0,0,0.2),inset_0_1px_1px_rgba(255,255,255,0.15)] flex items-center gap-2 outline-none hover:scale-105 active:scale-95`}
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
        className={`p-1.5 sm:p-2 rounded-full pointer-events-auto flex items-center z-50 transition-all duration-700 ${SPRING_EASING} ${GLASS_BASE} ${
          activePane === 0
            ? 'shadow-[0_12px_48px_-12px_rgba(168,85,247,0.35),0_0_24px_rgba(168,85,247,0.1)]' // Purple
            : activePane === 1
              ? 'shadow-[0_12px_48px_-12px_rgba(236,72,153,0.35),0_0_24px_rgba(236,72,153,0.1)]' // Pink
              : activePane === 2
                ? 'shadow-[0_12px_48px_-12px_rgba(251,146,60,0.35),0_0_24px_rgba(251,146,60,0.1)]' // Peach
                : 'shadow-[0_12px_48px_-12px_rgba(250,204,21,0.35),0_0_24px_rgba(250,204,21,0.1)]' // Gold
        }`}
      >
        {/* The Master Toggle: An exquisite frosted glass dial */}
        <button
          type="button"
          onClick={cyclePane}
          title="Switch Tools"
          className={`relative flex flex-col items-center justify-center w-11 h-11 sm:w-12 sm:h-12 rounded-full shrink-0 transition-all duration-700 ${SPRING_EASING} outline-none hover:scale-[1.08] active:scale-95 border border-white/60 bg-white/50 backdrop-blur-md shadow-[0_2px_12px_rgba(0,0,0,0.06)]`}
        >
          {/* Refined Semantic Icons */}
          {activePane === 0 && (
            <Command
              key="p0"
              size={18}
              strokeWidth={2.5}
              className="mb-0.5 text-stone-800 animate-in zoom-in duration-500"
            />
          )}
          {activePane === 1 && (
            <Files
              key="p1"
              size={18}
              strokeWidth={2.5}
              className="mb-0.5 text-stone-800 animate-in zoom-in duration-500"
            />
          )}
          {activePane === 2 && (
            <Palette
              key="p2"
              size={18}
              strokeWidth={2.5}
              className="mb-0.5 text-stone-800 animate-in zoom-in duration-500"
            />
          )}
          {activePane === 3 && (
            <Sparkles
              key="p3"
              size={18}
              strokeWidth={2.5}
              className="mb-0.5 text-stone-800 animate-in zoom-in duration-500"
            />
          )}

          {/* Ultra-precise Dark Dots */}
          <div className="absolute bottom-1.5 flex gap-[3px]">
            <div
              className={`w-1 h-1 rounded-full transition-all duration-500 ${activePane === 0 ? 'bg-stone-800 scale-125' : 'bg-stone-800/20'}`}
            />
            <div
              className={`w-1 h-1 rounded-full transition-all duration-500 ${activePane === 1 ? 'bg-stone-800 scale-125' : 'bg-stone-800/20'}`}
            />
            <div
              className={`w-1 h-1 rounded-full transition-all duration-500 ${activePane === 2 ? 'bg-stone-800 scale-125' : 'bg-stone-800/20'}`}
            />
            <div
              className={`w-1 h-1 rounded-full transition-all duration-500 ${activePane === 3 ? 'bg-stone-800 scale-125' : 'bg-stone-800/20'}`}
            />
          </div>
        </button>

        <div className="w-[1.5px] h-7 bg-stone-900/[0.08] rounded-full mx-1 sm:mx-1.5 shrink-0" />

        {/* CONSTANT TOOLS: Edit and Camera Move visible across all panes */}
        <div className="flex items-center gap-0.5 shrink-0">
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
        </div>

        <Divider />

        {/* Dynamic Tool Wrapper */}
        <div
          key={`pane-${activePane}`}
          className={`flex items-center gap-0.5 animate-in fade-in zoom-in-95 slide-in-from-left-2 duration-500 ${SPRING_EASING}`}
        >
          {/* PANE 0: Navigation & Basic Edit */}
          {activePane === 0 && (
            <>
              <ToolButton
                title="Select Area"
                active={globalToolMode === 'select'}
                onClick={() => setGlobalToolMode('select')}
              >
                <SquareDashed size={16} strokeWidth={1.5} />
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

          {/* PANE 1: Clipboard & Deletion Actions */}
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

          {/* PANE 2: Creative & Generative Tools */}
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
            </>
          )}

          {/* PANE 3: Magic Effects & AI */}
          {activePane === 3 && (
            <>
              <ToolButton
                title="Magic Effects"
                active={activePopup === 'effects' || !!activeEffect}
                onClick={() => togglePopup('effects')}
              >
                <Wand2 size={16} strokeWidth={1.5} />
              </ToolButton>
              <ToolButton
                title="AI Assistant"
                active={activePopup === 'ai'}
                onClick={() => togglePopup('ai')}
                className={
                  isAiProcessing
                    ? '!bg-[#1c1c1e] !text-white shadow-[0_4px_12px_rgba(0,0,0,0.2),inset_0_1px_1px_rgba(255,255,255,0.15)] scale-[1.02] animate-pulse'
                    : ''
                }
              >
                <Computer size={16} strokeWidth={1.5} />
              </ToolButton>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
