import { create } from 'zustand';
import { supabase, uploadAssetToStorage } from '@/shared/lib/supabase';
import {
  archiveAssetInDB,
  clearCheckpointFromDB,
  clearWorkspaceFromDB,
  deleteAssetFromDB,
  getAllAssetsFromDB,
  getAssetByIdFromDB,
  loadWorkspaceFromDB,
  saveAssetToDB,
  saveCheckpointToDB,
  saveWorkspaceToDB,
} from '@/shared/utils/asset-db';
import { processAndCompressImage } from '@/shared/utils/image-processing';

// --- MUTEXES & TOKENS ---
let activeInitCount = 0;
let isInitializing = false;
let initToken = 0;
let editorAsyncEpoch = 0;
let activeSavePromise: Promise<string> | null = null;
let saveTimeout: ReturnType<typeof setTimeout>;

let activeTransitionPromise: Promise<void> | null = null;
let activeTransitionToken = 0;
let activePersistenceMutex: Promise<void> | null = null;

// Centralized runtime registries for local asset persistence.
interface AssetPersistenceState {
  promise: Promise<void>;
  status: 'pending' | 'success' | 'failed';
}
const pendingAssetSaves = new Map<string, AssetPersistenceState>();
const failedAssetIds = new Set<string>();

export type ToolType = 'text' | 'shape' | 'image' | 'drawing';
export type GlobalToolType =
  | 'default'
  | 'select'
  | 'fill'
  | 'blur'
  | 'burn'
  | 'saturate'
  | 'erase'
  | 'camera';
export type CameraView = 'front' | 'back' | 'left' | 'right' | 'top' | 'custom';
export type ApparelModelType = 'tshirtman' | 'tshirtwoman' | 'tshirtoversized';
export type PlacementModeType = 'front' | 'back' | 'pass-through' | 'wrap';

export interface BrushSettings {
  size: number;
  color: string;
  intensity: number;
}

export type ShapeType =
  | 'rectangle'
  | 'circle'
  | 'triangle'
  | 'star'
  | 'diamond'
  | 'hexagon'
  | 'octagon'
  | 'pentagon'
  | 'ellipse'
  | 'capsule'
  | 'cross'
  | 'heart'
  | 'cloud'
  | 'arrow'
  | 'parallelogram'
  | 'trapezoid'
  | 'chat-bubble'
  | 'shield'
  | 'badge'
  | 'bookmark';

export interface UserAsset {
  id: string;
  src: string;
  aspectRatio: number;
}

export interface DecalData {
  id: string;
  assetId?: string; // Durable user asset identity
  type: ToolType;
  shapeType?: ShapeType;
  name: string;
  src?: string; // Runtime ONLY
  originalSrc?: string; // Runtime ONLY if local blob/data URL
  meshName?: string;
  /** Physical garment panel receiving this artwork; used by proof/export views. */
  meshSide?: 'front' | 'back';
  position: [number, number, number];
  rotation: [number, number, number];
  scale: number;
  scaleX?: number;
  scaleY?: number;
  zDepth?: number;
  rotationOffset?: number;
  groupId?: string;
  /** Layer visibility is persisted with the design. Omitted means visible for legacy designs. */
  visible?: boolean;
  /** Locked layers remain visible but cannot be manipulated on the 3D canvas. */
  locked?: boolean;
  /** Preserve image proportions when resizing from side handles. */
  lockAspectRatio?: boolean;
  /** Texture orientation flags; kept separate from physical transform scale. */
  flipX?: boolean;
  flipY?: boolean;
  needsInitialPlacement?: boolean; // Runtime ONLY
  initialPlacementScale?: number; // Runtime ONLY: explicit AI scale applied after surface placement
  aspectRatio?: number;
  placementMode?: PlacementModeType;
  angleLimit?: number;

  cropX?: number;
  cropY?: number;
  cropW?: number;
  cropH?: number;

  text?: string;
  fill?: string;
  fontSize?: number;
  fontFamily?: string;
  fontWeight?: string | number;
  textAlign?: 'left' | 'center' | 'right';
  letterSpacing?: number;
  lineHeight?: number;

  strokeWidth?: number;
  strokeColor?: string;
  borderStyle?: string;
  borderRadius?: number;

  opacity?: number;
  blendMode?: string;

  shadowColor?: string;
  shadowBlur?: number;
  shadowOffsetX?: number;
  shadowOffsetY?: number;
  shadowOpacity?: number;

  tintColor?: string;
  tintOpacity?: number;

  arc?: number;
  wave?: number;
  squeezeX?: number;
  squeezeY?: number;
  blur?: number;
  brightness?: number;
  contrast?: number;
  saturation?: number;
  grayscale?: number;
  sepia?: number;
  hueRotate?: number;
  invert?: number;
}

export interface RemixPayload {
  id: string;
  name: string;
  canvasState: unknown[];
  tshirtColor: string;
  apparelModel: ApparelModelType;
}

interface EditorState {
  editorRevision: number;
  decalAsyncGenerations: Record<string, number>;

  activeDesignId: string | null;
  designName: string;
  remixSourceId: string | null;
  decals: DecalData[];
  selectedIds: string[];
  isDragging: boolean;
  autoSelect: boolean;

  isDrawingMode: boolean;
  editingDrawingId: string | null;
  globalToolMode: GlobalToolType;
  brushSettings: BrushSettings;

  croppingDecalId: string | null;

  marqueeStart: [number, number, number] | null;
  marqueeEnd: [number, number, number] | null;
  showMarqueeBox: boolean;

  past: DecalData[][];
  future: DecalData[][];
  clipboard: DecalData[];
  contextMenu: { x: number; y: number; decalId: string } | null;

  bgRemovalActiveCount: number;
  isProcessingBgRemoval: boolean;
  bgRemovalProgress: number;

  aiActiveCount: number;
  isAiProcessing: boolean;
  aiFeedbackMessage: string | null;

  tshirtColor: string;
  apparelModel: ApparelModelType;
  cameraView: CameraView;

  userAssets: UserAsset[];

  init: () => Promise<void>;
  setDesignName: (name: string) => void;
  resetDesign: () => Promise<void>;
  loadRemix: (payload: RemixPayload) => Promise<void>;

  setSelectedId: (id: string | null, multi?: boolean) => void;
  setSelectedIds: (ids: string[]) => void;
  setIsDragging: (val: boolean) => void;
  setAutoSelect: (val: boolean) => void;

  setDrawingMode: (val: boolean) => void;
  setEditingDrawingId: (id: string | null) => void;
  setGlobalToolMode: (tool: GlobalToolType) => void;
  setBrushSettings: (settings: Partial<BrushSettings>) => void;
  setCroppingDecalId: (id: string | null) => void;

  setMarqueeStart: (pt: [number, number, number] | null) => void;
  setMarqueeEnd: (pt: [number, number, number] | null) => void;
  setShowMarqueeBox: (show: boolean) => void;

  setContextMenu: (menu: { x: number; y: number; decalId: string } | null) => void;

  addTool: (
    type: ToolType,
    imageSrc?: string,
    shapeType?: ShapeType,
    overrides?: Partial<DecalData>,
    noHistory?: boolean,
  ) => void;
  updateDecal: (id: string, updates: Partial<DecalData>) => void;
  setDecalVisibility: (id: string, visible: boolean) => void;
  setDecalLocked: (id: string, locked: boolean) => void;
  reorderLayer: (id: string, targetId: string) => void;
  replaceDecalImage: (id: string, blob: Blob, aspectRatio: number) => Promise<void>;
  updateText: (id: string, newText: string) => Promise<void>;
  removeDecal: (id: string, noHistory?: boolean) => void;
  moveLayerUp: (id: string) => void;
  moveLayerDown: (id: string) => void;
  saveHistory: () => void;
  undo: () => void;
  redo: () => void;
  copy: () => void;
  cut: () => void;
  paste: () => void;
  duplicate: () => void;
  deleteSelected: () => void;
  selectAll: () => void;
  groupSelected: () => void;
  removeFromGroup: () => void;
  breakGroup: () => void;

  applyBackgroundRemoval: (id: string) => Promise<void>;
  dispatchAiCommand: (prompt: string, targetIds?: string[]) => Promise<void>;

  setTshirtColor: (color: string) => void;
  setApparelModel: (model: ApparelModelType) => void;
  setCameraView: (view: CameraView) => void;

  addUserAsset: (
    blob: Blob,
    aspectRatio: number,
  ) => Promise<{ id: string; src: string; aspectRatio: number }>;
  removeUserAsset: (id: string) => Promise<void>;
  replaceUserAsset: (
    oldId: string,
    blob: Blob,
    aspectRatio: number,
  ) => Promise<{ id: string; src: string; aspectRatio: number }>;

  saveDesign: () => Promise<string>;
}

// --- HELPER FUNCTIONS ---

const pruneGens = (gens: Record<string, number>, decals: DecalData[]) => {
  const activeIds = new Set(decals.map((d) => d.id));
  const res: Record<string, number> = {};
  for (const k in gens) {
    if (activeIds.has(k)) res[k] = gens[k];
  }
  return res;
};

const hexToRgba = (hex: string, opacityPercent: number) => {
  let c = hex.replace('#', '');
  if (c.length === 3)
    c = c
      .split('')
      .map((x) => x + x)
      .join('');
  const r = parseInt(c.slice(0, 2), 16) || 0;
  const g = parseInt(c.slice(2, 4), 16) || 0;
  const b = parseInt(c.slice(4, 6), 16) || 0;
  return `rgba(${r}, ${g}, ${b}, ${opacityPercent / 100})`;
};

const applyLineDash = (ctx: CanvasRenderingContext2D, style: string, width: number) => {
  if (style === 'dashed') ctx.setLineDash([width * 2, width * 2]);
  else if (style === 'dotted') ctx.setLineDash([width, width * 2]);
  else ctx.setLineDash([]);
};

export const extractLightweightManifest = (decals: DecalData[]): DecalData[] => {
  return decals.map((d) => {
    const blueprint = { ...d };

    delete blueprint.src;
    delete blueprint.needsInitialPlacement;
    delete blueprint.initialPlacementScale;

    // Strict invariant: Never persist an assetId whose local binary failed or is still saving
    if (blueprint.assetId) {
      const pState = pendingAssetSaves.get(blueprint.assetId);
      if ((pState && pState.status === 'pending') || failedAssetIds.has(blueprint.assetId)) {
        delete blueprint.assetId;
      }
    }

    if (blueprint.type === 'text' || blueprint.type === 'shape') {
      delete blueprint.originalSrc;
    } else if (blueprint.type === 'image' || blueprint.type === 'drawing') {
      if (
        blueprint.originalSrc &&
        (blueprint.originalSrc.startsWith('blob:') || blueprint.originalSrc.startsWith('data:'))
      ) {
        delete blueprint.originalSrc;
      }
    }

    return blueprint;
  });
};

const dataUrlToBlob = async (dataUrl: string): Promise<Blob> => {
  const res = await fetch(dataUrl);
  if (!res.ok) throw new Error(`HTTP error fetching asset: ${res.status} ${res.statusText}`);
  return await res.blob();
};

const isLocalBinary = (url?: string) => {
  if (!url) return false;
  return url.startsWith('blob:') || url.startsWith('data:');
};

const isBlobUrl = (url?: string) => {
  if (!url) return false;
  return url.startsWith('blob:');
};

const safeNum = (val: unknown, min: number, max: number, fallback: number): number => {
  if (typeof val === 'number' && Number.isFinite(val)) {
    return Math.min(Math.max(val, min), max);
  }
  if (typeof val === 'string') {
    const parsed = parseFloat(val);
    if (Number.isFinite(parsed)) {
      return Math.min(Math.max(parsed, min), max);
    }
  }
  return fallback;
};

const VALID_TOOL_TYPES: ToolType[] = ['text', 'shape', 'image', 'drawing'];
const VALID_PLACEMENT_MODES: PlacementModeType[] = ['front', 'back', 'pass-through', 'wrap'];
const VALID_TEXT_ALIGNS = ['left', 'center', 'right'];
const VALID_SHAPES: ShapeType[] = [
  'rectangle',
  'circle',
  'triangle',
  'star',
  'diamond',
  'hexagon',
  'octagon',
  'pentagon',
  'ellipse',
  'capsule',
  'cross',
  'heart',
  'cloud',
  'arrow',
  'parallelogram',
  'trapezoid',
  'chat-bubble',
  'shield',
  'badge',
  'bookmark',
];

const isValidToolType = (type: unknown): type is ToolType =>
  typeof type === 'string' && VALID_TOOL_TYPES.includes(type as ToolType);
const isValidShapeType = (type: unknown): type is ShapeType =>
  typeof type === 'string' && VALID_SHAPES.includes(type as ShapeType);
const isValidPlacementMode = (mode: unknown): mode is PlacementModeType =>
  typeof mode === 'string' && VALID_PLACEMENT_MODES.includes(mode as PlacementModeType);
const isValidTextAlign = (align: unknown): align is 'left' | 'center' | 'right' =>
  typeof align === 'string' && VALID_TEXT_ALIGNS.includes(align);

const AI_COLOR_PATTERN = /^(#[0-9a-f]{6}|transparent)$/i;
const AI_TEXTURE_REFRESH_KEYS = new Set<string>([
  'fill', 'opacity', 'text', 'fontSize', 'fontFamily', 'fontWeight', 'textAlign',
  'letterSpacing', 'lineHeight', 'strokeWidth', 'strokeColor', 'borderStyle',
  'borderRadius', 'shadowColor', 'shadowBlur', 'shadowOffsetX', 'shadowOffsetY',
  'shadowOpacity', 'arc', 'wave', 'squeezeX', 'squeezeY', 'blur', 'brightness',
  'contrast', 'saturation', 'grayscale', 'sepia', 'hueRotate', 'invert',
  'tintColor', 'tintOpacity', 'cropX', 'cropY', 'cropW', 'cropH',
]);
const AI_BLEND_MODES = [
  'normal', 'multiply', 'screen', 'overlay', 'darken', 'lighten', 'color-dodge',
  'color-burn', 'hard-light', 'soft-light', 'difference', 'exclusion', 'hue',
  'saturation', 'color', 'luminosity',
] as const;
const AI_BORDER_STYLES = ['solid', 'dashed', 'dotted'] as const;

const sanitizeAiOverrides = (overrides: unknown): Partial<DecalData> => {
  if (!overrides || typeof overrides !== 'object' || Array.isArray(overrides)) return {};
  const raw = overrides as Record<string, unknown>;
  const valid: Partial<DecalData> = {};
  const number = (key: string, min: number, max: number) => {
    const value = raw[key];
    if (typeof value === 'number' && Number.isFinite(value)) {
      return Math.min(Math.max(value, min), max);
    }
    return undefined;
  };
  const string = (key: string, maxLength: number, preserveLineBreaks = false) => {
    const value = raw[key];
    if (typeof value === 'string' && value.trim().length > 0) {
      const disallowedControls = preserveLineBreaks
        ? /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g
        : /[\u0000-\u001f\u007f]/g;
      return value.replace(disallowedControls, '').trim().slice(0, maxLength);
    }
    return undefined;
  };
  const color = (key: 'fill' | 'strokeColor' | 'tintColor' | 'shadowColor') => {
    const value = raw[key];
    if (typeof value === 'string' && AI_COLOR_PATTERN.test(value)) return value;
    return undefined;
  };

  const numericRanges: Array<[keyof DecalData, number, number]> = [
    ['scale', 0.01, 10], ['scaleX', 0.01, 10], ['scaleY', 0.01, 10],
    ['zDepth', 0.01, 15], ['angleLimit', 10, 90],
    ['rotationOffset', -Math.PI * 2, Math.PI * 2], ['aspectRatio', 0.01, 100],
    ['opacity', 0, 100], ['tintOpacity', 0, 100], ['shadowOpacity', 0, 100],
    ['shadowBlur', 0, 100], ['shadowOffsetX', -100, 100], ['shadowOffsetY', -100, 100],
    ['blur', 0, 50], ['brightness', 0, 200], ['contrast', 0, 200],
    ['saturation', 0, 200], ['grayscale', 0, 100], ['sepia', 0, 100],
    ['hueRotate', 0, 360], ['invert', 0, 100], ['arc', -360, 360], ['wave', 0, 100],
    ['squeezeX', 0.1, 3], ['squeezeY', 0.1, 3], ['fontSize', 8, 400],
    ['letterSpacing', -50, 80], ['lineHeight', 0.5, 4], ['strokeWidth', 0, 100],
    ['borderRadius', 0, 500], ['cropX', 0, 100], ['cropY', 0, 100],
    ['cropW', 0.1, 100], ['cropH', 0.1, 100],
  ];
  for (const [key, min, max] of numericRanges) {
    const value = number(String(key), min, max);
    if (value !== undefined) (valid as Record<string, unknown>)[key] = value;
  }

  if (Array.isArray(raw.position) && raw.position.length === 3 && raw.position.every((v) => typeof v === 'number' && Number.isFinite(v))) {
    valid.position = [
      safeNum(raw.position[0], -2, 2, 0),
      safeNum(raw.position[1], -2, 2, 0),
      safeNum(raw.position[2], -2, 2, 0),
    ];
  }
  if (Array.isArray(raw.rotation) && raw.rotation.length === 3 && raw.rotation.every((v) => typeof v === 'number' && Number.isFinite(v))) {
    valid.rotation = [
      safeNum(raw.rotation[0], -Math.PI * 2, Math.PI * 2, 0),
      safeNum(raw.rotation[1], -Math.PI * 2, Math.PI * 2, 0),
      safeNum(raw.rotation[2], -Math.PI * 2, Math.PI * 2, 0),
    ];
  }

  for (const key of ['fill', 'strokeColor', 'tintColor', 'shadowColor'] as const) {
    const value = color(key);
    if (value !== undefined) (valid as Record<string, unknown>)[key] = value;
  }
  const name = string('name', 80);
  if (name !== undefined) valid.name = name;
  const text = string('text', 300, true);
  if (text !== undefined) valid.text = text;
  const fontFamily = string('fontFamily', 80);
  if (fontFamily && /^[\w\s,'"-]+$/.test(fontFamily)) valid.fontFamily = fontFamily;
  const fontWeight = raw.fontWeight;
  if ((typeof fontWeight === 'number' && Number.isFinite(fontWeight)) ||
      (typeof fontWeight === 'string' && /^(normal|bold|bolder|lighter|[1-9]00)$/i.test(fontWeight))) {
    valid.fontWeight = typeof fontWeight === 'number' ? Math.min(900, Math.max(100, fontWeight)) : fontWeight;
  }
  const blendMode = raw.blendMode;
  if (typeof blendMode === 'string' && (AI_BLEND_MODES as readonly string[]).includes(blendMode)) valid.blendMode = blendMode;
  const borderStyle = raw.borderStyle;
  if (typeof borderStyle === 'string' && (AI_BORDER_STYLES as readonly string[]).includes(borderStyle)) valid.borderStyle = borderStyle;
  if (isValidPlacementMode(raw.placementMode)) valid.placementMode = raw.placementMode;
  if (isValidTextAlign(raw.textAlign)) valid.textAlign = raw.textAlign;
  if (typeof raw.flipX === 'boolean') valid.flipX = raw.flipX;
  if (typeof raw.flipY === 'boolean') valid.flipY = raw.flipY;
  if (typeof raw.lockAspectRatio === 'boolean') valid.lockAspectRatio = raw.lockAspectRatio;
  if (typeof raw.visible === 'boolean') valid.visible = raw.visible;
  if (typeof raw.locked === 'boolean') valid.locked = raw.locked;

  return valid;
};

export const applyImageFilters = (
  config: Partial<DecalData>,
): Promise<{ src: string; aspectRatio: number }> => {
  return new Promise((resolve) => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx || !config.originalSrc) return resolve({ src: config.src || '', aspectRatio: 1 });

    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const isImage = config.type === 'image';

      const baseImgW = isImage ? img.naturalWidth || 512 : 512;
      const baseImgH = isImage ? img.naturalHeight || 512 : 512;

      const cropX = config.cropX ?? 0;
      const cropY = config.cropY ?? 0;
      const cropW = config.cropW ?? 100;
      const cropH = config.cropH ?? 100;

      const sourceX = (cropX / 100) * baseImgW;
      const sourceY = (cropY / 100) * baseImgH;
      const sourceW = Math.max(1, (cropW / 100) * baseImgW);
      const sourceH = Math.max(1, (cropH / 100) * baseImgH);

      const strokeW = isImage ? config.strokeWidth || 0 : 0;
      const blurW = config.shadowBlur || 0;
      const padding =
        strokeW / 2 +
        blurW +
        Math.max(Math.abs(config.shadowOffsetX || 0), Math.abs(config.shadowOffsetY || 0));

      const targetW = sourceW + padding * 2;
      const targetH = sourceH + padding * 2;

      let scaleFactor = 1;
      const MAX_DIM = 1024;
      if (targetW > MAX_DIM || targetH > MAX_DIM) {
        scaleFactor = Math.min(MAX_DIM / targetW, MAX_DIM / targetH);
      }

      const finalCanvasW = targetW * scaleFactor;
      const finalCanvasH = targetH * scaleFactor;

      canvas.width = finalCanvasW;
      canvas.height = finalCanvasH;
      ctx.clearRect(0, 0, finalCanvasW, finalCanvasH);

      const availW = Math.max(1, finalCanvasW - padding * scaleFactor * 2);
      const availH = Math.max(1, finalCanvasH - padding * scaleFactor * 2);

      const imgAspect = sourceW / sourceH;
      const availAspect = availW / availH;

      let finalDrawW = availW;
      let finalDrawH = availH;

      if (imgAspect > availAspect) {
        finalDrawH = availW / imgAspect;
      } else {
        finalDrawW = availH * imgAspect;
      }

      const offscreen = document.createElement('canvas');
      offscreen.width = finalDrawW;
      offscreen.height = finalDrawH;
      const offCtx = offscreen.getContext('2d');

      if (offCtx) {
        if (isImage && config.borderRadius && config.borderRadius > 0) {
          offCtx.beginPath();
          if (typeof offCtx.roundRect === 'function') {
            const radiusScale = Math.min(finalDrawW, finalDrawH) / 512;
            offCtx.roundRect(0, 0, finalDrawW, finalDrawH, config.borderRadius * radiusScale);
          } else {
            offCtx.rect(0, 0, finalDrawW, finalDrawH);
          }
          offCtx.clip();
        }

        const filters = [];
        if (config.blur) filters.push(`blur(${config.blur}px)`);
        if (config.brightness !== undefined && config.brightness !== 100)
          filters.push(`brightness(${config.brightness}%)`);
        if (config.contrast !== undefined && config.contrast !== 100)
          filters.push(`contrast(${config.contrast}%)`);
        if (config.saturation !== undefined && config.saturation !== 100)
          filters.push(`saturate(${config.saturation}%)`);
        if (config.grayscale) filters.push(`grayscale(${config.grayscale}%)`);
        if (config.sepia) filters.push(`sepia(${config.sepia}%)`);
        if (config.hueRotate) filters.push(`hue-rotate(${config.hueRotate}deg)`);
        if (config.invert) filters.push(`invert(${config.invert}%)`);

        if (filters.length > 0) offCtx.filter = filters.join(' ');

        offCtx.globalAlpha = (config.opacity ?? 100) / 100;
        offCtx.drawImage(img, sourceX, sourceY, sourceW, sourceH, 0, 0, finalDrawW, finalDrawH);

        if (config.tintColor && config.tintOpacity) {
          offCtx.globalCompositeOperation = 'source-atop';
          offCtx.globalAlpha = config.tintOpacity / 100;
          offCtx.fillStyle = config.tintColor;
          offCtx.fillRect(0, 0, finalDrawW, finalDrawH);
        }
      }

      const sqX = config.squeezeX || 1;
      const sqY = config.squeezeY || 1;
      const finalW = finalDrawW * sqX;
      const finalH = finalDrawH * sqY;

      const dx = (finalCanvasW - finalW) / 2;
      const dy = (finalCanvasH - finalH) / 2;

      if (config.shadowColor && config.shadowColor !== 'transparent' && blurW > 0) {
        ctx.shadowColor = hexToRgba(config.shadowColor, config.shadowOpacity ?? 100);
        ctx.shadowBlur = blurW * scaleFactor;
        ctx.shadowOffsetX = (config.shadowOffsetX || 0) * scaleFactor;
        ctx.shadowOffsetY = (config.shadowOffsetY || 0) * scaleFactor;
      }

      ctx.drawImage(offscreen, dx, dy, finalW, finalH);

      ctx.shadowColor = 'transparent';
      ctx.shadowBlur = 0;
      ctx.shadowOffsetX = 0;
      ctx.shadowOffsetY = 0;

      if (isImage && strokeW > 0) {
        ctx.beginPath();
        if (typeof ctx.roundRect === 'function') {
          const radiusScale = Math.min(finalDrawW, finalDrawH) / 512;
          ctx.roundRect(dx, dy, finalW, finalH, (config.borderRadius || 0) * radiusScale);
        } else {
          ctx.rect(dx, dy, finalW, finalH);
        }
        applyLineDash(ctx, config.borderStyle || 'solid', strokeW * scaleFactor);
        ctx.lineWidth = strokeW * scaleFactor;
        ctx.strokeStyle = config.strokeColor || '#000000';
        ctx.stroke();
      }

      resolve({
        src: canvas.toDataURL('image/png'),
        aspectRatio: finalCanvasW / finalCanvasH,
      });
    };
    img.onerror = () => resolve({ src: config.src || '', aspectRatio: 1 });
    img.src = config.originalSrc;
  });
};

export function generateAssetTexture(config: Partial<DecalData>): string {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';

  ctx.clearRect(0, 0, 512, 512);

  const {
    type = 'shape',
    shapeType = 'rectangle',
    text = 'CALIQUI',
    fill = '#000000',
    fontSize = 64,
    fontFamily = 'Inter',
    fontWeight = 'bold',
    textAlign = 'center',
    strokeWidth = 0,
    strokeColor = '#000000',
    borderStyle = 'solid',
    borderRadius = 0,
    letterSpacing = 0,
    lineHeight = 1.2,
    arc = 0,
    wave = 0,
  } = config;

  if (type === 'shape') {
    const padding = strokeWidth / 2;
    const size = 512 - padding * 2;
    const cx = 256;
    const cy = 256;
    const r = size / 2;
    const left = padding;
    const top = padding;
    const right = padding + size;
    const bottom = padding + size;

    ctx.fillStyle = fill;
    ctx.beginPath();

    switch (shapeType) {
      case 'circle':
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        break;
      case 'triangle':
        ctx.moveTo(cx, top);
        ctx.lineTo(right, bottom);
        ctx.lineTo(left, bottom);
        ctx.closePath();
        break;
      case 'star':
        for (let i = 0; i < 10; i++) {
          const rad = i % 2 === 0 ? r : r / 2.5;
          const a = (Math.PI * 2 * i) / 10 - Math.PI / 2;
          ctx.lineTo(cx + Math.cos(a) * rad, cy + Math.sin(a) * rad);
        }
        ctx.closePath();
        break;
      case 'diamond':
        ctx.moveTo(cx, top);
        ctx.lineTo(right, cy);
        ctx.lineTo(cx, bottom);
        ctx.lineTo(left, cy);
        ctx.closePath();
        break;
      case 'hexagon':
        for (let i = 0; i < 6; i++) {
          const a = (Math.PI * 2 * i) / 6 - Math.PI / 2;
          ctx.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
        }
        ctx.closePath();
        break;
      case 'octagon':
        for (let i = 0; i < 8; i++) {
          const a = (Math.PI * 2 * i) / 8 - Math.PI / 8;
          ctx.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
        }
        ctx.closePath();
        break;
      case 'pentagon':
        for (let i = 0; i < 5; i++) {
          const a = (Math.PI * 2 * i) / 5 - Math.PI / 2;
          ctx.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
        }
        ctx.closePath();
        break;
      case 'ellipse':
        ctx.ellipse(cx, cy, r, r * 0.6, 0, 0, Math.PI * 2);
        break;
      case 'capsule':
        if (typeof ctx.roundRect === 'function') {
          ctx.roundRect(left, cy - r * 0.5, size, r, r * 0.5);
        } else {
          ctx.rect(left, cy - r * 0.5, size, r);
        }
        break;
      case 'cross':
        ctx.moveTo(cx - r * 0.3, top);
        ctx.lineTo(cx + r * 0.3, top);
        ctx.lineTo(cx + r * 0.3, cy - r * 0.3);
        ctx.lineTo(right, cy - r * 0.3);
        ctx.lineTo(right, cy + r * 0.3);
        ctx.lineTo(cx + r * 0.3, cy + r * 0.3);
        ctx.lineTo(cx + r * 0.3, bottom);
        ctx.lineTo(cx - r * 0.3, bottom);
        ctx.lineTo(cx - r * 0.3, cy + r * 0.3);
        ctx.lineTo(left, cy + r * 0.3);
        ctx.lineTo(left, cy - r * 0.3);
        ctx.lineTo(cx - r * 0.3, cy - r * 0.3);
        ctx.closePath();
        break;
      case 'heart':
        ctx.moveTo(cx, top + r * 0.4);
        ctx.bezierCurveTo(cx, top, left, top, left, cy);
        ctx.bezierCurveTo(left, bottom - r * 0.4, cx, bottom, cx, bottom);
        ctx.bezierCurveTo(cx, bottom, right, bottom - r * 0.4, right, cy);
        ctx.bezierCurveTo(right, top, cx, top, cx, top + r * 0.4);
        ctx.closePath();
        break;
      case 'cloud':
        ctx.moveTo(cx - r * 0.5, cy + r * 0.4);
        ctx.bezierCurveTo(left, cy + r * 0.4, left, cy - r * 0.2, cx - r * 0.4, cy - r * 0.2);
        ctx.bezierCurveTo(cx - r * 0.4, top, cx + r * 0.4, top, cx + r * 0.4, cy - r * 0.2);
        ctx.bezierCurveTo(right, cy - r * 0.2, right, cy + r * 0.4, cx + r * 0.5, cy + r * 0.4);
        ctx.closePath();
        break;
      case 'arrow':
        ctx.moveTo(left, cy - r * 0.3);
        ctx.lineTo(cx + r * 0.1, cy - r * 0.3);
        ctx.lineTo(cx + r * 0.1, top);
        ctx.lineTo(right, cy);
        ctx.lineTo(cx + r * 0.1, bottom);
        ctx.lineTo(cx + r * 0.1, cy + r * 0.3);
        ctx.lineTo(left, cy + r * 0.3);
        ctx.closePath();
        break;
      case 'parallelogram':
        ctx.moveTo(left + r * 0.5, top);
        ctx.lineTo(right, top);
        ctx.lineTo(right - r * 0.5, bottom);
        ctx.lineTo(left, bottom);
        ctx.closePath();
        break;
      case 'trapezoid':
        ctx.moveTo(left + r * 0.5, top);
        ctx.lineTo(right - r * 0.5, top);
        ctx.lineTo(right, bottom);
        ctx.lineTo(left, bottom);
        ctx.closePath();
        break;
      case 'shield':
        ctx.moveTo(cx, bottom);
        ctx.bezierCurveTo(right, bottom - r * 0.5, right, top + r * 0.2, right, top);
        ctx.lineTo(left, top);
        ctx.bezierCurveTo(left, top + r * 0.2, left, bottom - r * 0.5, cx, bottom);
        ctx.closePath();
        break;
      case 'badge':
        for (let i = 0; i < 24; i++) {
          const rad = i % 2 === 0 ? r : r * 0.85;
          const a = (Math.PI * 2 * i) / 24;
          ctx.lineTo(cx + Math.cos(a) * rad, cy + Math.sin(a) * rad);
        }
        ctx.closePath();
        break;
      case 'bookmark':
        ctx.moveTo(left + r * 0.4, top);
        ctx.lineTo(right - r * 0.4, top);
        ctx.lineTo(right - r * 0.4, bottom);
        ctx.lineTo(cx, bottom - r * 0.4);
        ctx.lineTo(left + r * 0.4, bottom);
        ctx.closePath();
        break;
      case 'chat-bubble':
        ctx.moveTo(left + r * 0.2, top);
        ctx.lineTo(right - r * 0.2, top);
        ctx.quadraticCurveTo(right, top, right, top + r * 0.2);
        ctx.lineTo(right, cy + r * 0.3);
        ctx.quadraticCurveTo(right, cy + r * 0.5, right - r * 0.2, cy + r * 0.5);
        ctx.lineTo(cx + r * 0.2, cy + r * 0.5);
        ctx.lineTo(cx - r * 0.4, bottom);
        ctx.lineTo(cx - r * 0.2, cy + r * 0.5);
        ctx.lineTo(left + r * 0.2, cy + r * 0.5);
        ctx.quadraticCurveTo(left, cy + r * 0.5, left, cy + r * 0.3);
        ctx.lineTo(left, top + r * 0.2);
        ctx.quadraticCurveTo(left, top, left + r * 0.2, top);
        ctx.closePath();
        break;
      default:
        if (typeof ctx.roundRect === 'function') {
          ctx.roundRect(left, top, size, size, borderRadius);
        } else {
          ctx.rect(left, top, size, size);
        }
        break;
    }

    ctx.fill();

    if (strokeWidth > 0) {
      applyLineDash(ctx, borderStyle, strokeWidth);
      ctx.lineWidth = strokeWidth;
      ctx.strokeStyle = strokeColor;
      ctx.stroke();
    }
  } else if (type === 'text') {
    ctx.fillStyle = fill;
    ctx.font = `${fontWeight} ${fontSize}px ${fontFamily}, sans-serif`;
    ctx.textBaseline = 'middle';
    ctx.textAlign = textAlign as CanvasTextAlign;

    if (letterSpacing !== 0 && 'letterSpacing' in ctx) {
      (ctx as CanvasRenderingContext2D & { letterSpacing: string }).letterSpacing =
        `${letterSpacing}px`;
    }

    let startX = 256;
    if (textAlign === 'left') startX = strokeWidth + 24;
    if (textAlign === 'right') startX = 512 - strokeWidth - 24;
    const startY = 256;

    applyLineDash(ctx, borderStyle, strokeWidth);

    const lines = text.split('\n');
    const lineSpacing = fontSize * lineHeight;
    const totalHeight = lineSpacing * (lines.length - 1);
    let currentY = startY - totalHeight / 2;

    if (arc !== 0 || wave !== 0) {
      ctx.textAlign = 'center';

      lines.forEach((line) => {
        const chars = line.split('');
        const totalWidth = ctx.measureText(line).width;
        let currentX = startX - totalWidth / 2;

        chars.forEach((char) => {
          ctx.save();
          const charWidth = ctx.measureText(char).width;
          const charCenterX = currentX + charWidth / 2;

          let offsetY = 0;
          let rotation = 0;

          if (wave !== 0) {
            const waveAmp = (wave / 100) * 80;
            const freq = Math.PI / totalWidth;
            offsetY += Math.sin((charCenterX - startX) * freq) * waveAmp;
          }

          if (arc !== 0) {
            const arcRadius = 10000 / arc;
            const angle = (charCenterX - startX) / arcRadius;
            offsetY += arcRadius - Math.cos(angle) * arcRadius;
            rotation = angle;
          }

          ctx.translate(charCenterX, currentY + offsetY);
          ctx.rotate(rotation);

          if (strokeWidth > 0) {
            ctx.lineWidth = strokeWidth;
            ctx.strokeStyle = strokeColor;
            ctx.strokeText(char, 0, 0);
          }
          ctx.fillText(char, 0, 0);

          ctx.restore();
          currentX += charWidth;
        });
        currentY += lineSpacing;
      });
    } else {
      lines.forEach((line) => {
        if (strokeWidth > 0) {
          ctx.lineWidth = strokeWidth;
          ctx.strokeStyle = strokeColor;
          ctx.strokeText(line, startX, currentY);
        }
        ctx.fillText(line, startX, currentY);
        currentY += lineSpacing;
      });
    }
  }
  return canvas.toDataURL('image/png');
}

export const getDefaultConfig = (_type: ToolType): Partial<DecalData> => ({
  shapeType: 'rectangle',
  fill: '#000000',
  fontSize: 64,
  fontFamily: 'Inter',
  fontWeight: 'bold',
  textAlign: 'center',
  strokeWidth: 0,
  strokeColor: '#000000',
  borderStyle: 'solid',
  borderRadius: 0,
  opacity: 100,
  shadowColor: 'transparent',
  shadowBlur: 0,
  shadowOffsetX: 0,
  shadowOffsetY: 0,
  shadowOpacity: 100,
  blur: 0,
  brightness: 100,
  contrast: 100,
  saturation: 100,
  grayscale: 0,
  sepia: 0,
  hueRotate: 0,
  invert: 0,
  blendMode: 'normal',
  letterSpacing: 0,
  lineHeight: 1.2,
  tintOpacity: 0,
  arc: 0,
  wave: 0,
  squeezeX: 1,
  squeezeY: 1,
  scale: 0.2,
  zDepth: 0.12,
  angleLimit: 65,
  cropX: 0,
  cropY: 0,
  cropW: 100,
  cropH: 100,
  rotationOffset: 0,
  aspectRatio: 1,
  placementMode: 'front',
  visible: true,
  locked: false,
  lockAspectRatio: true,
  flipX: false,
  flipY: false,
});

export const useEditorStore = create<EditorState>((set, get) => ({
  editorRevision: 0,
  decalAsyncGenerations: {},

  activeDesignId: null,
  designName: 'Untitled Design',
  remixSourceId: null,
  decals: [],
  selectedIds: [],
  isDragging: false,
  autoSelect: true,

  isDrawingMode: false,
  editingDrawingId: null,
  globalToolMode: 'default',
  brushSettings: { size: 40, color: '#000000', intensity: 50 },

  croppingDecalId: null,

  marqueeStart: null,
  marqueeEnd: null,
  showMarqueeBox: false,

  past: [],
  future: [],
  clipboard: [],
  contextMenu: null,

  bgRemovalActiveCount: 0,
  isProcessingBgRemoval: false,
  bgRemovalProgress: 0,

  aiActiveCount: 0,
  isAiProcessing: false,
  aiFeedbackMessage: null,

  tshirtColor: '#ffffff',
  apparelModel: 'tshirtman',
  cameraView: 'front',

  userAssets: [],

  resetDesign: async () => {
    const startEpoch = ++editorAsyncEpoch;
    ++initToken;
    clearTimeout(saveTimeout);

    const currentTransitionToken = ++activeTransitionToken;
    let resolveTransition!: () => void;
    const previousTransition = activeTransitionPromise;
    activeTransitionPromise = new Promise<void>((resolve) => {
      resolveTransition = resolve;
    });

    try {
      if (previousTransition) {
        await previousTransition.catch(() => {});
      }
      if (activePersistenceMutex) {
        await activePersistenceMutex.catch(() => {});
      }

      const p1 = clearWorkspaceFromDB();
      const p2 = clearCheckpointFromDB();
      activePersistenceMutex = Promise.allSettled([p1, p2]).then(() => {});
      await activePersistenceMutex;

      if (editorAsyncEpoch !== startEpoch) return;

      set((state) => ({
        editorRevision: state.editorRevision + 1,
        decalAsyncGenerations: pruneGens(state.decalAsyncGenerations, []),
        activeDesignId: null,
        designName: 'Untitled Design',
        remixSourceId: null,
        decals: [],
        selectedIds: [],
        past: [],
        future: [],
        clipboard: [],
        tshirtColor: '#ffffff',
        apparelModel: 'tshirtman',
        cameraView: 'front',
        isDrawingMode: false,
        editingDrawingId: null,
        globalToolMode: 'default',
        croppingDecalId: null,
        marqueeStart: null,
        marqueeEnd: null,
        showMarqueeBox: false,
        isProcessingBgRemoval: false,
        bgRemovalActiveCount: 0,
        bgRemovalProgress: 0,
        isAiProcessing: false,
        aiActiveCount: 0,
        aiFeedbackMessage: null,
        contextMenu: null,
        isDragging: false,
      }));
    } finally {
      resolveTransition();
      if (activeTransitionToken === currentTransitionToken) {
        activeTransitionPromise = null;
      }
    }
  },

  loadRemix: async (payload: RemixPayload) => {
    const startEpoch = ++editorAsyncEpoch;
    ++initToken;
    clearTimeout(saveTimeout);

    const currentTransitionToken = ++activeTransitionToken;
    let resolveTransition!: () => void;
    const previousTransition = activeTransitionPromise;
    activeTransitionPromise = new Promise<void>((resolve) => {
      resolveTransition = resolve;
    });

    try {
      if (previousTransition) {
        await previousTransition.catch(() => {});
      }

      let currentState = get();
      let checkpointRevision = currentState.editorRevision;
      const isDirty =
        currentState.decals.length > 0 ||
        currentState.tshirtColor !== '#ffffff' ||
        currentState.apparelModel !== 'tshirtman' ||
        currentState.activeDesignId !== null ||
        currentState.remixSourceId !== null ||
        currentState.designName !== 'Untitled Design';

      if (isDirty) {
        let saveCheckpointComplete = false;
        while (!saveCheckpointComplete) {
          let pendingAssetsExist = true;
          while (pendingAssetsExist) {
            pendingAssetsExist = false;

            currentState = get();

            const assetsToWait: Promise<void>[] = [];
            for (const d of currentState.decals) {
              if (d.assetId) {
                const pState = pendingAssetSaves.get(d.assetId);
                if (pState && pState.status === 'pending') {
                  assetsToWait.push(pState.promise);
                }
              }
            }
            if (assetsToWait.length > 0) {
              await Promise.allSettled(assetsToWait);
            }

            if (editorAsyncEpoch !== startEpoch) return;

            if (get().editorRevision !== checkpointRevision) {
              currentState = get();
              checkpointRevision = currentState.editorRevision;
              pendingAssetsExist = true;
              break;
            }

            const assetsToRecover: DecalData[] = [];
            for (const d of currentState.decals) {
              if (d.assetId && failedAssetIds.has(d.assetId)) {
                assetsToRecover.push(d);
              }
            }
            if (assetsToRecover.length > 0) {
              for (const d of assetsToRecover) {
                if (!d.assetId) continue;
                if (
                  failedAssetIds.has(d.assetId) &&
                  d.originalSrc &&
                  isLocalBinary(d.originalSrc)
                ) {
                  try {
                    const blob = await dataUrlToBlob(d.originalSrc);
                    await saveAssetToDB(d.assetId, blob, d.aspectRatio || 1);
                    await archiveAssetInDB(d.assetId);
                    failedAssetIds.delete(d.assetId);
                  } catch (_e) {
                    throw new Error(
                      `Cannot remix: the current workspace contains a failed asset that is unrecoverable. ID: ${d.assetId}`,
                    );
                  }
                } else if (failedAssetIds.has(d.assetId)) {
                  throw new Error(
                    `Cannot remix: the current workspace contains a failed asset that is unrecoverable. ID: ${d.assetId}`,
                  );
                }
              }
              if (editorAsyncEpoch !== startEpoch) return;
              if (get().editorRevision !== checkpointRevision) {
                currentState = get();
                checkpointRevision = currentState.editorRevision;
                pendingAssetsExist = true;
                break;
              }
            }
          }

          if (editorAsyncEpoch !== startEpoch) return;
          if (get().editorRevision !== checkpointRevision) continue;

          if (activePersistenceMutex) {
            await activePersistenceMutex.catch(() => {});
          }

          if (editorAsyncEpoch !== startEpoch) return;
          if (get().editorRevision !== checkpointRevision) {
            currentState = get();
            checkpointRevision = currentState.editorRevision;
            continue;
          }

          let isCheckpointSafe = true;
          for (const d of currentState.decals) {
            if (d.assetId && failedAssetIds.has(d.assetId)) {
              isCheckpointSafe = false;
              break;
            }
          }

          if (!isCheckpointSafe) {
            throw new Error('Cannot remix: the current workspace contains a failed asset.');
          }

          const lightweightManifest = extractLightweightManifest(currentState.decals);
          const snapshot = JSON.stringify({
            decals: lightweightManifest,
            tshirtColor: currentState.tshirtColor,
            apparelModel: currentState.apparelModel,
            activeDesignId: currentState.activeDesignId,
            designName: currentState.designName,
            remixSourceId: currentState.remixSourceId,
          });

          const p = saveCheckpointToDB(snapshot);
          activePersistenceMutex = p;
          await p;

          if (editorAsyncEpoch !== startEpoch) return;
          if (get().editorRevision !== checkpointRevision) {
            currentState = get();
            checkpointRevision = currentState.editorRevision;
            continue;
          }

          saveCheckpointComplete = true;
        }
      } else {
        if (activePersistenceMutex) {
          await activePersistenceMutex.catch(() => {});
        }
      }

      if (editorAsyncEpoch !== startEpoch) return;

      const groupIdMap = new Map<string, string>();
      const remixedDecals: DecalData[] = (payload.canvasState as DecalData[]).map((d) => {
        const newId = crypto.randomUUID();
        let newGroupId = d.groupId;

        if (d.groupId) {
          if (!groupIdMap.has(d.groupId)) {
            groupIdMap.set(d.groupId, crypto.randomUUID());
          }
          newGroupId = groupIdMap.get(d.groupId);
        }

        return {
          ...d,
          id: newId,
          groupId: newGroupId,
          assetId: undefined,
          needsInitialPlacement: false,
        };
      });

      set((state) => ({
        editorRevision: state.editorRevision + 1,
        decalAsyncGenerations: pruneGens(state.decalAsyncGenerations, remixedDecals),
        activeDesignId: null,
        designName: `Remix of ${payload.name}`,
        remixSourceId: payload.id,
        decals: remixedDecals,
        tshirtColor: payload.tshirtColor,
        apparelModel: payload.apparelModel,
        selectedIds: [],
        past: [],
        future: [],
        clipboard: [],
        isDrawingMode: false,
        editingDrawingId: null,
        globalToolMode: 'default',
        croppingDecalId: null,
        marqueeStart: null,
        marqueeEnd: null,
        showMarqueeBox: false,
        isProcessingBgRemoval: false,
        bgRemovalActiveCount: 0,
        bgRemovalProgress: 0,
        isAiProcessing: false,
        aiActiveCount: 0,
        aiFeedbackMessage: null,
        contextMenu: null,
        isDragging: false,
      }));
    } finally {
      resolveTransition();
      if (activeTransitionToken === currentTransitionToken) {
        activeTransitionPromise = null;
      }
    }
  },

  init: async () => {
    const startEpoch = ++editorAsyncEpoch;
    const currentToken = ++initToken;
    activeInitCount++;
    isInitializing = true;
    clearTimeout(saveTimeout);

    const currentTransitionToken = ++activeTransitionToken;
    let resolveTransition!: () => void;
    const previousTransition = activeTransitionPromise;
    activeTransitionPromise = new Promise<void>((resolve) => {
      resolveTransition = resolve;
    });

    const locallyCreatedUrls = new Set<string>();

    try {
      if (previousTransition) {
        await previousTransition.catch(() => {});
      }

      if (activePersistenceMutex) {
        await activePersistenceMutex.catch(() => {});
      }

      if (currentToken !== initToken || editorAsyncEpoch !== startEpoch) {
        return;
      }

      let loadedAssets: UserAsset[] = [];
      try {
        const dbAssets = await getAllAssetsFromDB();
        loadedAssets = dbAssets.map((a) => {
          const url = URL.createObjectURL(a.blob);
          locallyCreatedUrls.add(url);
          return { id: a.id, src: url, aspectRatio: a.aspectRatio };
        });
      } catch (e) {
        console.error('Failed to load active user assets from DB', e);
      }

      if (currentToken !== initToken || editorAsyncEpoch !== startEpoch) {
        locallyCreatedUrls.forEach((u) => {
          URL.revokeObjectURL(u);
        });
        locallyCreatedUrls.clear();
        return;
      }

      let initialDecals: DecalData[] = [];
      let initialColor = '#ffffff';
      let initialModel: ApparelModelType = 'tshirtman';
      let initialActiveId: string | null = null;
      let initialDesignName = 'Untitled Design';
      let initialRemixId: string | null = null;

      try {
        const storedWorkspace = await loadWorkspaceFromDB();
        if (storedWorkspace) {
          const parsed = JSON.parse(storedWorkspace);
          initialColor = parsed.tshirtColor || '#ffffff';
          initialModel = parsed.apparelModel || 'tshirtman';
          initialDecals = parsed.decals || [];
          initialActiveId = parsed.activeDesignId || null;
          initialDesignName = parsed.designName || 'Untitled Design';
          initialRemixId = parsed.remixSourceId || null;
        }
      } catch (e) {
        console.error('Failed to load workspace from DB', e);
      }

      if (currentToken !== initToken || editorAsyncEpoch !== startEpoch) {
        locallyCreatedUrls.forEach((u) => {
          URL.revokeObjectURL(u);
        });
        locallyCreatedUrls.clear();
        return;
      }

      let hydrated: DecalData[] = [];
      if (initialDecals.length > 0) {
        hydrated = await Promise.all(
          initialDecals.map(async (d) => {
            let rehydratedOriginalSrc = d.originalSrc;

            if (d.assetId) {
              try {
                const localDbAsset = await getAssetByIdFromDB(d.assetId);
                if (localDbAsset?.blob) {
                  rehydratedOriginalSrc = URL.createObjectURL(localDbAsset.blob);
                  locallyCreatedUrls.add(rehydratedOriginalSrc);
                } else {
                  const {
                    data: { user },
                  } = await supabase.auth.getUser();
                  if (user) {
                    const { data: cloudAsset } = await supabase
                      .from('assets')
                      .select('storage_path')
                      .eq('id', d.assetId)
                      .eq('user_id', user.id)
                      .maybeSingle();

                    if (cloudAsset?.storage_path) {
                      rehydratedOriginalSrc = supabase.storage
                        .from('user-assets')
                        .getPublicUrl(cloudAsset.storage_path).data.publicUrl;
                    }
                  }
                }
              } catch (e) {
                console.warn(`Failed to rehydrate asset ${d.assetId}`, e);
              }
            }

            if (d.type === 'shape' || d.type === 'text') {
              const baseSrc = generateAssetTexture(d);
              const { src: finalSrc, aspectRatio } = await applyImageFilters({
                ...d,
                originalSrc: baseSrc,
              });
              return { ...d, src: finalSrc, originalSrc: baseSrc, aspectRatio };
            } else if (d.type === 'image' || d.type === 'drawing') {
              const { src: finalSrc, aspectRatio } = await applyImageFilters({
                ...d,
                originalSrc: rehydratedOriginalSrc,
              });
              return { ...d, src: finalSrc, originalSrc: rehydratedOriginalSrc, aspectRatio };
            }
            return d;
          }),
        );
      }

      if (currentToken !== initToken || editorAsyncEpoch !== startEpoch) {
        locallyCreatedUrls.forEach((u) => {
          URL.revokeObjectURL(u);
        });
        locallyCreatedUrls.clear();
        return;
      }

      set((state) => ({
        editorRevision: state.editorRevision + 1,
        activeDesignId: initialActiveId,
        designName: initialDesignName,
        remixSourceId: initialRemixId,
        decals: hydrated,
        selectedIds: [],
        isDragging: false,
        autoSelect: true,
        isDrawingMode: false,
        editingDrawingId: null,
        globalToolMode: 'default',
        brushSettings: { size: 40, color: '#000000', intensity: 50 },
        marqueeStart: null,
        marqueeEnd: null,
        showMarqueeBox: false,
        past: [],
        future: [],
        clipboard: [],
        isProcessingBgRemoval: false,
        bgRemovalActiveCount: 0,
        bgRemovalProgress: 0,
        tshirtColor: initialColor,
        apparelModel: initialModel,
        cameraView: 'front',
        userAssets: loadedAssets,
        isAiProcessing: false,
        aiActiveCount: 0,
        aiFeedbackMessage: null,
        decalAsyncGenerations: pruneGens(state.decalAsyncGenerations, hydrated),
      }));

      locallyCreatedUrls.clear();
    } catch (e) {
      locallyCreatedUrls.forEach((u) => {
        URL.revokeObjectURL(u);
      });
      locallyCreatedUrls.clear();
      console.error('Workspace init failed', e);
    } finally {
      activeInitCount--;
      if (activeInitCount === 0) {
        isInitializing = false;
      }
      resolveTransition();
      if (activeTransitionToken === currentTransitionToken) {
        activeTransitionPromise = null;
      }
    }
  },

  setDesignName: (name) =>
    set((state) => ({ designName: name, editorRevision: state.editorRevision + 1 })),

  saveHistory: () => {
    const { decals, past } = get();
    const MAX_HISTORY = 20;
    const newPast = [...past, JSON.parse(JSON.stringify(decals))].slice(-MAX_HISTORY);
    set({ past: newPast, future: [] });
  },

  setSelectedId: (id, multi = false) =>
    set((state) => {
      if (!id) return { selectedIds: [] };
      if (multi) {
        return {
          selectedIds: state.selectedIds.includes(id)
            ? state.selectedIds.filter((s) => s !== id)
            : [...state.selectedIds, id],
        };
      }
      return { selectedIds: [id] };
    }),

  setSelectedIds: (ids) => set({ selectedIds: ids }),
  selectAll: () => set((state) => ({ selectedIds: state.decals.map((d) => d.id) })),
  setIsDragging: (val) => set({ isDragging: val }),
  setAutoSelect: (val) => set({ autoSelect: val }),
  setDrawingMode: (val) => set({ isDrawingMode: val }),
  setEditingDrawingId: (id) => set({ editingDrawingId: id }),
  setGlobalToolMode: (tool) => set({ globalToolMode: tool }),
  setBrushSettings: (settings) =>
    set((state) => ({ brushSettings: { ...state.brushSettings, ...settings } })),
  setCroppingDecalId: (id) => set({ croppingDecalId: id }),
  setMarqueeStart: (pt) => set({ marqueeStart: pt }),
  setMarqueeEnd: (pt) => set({ marqueeEnd: pt }),
  setShowMarqueeBox: (show) => set({ showMarqueeBox: show }),
  setContextMenu: (menu) => set({ contextMenu: menu }),

  addTool: (type, imageSrc, shapeType, overrides, noHistory = false) => {
    if (!noHistory) get().saveHistory();

    const defaultConfig = getDefaultConfig(type);
    defaultConfig.type = type;

    let textDefault: string | undefined;
    if (type === 'text') {
      if (typeof overrides?.text === 'string') {
        textDefault = overrides.text;
      } else {
        textDefault = 'CALIQUI';
      }
    }
    defaultConfig.text = textDefault;

    if (shapeType) defaultConfig.shapeType = shapeType;

    let hasValidPosition = false;
    let safePosition: [number, number, number] = [0, 0, 0];
    const overridePos = overrides?.position;
    if (Array.isArray(overridePos) && overridePos.length === 3) {
      hasValidPosition = true;
      safePosition = [
        safeNum(overridePos[0], -2, 2, 0),
        safeNum(overridePos[1], -2, 2, 0),
        safeNum(overridePos[2], -2, 2, 0),
      ];
    }

    let safeRotation: [number, number, number] = [0, 0, 0];
    const overrideRot = overrides?.rotation;
    if (Array.isArray(overrideRot) && overrideRot.length === 3) {
      safeRotation = [
        safeNum(overrideRot[0], -Math.PI * 2, Math.PI * 2, 0),
        safeNum(overrideRot[1], -Math.PI * 2, Math.PI * 2, 0),
        safeNum(overrideRot[2], -Math.PI * 2, Math.PI * 2, 0),
      ];
    }

    const mergedConfig = { ...defaultConfig, ...overrides };
    const safeScale = safeNum(mergedConfig.scale, 0.01, 10, 0.2);
    const src =
      (type === 'image' || type === 'drawing') && imageSrc
        ? imageSrc
        : generateAssetTexture(mergedConfig);

    const shapeName = shapeType
      ? shapeType
          .split('-')
          .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
          .join(' ')
      : 'Rectangle';

    const finalId = crypto.randomUUID();

    const newDecal: DecalData = {
      ...defaultConfig,
      ...overrides,
      id: finalId,
      type,
      name:
        type === 'text'
          ? 'CALIQUI Text'
          : type === 'shape'
            ? shapeName
            : type === 'drawing'
              ? 'Illustration'
              : 'Image',
      src,
      originalSrc: type === 'image' || type === 'drawing' ? src : undefined,
      position: safePosition,
      rotation: safeRotation,
      scale: safeScale,
      needsInitialPlacement: !hasValidPosition,
      assetId: undefined,
    };
    if ((type === 'image' || type === 'drawing') && isLocalBinary(src)) {
      const newAssetId = crypto.randomUUID();
      newDecal.assetId = newAssetId;

      const pState: AssetPersistenceState = { promise: Promise.resolve(), status: 'pending' };

      pState.promise = dataUrlToBlob(src)
        .then((blob) => saveAssetToDB(newAssetId, blob, mergedConfig.aspectRatio || 1))
        .then(() => archiveAssetInDB(newAssetId))
        .then(() => {
          pState.status = 'success';
          pendingAssetSaves.delete(newAssetId);
          failedAssetIds.delete(newAssetId);
        })
        .catch((e) => {
          console.error('Asset persistence failed:', e);
          pState.status = 'failed';
          failedAssetIds.add(newAssetId);
          pendingAssetSaves.delete(newAssetId);
        });

      pendingAssetSaves.set(newAssetId, pState);
    }

    set((state) => {
      const isGroupedExtract = !!overrides?.groupId;
      const nextDecals = [...state.decals, newDecal];
      return {
        decals: nextDecals,
        selectedIds: isGroupedExtract ? [...state.selectedIds, newDecal.id] : [newDecal.id],
        editorRevision: state.editorRevision + 1,
        decalAsyncGenerations: {
          ...pruneGens(state.decalAsyncGenerations, nextDecals),
          [finalId]: 1,
        },
      };
    });
  },

  updateDecal: (id, updates) =>
    set((state) => {
      const index = state.decals.findIndex((d) => d.id === id);
      if (index === -1) return state;

      const {
        id: _id,
        type: _type,
        assetId: _assetId,
        src: _src,
        originalSrc: _originalSrc,
        needsInitialPlacement: _nip,
        ...safeUpdates
      } = updates as Partial<DecalData>;

      const nextDecals = state.decals.map((d) => (d.id === id ? { ...d, ...safeUpdates } : d));
      return {
        decals: nextDecals,
        editorRevision: state.editorRevision + 1,
        decalAsyncGenerations: {
          ...state.decalAsyncGenerations,
          [id]: (state.decalAsyncGenerations[id] || 0) + 1,
        },
      };
    }),

  setDecalVisibility: (id, visible) => {
    const current = get().decals.find((decal) => decal.id === id);
    if (!current || (current.visible !== false) === visible) return;
    get().saveHistory();
    set((state) => ({
      decals: state.decals.map((decal) => (decal.id === id ? { ...decal, visible } : decal)),
      selectedIds: visible ? state.selectedIds : state.selectedIds.filter((selectedId) => selectedId !== id),
      editorRevision: state.editorRevision + 1,
      decalAsyncGenerations: {
        ...state.decalAsyncGenerations,
        [id]: (state.decalAsyncGenerations[id] || 0) + 1,
      },
    }));
  },

  setDecalLocked: (id, locked) => {
    const current = get().decals.find((decal) => decal.id === id);
    if (!current || Boolean(current.locked) === locked) return;
    get().saveHistory();
    set((state) => ({
      decals: state.decals.map((decal) => (decal.id === id ? { ...decal, locked } : decal)),
      editorRevision: state.editorRevision + 1,
      decalAsyncGenerations: {
        ...state.decalAsyncGenerations,
        [id]: (state.decalAsyncGenerations[id] || 0) + 1,
      },
    }));
  },

  // Layer list is displayed top-to-bottom, while the render stack is stored
  // bottom-to-top. Reorder using the same visible order users interact with.
  reorderLayer: (id, targetId) => {
    const current = get().decals;
    if (id === targetId) return;
    const source = current.find((decal) => decal.id === id);
    const target = current.find((decal) => decal.id === targetId);
    if (!source || !target || source.groupId !== target.groupId) return;

    const visibleOrder = [...current].reverse();
    const from = visibleOrder.findIndex((decal) => decal.id === id);
    const to = visibleOrder.findIndex((decal) => decal.id === targetId);
    if (from < 0 || to < 0) return;

    const nextVisible = [...visibleOrder];
    const [moving] = nextVisible.splice(from, 1);
    const targetIndex = nextVisible.findIndex((decal) => decal.id === targetId);
    if (targetIndex < 0) return;
    nextVisible.splice(targetIndex, 0, moving);
    if (nextVisible.every((decal, index) => decal.id === visibleOrder[index]?.id)) return;

    get().saveHistory();
    set((state) => ({
      decals: nextVisible.reverse(),
      editorRevision: state.editorRevision + 1,
      decalAsyncGenerations: {
        ...state.decalAsyncGenerations,
        [id]: (state.decalAsyncGenerations[id] || 0) + 1,
      },
    }));
  },

  replaceDecalImage: async (id, blob, aspectRatio) => {
    const existing = get().decals.find((decal) => decal.id === id);
    if (!existing || (existing.type !== 'image' && existing.type !== 'drawing')) {
      throw new Error('Only image and drawing layers can be replaced.');
    }

    const safeAspectRatio = Number.isFinite(aspectRatio) && aspectRatio > 0 ? aspectRatio : 1;
    const assetId = crypto.randomUUID();
    const originalSrc = URL.createObjectURL(blob);

    try {
      // Keep the source durable without adding it to the six-item reusable asset dock.
      await saveAssetToDB(assetId, blob, safeAspectRatio);
      await archiveAssetInDB(assetId);

      const filtered = await applyImageFilters({
        ...existing,
        originalSrc,
        aspectRatio: safeAspectRatio,
        cropX: 0,
        cropY: 0,
        cropW: 100,
        cropH: 100,
      });

      const latest = get().decals.find((decal) => decal.id === id);
      if (!latest) {
        URL.revokeObjectURL(originalSrc);
        return;
      }

      get().saveHistory();
      set((state) => ({
        decals: state.decals.map((decal) =>
          decal.id === id
            ? {
                ...decal,
                assetId,
                src: filtered.src,
                originalSrc,
                aspectRatio: filtered.aspectRatio || safeAspectRatio,
                cropX: 0,
                cropY: 0,
                cropW: 100,
                cropH: 100,
              }
            : decal,
        ),
        editorRevision: state.editorRevision + 1,
        decalAsyncGenerations: {
          ...state.decalAsyncGenerations,
          [id]: (state.decalAsyncGenerations[id] || 0) + 1,
        },
      }));
    } catch (error) {
      URL.revokeObjectURL(originalSrc);
      throw error;
    }
  },

  updateText: async (id, newText) => {
    const stateBefore = get();
    const decalBefore = stateBefore.decals.find((d) => d.id === id);
    if (decalBefore?.type !== 'text' || decalBefore.text === newText) return;

    const startEpoch = editorAsyncEpoch;

    set((state) => ({
      editorRevision: state.editorRevision + 1,
      decalAsyncGenerations: {
        ...state.decalAsyncGenerations,
        [id]: (state.decalAsyncGenerations[id] || 0) + 1,
      },
    }));

    const newGen = get().decalAsyncGenerations[id];
    const updatedDecal = { ...decalBefore, text: newText };
    const baseSrc = generateAssetTexture(updatedDecal);
    const { src: finalSrc, aspectRatio } = await applyImageFilters({
      ...updatedDecal,
      originalSrc: baseSrc,
    });

    if (editorAsyncEpoch !== startEpoch) return;
    if (get().decalAsyncGenerations[id] !== newGen) return;

    const decalAfter = get().decals.find((d) => d.id === id);
    if (decalAfter?.type !== 'text') return;

    get().saveHistory();

    set((state) => ({
      decals: state.decals.map((d) =>
        d.id === id ? { ...d, text: newText, src: finalSrc, aspectRatio } : d,
      ),
      editorRevision: state.editorRevision + 1,
      decalAsyncGenerations: { ...state.decalAsyncGenerations, [id]: newGen + 1 },
    }));
  },

  removeDecal: (id, noHistory = false) => {
    const state = get();
    if (!state.decals.some((d) => d.id === id)) return;
    if (!noHistory) state.saveHistory();

    set((state) => {
      const nextDecals = state.decals.filter((d) => d.id !== id);
      return {
        decals: nextDecals,
        selectedIds: state.selectedIds.filter((sid) => sid !== id),
        isDragging: false,
        editorRevision: state.editorRevision + 1,
        decalAsyncGenerations: pruneGens(state.decalAsyncGenerations, nextDecals),
      };
    });
  },

  deleteSelected: () => {
    const { selectedIds, decals } = get();
    if (selectedIds.length === 0) return;
    get().saveHistory();
    set((state) => {
      const newGens = { ...state.decalAsyncGenerations };
      selectedIds.forEach((id) => {
        newGens[id] = (newGens[id] || 0) + 1;
      });
      const nextDecals = decals.filter((d) => !selectedIds.includes(d.id));
      return {
        decals: nextDecals,
        selectedIds: [],
        editorRevision: state.editorRevision + 1,
        decalAsyncGenerations: pruneGens(newGens, nextDecals),
      };
    });
  },

  moveLayerUp: (id) => {
    const state = get();
    const index = state.decals.findIndex((d) => d.id === id);
    if (index === -1 || index === state.decals.length - 1) return;

    state.saveHistory();
    set((state) => {
      const newDecals = [...state.decals];
      [newDecals[index], newDecals[index + 1]] = [newDecals[index + 1], newDecals[index]];
      return {
        decals: newDecals,
        editorRevision: state.editorRevision + 1,
        decalAsyncGenerations: {
          ...state.decalAsyncGenerations,
          [id]: (state.decalAsyncGenerations[id] || 0) + 1,
        },
      };
    });
  },

  moveLayerDown: (id) => {
    const state = get();
    const index = state.decals.findIndex((d) => d.id === id);
    if (index <= 0) return;

    state.saveHistory();
    set((state) => {
      const newDecals = [...state.decals];
      [newDecals[index - 1], newDecals[index]] = [newDecals[index], newDecals[index - 1]];
      return {
        decals: newDecals,
        editorRevision: state.editorRevision + 1,
        decalAsyncGenerations: {
          ...state.decalAsyncGenerations,
          [id]: (state.decalAsyncGenerations[id] || 0) + 1,
        },
      };
    });
  },

  undo: () => {
    const { past, decals, future, editorRevision, decalAsyncGenerations } = get();
    if (past.length === 0) return;

    ++editorAsyncEpoch;
    const previous = past[past.length - 1];
    const newPast = past.slice(0, past.length - 1);

    const newGens = { ...decalAsyncGenerations };
    previous.forEach((d) => {
      newGens[d.id] = (newGens[d.id] || 0) + 1;
    });
    decals.forEach((d) => {
      newGens[d.id] = (newGens[d.id] || 0) + 1;
    });

    set({
      past: newPast,
      decals: previous,
      future: [JSON.parse(JSON.stringify(decals)), ...future],
      editorRevision: editorRevision + 1,
      decalAsyncGenerations: pruneGens(newGens, previous),
      bgRemovalActiveCount: 0,
      isProcessingBgRemoval: false,
      bgRemovalProgress: 0,
      aiActiveCount: 0,
      isAiProcessing: false,
    });
  },

  redo: () => {
    const { past, decals, future, editorRevision, decalAsyncGenerations } = get();
    if (future.length === 0) return;

    ++editorAsyncEpoch;
    const next = future[0];
    const newFuture = future.slice(1);

    const newGens = { ...decalAsyncGenerations };
    next.forEach((d) => {
      newGens[d.id] = (newGens[d.id] || 0) + 1;
    });
    decals.forEach((d) => {
      newGens[d.id] = (newGens[d.id] || 0) + 1;
    });

    set({
      past: [...past, JSON.parse(JSON.stringify(decals))],
      decals: next,
      future: newFuture,
      editorRevision: editorRevision + 1,
      decalAsyncGenerations: pruneGens(newGens, next),
      bgRemovalActiveCount: 0,
      isProcessingBgRemoval: false,
      bgRemovalProgress: 0,
      aiActiveCount: 0,
      isAiProcessing: false,
    });
  },

  copy: () => {
    const { decals, selectedIds } = get();
    const toCopy = decals.filter((d) => selectedIds.includes(d.id));
    if (toCopy.length > 0) set({ clipboard: JSON.parse(JSON.stringify(toCopy)) });
  },

  cut: () => {
    get().copy();
    get().deleteSelected();
  },

  paste: () => {
    const { clipboard, decals } = get();
    if (clipboard.length === 0) return;
    get().saveHistory();

    const groupIdMap = new Map<string, string>();

    const newDecals = clipboard.map((d) => {
      let newGroupId = d.groupId;
      if (d.groupId) {
        if (!groupIdMap.has(d.groupId)) {
          groupIdMap.set(d.groupId, crypto.randomUUID());
        }
        newGroupId = groupIdMap.get(d.groupId);
      }

      return {
        ...d,
        id: crypto.randomUUID(),
        groupId: newGroupId,
        needsInitialPlacement: false,
        position: [d.position[0] + 0.05, d.position[1] - 0.05, d.position[2]] as [
          number,
          number,
          number,
        ],
      };
    });
    set((state) => ({
      decals: [...decals, ...newDecals],
      selectedIds: newDecals.map((d) => d.id),
      editorRevision: state.editorRevision + 1,
    }));
  },

  duplicate: () => {
    get().copy();
    get().paste();
  },

  groupSelected: () => {
    const { selectedIds, decals } = get();
    if (selectedIds.length < 2) return;
    get().saveHistory();
    const newGroupId = crypto.randomUUID();
    set((state) => ({
      decals: decals.map((d) => (selectedIds.includes(d.id) ? { ...d, groupId: newGroupId } : d)),
      editorRevision: state.editorRevision + 1,
    }));
  },

  removeFromGroup: () => {
    const { selectedIds, decals } = get();
    if (selectedIds.length === 0) return;
    get().saveHistory();
    set((state) => ({
      decals: decals.map((d) => (selectedIds.includes(d.id) ? { ...d, groupId: undefined } : d)),
      editorRevision: state.editorRevision + 1,
    }));
  },

  breakGroup: () => {
    const { selectedIds, decals } = get();
    if (selectedIds.length === 0) return;
    const targetDecal = decals.find((d) => selectedIds.includes(d.id) && d.groupId);
    if (!targetDecal?.groupId) return;
    get().saveHistory();
    set((state) => ({
      decals: decals.map((d) =>
        d.groupId === targetDecal.groupId ? { ...d, groupId: undefined } : d,
      ),
      editorRevision: state.editorRevision + 1,
    }));
  },

  applyBackgroundRemoval: async (id) => {
    const stateBefore = get();
    const decalBefore = stateBefore.decals.find((d) => d.id === id);
    if (!decalBefore?.src || (decalBefore.type !== 'image' && decalBefore.type !== 'drawing'))
      return;

    const originalSrcAtStart = decalBefore.originalSrc || decalBefore.src;
    const startEpoch = editorAsyncEpoch;

    set((state) => ({
      editorRevision: state.editorRevision + 1,
      decalAsyncGenerations: {
        ...state.decalAsyncGenerations,
        [id]: (state.decalAsyncGenerations[id] || 0) + 1,
      },
      bgRemovalActiveCount: state.bgRemovalActiveCount + 1,
      isProcessingBgRemoval: true,
      bgRemovalProgress: 0,
    }));

    const newGen = get().decalAsyncGenerations[id];

    await new Promise((resolve) => setTimeout(resolve, 100));

    try {
      const { removeImageBackground } = await import('@/shared/utils/ai-engine');
      const removedSrc = await removeImageBackground(originalSrcAtStart, (progress) => {
        if (editorAsyncEpoch === startEpoch && get().decalAsyncGenerations[id] === newGen) {
          set({ bgRemovalProgress: progress });
        }
      });

      if (editorAsyncEpoch !== startEpoch || get().decalAsyncGenerations[id] !== newGen) return;

      const decalAfterBg = get().decals.find((d) => d.id === id);
      if (!decalAfterBg) return;

      const { src: finalSrc, aspectRatio } = await applyImageFilters({
        ...decalAfterBg,
        originalSrc: removedSrc,
      });

      if (editorAsyncEpoch !== startEpoch || get().decalAsyncGenerations[id] !== newGen) return;

      const derivedAssetId = crypto.randomUUID();
      const derivedBlob = await dataUrlToBlob(removedSrc);

      if (editorAsyncEpoch !== startEpoch || get().decalAsyncGenerations[id] !== newGen) return;

      await saveAssetToDB(derivedAssetId, derivedBlob, aspectRatio);
      await archiveAssetInDB(derivedAssetId);

      if (editorAsyncEpoch !== startEpoch || get().decalAsyncGenerations[id] !== newGen) {
        await deleteAssetFromDB(derivedAssetId);
        return;
      }

      get().saveHistory();

      set((state) => ({
        decals: state.decals.map((d) =>
          d.id === id
            ? { ...d, src: finalSrc, originalSrc: removedSrc, aspectRatio, assetId: derivedAssetId }
            : d,
        ),
        editorRevision: state.editorRevision + 1,
        decalAsyncGenerations: { ...state.decalAsyncGenerations, [id]: newGen + 1 },
      }));
    } catch (error) {
      console.error('Failed to remove background', error);
    } finally {
      if (editorAsyncEpoch === startEpoch) {
        set((state) => {
          const newCount = Math.max(0, state.bgRemovalActiveCount - 1);
          return {
            bgRemovalActiveCount: newCount,
            isProcessingBgRemoval: newCount > 0,
            bgRemovalProgress: 0,
          };
        });
      }
    }
  },

  dispatchAiCommand: async (prompt: string, targetIds: string[] = []) => {
    const cleanPrompt = prompt.trim();
    if (!cleanPrompt) {
      set({ aiFeedbackMessage: 'Describe the change you want to make first.' });
      return;
    }

    const startState = get();
    const startRev = startState.editorRevision;
    const startEpoch = editorAsyncEpoch;
    const validSelectedIds = [...new Set(targetIds)].filter((id) =>
      startState.decals.some((decal) => decal.id === id),
    ).slice(0, 60);
    const selectedManifestIds = new Set(validSelectedIds);
    const manifest = extractLightweightManifest(startState.decals)
      .sort((a, b) => Number(selectedManifestIds.has(b.id)) - Number(selectedManifestIds.has(a.id)))
      .slice(0, 100)
      .map((decal) => {
        const { src: _src, originalSrc: _originalSrc, assetId: _assetId, ...safeDecal } = decal;
        return safeDecal;
      });

    set((state) => ({
      aiActiveCount: state.aiActiveCount + 1,
      isAiProcessing: true,
      aiFeedbackMessage: null,
    }));

    try {
      const { data, error } = await supabase.functions.invoke('ai-editor', {
        body: {
          prompt: cleanPrompt,
          decalState: manifest,
          selectedIds: validSelectedIds,
          workspaceState: {
            tshirtColor: startState.tshirtColor,
            apparelModel: startState.apparelModel,
          },
        },
      });

      if (error) {
        const status = (error as unknown as { context?: { status?: number } }).context?.status;
        if (status === 401 || status === 403) throw new Error('Please sign in again before using the AI Workmachine.');
        if (status === 429) throw new Error('You have reached the AI usage limit. Please try again later.');
        if (status === 503) throw new Error('The AI Workmachine needs its Supabase rate-limit setup completed.');
        if (status === 504) throw new Error('The AI Workmachine took too long to respond. Please try a smaller change.');
        throw new Error('The AI Workmachine could not reach its service. Please try again.');
      }
      if (!data || typeof data !== 'object' || Array.isArray(data)) {
        throw new Error('The AI Workmachine returned an unreadable response. Please try again.');
      }

      if (editorAsyncEpoch !== startEpoch) return;
      if (get().editorRevision !== startRev) {
        set({ aiFeedbackMessage: 'Your design changed while the AI was working. Please run the command again.' });
        return;
      }

      const result = data as Record<string, unknown>;
      const action = result.action;
      const resultMessage = typeof result.message === 'string' ? result.message.slice(0, 400) : '';
      if (action === 'clarify' || action === 'no_op') {
        set({ aiFeedbackMessage: resultMessage || (action === 'clarify' ? 'Please clarify which artwork you want to change.' : 'I could not identify a safe edit to apply.') });
        return;
      }

      const currentState = get();
      let nextDecals = [...currentState.decals];
      let nextSelectedIds = [...currentState.selectedIds];
      let tShirtColorCommit = currentState.tshirtColor;
      const updatedGens: Record<string, number> = {};
      const changedIds: string[] = [];
      let applied = false;

      if (action === 'add_tool' && isValidToolType(result.toolType) && (result.toolType === 'shape' || result.toolType === 'text')) {
        const type = result.toolType as ToolType;
        const shapeType = type === 'shape'
          ? (isValidShapeType(result.shapeType) ? result.shapeType : undefined)
          : undefined;
        if (type === 'shape' && !shapeType) {
          set({ aiFeedbackMessage: 'The requested shape is not supported yet. Try a rectangle, circle, star or badge.' });
          return;
        }

        const validOverrides = sanitizeAiOverrides(result.overrides);
        const defaultConfig = getDefaultConfig(type);
        const mergedConfig: Partial<DecalData> = {
          ...defaultConfig,
          ...validOverrides,
          ...(shapeType ? { shapeType } : {}),
        };
        if (type === 'text' && !validOverrides.text) mergedConfig.text = 'CALIQUI';
        const src = generateAssetTexture(mergedConfig);
        const finalId = crypto.randomUUID();
        const hasExplicitPosition = Array.isArray(validOverrides.position);
        const label = shapeType
          ? shapeType.split('-').map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(' ')
          : 'CALIQUI Text';
        const newDecal: DecalData = {
          ...defaultConfig,
          ...validOverrides,
          id: finalId,
          type,
          shapeType: shapeType || undefined,
          name: validOverrides.name || label,
          src,
          originalSrc: undefined,
          position: validOverrides.position || [0, 0, 0],
          rotation: validOverrides.rotation || [0, 0, 0],
          scale: safeNum(validOverrides.scale, 0.01, 10, safeNum(defaultConfig.scale, 0.01, 10, 0.2)),
          needsInitialPlacement: !hasExplicitPosition,
          initialPlacementScale: validOverrides.scale,
          assetId: undefined,
        };
        nextDecals.push(newDecal);
        updatedGens[finalId] = (currentState.decalAsyncGenerations[finalId] || 0) + 1;
        changedIds.push(finalId);
        nextSelectedIds = [finalId];
        applied = true;
      } else if (action === 'update' && Array.isArray(result.updates)) {
        for (const updateReq of result.updates.slice(0, 30)) {
          if (!updateReq || typeof updateReq !== 'object' || Array.isArray(updateReq)) continue;
          const req = updateReq as Record<string, unknown>;
          const id = typeof req.id === 'string' ? req.id : null;
          if (!id) continue;
          const targetIdx = nextDecals.findIndex((decal) => decal.id === id);
          if (targetIdx < 0) continue;
          const validChanges = sanitizeAiOverrides(req.changes);
          const targetDecal = nextDecals[targetIdx];
          // The renderer uses scaleX/scaleY once either axis has been explicitly set.
          // Translate an AI uniform-scale update into both axes so resized layers visibly respond.
          const currentX = targetDecal.scaleX ?? targetDecal.scale ?? 0.2;
          const currentY = targetDecal.scaleY ?? targetDecal.scale ?? 0.2;
          const hasExplicitAxes = targetDecal.scaleX !== undefined || targetDecal.scaleY !== undefined;

          if (
            validChanges.scale !== undefined &&
            hasExplicitAxes &&
            validChanges.scaleX === undefined &&
            validChanges.scaleY === undefined
          ) {
            const currentMax = Math.max(0.01, currentX, currentY);
            const factor = validChanges.scale / currentMax;
            const nextX = safeNum(currentX * factor, 0.01, 10, currentX);
            const nextY = safeNum(currentY * factor, 0.01, 10, currentY);
            validChanges.scaleX = nextX;
            validChanges.scaleY = nextY;
            validChanges.scale = Math.max(nextX, nextY);
          } else if (targetDecal.lockAspectRatio === true) {
            // A single-axis AI resize must respect the layer's aspect-ratio lock.
            if (validChanges.scaleX !== undefined && validChanges.scaleY === undefined) {
              const factor = validChanges.scaleX / Math.max(0.01, currentX);
              validChanges.scaleY = safeNum(currentY * factor, 0.01, 10, currentY);
              validChanges.scale = Math.max(validChanges.scaleX, validChanges.scaleY);
            } else if (validChanges.scaleY !== undefined && validChanges.scaleX === undefined) {
              const factor = validChanges.scaleY / Math.max(0.01, currentY);
              validChanges.scaleX = safeNum(currentX * factor, 0.01, 10, currentX);
              validChanges.scale = Math.max(validChanges.scaleX, validChanges.scaleY);
            }
          }
          if (targetDecal.locked) {
            for (const key of Object.keys(validChanges)) {
              if (key !== 'locked') delete (validChanges as Record<string, unknown>)[key];
            }
          }
          if (Object.keys(validChanges).length === 0) continue;
          if (validChanges.locked !== undefined && Boolean(targetDecal.locked) === validChanges.locked && Object.keys(validChanges).length === 1) continue;
          const updatedDecal = { ...targetDecal, ...validChanges };
          const requiresTextureRefresh = Object.keys(validChanges).some((key) => AI_TEXTURE_REFRESH_KEYS.has(key));

          if (!requiresTextureRefresh) {
            // Transform, placement, visibility, lock and naming edits should not
            // redraw or re-filter a texture that has not visually changed.
            nextDecals[targetIdx] = updatedDecal;
          } else if (updatedDecal.type === 'image' || updatedDecal.type === 'drawing') {
            const { src: newSrc, aspectRatio } = await applyImageFilters(updatedDecal);
            nextDecals[targetIdx] = { ...updatedDecal, src: newSrc, aspectRatio };
          } else {
            const baseSrc = generateAssetTexture(updatedDecal);
            const { src: finalSrc, aspectRatio } = await applyImageFilters({
              ...updatedDecal,
              originalSrc: baseSrc,
            });
            nextDecals[targetIdx] = { ...updatedDecal, src: finalSrc, originalSrc: baseSrc, aspectRatio };
          }
          updatedGens[id] = (currentState.decalAsyncGenerations[id] || 0) + 1;
          changedIds.push(id);
          applied = true;
        }
        if (changedIds.length > 0) nextSelectedIds = [...new Set(changedIds)];
      } else if (action === 'update_workspace' && result.updates && typeof result.updates === 'object') {
        const color = (result.updates as Record<string, unknown>).tshirtColor;
        if (typeof color === 'string' && /^#[0-9A-Fa-f]{6}$/.test(color) && color.toLowerCase() !== currentState.tshirtColor.toLowerCase()) {
          tShirtColorCommit = color;
          applied = true;
        }
      } else if (action === 'delete_layers' && Array.isArray(result.ids)) {
        const idsToDelete = new Set(result.ids.filter((id): id is string =>
          typeof id === 'string' && currentState.decals.some((decal) => decal.id === id && !decal.locked),
        ));
        if (idsToDelete.size > 0) {
          nextDecals = nextDecals.filter((decal) => !idsToDelete.has(decal.id));
          idsToDelete.forEach((id) => {
            updatedGens[id] = (currentState.decalAsyncGenerations[id] || 0) + 1;
          });
          nextSelectedIds = currentState.selectedIds.filter((id) => !idsToDelete.has(id));
          applied = true;
        }
      } else if (action === 'group_layers' && Array.isArray(result.ids)) {
        const idsToGroup = [...new Set(result.ids.filter((id): id is string =>
          typeof id === 'string' && currentState.decals.some((decal) => decal.id === id && !decal.locked),
        ))];
        if (idsToGroup.length >= 2) {
          const newGroupId = crypto.randomUUID();
          const groupSet = new Set(idsToGroup);
          nextDecals = nextDecals.map((decal) => {
            if (!groupSet.has(decal.id)) return decal;
            updatedGens[decal.id] = (currentState.decalAsyncGenerations[decal.id] || 0) + 1;
            return { ...decal, groupId: newGroupId };
          });
          nextSelectedIds = idsToGroup;
          applied = true;
        }
      }

      if (!applied) {
        set({ aiFeedbackMessage: resultMessage || 'I understood the request, but it did not produce a supported change. Try being more specific.' });
        return;
      }

      if (get().editorRevision !== startRev || editorAsyncEpoch !== startEpoch) {
        if (editorAsyncEpoch === startEpoch) set({ aiFeedbackMessage: 'Your design changed while the AI was working. Please run the command again.' });
        return;
      }

      get().saveHistory();
      set((state) => ({
        decals: nextDecals,
        selectedIds: nextSelectedIds.filter((id) => nextDecals.some((decal) => decal.id === id)),
        tshirtColor: tShirtColorCommit,
        editorRevision: state.editorRevision + 1,
        decalAsyncGenerations: pruneGens({ ...state.decalAsyncGenerations, ...updatedGens }, nextDecals),
        aiFeedbackMessage: null,
      }));
    } catch (error) {
      console.error('AI Workmachine request failed:', error);
      if (editorAsyncEpoch === startEpoch) {
        set({ aiFeedbackMessage: error instanceof Error ? error.message : 'AI Workmachine failed. Please try again.' });
      }
    } finally {
      if (editorAsyncEpoch === startEpoch) {
        set((state) => {
          const newCount = Math.max(0, state.aiActiveCount - 1);
          return { aiActiveCount: newCount, isAiProcessing: newCount > 0 };
        });
      }
    }
  },

  setTshirtColor: (color) =>
    set((state) => ({ tshirtColor: color, editorRevision: state.editorRevision + 1 })),
  setApparelModel: (model) =>
    set((state) => ({ apparelModel: model, editorRevision: state.editorRevision + 1 })),
  setCameraView: (view) => set({ cameraView: view }),

  addUserAsset: async (blob: Blob, aspectRatio: number) => {
    const state = get();
    if (state.userAssets.length >= 6) {
      throw new Error('Maximum of 6 image assets allowed. Please remove one before uploading.');
    }

    const id = crypto.randomUUID();
    const src = URL.createObjectURL(blob);

    try {
      await saveAssetToDB(id, blob, aspectRatio);
      set((state) => ({ userAssets: [{ id, src, aspectRatio }, ...state.userAssets] }));
      return { id, src, aspectRatio };
    } catch (error) {
      URL.revokeObjectURL(src);
      throw error;
    }
  },

  removeUserAsset: async (id: string) => {
    await archiveAssetInDB(id);

    set((state) => {
      return { userAssets: state.userAssets.filter((a) => a.id !== id) };
    });

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        const { error } = await supabase
          .from('assets')
          .update({ is_archived: true })
          .eq('id', id)
          .eq('user_id', user.id);
        if (error) console.error('Failed to update cloud asset archive status:', error.message);
      }
    } catch (e) {
      console.error('Failed to sync archive status to cloud', e);
    }
  },

  replaceUserAsset: async (oldId: string, blob: Blob, aspectRatio: number) => {
    await get().removeUserAsset(oldId);
    return await get().addUserAsset(blob, aspectRatio);
  },

  saveDesign: () => {
    const performSave = async () => {
      while (true) {
        const transition: Promise<void> | null = activeTransitionPromise;

        if (transition === null) {
          break;
        }

        await transition.catch(() => {});
      }

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        throw new Error('Must be logged in to save');
      }

      while (true) {
        const transition: Promise<void> | null = activeTransitionPromise;

        if (transition === null) {
          break;
        }

        await transition.catch(() => {});
      }
      let state = get();
      let startRev = state.editorRevision;
      const startEpoch = editorAsyncEpoch;

      let pendingAssetsExist = true;
      while (pendingAssetsExist) {
        pendingAssetsExist = false;

        state = get();

        const assetsToWait: Promise<void>[] = [];
        for (const d of state.decals) {
          if (d.assetId) {
            const pState = pendingAssetSaves.get(d.assetId);
            if (pState && pState.status === 'pending') {
              assetsToWait.push(pState.promise);
            }
          }
        }

        if (assetsToWait.length > 0) {
          await Promise.allSettled(assetsToWait);
        }

        if (editorAsyncEpoch !== startEpoch) {
          throw new Error('Save aborted: editor epoch changed during save.');
        }

        if (get().editorRevision !== startRev) {
          state = get();
          startRev = state.editorRevision;
          pendingAssetsExist = true;
          continue;
        }

        const assetsToRecover: DecalData[] = [];
        for (const d of state.decals) {
          if (d.assetId && failedAssetIds.has(d.assetId)) {
            assetsToRecover.push(d);
          }
        }

        if (assetsToRecover.length > 0) {
          for (const d of assetsToRecover) {
            if (!d.assetId) continue;
            if (failedAssetIds.has(d.assetId) && d.originalSrc && isLocalBinary(d.originalSrc)) {
              try {
                const blob = await dataUrlToBlob(d.originalSrc);
                await saveAssetToDB(d.assetId, blob, d.aspectRatio || 1);
                await archiveAssetInDB(d.assetId);
                failedAssetIds.delete(d.assetId);
              } catch (e) {
                throw new Error(
                  `Failed to recover persistence for asset ${d.assetId}: ${e instanceof Error ? e.message : 'Unknown error'}`,
                );
              }
            } else if (failedAssetIds.has(d.assetId)) {
              throw new Error(`Cannot recover failed asset ${d.assetId}: Local binary is missing.`);
            }
          }
          if (editorAsyncEpoch !== startEpoch) {
            throw new Error('Save aborted: editor epoch changed during save.');
          }
          if (get().editorRevision !== startRev) {
            state = get();
            startRev = state.editorRevision;
            pendingAssetsExist = true;
          }
        }
      }

      const snapshotName = state.designName;
      const snapshotColor = state.tshirtColor;
      const snapshotModel = state.apparelModel;
      const snapshotRemixSourceId = state.remixSourceId;
      const snapshotActiveId = state.activeDesignId;

      const processingDecals = JSON.parse(JSON.stringify(state.decals)) as DecalData[];
      const usedAssetIds = new Set<string>();
      const localAssetsToUpload = new Map<string, Blob>();

      const newDurableIds = new Map<string, string>();

      for (const decal of processingDecals) {
        if (decal.type === 'image' || decal.type === 'drawing') {
          if (
            !decal.assetId &&
            decal.originalSrc &&
            (isLocalBinary(decal.originalSrc) || decal.originalSrc.startsWith('http'))
          ) {
            decal.assetId = crypto.randomUUID();
            const blob = await dataUrlToBlob(decal.originalSrc);
            await saveAssetToDB(decal.assetId, blob, decal.aspectRatio || 1);
            await archiveAssetInDB(decal.assetId);

            newDurableIds.set(decal.id, decal.assetId);
          }

          if (decal.assetId) {
            usedAssetIds.add(decal.assetId);

            if (!decal.originalSrc || isLocalBinary(decal.originalSrc)) {
              if (!localAssetsToUpload.has(decal.assetId)) {
                let blob: Blob | null = null;

                if (decal.originalSrc) {
                  try {
                    blob = await dataUrlToBlob(decal.originalSrc);
                  } catch (_e) {
                    /* Fallback */
                  }
                }

                if (!blob) {
                  const dbAsset = await getAssetByIdFromDB(decal.assetId);
                  if (dbAsset?.blob) blob = dbAsset.blob;
                }

                if (!blob) {
                  const { data: cloudAsset } = await supabase
                    .from('assets')
                    .select('storage_path')
                    .eq('id', decal.assetId)
                    .eq('user_id', user.id)
                    .maybeSingle();

                  if (!cloudAsset?.storage_path) {
                    throw new Error(`Failed to resolve durable binary for asset ${decal.assetId}`);
                  }
                } else {
                  localAssetsToUpload.set(decal.assetId, blob);
                }
              }
            }
          }
        }
      }

      if (editorAsyncEpoch !== startEpoch) {
        throw new Error('Save aborted: editor epoch changed during save.');
      }
      if (get().editorRevision !== startRev) {
        throw new Error('Save aborted: Canvas was modified during pre-save processing.');
      }

      const assetUrlMap = new Map<string, string>();

      await Promise.all(
        Array.from(usedAssetIds).map(async (aId) => {
          const { data: existingAsset, error: checkError } = await supabase
            .from('assets')
            .select('storage_path')
            .eq('id', aId)
            .eq('user_id', user.id)
            .maybeSingle();

          if (checkError)
            throw new Error(`Failed to verify metadata for asset ${aId}: ${checkError.message}`);

          if (existingAsset?.storage_path) {
            const publicUrl = supabase.storage
              .from('user-assets')
              .getPublicUrl(existingAsset.storage_path).data.publicUrl;
            assetUrlMap.set(aId, publicUrl);
          } else if (localAssetsToUpload.has(aId)) {
            const blob = localAssetsToUpload.get(aId);
            if (!blob) {
              throw new Error(`Local asset ${aId} disappeared before upload.`);
            }
            const { blob: compressedBlob } = await processAndCompressImage(blob, 90 * 1024);
            const publicUrl = await uploadAssetToStorage(compressedBlob, user.id);

            if (!publicUrl) throw new Error(`Upload failed for asset ${aId}`);

            const isActiveDockAsset = get().userAssets.some((a) => a.id === aId);
            const relativePath = publicUrl.split('user-assets/')[1] || publicUrl;

            const { error: insertError } = await supabase.from('assets').insert({
              id: aId,
              user_id: user.id,
              storage_path: relativePath,
              file_size: compressedBlob.size,
              mime_type: compressedBlob.type,
              is_archived: !isActiveDockAsset,
            });

            if (insertError)
              throw new Error(`Failed to create metadata for asset ${aId}: ${insertError.message}`);
            assetUrlMap.set(aId, publicUrl);
          } else {
            throw new Error(`Asset ${aId} is missing locally and not found in cloud storage.`);
          }
        }),
      );

      if (editorAsyncEpoch !== startEpoch) {
        throw new Error('Save aborted: editor epoch changed during save.');
      }
      if (get().editorRevision !== startRev) {
        throw new Error('Save aborted: Canvas was modified during upload phase.');
      }

      for (const decal of processingDecals) {
        if (decal.assetId) {
          const publicUrl = assetUrlMap.get(decal.assetId);
          if (publicUrl) decal.originalSrc = publicUrl;
        }
      }

      const lightweightManifest = extractLightweightManifest(processingDecals);
      const designPayload = {
        user_id: user.id,
        name: snapshotName || 'Untitled Design',
        canvas_state: lightweightManifest as unknown as Record<string, unknown>[],
        tshirt_color: snapshotColor || '#ffffff',
        apparel_model: snapshotModel,
        thumbnail_url: 'https://via.placeholder.com/512?text=3D+Model',
        remix_source_id: snapshotRemixSourceId,
        is_draft: false,
      };

      let targetDesignId = snapshotActiveId;

      if (editorAsyncEpoch !== startEpoch || get().editorRevision !== startRev) {
        throw new Error('Save aborted: Canvas was modified before database commit.');
      }

      if (targetDesignId) {
        const { error: updateError, data: updateData } = await supabase
          .from('designs')
          .update(designPayload)
          .eq('id', targetDesignId)
          .eq('user_id', user.id)
          .select('id')
          .single();

        if (updateError) throw new Error(`Failed to update design: ${updateError.message}`);
        if (!updateData) throw new Error('Design update failed or unauthorized.');
      } else {
        const { data: insertData, error: insertError } = await supabase
          .from('designs')
          .insert(designPayload)
          .select('id')
          .single();

        if (insertError) {
          throw new Error(`Failed to insert design: ${insertError.message}`);
        }

        targetDesignId = insertData.id;
      }

      if (!targetDesignId) {
        throw new Error('Failed to resolve saved design ID.');
      }

      if (editorAsyncEpoch !== startEpoch || get().editorRevision !== startRev) {
        throw new Error('Save aborted: Canvas was modified before asset sync.');
      }

      const { error: rpcError } = await supabase.rpc('sync_design_assets', {
        target_design_id: targetDesignId,
        active_asset_ids: Array.from(usedAssetIds),
      });

      if (rpcError) {
        throw new Error(
          `Design saved, but failed to sync asset relationships: ${rpcError.message}`,
        );
      }

      if (get().editorRevision === startRev && editorAsyncEpoch === startEpoch) {
        set((s) => {
          let hasMutations = false;
          const syncedDecals = s.decals.map((d) => {
            const updated = { ...d };
            if (newDurableIds.has(d.id)) {
              updated.assetId = newDurableIds.get(d.id);
              if (d.assetId !== updated.assetId) hasMutations = true;
            }
            if (updated.assetId && assetUrlMap.has(updated.assetId)) {
              const nextUrl = assetUrlMap.get(updated.assetId);
              if (nextUrl && updated.originalSrc !== nextUrl) {
                updated.originalSrc = nextUrl;
                hasMutations = true;
              }
            }
            return updated;
          });

          if (s.activeDesignId !== targetDesignId) hasMutations = true;

          if (hasMutations) {
            return {
              activeDesignId: targetDesignId,
              decals: syncedDecals,
              editorRevision: s.editorRevision + 1,
            };
          }
          return { activeDesignId: targetDesignId };
        });
      }

      return targetDesignId;
    };

    const promise = (async () => {
      if (activeSavePromise) {
        await activeSavePromise.catch(() => {});
      }
      return await performSave();
    })();

    activeSavePromise = promise;

    const cleanup = () => {
      if (activeSavePromise === promise) activeSavePromise = null;
    };
    promise.then(cleanup, cleanup);

    return promise;
  },
}));

// --- GLOBAL OBJECT URL GARBAGE COLLECTION ---
const extractAllBlobUrls = (state: EditorState) => {
  const urls = new Set<string>();
  const add = (u?: string) => {
    if (isBlobUrl(u)) urls.add(u as string);
  };
  state.decals.forEach((d) => {
    add(d.src);
    add(d.originalSrc);
  });
  state.userAssets.forEach((a) => {
    add(a.src);
  });
  state.past.forEach((arr) => {
    arr.forEach((d) => {
      add(d.src);
      add(d.originalSrc);
    });
  });
  state.future.forEach((arr) => {
    arr.forEach((d) => {
      add(d.src);
      add(d.originalSrc);
    });
  });
  state.clipboard.forEach((d) => {
    add(d.src);
    add(d.originalSrc);
  });
  return urls;
};

let previousUrls = new Set<string>();

useEditorStore.subscribe((state) => {
  const newUrls = extractAllBlobUrls(state);
  previousUrls.forEach((url) => {
    if (!newUrls.has(url)) URL.revokeObjectURL(url);
  });
  previousUrls = newUrls;

  const referencedAssetIds = new Set<string>();
  state.decals.forEach((d) => {
    if (d.assetId) referencedAssetIds.add(d.assetId);
  });
  state.past.forEach((arr) => {
    arr.forEach((d) => {
      if (d.assetId) referencedAssetIds.add(d.assetId);
    });
  });

  state.future.forEach((arr) => {
    arr.forEach((d) => {
      if (d.assetId) referencedAssetIds.add(d.assetId);
    });
  });
  state.clipboard.forEach((d) => {
    if (d.assetId) referencedAssetIds.add(d.assetId);
  });

  failedAssetIds.forEach((id) => {
    if (!referencedAssetIds.has(id)) failedAssetIds.delete(id);
  });

  if (isInitializing) return;

  clearTimeout(saveTimeout);
  saveTimeout = setTimeout(async () => {
    try {
      while (activeTransitionPromise) {
        await activeTransitionPromise.catch(() => {});
      }

      let resolveMutex: () => void = () => {};
      const currentMutex = new Promise<void>((res) => {
        resolveMutex = res;
      });
      const previousMutex = activePersistenceMutex;
      activePersistenceMutex = currentMutex;

      try {
        if (previousMutex) {
          await previousMutex.catch(() => {});
        }

        const autosaveEpoch = editorAsyncEpoch;
        let activeState = useEditorStore.getState();
        let autosaveRevision = activeState.editorRevision;

        let pendingAssetsExist = true;
        while (pendingAssetsExist) {
          pendingAssetsExist = false;
          const assetsToWait: Promise<void>[] = [];

          activeState.decals.forEach((d) => {
            if (d.assetId && pendingAssetSaves.has(d.assetId)) {
              const pState = pendingAssetSaves.get(d.assetId);
              if (pState && pState.status === 'pending') {
                assetsToWait.push(pState.promise);
              }
            }
          });

          if (assetsToWait.length > 0) {
            await Promise.allSettled(assetsToWait);
          }

          if (editorAsyncEpoch !== autosaveEpoch) {
            return;
          }

          if (useEditorStore.getState().editorRevision !== autosaveRevision) {
            activeState = useEditorStore.getState();
            autosaveRevision = activeState.editorRevision;
            pendingAssetsExist = true;
          }
        }

        if (editorAsyncEpoch !== autosaveEpoch) {
          return;
        }

        if (useEditorStore.getState().editorRevision !== autosaveRevision) {
          return;
        }

        let attempts = 0;
        const MAX_REPAIR_WRITES = 3;

        while (attempts < MAX_REPAIR_WRITES) {
          attempts++;

          if (editorAsyncEpoch !== autosaveEpoch) {
            return;
          }

          activeState = useEditorStore.getState();

          if (activeState.editorRevision !== autosaveRevision) {
            autosaveRevision = activeState.editorRevision;
          }

          // A newer revision may have introduced local assets that are
          // still being persisted. Wait for them before checkpointing.
          const repairAssetsToWait: Promise<void>[] = [];

          for (const d of activeState.decals) {
            if (d.assetId) {
              const pState = pendingAssetSaves.get(d.assetId);

              if (pState && pState.status === 'pending') {
                repairAssetsToWait.push(pState.promise);
              }
            }
          }

          if (repairAssetsToWait.length > 0) {
            await Promise.allSettled(repairAssetsToWait);
          }

          if (editorAsyncEpoch !== autosaveEpoch) {
            return;
          }

          // Waiting for asset persistence may have coincided with another edit.
          // Re-check the revision before producing the checkpoint.
          const stateAfterAssetWait = useEditorStore.getState();

          if (stateAfterAssetWait.editorRevision !== autosaveRevision) {
            activeState = stateAfterAssetWait;
            autosaveRevision = stateAfterAssetWait.editorRevision;
            continue;
          }

          let isCheckpointSafe = true;

          for (const d of activeState.decals) {
            if (d.assetId && failedAssetIds.has(d.assetId)) {
              isCheckpointSafe = false;
              break;
            }
          }

          if (!isCheckpointSafe) {
            return;
          }

          const lightweightManifest = extractLightweightManifest(activeState.decals);

          await saveWorkspaceToDB(
            JSON.stringify({
              decals: lightweightManifest,
              tshirtColor: activeState.tshirtColor,
              apparelModel: activeState.apparelModel,
              activeDesignId: activeState.activeDesignId,
              designName: activeState.designName,
              remixSourceId: activeState.remixSourceId,
            }),
          );

          // Critical post-write ownership check.
          if (editorAsyncEpoch !== autosaveEpoch) {
            return;
          }

          const latestState = useEditorStore.getState();

          if (latestState.editorRevision === autosaveRevision) {
            // The snapshot we just wrote still represents the live editor.
            break;
          }

          // A normal edit happened while the DB write was in flight.
          // Repair immediately while this autosave still owns the persistence mutex.
          activeState = latestState;
          autosaveRevision = latestState.editorRevision;
        }
      } finally {
        resolveMutex();
        if (activePersistenceMutex === currentMutex) {
          activePersistenceMutex = null;
        }
      }
    } catch (e) {
      console.warn('Workspace save failed (IndexedDB error)', e);
    }
  }, 1000);
});
