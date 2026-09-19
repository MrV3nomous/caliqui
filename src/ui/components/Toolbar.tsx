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
  Copy,
  CopyPlus,
  Cross,
  Diamond,
  Droplet,
  Eraser,
  Flame,
  Heart,
  Hexagon,
  Library,
  Loader2,
  MessageCircle,
  MousePointer2,
  Octagon,
  PaintBucket,
  Paintbrush,
  Pentagon,
  Pill,
  RectangleHorizontal,
  Redo2,
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
  { type: 'rectangle', icon: <Square size={16} strokeWidth={1.5} />, label: 'Rectangle' },
  { type: 'circle', icon: <Circle size={16} strokeWidth={1.5} />, label: 'Circle' },
  { type: 'triangle', icon: <Triangle size={16} strokeWidth={1.5} />, label: 'Triangle' },
  { type: 'star', icon: <Star size={16} strokeWidth={1.5} />, label: 'Star' },
  { type: 'diamond', icon: <Diamond size={16} strokeWidth={1.5} />, label: 'Diamond' },
  { type: 'hexagon', icon: <Hexagon size={16} strokeWidth={1.5} />, label: 'Hexagon' },
  { type: 'octagon', icon: <Octagon size={16} strokeWidth={1.5} />, label: 'Octagon' },
  { type: 'pentagon', icon: <Pentagon size={16} strokeWidth={1.5} />, label: 'Pentagon' },
  {
    type: 'ellipse',
    icon: <Circle size={16} strokeWidth={1.5} className="scale-x-125" />,
    label: 'Ellipse',
  },
  { type: 'capsule', icon: <Pill size={16} strokeWidth={1.5} />, label: 'Capsule' },
  { type: 'cross', icon: <Cross size={16} strokeWidth={1.5} />, label: 'Cross' },
  { type: 'heart', icon: <Heart size={16} strokeWidth={1.5} />, label: 'Heart' },
  { type: 'cloud', icon: <Cloud size={16} strokeWidth={1.5} />, label: 'Cloud' },
  { type: 'arrow', icon: <ArrowRight size={16} strokeWidth={1.5} />, label: 'Arrow' },
  {
    type: 'parallelogram',
    icon: <RectangleHorizontal size={16} strokeWidth={1.5} className="skew-x-12" />,
    label: 'Parallelo',
  },
  { type: 'trapezoid', icon: <Box size={16} strokeWidth={1.5} />, label: 'Trapezoid' },
  { type: 'chat-bubble', icon: <MessageCircle size={16} strokeWidth={1.5} />, label: 'Bubble' },
  { type: 'shield', icon: <Shield size={16} strokeWidth={1.5} />, label: 'Shield' },
  { type: 'badge', icon: <Badge size={16} strokeWidth={1.5} />, label: 'Badge' },
  { type: 'bookmark', icon: <Bookmark size={16} strokeWidth={1.5} />, label: 'Bookmark' },
];

const EFFECTS_LIBRARY: { id: GlobalToolType; icon: React.ReactNode; label: string }[] = [
  { id: 'fill', icon: <PaintBucket size={16} strokeWidth={1.5} />, label: 'Fill' },
  { id: 'blur', icon: <Droplet size={16} strokeWidth={1.5} />, label: 'Blur' },
  { id: 'burn', icon: <Flame size={16} strokeWidth={1.5} />, label: 'Burn' },
  { id: 'saturate', icon: <Sun size={16} strokeWidth={1.5} />, label: 'Saturate' },
];

export function Toolbar() {
  const {
    addTool,
    setDrawingMode,
    globalToolMode,
    setGlobalToolMode,
    userAssets,
    addUserAsset,
    removeUserAsset,
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
  } = useEditorStore();

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [activeMenu, setActiveMenu] = useState<
    'shapes' | 'library' | 'effects' | 'ai' | 'camera' | null
  >(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [aiPrompt, setAiPrompt] = useState('');

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setActiveMenu(null);
      }
    };
    if (activeMenu) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [activeMenu]);

  const toggleMenu = (
    menu: 'shapes' | 'library' | 'effects' | 'ai' | 'camera',
    e: React.MouseEvent<HTMLButtonElement>,
  ) => {
    e.stopPropagation();
    setActiveMenu(activeMenu === menu ? null : menu);
  };

  const processFile = async (file: File) => {
    try {
      const { blob, aspectRatio } = await processAndCompressImage(file);
      const blobUrl = await addUserAsset(blob, aspectRatio);
      addTool('image', blobUrl, undefined, { aspectRatio });
      setActiveMenu(null);
    } catch (error) {
      console.error('Upload failed', error);
    }
  };

  const handleAiSubmit = async () => {
    if (!aiPrompt.trim() || isAiProcessing) return;
    await dispatchAiCommand(aiPrompt);
    if (!useEditorStore.getState().aiFeedbackMessage) {
      setAiPrompt('');
      setActiveMenu(null);
    }
  };

  const activeEffect = EFFECTS_LIBRARY.find((effect) => effect.id === globalToolMode);

  // Pure Apple-style ToolButton - Refined for elegance
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
      className={`w-10 h-10 flex items-center justify-center rounded-xl shrink-0 transition-all duration-200 outline-none ${active ? 'bg-neutral-100 text-black shadow-inner border border-black/5' : 'text-neutral-500 hover:bg-neutral-50 hover:text-black'} ${className}`}
    >
      {children}
    </button>
  );

  const Divider = () => <div className="w-px h-5 bg-black/10 mx-1.5 shrink-0" />;

  const renderPopup = (content: React.ReactNode) => {
    if (typeof document === 'undefined') return null;
    return createPortal(content, document.body);
  };

  // Ultra-premium, sleek popup container
  const popupClasses =
    'fixed bottom-24 left-1/2 -translate-x-1/2 bg-white/95 backdrop-blur-xl border border-black/[0.04] rounded-[2rem] shadow-[0_20px_60px_rgba(0,0,0,0.08)] p-6 z-[500] animate-in zoom-in-95 duration-200 cursor-default';

  return (
    <div className="flex flex-row items-center justify-start md:justify-center gap-1 w-full h-full p-1 overflow-x-auto scrollbar-hide">
      {/* 1. SELECTION */}
      <ToolButton
        title="Pointer"
        active={globalToolMode === 'default'}
        onClick={() => setGlobalToolMode('default')}
      >
        <MousePointer2 size={16} strokeWidth={1.5} />
      </ToolButton>
      <ToolButton
        title="Marquee"
        active={globalToolMode === 'select'}
        onClick={() => setGlobalToolMode('select')}
      >
        <SquareDashed size={16} strokeWidth={1.5} />
      </ToolButton>

      <Divider />

      {/* 2. CREATION */}
      <ToolButton title="Text" onClick={() => addTool('text')}>
        <Type size={16} strokeWidth={1.5} />
      </ToolButton>

      <ToolButton
        title="Library"
        active={activeMenu === 'library'}
        onClick={(e) => toggleMenu('library', e)}
      >
        <Library size={16} strokeWidth={1.5} />
      </ToolButton>
      {activeMenu === 'library' &&
        renderPopup(
          <div ref={menuRef} className={`${popupClasses} w-[340px]`}>
            <div className="pb-4 mb-4 border-b border-black/[0.04] flex justify-between items-center px-1">
              <span className="text-[10px] font-medium text-neutral-500 uppercase tracking-[0.2em]">
                My Assets
              </span>
              <span className="text-[9px] font-medium bg-neutral-100 text-neutral-500 px-2 py-0.5 rounded-full tracking-widest">
                {userAssets.length} Saved
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
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="w-full flex flex-col items-center justify-center gap-3 bg-[#fbfbfd] border border-black/[0.04] hover:border-black/20 rounded-[1.5rem] p-6 transition-all mb-5 outline-none"
            >
              <UploadCloud size={20} strokeWidth={1.5} className="text-neutral-400" />
              <span className="text-[10px] uppercase tracking-[0.1em] font-medium text-neutral-500">
                Click to Upload
              </span>
            </button>
            <div className="grid grid-cols-3 gap-3 max-h-[220px] overflow-y-auto pr-1 hide-scrollbar">
              {userAssets.map((asset) => (
                <div
                  key={asset.id}
                  className="relative group aspect-square rounded-[1.2rem] overflow-hidden bg-[#f5f5f7] transition-all hover:shadow-md"
                >
                  <button
                    type="button"
                    className="w-full h-full p-2.5 flex items-center justify-center outline-none"
                    onClick={() => {
                      addTool('image', asset.src, undefined, { aspectRatio: asset.aspectRatio });
                      setActiveMenu(null);
                    }}
                  >
                    <img
                      src={asset.src}
                      alt="Saved"
                      className="max-w-full max-h-full object-contain drop-shadow-sm transition-transform duration-300 group-hover:scale-105"
                    />
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      removeUserAsset(asset.id);
                    }}
                    className="absolute top-1.5 right-1.5 p-1.5 bg-white/90 text-neutral-400 hover:text-red-500 rounded-full opacity-0 group-hover:opacity-100 shadow-sm outline-none transition-all"
                  >
                    <Trash2 size={12} strokeWidth={1.5} />
                  </button>
                </div>
              ))}
            </div>
          </div>,
        )}

      <ToolButton
        title="Shapes"
        active={activeMenu === 'shapes'}
        onClick={(e) => toggleMenu('shapes', e)}
      >
        <Shapes size={16} strokeWidth={1.5} />
      </ToolButton>
      {activeMenu === 'shapes' &&
        renderPopup(
          <div ref={menuRef} className={`${popupClasses} w-[320px] md:w-[380px]`}>
            <div className="pb-4 mb-4 border-b border-black/[0.04] text-[10px] font-medium text-neutral-500 uppercase tracking-[0.2em] px-1">
              Shape Library
            </div>
            <div className="grid grid-cols-4 gap-2">
              {SHAPE_LIBRARY.map((shape) => (
                <button
                  key={shape.type}
                  type="button"
                  onClick={() => {
                    addTool('shape', undefined, shape.type);
                    setActiveMenu(null);
                  }}
                  className="flex flex-col items-center justify-center gap-2 p-3 text-[9px] uppercase tracking-widest font-medium text-neutral-500 hover:bg-[#fbfbfd] hover:text-black rounded-[1.2rem] transition-colors outline-none"
                >
                  {shape.icon}
                  <span className="truncate w-full text-center">{shape.label}</span>
                </button>
              ))}
            </div>
          </div>,
        )}

      <ToolButton title="Drawing" onClick={() => setDrawingMode(true)}>
        <Paintbrush size={16} strokeWidth={1.5} />
      </ToolButton>

      <Divider />

      {/* 3. EFFECTS */}
      <ToolButton
        title="Eraser"
        active={globalToolMode === 'erase'}
        onClick={() => setGlobalToolMode(globalToolMode === 'erase' ? 'default' : 'erase')}
      >
        <Eraser size={16} strokeWidth={1.5} />
      </ToolButton>

      <ToolButton
        title="Effects"
        active={!!activeEffect || activeMenu === 'effects'}
        onClick={(e) => toggleMenu('effects', e)}
      >
        <Wand2 size={16} strokeWidth={1.5} />
      </ToolButton>
      {activeMenu === 'effects' &&
        renderPopup(
          <div ref={menuRef} className={`${popupClasses} w-[280px]`}>
            <div className="pb-4 mb-4 border-b border-black/[0.04] flex justify-between items-center px-1">
              <span className="text-[10px] font-medium text-neutral-500 uppercase tracking-[0.2em]">
                Magic Effects
              </span>
              {!!activeEffect && (
                <button
                  type="button"
                  onClick={() => {
                    setGlobalToolMode('default');
                    setActiveMenu(null);
                  }}
                  className="text-[9px] text-red-500 hover:text-red-600 font-bold uppercase tracking-widest bg-red-50 px-2.5 py-1 rounded-full outline-none transition-colors"
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
                    setActiveMenu(null);
                  }}
                  className={`flex flex-col items-center justify-center gap-2 p-4 text-[10px] uppercase tracking-widest font-medium rounded-[1.2rem] transition-all outline-none ${globalToolMode === effect.id ? 'bg-black text-white shadow-md' : 'text-neutral-500 bg-[#fbfbfd] hover:bg-neutral-100 hover:text-black'}`}
                >
                  {effect.icon}
                  <span>{effect.label}</span>
                </button>
              ))}
            </div>
          </div>,
        )}

      <Divider />

      {/* 4. CAMERA ANGLES */}
      <ToolButton
        title="Camera Views"
        active={activeMenu === 'camera'}
        onClick={(e) => toggleMenu('camera', e)}
      >
        <Camera size={16} strokeWidth={1.5} />
      </ToolButton>
      {activeMenu === 'camera' &&
        renderPopup(
          <div ref={menuRef} className={`${popupClasses} w-[260px]`}>
            <div className="pb-4 mb-4 border-b border-black/[0.04] text-[10px] font-medium text-neutral-500 uppercase tracking-[0.2em] px-1">
              Camera Views
            </div>
            <div className="grid grid-cols-2 gap-2">
              {(['front', 'back', 'left', 'right', 'top'] as CameraView[]).map((view) => (
                <button
                  key={view}
                  type="button"
                  onClick={() => {
                    setCameraView(view);
                    setActiveMenu(null);
                  }}
                  className={`flex items-center justify-center p-3 text-[10px] uppercase tracking-[0.1em] font-medium rounded-xl transition-all outline-none bg-[#fbfbfd] hover:bg-neutral-100 text-neutral-600 hover:text-black ${view === 'top' ? 'col-span-2' : ''}`}
                >
                  {view}
                </button>
              ))}
            </div>
          </div>,
        )}

      <Divider />

      {/* 5. GLOBAL ACTIONS */}
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
      <ToolButton
        title="Delete"
        onClick={deleteSelected}
        className="hover:!bg-red-50 hover:!text-red-600"
      >
        <Trash2 size={16} strokeWidth={1.5} className="text-red-400" />
      </ToolButton>

      <Divider />

      {/* 6. AI ASSISTANT */}
      <ToolButton
        title="AI Assistant"
        onClick={(e) => toggleMenu('ai', e)}
        className={
          activeMenu === 'ai' || isAiProcessing
            ? '!bg-black !text-white shadow-[0_4px_12px_rgba(0,0,0,0.1)] animate-pulse'
            : 'hover:scale-105'
        }
      >
        <Sparkles size={16} strokeWidth={1.5} />
      </ToolButton>
      {activeMenu === 'ai' &&
        renderPopup(
          <div ref={menuRef} className={`${popupClasses} w-[320px] md:w-[400px]`}>
            <div className="pb-4 mb-4 border-b border-black/[0.04] text-[10px] font-medium text-neutral-500 uppercase tracking-[0.2em] px-1 flex items-center gap-2">
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
              className="w-full bg-[#fbfbfd] border border-black/5 rounded-2xl p-4 text-xs tracking-wide text-black focus:border-black/20 outline-none resize-none min-h-[120px] placeholder:text-neutral-400 transition-colors"
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
                className="bg-black hover:bg-neutral-800 disabled:bg-neutral-100 disabled:text-neutral-400 text-white px-6 py-2.5 rounded-full text-[10px] uppercase tracking-[0.1em] font-medium transition-all shadow-sm flex items-center gap-2 outline-none"
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
    </div>
  );
}
