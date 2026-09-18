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
import { processAndCompressImage } from '@/shared/utils/image-processing';
import {
  type CameraView,
  type GlobalToolType,
  type ShapeType,
  useEditorStore,
} from '@/ui/store/editor-store';

const SHAPE_LIBRARY: { type: ShapeType; icon: React.ReactNode; label: string }[] = [
  { type: 'rectangle', icon: <Square size={16} />, label: 'Rectangle' },
  { type: 'circle', icon: <Circle size={16} />, label: 'Circle' },
  { type: 'triangle', icon: <Triangle size={16} />, label: 'Triangle' },
  { type: 'star', icon: <Star size={16} />, label: 'Star' },
  { type: 'diamond', icon: <Diamond size={16} />, label: 'Diamond' },
  { type: 'hexagon', icon: <Hexagon size={16} />, label: 'Hexagon' },
  { type: 'octagon', icon: <Octagon size={16} />, label: 'Octagon' },
  { type: 'pentagon', icon: <Pentagon size={16} />, label: 'Pentagon' },
  { type: 'ellipse', icon: <Circle size={16} className="scale-x-125" />, label: 'Ellipse' },
  { type: 'capsule', icon: <Pill size={16} />, label: 'Capsule' },
  { type: 'cross', icon: <Cross size={16} />, label: 'Cross' },
  { type: 'heart', icon: <Heart size={16} />, label: 'Heart' },
  { type: 'cloud', icon: <Cloud size={16} />, label: 'Cloud' },
  { type: 'arrow', icon: <ArrowRight size={16} />, label: 'Arrow' },
  {
    type: 'parallelogram',
    icon: <RectangleHorizontal size={16} className="skew-x-12" />,
    label: 'Parallelo',
  },
  { type: 'trapezoid', icon: <Box size={16} />, label: 'Trapezoid' },
  { type: 'chat-bubble', icon: <MessageCircle size={16} />, label: 'Bubble' },
  { type: 'shield', icon: <Shield size={16} />, label: 'Shield' },
  { type: 'badge', icon: <Badge size={16} />, label: 'Badge' },
  { type: 'bookmark', icon: <Bookmark size={16} />, label: 'Bookmark' },
];

const EFFECTS_LIBRARY: { id: GlobalToolType; icon: React.ReactNode; label: string }[] = [
  { id: 'fill', icon: <PaintBucket size={16} />, label: 'Fill' },
  { id: 'blur', icon: <Droplet size={16} />, label: 'Blur' },
  { id: 'burn', icon: <Flame size={16} />, label: 'Burn' },
  { id: 'saturate', icon: <Sun size={16} />, label: 'Saturate' },
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

  // Pure Apple-style ToolButton without nesting issues
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
      className={`w-10 h-10 flex items-center justify-center rounded-full shrink-0 transition-all duration-200 outline-none ${active ? 'bg-black text-white shadow-md' : 'text-neutral-600 hover:bg-black/5 hover:text-black'} ${className}`}
    >
      {children}
    </button>
  );

  const Divider = () => <div className="w-px h-5 bg-black/10 mx-1 shrink-0" />;

  // FIXED layout for popups relative to the screen, anchoring them beautifully above the dock
  const popupClasses =
    'fixed bottom-24 left-1/2 -translate-x-1/2 bg-white/95 backdrop-blur-3xl border border-black/10 rounded-3xl shadow-[0_24px_50px_rgba(0,0,0,0.15)] p-5 z-[300] animate-in zoom-in-95 duration-200 cursor-default';

  return (
    <div className="flex flex-row items-center justify-start md:justify-center gap-1 w-full h-full p-1 overflow-x-auto scrollbar-hide">
      {/* 1. SELECTION */}
      <ToolButton
        title="Pointer"
        active={globalToolMode === 'default'}
        onClick={() => setGlobalToolMode('default')}
      >
        <MousePointer2 size={16} />
      </ToolButton>
      <ToolButton
        title="Marquee"
        active={globalToolMode === 'select'}
        onClick={() => setGlobalToolMode('select')}
      >
        <SquareDashed size={16} />
      </ToolButton>

      <Divider />

      {/* 2. CREATION */}
      <ToolButton title="Text" onClick={() => addTool('text')}>
        <Type size={16} />
      </ToolButton>

      <ToolButton
        title="Library"
        active={activeMenu === 'library'}
        onClick={(e) => toggleMenu('library', e)}
      >
        <Library size={16} />
      </ToolButton>
      {activeMenu === 'library' && (
        <div ref={menuRef} className={`${popupClasses} w-[300px]`}>
          <div className="pb-3 mb-3 border-b border-black/5 flex justify-between items-center px-1">
            <span className="text-[10px] font-extrabold text-neutral-400 uppercase tracking-widest">
              My Assets
            </span>
            <span className="text-[9px] font-bold bg-neutral-100 text-neutral-500 px-2 py-0.5 rounded-full">
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
            className="w-full flex flex-col items-center justify-center gap-2 border border-dashed border-neutral-300 hover:border-black hover:bg-black/5 rounded-2xl p-6 transition-all mb-4 outline-none"
          >
            <UploadCloud size={24} className="text-neutral-400" />
            <span className="text-xs font-bold text-neutral-600">Click to Upload</span>
          </button>
          <div className="grid grid-cols-3 gap-2 max-h-[200px] overflow-y-auto pr-1 scrollbar-hide">
            {userAssets.map((asset) => (
              <div
                key={asset.id}
                className="relative group aspect-square rounded-xl border border-black/5 overflow-hidden bg-neutral-50 shadow-sm hover:border-black/20 transition-all"
              >
                <button
                  type="button"
                  className="w-full h-full p-2 flex items-center justify-center"
                  onClick={() => {
                    addTool('image', asset.src, undefined, { aspectRatio: asset.aspectRatio });
                    setActiveMenu(null);
                  }}
                >
                  <img
                    src={asset.src}
                    alt="Saved"
                    className="max-w-full max-h-full object-contain drop-shadow-sm"
                  />
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    removeUserAsset(asset.id);
                  }}
                  className="absolute top-1 right-1 p-1 bg-white/90 text-neutral-400 hover:text-red-500 rounded-lg opacity-0 group-hover:opacity-100 shadow-sm"
                >
                  <Trash2 size={12} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <ToolButton
        title="Shapes"
        active={activeMenu === 'shapes'}
        onClick={(e) => toggleMenu('shapes', e)}
      >
        <Shapes size={16} />
      </ToolButton>
      {activeMenu === 'shapes' && (
        <div ref={menuRef} className={`${popupClasses} w-[300px] md:w-[360px]`}>
          <div className="pb-3 mb-3 border-b border-black/5 text-[10px] font-extrabold text-neutral-400 uppercase tracking-widest px-1">
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
                className="flex flex-col items-center justify-center gap-1.5 p-3 text-[10px] font-semibold text-neutral-600 hover:bg-neutral-100 hover:text-black rounded-2xl transition-colors"
              >
                {shape.icon}
                <span className="truncate w-full text-center">{shape.label}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      <ToolButton title="Drawing" onClick={() => setDrawingMode(true)}>
        <Paintbrush size={16} />
      </ToolButton>

      <Divider />

      {/* 3. EFFECTS */}
      <ToolButton
        title="Eraser"
        active={globalToolMode === 'erase'}
        onClick={() => setGlobalToolMode(globalToolMode === 'erase' ? 'default' : 'erase')}
      >
        <Eraser size={16} />
      </ToolButton>

      <ToolButton
        title="Effects"
        active={!!activeEffect || activeMenu === 'effects'}
        onClick={(e) => toggleMenu('effects', e)}
      >
        <Wand2 size={16} />
      </ToolButton>
      {activeMenu === 'effects' && (
        <div ref={menuRef} className={`${popupClasses} w-[260px]`}>
          <div className="pb-3 mb-3 border-b border-black/5 text-[10px] font-extrabold text-neutral-400 uppercase tracking-widest px-1 flex justify-between items-center">
            <span>Magic Effects</span>
            {!!activeEffect && (
              <button
                type="button"
                onClick={() => {
                  setGlobalToolMode('default');
                  setActiveMenu(null);
                }}
                className="text-[9px] text-red-500 hover:text-red-600 font-bold uppercase bg-red-50 px-2 py-0.5 rounded-full"
              >
                Clear
              </button>
            )}
          </div>
          <div className="grid grid-cols-2 gap-2">
            {EFFECTS_LIBRARY.map((effect) => (
              <button
                key={effect.id}
                type="button"
                onClick={() => {
                  setGlobalToolMode(globalToolMode === effect.id ? 'default' : effect.id);
                  setActiveMenu(null);
                }}
                className={`flex flex-col items-center justify-center gap-1.5 p-3 text-[10px] font-bold rounded-2xl transition-all ${globalToolMode === effect.id ? 'bg-black text-white shadow-md' : 'text-neutral-600 hover:bg-black/5 hover:text-black'}`}
              >
                {effect.icon}
                <span>{effect.label}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      <Divider />

      {/* 4. CAMERA ANGLES */}
      <ToolButton
        title="Camera Views"
        active={activeMenu === 'camera'}
        onClick={(e) => toggleMenu('camera', e)}
      >
        <Camera size={16} />
      </ToolButton>
      {activeMenu === 'camera' && (
        <div ref={menuRef} className={`${popupClasses} w-[240px]`}>
          <div className="pb-3 mb-3 border-b border-black/5 text-[10px] font-extrabold text-neutral-400 uppercase tracking-widest px-1">
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
                className={`flex items-center justify-center p-3 text-[10px] font-bold rounded-2xl transition-all bg-neutral-50 hover:bg-black hover:text-white text-black capitalize ${view === 'top' ? 'col-span-2' : ''}`}
              >
                {view}
              </button>
            ))}
          </div>
        </div>
      )}

      <Divider />

      {/* 5. GLOBAL ACTIONS (Cut/Copy/Paste etc. neatly integrated) */}
      <ToolButton
        title="Undo"
        onClick={undo}
        className={past.length === 0 ? 'opacity-30 pointer-events-none' : ''}
      >
        <Undo2 size={16} />
      </ToolButton>
      <ToolButton
        title="Redo"
        onClick={redo}
        className={future.length === 0 ? 'opacity-30 pointer-events-none' : ''}
      >
        <Redo2 size={16} />
      </ToolButton>
      <ToolButton title="Cut" onClick={cut}>
        <Scissors size={16} />
      </ToolButton>
      <ToolButton title="Copy" onClick={copy}>
        <Copy size={16} />
      </ToolButton>
      <ToolButton title="Paste" onClick={paste}>
        <ClipboardPaste size={16} />
      </ToolButton>
      <ToolButton title="Duplicate" onClick={duplicate}>
        <CopyPlus size={16} />
      </ToolButton>
      <ToolButton
        title="Delete"
        onClick={deleteSelected}
        className="hover:!bg-red-50 hover:!text-red-600"
      >
        <Trash2 size={16} className="text-red-400" />
      </ToolButton>

      <Divider />

      {/* 6. AI ASSISTANT */}
      <ToolButton
        title="AI Assistant"
        onClick={(e) => toggleMenu('ai', e)}
        className={
          activeMenu === 'ai' || isAiProcessing
            ? '!bg-black !text-white shadow-[0_0_20px_rgba(0,0,0,0.15)] animate-pulse'
            : 'bg-neutral-100 hover:scale-105'
        }
      >
        <Sparkles size={16} />
      </ToolButton>
      {activeMenu === 'ai' && (
        <div ref={menuRef} className={`${popupClasses} w-[300px] md:w-[380px]`}>
          <div className="pb-3 mb-3 border-b border-black/5 text-[10px] font-extrabold text-neutral-400 uppercase tracking-widest px-1 flex items-center gap-1.5">
            <Sparkles size={14} /> AI Co-Pilot
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
            placeholder="Describe your design or edits..."
            className="w-full bg-neutral-50 border-0 rounded-2xl p-4 text-sm font-medium text-black focus:ring-2 focus:ring-black/20 outline-none resize-none min-h-[100px] placeholder:text-neutral-400"
            disabled={isAiProcessing}
          />
          <div className="mt-3 flex justify-between items-center">
            <span className="text-[10px] text-neutral-400 font-medium px-2">
              Press Enter to send
            </span>
            <button
              type="button"
              onClick={handleAiSubmit}
              disabled={isAiProcessing || !aiPrompt.trim()}
              className="bg-black hover:bg-neutral-800 disabled:bg-neutral-200 disabled:text-neutral-400 text-white px-5 py-2.5 rounded-full text-xs font-bold transition-all shadow-md flex items-center gap-2"
            >
              {isAiProcessing ? <Loader2 size={14} className="animate-spin" /> : 'Apply Magic'}
            </button>
          </div>
          {aiFeedbackMessage && (
            <div className="mt-3 p-3 bg-red-50 text-red-600 text-[11px] font-bold rounded-xl flex items-start gap-2">
              <AlertCircle size={14} className="shrink-0 mt-0.5" />
              {aiFeedbackMessage}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
