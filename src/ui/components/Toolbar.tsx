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
  Computer,
  Copy,
  CopyPlus,
  Cross,
  Diamond,
  Droplet,
  Flame,
  Heart,
  Hexagon,
  Library,
  Loader2,
  MessageCircle,
  MousePointer2,
  MoreHorizontal,
  Maximize2,
  RotateCcw,
  ZoomIn,
  ZoomOut,
  Octagon,
  PaintBucket,
  Paintbrush,
  Info,
  Search,
  Plus,
  Pentagon,
  Pill,
  RectangleHorizontal,
  Redo2,
  RefreshCw,
  Scissors,
  Shapes,
  Shirt,
  Shield,
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
  type DecalData,
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
    label: 'Parallelogram',
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


type HelpArticle = { category: string; title: string; summary: string; steps: string[]; keywords: string };
const EDITOR_HELP: HelpArticle[] = [
  { category: 'Getting started', title: 'Your first design', summary: 'Build a design by adding artwork to the garment, arranging it, then reviewing the front and back.', steps: ['Choose a garment from the Apparel panel and select its colour in Layers & Settings.', 'Open Add to insert text, an image, a shape, a drawing or a starter template.', 'Select an element on the garment to move it. Use the visible handles to resize or rotate it.', 'Use Layers to select, rename, reorder, group or delete elements.', 'Save your design before leaving. Choose Add to Cart when you are ready to order.'], keywords: 'beginner start tutorial create first design shirt apparel' },
  { category: 'Create', title: 'Add text, images and shapes', summary: 'Start with your own artwork or an editable starting point.', steps: ['Open Add on the bottom toolbar.', 'Choose Text to add editable typography, My Assets to upload an image, Shapes for vector-like shapes, or Draw to create freehand artwork.', 'Choose Templates for editable starter compositions. They are not flattened images; the elements can be edited separately.', 'Select any added element to open its contextual editing controls and detailed properties.'], keywords: 'upload import picture photo text type typography shapes drawing template assets add' },
  { category: 'Edit', title: 'Move, resize and rotate artwork', summary: 'Artwork gestures and garment gestures are deliberately different.', steps: ['Drag from the centre or body of a selected artwork element to move it.', 'Drag a corner handle to resize proportionally. Drag a side handle to resize along one axis.', 'Drag the circular corner control to rotate. Hold Shift while rotating to snap to 45-degree increments.', 'When smart guides appear, the artwork is aligning with the garment centre or nearby artwork. Hold Alt while dragging to temporarily disable snapping.', 'Use arrow keys to nudge selected artwork; hold Shift for a larger step. Use Undo or Redo if you need to step back or restore an action.'], keywords: 'move drag resize scale transform rotate handles smart guides snapping alignment alt shift' },
  { category: 'View', title: 'Turn and inspect the garment', summary: 'Rotate the garment without switching away from artwork editing.', steps: ['On desktop, drag an unoccupied area of the T-shirt to orbit around it.', 'Hold Space and drag to temporarily orbit from elsewhere; release Space to return to the previous tool.', 'On touch screens, drag an unoccupied garment area or blank canvas to rotate; use two fingers to orbit and pinch to zoom.', 'Open View for exact Front, Back, Left, Right and Top camera presets.', 'Dragging an artwork element or its handles remains an editing action, not a camera action.'], keywords: 'camera view orbit rotate turn front back left right top space zoom pinch inspect' },
  { category: 'Organise', title: 'Use Layers and groups', summary: 'Keep complex designs organised and easy to edit.', steps: ['Open Layers & Settings from the right side of the Studio.', 'Select a layer by choosing its name. Double-click a name to rename it.', 'Use the up/down controls to change stacking order on any device, or drag a row to reorder it with a mouse. Visibility hides a layer without deleting it; Lock prevents accidental movement and resizing.', 'Select multiple elements with Ctrl/Command or Shift, then use Group. Use Ungroup or Break to separate them.', 'Open the settings control on a layer to edit its detailed properties. The properties view stays open while you select other canvas items; close it explicitly to return to the layer list.'], keywords: 'layers group ungroup rename reorder stack properties settings inspector panel' },
  { category: 'Style', title: 'Edit text and image properties', summary: 'Fine-tune the selected element from its properties panel.', steps: ['Select an artwork element and open its settings from the Layers list, or use the contextual controls near the selection.', 'For text, edit the wording, font, weight, alignment, size and colour.', 'For images and drawings, use available image controls and background removal.', 'Use placement settings to choose front/back placement, both-side projection or wrap where supported by the garment model.', 'Reset a property group when you want to restore its defaults.'], keywords: 'properties inspector edit image text font color font size placement background removal effects' },
  { category: 'Draw', title: 'Draw and apply effects', summary: 'Create artwork directly or refine an existing image.', steps: ['Open Add and choose Draw to open the drawing workspace.', 'Choose a drawing tool, colour and brush size, then draw on the canvas.', 'Apply the drawing to add it to the garment as an editable artwork layer.', 'Open Effects for available image treatments such as Fill, Blur, Burn and Saturate. Brush size and flow appear when relevant.', 'Use the drawing workspace Undo and Redo buttons, or Ctrl/Command + Z and Shift + Z, to reverse and restore strokes. Clear removes the whole drawing and can also be undone.'], keywords: 'draw brush pen freehand erase fill blur burn saturate flow effect' },
  { category: 'Assets', title: 'Upload and manage My Assets', summary: 'Keep your own artwork in the asset library and reuse it in a design.', steps: ['Open Add, then choose My Assets.', 'Choose Upload to add a supported image. Caliqui processes the image before adding it to your library.', 'Choose an asset to place a copy on the garment. The placed artwork becomes its own layer.', 'Use Replace to update a library asset or Remove to archive it from the library. Existing designs may retain their own saved artwork until you edit or replace that layer.', 'Use descriptive filenames and transparent artwork where appropriate for cleaner garment previews.'], keywords: 'my assets library upload replace remove archive image photo reuse file' },
  { category: 'Refine', title: 'Crop and remove image backgrounds', summary: 'Clean up an image before finalising its placement.', steps: ['Select an image or drawing layer and open its Properties.', 'Use the crop control to open the crop workspace. Drag the centre to reposition the crop and drag the edges or corners to adjust its bounds.', 'Apply the crop to update the artwork layer. Use Undo if you prefer the earlier version.', 'Use Remove Background where available to isolate the subject from its original background.', 'Check fine edges at a larger zoom before ordering.'], keywords: 'crop trim frame background removal cutout transparent edge image cleanup' },
  { category: 'Garment', title: 'Choose garment colour and artwork placement', summary: 'Review how artwork is assigned to the garment.', steps: ['Open Layers & Settings to change the garment colour.', 'Use the Apparel panel to choose the available garment model.', 'For a selected artwork layer, open Properties and choose the available placement mode: Front/Back, Both Sides or 360° Wrap.', 'Rotate the garment to inspect the artwork from all sides using the live 3D viewport.', 'Review the actual garment from the front, back and side camera views before adding it to your bag.'], keywords: 'apparel garment shirt tshirt color colour front back pass-through wrap placement both sides' },
  { category: 'Finish', title: 'Save and order', summary: 'Keep your work and place an order through Caliqui.', steps: ['Give your design a recognisable name in the top bar.', 'Use Save to save your current design to your account.', 'Choose Add to Cart to save the design and select garment sizes and quantities.', 'Review your bag and checkout details before placing an order.', 'If you leave the Studio, reopen saved designs from your account dashboard.'], keywords: 'save autosave order checkout cart buy size quantity account dashboard' },
  { category: 'Shortcuts', title: 'Keyboard shortcuts', summary: 'Use familiar shortcuts for common editing actions.', steps: ['Space (hold): temporarily enter camera navigation; release to restore the previous tool.', 'V: return to the Edit tool.', 'Ctrl/Command + Z: Undo. Ctrl/Command + Shift + Z or Ctrl/Command + Y: Redo.', 'Ctrl/Command + C: Copy. Ctrl/Command + X: Cut. Ctrl/Command + V: Paste. Ctrl/Command + D: Duplicate.', 'Ctrl/Command + A: Select all. Delete or Backspace: delete selected artwork.', 'Shortcuts are ignored while typing in text fields or other text-entry controls.'], keywords: 'keyboard shortcut hotkey ctrl command undo redo copy paste duplicate delete select all space v' },
];

// Quiet, high-contrast surface shared by the rail and its popovers.
const GLASS_BASE =
  'studio-glass-surface bg-white/95 backdrop-blur-xl border border-stone-200/80';
const SPRING_EASING = 'ease-[cubic-bezier(0.32,0.72,0,1)]';

export function Toolbar({ onOpenApparel }: { onOpenApparel?: () => void } = {}) {
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
    selectedIds,
    clipboard,
  } = useEditorStore();

  const fileInputRef = useRef<HTMLInputElement>(null);
  const replaceInputRef = useRef<HTMLInputElement>(null);

  const [activePopup, setActivePopup] = useState<
    'add' | 'library' | 'shapes' | 'templates' | 'effects' | 'ai' | 'camera' | 'help' | 'more' | null
  >(null);

  const [aiPrompt, setAiPrompt] = useState('');
  const [helpQuery, setHelpQuery] = useState('');
  const [replaceTargetId, setReplaceTargetId] = useState<string | null>(null);

  const [isUploading, setIsUploading] = useState(false);
  const [isReplacing, setIsReplacing] = useState(false);
  const [assetError, setAssetError] = useState<string | null>(null);
  const [removingAssetIds, setRemovingAssetIds] = useState<Set<string>>(new Set());

  const containerRef = useRef<HTMLDivElement>(null);
  const popupRef = useRef<HTMLDivElement>(null);
  const popupTriggerRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent | PointerEvent) => {
      const target = e.target as Node;

      const isOutsideContainer = containerRef.current && !containerRef.current.contains(target);
      const isOutsidePopup = !popupRef.current?.contains(target);

      if (isOutsideContainer && isOutsidePopup) {
        setActivePopup(null);
      }
    };

    document.addEventListener('pointerdown', handleClickOutside);
    return () => document.removeEventListener('pointerdown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (!activePopup) return;

    const firstControl = popupRef.current?.querySelector<HTMLElement>('[data-help-search]')
      || popupRef.current?.querySelector<HTMLButtonElement>('button:not(:disabled)');
    firstControl?.focus();

    const handlePopupKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      setActivePopup(null);
      requestAnimationFrame(() => popupTriggerRef.current?.focus());
    };

    document.addEventListener('keydown', handlePopupKeyDown);
    return () => document.removeEventListener('keydown', handlePopupKeyDown);
  }, [activePopup]);

  const togglePopup = (popup: 'add' | 'library' | 'shapes' | 'templates' | 'effects' | 'ai' | 'camera' | 'help' | 'more') => {
    setActivePopup(activePopup === popup ? null : popup);
  };

  const processFile = async (file: File) => {
    if (isUploading) return;
    setIsUploading(true);
    setAssetError(null);
    try {
      const { blob, aspectRatio } = await processAndCompressImage(file);
      const asset = await addUserAsset(blob, aspectRatio);

      setDrawingMode(false);
      setGlobalToolMode('default');
      addTool('image', asset.src, undefined, {
        aspectRatio: asset.aspectRatio,
      });

      setActivePopup(null);
    } catch (error) {
      console.error('Upload failed', error);
      setAssetError((error as Error).message);
    } finally {
      setIsUploading(false);
    }
  };

  const processReplacement = async (file: File) => {
    if (!replaceTargetId || isReplacing) return;
    setIsReplacing(true);
    setAssetError(null);
    try {
      const { blob, aspectRatio } = await processAndCompressImage(file);
      await replaceUserAsset(replaceTargetId, blob, aspectRatio);
      setReplaceTargetId(null);
    } catch (error) {
      console.error('Replacement failed', error);
      setAssetError((error as Error).message);
    } finally {
      setIsReplacing(false);
    }
  };

  const handleRemoveAsset = (id: string) => {
    if (removingAssetIds.has(id)) return;

    setAssetError(null);
    setRemovingAssetIds((prev) => {
      const next = new Set(prev);
      next.add(id);
      return next;
    });

    void removeUserAsset(id)
      .catch((error) => {
        console.error('Failed to remove asset', error);
        setAssetError('Failed to remove asset. Please try again.');
      })
      .finally(() => {
        setRemovingAssetIds((prev) => {
          const next = new Set(prev);
          next.delete(id);
          return next;
        });
      });
  };

  const handleAiSubmit = async () => {
    if (!aiPrompt.trim() || isAiProcessing) return;
    await dispatchAiCommand(aiPrompt, selectedIds);
    if (!useEditorStore.getState().aiFeedbackMessage) {
      setAiPrompt('');
      setActivePopup(null);
    }
  };

  const applyStarterTemplate = (template: 'quiet-type' | 'retro-badge' | 'motion' | 'personal-mark') => {
    const store = useEditorStore.getState();
    store.saveHistory();
    const createdIds: string[] = [];
    const add = (type: 'text' | 'shape', shapeType: ShapeType | undefined, overrides: Partial<DecalData>) => {
      store.addTool(type, undefined, shapeType, { meshSide: 'front', ...overrides }, true);
      const currentDecals = useEditorStore.getState().decals;
      const created = currentDecals[currentDecals.length - 1];
      if (created) createdIds.push(created.id);
    };

    if (template === 'quiet-type') {
      add('text', undefined, { text: 'CREATE YOUR OWN', position: [0, 0.05, 0.025], scale: 0.19, fontSize: 76, fontFamily: 'Arial Black', fontWeight: 'bold', fill: '#171717', textAlign: 'center' });
      add('text', undefined, { text: 'MADE TO BE YOURS', position: [0, -0.11, 0.035], scale: 0.075, fontSize: 28, fontFamily: 'Arial', fontWeight: 'normal', fill: '#555555', textAlign: 'center' });
    } else if (template === 'retro-badge') {
      add('shape', 'circle', { position: [0, 0, 0.02], scale: 0.25, fill: '#E8D9BD' });
      add('text', undefined, { text: 'FIELD CLUB', position: [0, 0.035, 0.04], scale: 0.14, fontSize: 68, fontFamily: 'Arial Black', fill: '#25211C', textAlign: 'center' });
      add('text', undefined, { text: 'ORIGINAL GOODS', position: [0, -0.075, 0.05], scale: 0.06, fontSize: 24, fontFamily: 'Arial', fill: '#574B3C', textAlign: 'center' });
    } else if (template === 'motion') {
      add('shape', 'arrow', { position: [-0.14, 0, 0.025], scale: 0.18, rotation: [0, 0, 0], fill: '#D94A36' });
      add('text', undefined, { text: 'MOVE DIFFERENT', position: [0.11, 0.02, 0.04], scale: 0.14, fontSize: 62, fontFamily: 'Arial Black', fill: '#171717', textAlign: 'center' });
      add('text', undefined, { text: 'FIND YOUR OWN PACE', position: [0.08, -0.105, 0.05], scale: 0.065, fontSize: 24, fill: '#777777', textAlign: 'center' });
    } else {
      add('shape', 'badge', { position: [0, 0, 0.02], scale: 0.24, fill: '#172A3A' });
      add('text', undefined, { text: 'YOUR\nIDEA', position: [0, 0.02, 0.04], scale: 0.16, fontSize: 76, fontFamily: 'Arial Black', fill: '#FFFFFF', textAlign: 'center' });
      add('text', undefined, { text: 'YOUR RULES', position: [0, -0.13, 0.05], scale: 0.06, fontSize: 24, fill: '#D9E3E8', textAlign: 'center' });
    }

    store.setSelectedIds(createdIds);
    store.setDrawingMode(false);
    store.setGlobalToolMode('default');
    setActivePopup(null);
  };

  const activeEffect = EFFECTS_LIBRARY.find((effect) => effect.id === globalToolMode);
  const moreActions: { label: string; icon: React.ReactNode; disabled?: boolean; action: () => void }[] = [
    { label: 'Select area', icon: <SquareDashed size={15} />, action: () => { setDrawingMode(false); setGlobalToolMode('select'); setActivePopup(null); } },
    { label: 'Redo', icon: <Redo2 size={15} />, disabled: future.length === 0, action: () => { redo(); setActivePopup(null); } },
    { label: 'View garment', icon: <Camera size={15} />, action: () => setActivePopup('camera') },
    ...(selectedIds.length > 0 ? [
      { label: 'Duplicate selection', icon: <CopyPlus size={15} />, action: () => { duplicate(); setActivePopup(null); } },
      { label: 'Delete selection', icon: <Trash2 size={15} />, action: () => { deleteSelected(); setActivePopup(null); } },
    ] : []),
    { label: 'Effects', icon: <Wand2 size={15} />, action: () => setActivePopup('effects') },
    { label: 'AI Workmachine', icon: <Computer size={15} />, action: () => setActivePopup('ai') },
    { label: 'Help', icon: <Info size={15} />, action: () => setActivePopup('help') },
  ];
  const normalizedHelpQuery = helpQuery.trim().toLowerCase();
  const visibleHelpArticles = EDITOR_HELP.filter((article) => {
    if (!normalizedHelpQuery) return true;
    const searchable = [article.category, article.title, article.summary, article.keywords, ...article.steps].join(' ').toLowerCase();
    return searchable.includes(normalizedHelpQuery);
  });

  // Matte Space Black premium button for active states
  const ToolButton = ({
    active,
    onClick,
    children,
    title,
    className = '',
    disabled = false,
    'aria-expanded': ariaExpanded,
    'aria-haspopup': ariaHasPopup,
  }: {
    active?: boolean;
    onClick: (e: React.MouseEvent<HTMLButtonElement>) => void;
    children: React.ReactNode;
    title: string;
    className?: string;
    disabled?: boolean;
    'aria-expanded'?: boolean;
    'aria-haspopup'?: 'dialog' | 'menu' | 'true' | 'false' | 'listbox' | 'tree' | 'grid';
  }) => (
    <button
      type="button"
      title={title}
      aria-label={title}
      aria-pressed={active}
      aria-expanded={ariaExpanded}
      aria-haspopup={ariaHasPopup}
      disabled={disabled}
      onClick={(event) => {
        if (ariaHasPopup) popupTriggerRef.current = event.currentTarget;
        onClick(event);
      }}
      data-studio-active={active ? 'true' : 'false'}
      className={`studio-tool-button inline-flex min-h-10 items-center justify-center gap-2 rounded-xl px-2.5 shrink-0 outline-none transition-all duration-200 ${SPRING_EASING} ${className}`}
    >
      {children}
    </button>
  );

  const Divider = () => (
    <div className="studio-toolbar-divider mx-1 h-6 w-px shrink-0 rounded-full" aria-hidden="true" />
  );

  const renderPortal = (content: React.ReactNode) => {
    if (typeof document === 'undefined') return null;
    return createPortal(<div className="studio-portal">{content}</div>, document.body);
  };

  // Compact, neutral popovers stay visually subordinate to the garment workspace.
  const popupClasses = `studio-popover-surface fixed bottom-[calc(env(safe-area-inset-bottom)+5.75rem)] left-1/2 -translate-x-1/2 z-[500] p-4 rounded-2xl animate-in zoom-in-95 slide-in-from-bottom-1 duration-200 ${SPRING_EASING} cursor-default transition-[opacity,transform] ${GLASS_BASE} shadow-[0_16px_44px_-18px_rgba(0,0,0,0.22)] max-h-[calc(100dvh-8rem)] overflow-y-auto overscroll-contain`;
  const railPopupClasses = `studio-popover-surface studio-rail-popover fixed z-[500] p-4 rounded-2xl animate-in zoom-in-95 duration-200 ${SPRING_EASING} cursor-default transition-[opacity,transform] ${GLASS_BASE} shadow-[0_16px_44px_-18px_rgba(0,0,0,0.22)] max-h-[calc(100dvh-8rem)] overflow-y-auto overscroll-contain`;

  return (
    <div
      ref={containerRef}
      role="toolbar"
      aria-orientation="horizontal"
      aria-label="Caliqui Studio tools"
      className="relative flex flex-row items-center justify-center w-full select-none"
    >
      {/* Workspace rail: apparel, direct edit actions and camera controls. */}
      <div className="studio-quick-rail" role="toolbar" aria-orientation="vertical" aria-label="Quick editing actions">
        <ToolButton
          title="Choose apparel"
          className="studio-quick-rail-button"
          onClick={() => { setActivePopup(null); onOpenApparel?.(); }}
        >
          <Shirt size={17} strokeWidth={1.7} />
        </ToolButton>
        <span className="studio-quick-rail-divider" aria-hidden="true" />
        <div className="studio-quick-rail-action-group" role="group" aria-label="Cut, copy, paste, duplicate and delete">
          <ToolButton title="Cut · Ctrl/⌘ X" className="studio-quick-rail-button" disabled={selectedIds.length === 0} onClick={() => cut()}>
            <Scissors size={16} strokeWidth={1.7} />
          </ToolButton>
          <ToolButton title="Copy · Ctrl/⌘ C" className="studio-quick-rail-button" disabled={selectedIds.length === 0} onClick={() => copy()}>
            <Copy size={16} strokeWidth={1.7} />
          </ToolButton>
          <ToolButton title="Paste · Ctrl/⌘ V" className="studio-quick-rail-button" disabled={clipboard.length === 0} onClick={() => paste()}>
            <ClipboardPaste size={16} strokeWidth={1.7} />
          </ToolButton>
          <ToolButton title="Duplicate · Ctrl/⌘ D" className="studio-quick-rail-button" disabled={selectedIds.length === 0} onClick={() => duplicate()}>
            <CopyPlus size={16} strokeWidth={1.7} />
          </ToolButton>
          <ToolButton title="Delete · Backspace" className="studio-quick-rail-button studio-quick-rail-button--danger" disabled={selectedIds.length === 0} onClick={() => deleteSelected()}>
            <Trash2 size={16} strokeWidth={1.7} />
          </ToolButton>
        </div>
        <span className="studio-quick-rail-divider" aria-hidden="true" />
        <ToolButton
          title="View garment"
          active={activePopup === 'camera'}
          aria-expanded={activePopup === 'camera'}
          aria-haspopup="dialog"
          className="studio-quick-rail-button"
          onClick={() => togglePopup('camera')}
        >
          <Camera size={17} strokeWidth={1.7} />
        </ToolButton>
      </div>

      {/* ---------------------------------------------------- */}
      {/* SECONDARY LAYER: LUXURY FLOATING POPUPS                */}
      {/* ---------------------------------------------------- */}
      {activePopup === 'add' &&
        renderPortal(
          <div
            ref={popupRef}
            role="group"
            aria-label="Add artwork"
            className={`${popupClasses} w-[320px] max-w-[calc(100vw-24px)]`}
          >
            <div className="pb-4 mb-4 border-b border-stone-900/[0.06] text-[10px] font-semibold text-stone-500 uppercase tracking-[0.2em] px-1">
              Add to your design
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => {
                  setDrawingMode(false);
                  setGlobalToolMode('default');
                  addTool('text');
                  setActivePopup(null);
                }}
                className="min-h-20 rounded-2xl border border-stone-900/[0.06] bg-stone-50 p-3 flex flex-col items-center justify-center gap-2 text-sm text-stone-700 hover:bg-stone-100 hover:text-black"
              >
                <Type size={20} /> Text
              </button>
              <button
                type="button"
                onClick={() => setActivePopup('library')}
                className="min-h-20 rounded-2xl border border-stone-900/[0.06] bg-stone-50 p-3 flex flex-col items-center justify-center gap-2 text-sm text-stone-700 hover:bg-stone-100 hover:text-black"
              >
                <Library size={20} /> My Assets
              </button>
              <button
                type="button"
                onClick={() => {
                  setDrawingMode(false);
                  setActivePopup('shapes');
                }}
                className="min-h-20 rounded-2xl border border-stone-900/[0.06] bg-stone-50 p-3 flex flex-col items-center justify-center gap-2 text-sm text-stone-700 hover:bg-stone-100 hover:text-black"
              >
                <Shapes size={20} /> Shapes
              </button>
              <button
                type="button"
                onClick={() => {
                  setDrawingMode(true);
                  setGlobalToolMode('default');
                  setActivePopup(null);
                }}
                className="min-h-20 rounded-2xl border border-stone-900/[0.06] bg-stone-50 p-3 flex flex-col items-center justify-center gap-2 text-sm text-stone-700 hover:bg-stone-100 hover:text-black"
              >
                <Paintbrush size={20} /> Draw
              </button>
              <button
                type="button"
                onClick={() => setActivePopup('templates')}
                className="min-h-20 rounded-2xl border border-stone-900/[0.06] bg-stone-50 p-3 flex flex-col items-center justify-center gap-2 text-sm text-stone-700 hover:bg-stone-100 hover:text-black"
              >
                <Wand2 size={20} /> Starter templates
              </button>
              <button
                type="button"
                onClick={() => { setActivePopup('ai'); setAiPrompt(''); }}
                className="min-h-20 rounded-2xl border border-stone-900/[0.06] bg-stone-50 p-3 flex flex-col items-center justify-center gap-2 text-sm text-stone-700 hover:bg-stone-100 hover:text-black"
              >
                <Computer size={20} /> Describe an idea
              </button>
            </div>
            <p className="mt-3 text-[11px] text-stone-500">Start with a new element or bring in your own artwork.</p>
          </div>,
        )}

      {activePopup === 'templates' &&
        renderPortal(
          <div ref={popupRef} role="dialog" aria-label="Starter design templates" className={`${popupClasses} w-[340px] max-w-[calc(100vw-24px)]`}>
            <div className="mb-3 border-b border-stone-200 pb-3">
              <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-stone-500">Start with a direction</div>
              <p className="mt-1 text-xs text-stone-500">Editable compositions. Change the words, colours and placement after adding.</p>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {[
                { id: 'quiet-type' as const, title: 'Quiet type', detail: 'Minimal typography' },
                { id: 'retro-badge' as const, title: 'Retro badge', detail: 'Classic emblem' },
                { id: 'motion' as const, title: 'Move different', detail: 'Sport / streetwear' },
                { id: 'personal-mark' as const, title: 'Personal mark', detail: 'Bold statement' },
              ].map((item) => (
                <button key={item.id} type="button" onClick={() => applyStarterTemplate(item.id)} className="min-h-24 rounded-xl border border-stone-200 bg-stone-50 p-3 text-left transition-colors hover:border-stone-400 hover:bg-white">
                  <span className="block text-sm font-semibold text-stone-900">{item.title}</span>
                  <span className="mt-1 block text-[10px] text-stone-500">{item.detail}</span>
                  <span className="mt-3 block text-[9px] font-semibold uppercase tracking-widest text-stone-400">Use template →</span>
                </button>
              ))}
            </div>
          </div>,
        )}

      {activePopup === 'library' &&
        renderPortal(
          <div
            ref={popupRef}
            role="group"
            aria-label="My Assets"
            className={`${popupClasses} w-[340px] max-w-[calc(100vw-24px)]`}
          >
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
              disabled={userAssets.length >= 6 || isUploading || isReplacing}
              className={`w-full flex flex-col items-center justify-center gap-2 bg-stone-50 border border-stone-200/80 rounded-xl p-4 transition-all duration-200 ${SPRING_EASING} mb-4 outline-none ${userAssets.length >= 6 || isUploading || isReplacing ? 'opacity-50 cursor-not-allowed' : 'hover:bg-white/60 hover:shadow-sm hover:scale-[1.02] active:scale-95'}`}
            >
              {isUploading ? (
                <Loader2 size={20} strokeWidth={1.5} className="text-stone-500 animate-spin" />
              ) : (
                <UploadCloud size={20} strokeWidth={1.5} className="text-stone-500" />
              )}
              <span className="text-[10px] uppercase tracking-[0.1em] font-semibold text-stone-600">
                {isUploading
                  ? 'Uploading...'
                  : userAssets.length >= 6
                    ? 'Storage Full'
                    : 'Click to Upload'}
              </span>
            </button>

            {assetError && (
              <div className="mb-4 p-3.5 bg-red-50 text-red-600 text-[11px] font-medium tracking-wide rounded-xl flex items-start gap-2 border border-red-100">
                <AlertCircle size={14} strokeWidth={1.5} className="shrink-0 mt-0.5" />
                {assetError}
              </div>
            )}

            <div className="grid grid-cols-3 gap-3 pr-1 hide-scrollbar">
              {userAssets.map((asset) => (
                <div
                  key={asset.id}
                  className="relative group aspect-square rounded-xl overflow-hidden bg-stone-50 border border-stone-200/80 transition-all hover:shadow-md"
                >
                  <button
                    type="button"
                    title="Insert Asset"
                    aria-label="Insert saved asset"
                    className="w-full h-full p-2.5 flex items-center justify-center outline-none"
                    onClick={() => {
                      setDrawingMode(false);
                      setGlobalToolMode('default');
                      addTool('image', asset.src, undefined, {
                        aspectRatio: asset.aspectRatio,
                      });
                      setActivePopup(null);
                    }}
                  >
                    <img
                      src={asset.src}
                      alt="Saved design asset"
                      className={`max-w-full max-h-full object-contain drop-shadow-sm transition-transform duration-500 ${SPRING_EASING} group-hover:scale-110`}
                    />
                  </button>
                  <div
                    className={`absolute top-1.5 right-1.5 flex flex-col gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100 transition-all duration-300 ${SPRING_EASING}`}
                  >
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setReplaceTargetId(asset.id);
                        replaceInputRef.current?.click();
                      }}
                      disabled={isUploading || isReplacing || removingAssetIds.has(asset.id)}
                      title="Replace Asset"
                      aria-label="Replace Asset"
                      className={`p-1.5 bg-white/90 backdrop-blur-md text-stone-600 studio-accent-hover rounded-full shadow-sm outline-none hover:scale-110 active:scale-95 transition-transform duration-300 ${SPRING_EASING} disabled:opacity-50`}
                    >
                      {isReplacing && replaceTargetId === asset.id ? (
                        <Loader2 size={12} strokeWidth={2} className="animate-spin" />
                      ) : (
                        <RefreshCw size={12} strokeWidth={2} />
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRemoveAsset(asset.id);
                      }}
                      disabled={isUploading || isReplacing || removingAssetIds.has(asset.id)}
                      title="Delete Asset"
                      aria-label="Delete Asset"
                      className={`p-1.5 bg-white/90 backdrop-blur-md text-stone-600 hover:text-red-500 rounded-full shadow-sm outline-none hover:scale-110 active:scale-95 transition-transform duration-300 ${SPRING_EASING} disabled:opacity-50`}
                    >
                      {removingAssetIds.has(asset.id) ? (
                        <Loader2 size={12} strokeWidth={2} className="animate-spin" />
                      ) : (
                        <Trash2 size={12} strokeWidth={1.5} />
                      )}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>,
        )}

      {activePopup === 'shapes' &&
        renderPortal(
          <div
            ref={popupRef}
            role="group"
            aria-label="Shape Library"
            className={`${popupClasses} w-[300px] md:w-[360px] max-w-[calc(100vw-24px)]`}
          >
            <div className="pb-4 mb-4 border-b border-stone-900/[0.06] text-[10px] font-semibold text-stone-500 uppercase tracking-[0.2em] px-1">
              Shape Library
            </div>
            <div className="grid grid-cols-4 gap-2">
              {SHAPE_LIBRARY.map((shape) => (
                <button
                  key={shape.type}
                  type="button"
                  onClick={() => {
                    setDrawingMode(false);
                    setGlobalToolMode('default');
                    addTool('shape', undefined, shape.type);
                    setActivePopup(null);
                  }}
                  className={`flex flex-col items-center justify-center gap-2 p-3 text-[9px] uppercase tracking-widest font-semibold text-stone-500 hover:bg-white/60 hover:shadow-sm hover:text-stone-900 rounded-xl transition-all duration-300 ${SPRING_EASING} hover:scale-105 active:scale-95 outline-none`}
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
          <div
            ref={popupRef}
            role="group"
            aria-label="Magic Effects"
            className={`${popupClasses} w-[280px] max-w-[calc(100vw-24px)]`}
          >
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
                  className={`flex flex-col items-center justify-center gap-2 p-4 text-[10px] uppercase tracking-widest font-semibold rounded-xl transition-all duration-500 ${SPRING_EASING} outline-none active:scale-95 ${
                    globalToolMode === effect.id
                      ? 'bg-[#1c1c1e] text-white shadow-[0_4px_12px_rgba(0,0,0,0.2),inset_0_1px_1px_rgba(255,255,255,0.15)] scale-[1.02]'
                      : 'text-stone-500 bg-stone-50 border border-stone-200/80 hover:bg-stone-100 hover:shadow-sm hover:text-stone-900 hover:scale-105'
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
          <div
            ref={popupRef}
            role="group"
            aria-label="Garment views"
            className={`${railPopupClasses} w-[260px] max-w-[calc(100vw-24px)]`}
          >
            <div className="pb-4 mb-4 border-b border-stone-900/[0.06] text-[10px] font-semibold text-stone-500 uppercase tracking-[0.2em] px-1">
              Garment views
            </div>
            <div className="mb-3 rounded-xl border border-stone-200/80 bg-stone-50/80 p-3">
              <div className="text-[11px] font-semibold text-stone-800">Turn the garment naturally</div>
              <p className="mt-1 text-[11px] leading-relaxed text-stone-500">
                Desktop: drag an empty area of the shirt. Hold Space and drag anywhere to temporarily orbit. Mobile: use two fingers on an empty area to rotate and zoom. Artwork selection is preserved.
              </p>
            </div>
            <div className="grid grid-cols-4 gap-2 mb-3">
              <button type="button" onClick={() => window.dispatchEvent(new CustomEvent('caliqui:camera-command', { detail: { command: 'reset' } }))} className="flex items-center justify-center gap-1.5 rounded-xl border border-stone-200 bg-white px-2 py-2.5 text-[10px] font-medium text-stone-600 hover:bg-stone-50"><RotateCcw size={13} /> Reset</button>
              <button type="button" onClick={() => window.dispatchEvent(new CustomEvent('caliqui:camera-command', { detail: { command: 'fit' } }))} className="flex items-center justify-center gap-1.5 rounded-xl border border-stone-200 bg-white px-2 py-2.5 text-[10px] font-medium text-stone-600 hover:bg-stone-50"><Maximize2 size={13} /> Fit</button>
              <button type="button" aria-label="Zoom in" onClick={() => window.dispatchEvent(new CustomEvent('caliqui:camera-command', { detail: { command: 'zoom-in' } }))} className="flex items-center justify-center rounded-xl border border-stone-200 bg-white px-2 py-2.5 text-stone-600 hover:bg-stone-50"><ZoomIn size={14} /></button>
              <button type="button" aria-label="Zoom out" onClick={() => window.dispatchEvent(new CustomEvent('caliqui:camera-command', { detail: { command: 'zoom-out' } }))} className="flex items-center justify-center rounded-xl border border-stone-200 bg-white px-2 py-2.5 text-stone-600 hover:bg-stone-50"><ZoomOut size={14} /></button>
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
                  className={`flex items-center justify-center p-3 text-[10px] uppercase tracking-[0.1em] font-semibold rounded-xl transition-all duration-500 ${SPRING_EASING} outline-none bg-stone-50 border border-stone-200/80 hover:bg-stone-100 hover:shadow-sm text-stone-600 hover:text-stone-900 hover:scale-105 active:scale-95 ${view === 'top' ? 'col-span-2' : ''}`}
                >
                  {view}
                </button>
              ))}
            </div>
          </div>,
        )}

      {activePopup === 'more' &&
        renderPortal(
          <div ref={popupRef} role="menu" aria-label="More editor tools" className={`${popupClasses} w-[min(340px,calc(100vw-24px))]`}>
            <div className="mb-3 border-b border-stone-200 pb-3 text-[10px] font-semibold uppercase tracking-[0.18em] text-stone-500">More tools</div>
            <div className="grid grid-cols-2 gap-2">
              {moreActions.map((item) => (
                <button
                  key={item.label}
                  type="button"
                  role="menuitem"
                  disabled={Boolean(item.disabled)}
                  onClick={item.action}
                  className="studio-menu-action flex min-h-11 items-center gap-2 rounded-xl border border-stone-200 bg-white px-3 text-left text-[11px] font-medium text-stone-700 hover:bg-stone-50 disabled:cursor-not-allowed disabled:opacity-35"
                >
                  {item.icon}{item.label}
                </button>
              ))}
            </div>
          </div>,
        )}

      {activePopup === 'ai' &&
        renderPortal(
          <div
            ref={popupRef}
            role="group"
            aria-label="AI Workmachine"
            className={`${popupClasses} w-[320px] md:w-[400px] max-w-[calc(100vw-24px)]`}
          >
            <div className="pb-4 mb-4 border-b border-stone-900/[0.06] text-[10px] font-semibold text-stone-500 uppercase tracking-[0.2em] px-1 flex items-center gap-2">
              <Computer size={14} strokeWidth={1.5} /> AI Workmachine
            </div>
            <div className="mb-3 flex flex-wrap gap-1.5">
              {[
                'Create a small vintage chest emblem',
                'Make the selected artwork smaller and centred',
                'Change the shirt to deep forest green',
              ].map((suggestion) => (
                <button key={suggestion} type="button" onClick={() => setAiPrompt(suggestion)} className="rounded-full border border-stone-200 bg-stone-50 px-2.5 py-1.5 text-[9px] text-stone-600 hover:bg-white">{suggestion}</button>
              ))}
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
              placeholder="Describe the change you want to make..."
              className={`w-full bg-stone-50 border border-stone-200/80 rounded-xl p-3 text-xs tracking-wide text-stone-900 focus:bg-white/70 focus:border-white/80 focus:ring-4 focus:ring-stone-900/5 focus:shadow-sm outline-none resize-none min-h-[120px] placeholder:text-stone-400 transition-all duration-500 ${SPRING_EASING}`}
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

      {activePopup === 'help' && renderPortal(
        <div
          ref={popupRef}
          role="dialog"
          aria-label="Caliqui Studio help and tutorials"
          className={`${popupClasses} w-[min(440px,calc(100vw-24px))] p-0`}
        >
          <div className="sticky top-0 z-10 border-b border-stone-200 bg-white/95 px-4 pb-3 pt-4 backdrop-blur-xl">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-stone-500">Studio guide</div>
                <h2 className="mt-1 text-base font-semibold tracking-tight text-stone-900">Learn your way around</h2>
              </div>
              <button type="button" aria-label="Close help" onClick={() => setActivePopup(null)} className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-stone-500 hover:bg-stone-100 hover:text-stone-900">×</button>
            </div>
            <label className="flex h-10 items-center gap-2 rounded-xl border border-stone-200 bg-stone-50 px-3 text-stone-400 focus-within:border-stone-400 focus-within:bg-white">
              <Search size={15} />
              <input
                data-help-search
                type="search"
                value={helpQuery}
                onChange={(event) => setHelpQuery(event.target.value)}
                placeholder="Search tools, guides and shortcuts…"
                aria-label="Search Studio help"
                className="min-w-0 flex-1 bg-transparent text-xs text-stone-800 outline-none placeholder:text-stone-400"
              />
            </label>
          </div>
          <div className="max-h-[min(62dvh,480px)] space-y-2 overflow-y-auto p-3">
            {visibleHelpArticles.length === 0 ? (
              <div className="rounded-xl border border-dashed border-stone-200 px-4 py-8 text-center text-xs text-stone-500">No guide matched that search. Try “move”, “camera”, “layers” or “save”.</div>
            ) : visibleHelpArticles.map((article) => (
              <details key={article.title} open={!!normalizedHelpQuery} className="group rounded-xl border border-stone-200 bg-white open:bg-stone-50/70">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-3 rounded-xl px-3 py-3 outline-none transition-colors hover:bg-stone-50 focus-visible:ring-2 focus-visible:ring-stone-400">
                  <span className="min-w-0">
                    <span className="block text-[9px] font-semibold uppercase tracking-[0.16em] text-stone-400">{article.category}</span>
                    <span className="mt-0.5 block text-xs font-semibold text-stone-900">{article.title}</span>
                    <span className="mt-1 block text-[10px] leading-relaxed text-stone-500">{article.summary}</span>
                  </span>
                  <span className="shrink-0 text-lg leading-none text-stone-400 transition-transform group-open:rotate-45">+</span>
                </summary>
                <ol className="space-y-2 border-t border-stone-200 px-4 py-3 pl-8 text-[11px] leading-relaxed text-stone-700 marker:font-semibold marker:text-stone-400">
                  {article.steps.map((step) => <li key={`${article.title}-${step}`} className="pl-1">{step}</li>)}
                </ol>
              </details>
            ))}
          </div>
        </div>,
      )}

      {/* A grouped, labelled tool rail: editing, history, view and creation. */}
      <div className="studio-toolbar-surface pointer-events-auto w-fit max-w-[calc(100vw-1rem)] overflow-x-auto overscroll-x-contain touch-pan-x rounded-2xl hide-scrollbar">
        <div className="studio-toolbar-inner flex min-w-max items-center gap-1.5 p-1.5 sm:p-2">
          <div className="studio-toolbar-group flex items-center gap-1">
            <ToolButton
              title="Edit artwork · V"
              active={globalToolMode === 'default' && !isDrawingMode}
              className="studio-tool-button--icon"
              onClick={() => { setDrawingMode(false); setGlobalToolMode('default'); setActivePopup(null); }}
            >
              <MousePointer2 size={17} strokeWidth={1.8} />
            </ToolButton>
            <ToolButton
              title="Select an area or multiple objects"
              active={globalToolMode === 'select'}
              className="studio-tool-button--icon"
              onClick={() => { setDrawingMode(false); setGlobalToolMode('select'); setActivePopup(null); }}
            >
              <SquareDashed size={17} strokeWidth={1.8} />
            </ToolButton>
          </div>

          <Divider />

          <div className="studio-toolbar-group flex items-center gap-0.5">
            <ToolButton title="Undo · Ctrl/⌘ Z" onClick={() => undo()} disabled={past.length === 0} className="studio-tool-button--icon">
              <Undo2 size={17} strokeWidth={1.8} />
            </ToolButton>
            <ToolButton title="Redo · Ctrl/⌘ Shift Z" onClick={() => redo()} disabled={future.length === 0} className="studio-tool-button--icon hidden sm:inline-flex">
              <Redo2 size={17} strokeWidth={1.8} />
            </ToolButton>
          </div>

          <Divider />

          <div className="studio-toolbar-group flex items-center gap-1">
            <ToolButton
              title="Add text, images, shapes, drawings or templates"
              active={activePopup === 'add' || activePopup === 'library' || activePopup === 'shapes' || activePopup === 'templates' || isDrawingMode}
              aria-expanded={activePopup === 'add' || activePopup === 'library' || activePopup === 'shapes' || activePopup === 'templates'}
              aria-haspopup="true"
              className="studio-tool-button--icon studio-tool-button--primary"
              onClick={() => togglePopup('add')}
            >
              <Plus size={17} strokeWidth={2} />
            </ToolButton>
            <ToolButton
              title="Image and artwork effects"
              active={activePopup === 'effects' || !!activeEffect}
              aria-expanded={activePopup === 'effects'}
              aria-haspopup="true"
              className="studio-tool-button--icon hidden 2xl:inline-flex"
              onClick={() => togglePopup('effects')}
            >
              <Wand2 size={17} strokeWidth={1.8} />
            </ToolButton>
            <ToolButton
              title="AI Workmachine"
              active={activePopup === 'ai'}
              aria-expanded={activePopup === 'ai'}
              aria-haspopup="true"
              className={`studio-tool-button--icon hidden 2xl:inline-flex ${isAiProcessing ? 'studio-tool-button--busy' : ''}`}
              onClick={() => togglePopup('ai')}
            >
              <Computer size={17} strokeWidth={1.8} />
            </ToolButton>
            <ToolButton
              title="Studio help, tutorials and shortcuts"
              active={activePopup === 'help'}
              aria-expanded={activePopup === 'help'}
              aria-haspopup="dialog"
              className="studio-tool-button--icon hidden 2xl:inline-flex"
              onClick={() => togglePopup('help')}
            >
              <Info size={17} strokeWidth={1.8} />
            </ToolButton>
          </div>

          <ToolButton title="More editor tools" active={activePopup === 'more'} aria-expanded={activePopup === 'more'} aria-haspopup="menu" className="studio-tool-button--icon 2xl:hidden" onClick={() => togglePopup('more')}>
            <MoreHorizontal size={19} strokeWidth={1.8} />
          </ToolButton>
        </div>
      </div>
    </div>
  );
}
