import { create } from 'zustand';
import { supabase } from '@/shared/lib/supabase';
import { deleteAssetFromDB, getAllAssetsFromDB, saveAssetToDB } from '@/shared/utils/asset-db';

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

// Define the exact string literal types for your 3D models
export type ApparelModelType = 'tshirtman' | 'tshirtwoman';

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
  type: ToolType;
  shapeType?: ShapeType;
  name: string;
  src: string;
  originalSrc?: string;
  meshName?: string;
  position: [number, number, number];
  rotation: [number, number, number];
  scale: number;
  scaleX?: number;
  scaleY?: number;
  rotationOffset?: number;
  groupId?: string;

  aspectRatio?: number;

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

interface EditorState {
  activeDesignId: string | null;
  designName: string;
  decals: DecalData[];
  selectedIds: string[];
  isDragging: boolean;
  autoSelect: boolean;

  isDrawingMode: boolean;
  editingDrawingId: string | null;
  globalToolMode: GlobalToolType;
  brushSettings: BrushSettings;

  marqueeStart: [number, number, number] | null;
  marqueeEnd: [number, number, number] | null;
  showMarqueeBox: boolean;

  past: DecalData[][];
  future: DecalData[][];
  clipboard: DecalData[];
  contextMenu: { x: number; y: number; decalId: string } | null;

  isProcessingBgRemoval: boolean;
  bgRemovalProgress: number;

  isAiProcessing: boolean;
  aiFeedbackMessage: string | null;

  tshirtColor: string;
  apparelModel: ApparelModelType; // Added Apparel Model State
  cameraView: CameraView;

  userAssets: UserAsset[];

  init: () => void;
  setDesignName: (name: string) => void;
  resetDesign: () => void;
  setSelectedId: (id: string | null, multi?: boolean) => void;
  setSelectedIds: (ids: string[]) => void;
  setIsDragging: (val: boolean) => void;
  setAutoSelect: (val: boolean) => void;

  setDrawingMode: (val: boolean) => void;
  setEditingDrawingId: (id: string | null) => void;
  setGlobalToolMode: (tool: GlobalToolType) => void;
  setBrushSettings: (settings: Partial<BrushSettings>) => void;

  setMarqueeStart: (pt: [number, number, number] | null) => void;
  setMarqueeEnd: (pt: [number, number, number] | null) => void;
  setShowMarqueeBox: (show: boolean) => void;

  setContextMenu: (menu: { x: number; y: number; decalId: string } | null) => void;

  addTool: (
    type: ToolType,
    imageSrc?: string,
    shapeType?: ShapeType,
    overrides?: Partial<DecalData>,
  ) => void;
  updateDecal: (id: string, updates: Partial<DecalData>) => void;
  updateText: (id: string, newText: string) => Promise<void>;
  removeDecal: (id: string) => void;
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

  dispatchAiCommand: (prompt: string, targetId?: string) => Promise<void>;

  setTshirtColor: (color: string) => void;
  setApparelModel: (model: ApparelModelType) => void; // Added Setter
  setCameraView: (view: CameraView) => void;

  addUserAsset: (blob: Blob, aspectRatio: number) => Promise<string>;
  removeUserAsset: (id: string) => Promise<void>;

  saveDesign: () => Promise<string>;
}

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

      const imgW = isImage ? img.naturalWidth || 512 : 512;
      const imgH = isImage ? img.naturalHeight || 512 : 512;

      const strokeW = isImage ? config.strokeWidth || 0 : 0;
      const blurW = config.shadowBlur || 0;
      const padding =
        strokeW / 2 +
        blurW +
        Math.max(Math.abs(config.shadowOffsetX || 0), Math.abs(config.shadowOffsetY || 0));

      const targetW = imgW + padding * 2;
      const targetH = imgH + padding * 2;

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

      const imgAspect = imgW / imgH;
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
        offCtx.drawImage(img, 0, 0, finalDrawW, finalDrawH);

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

    if (arc !== 0 || wave !== 0) {
      ctx.textAlign = 'center';
      const chars = text.split('');
      const totalWidth = ctx.measureText(text).width;

      let currentX = startX - totalWidth / 2;

      chars.forEach((char, _i) => {
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

        ctx.translate(charCenterX, startY + offsetY);
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
    } else {
      if (strokeWidth > 0) {
        ctx.lineWidth = strokeWidth;
        ctx.strokeStyle = strokeColor;
        ctx.strokeText(text, startX, startY);
      }
      ctx.fillText(text, startX, startY);
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
  lineHeight: 1,
  tintOpacity: 0,
  arc: 0,
  wave: 0,
  squeezeX: 1,
  squeezeY: 1,
  scale: 0.2,
  rotationOffset: 0,
  aspectRatio: 1,
});

export const useEditorStore = create<EditorState>((set, get) => ({
  activeDesignId: null,
  designName: 'Untitled Design',
  decals: [],
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
  contextMenu: null,

  isProcessingBgRemoval: false,
  bgRemovalProgress: 0,

  isAiProcessing: false,
  aiFeedbackMessage: null,

  tshirtColor: '#ffffff',
  apparelModel: 'tshirtman', // Default to men's shirt
  cameraView: 'front',

  userAssets: [],

  resetDesign: () => {
    localStorage.removeItem('caliqui_workspace');
    set({
      activeDesignId: null,
      designName: 'Untitled Design',
      decals: [],
      selectedIds: [],
      past: [],
      future: [],
      clipboard: [],
      tshirtColor: '#ffffff',
      apparelModel: 'tshirtman',
      cameraView: 'front',
      isDrawingMode: false,
      globalToolMode: 'default',
    });
  },

  init: async () => {
    let loadedAssets: UserAsset[] = [];
    try {
      const dbAssets = await getAllAssetsFromDB();
      loadedAssets = dbAssets.map((a) => ({
        id: a.id,
        src: URL.createObjectURL(a.blob),
        aspectRatio: a.aspectRatio,
      }));
    } catch (e) {
      console.error('Failed to load user assets from DB', e);
    }

    let initialDecals: DecalData[] = [];
    let initialColor = '#ffffff';
    let initialModel: ApparelModelType = 'tshirtman';
    let initialActiveId: string | null = null;
    let initialDesignName = 'Untitled Design';

    try {
      const storedWorkspace = localStorage.getItem('caliqui_workspace');
      if (storedWorkspace) {
        const parsed = JSON.parse(storedWorkspace);
        initialColor = parsed.tshirtColor || '#ffffff';
        initialModel = parsed.apparelModel || 'tshirtman';
        initialDecals = parsed.decals || [];
        initialActiveId = parsed.activeDesignId || null;
        initialDesignName = parsed.designName || 'Untitled Design';
      }
    } catch (e) {
      console.error('Failed to load workspace', e);
    }

    set({
      activeDesignId: initialActiveId,
      designName: initialDesignName,
      decals: initialDecals,
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
      bgRemovalProgress: 0,
      tshirtColor: initialColor,
      apparelModel: initialModel,
      cameraView: 'front',
      userAssets: loadedAssets,
      isAiProcessing: false,
      aiFeedbackMessage: null,
    });

    if (initialDecals.length > 0) {
      Promise.all(
        initialDecals.map(async (d) => {
          if (d.type === 'shape' || d.type === 'text') {
            const baseSrc = generateAssetTexture(d);
            const { src: finalSrc, aspectRatio } = await applyImageFilters({
              ...d,
              originalSrc: baseSrc,
            });
            return { ...d, src: finalSrc, originalSrc: baseSrc, aspectRatio };
          }
          return d;
        }),
      ).then((hydrated) => {
        set({ decals: hydrated });
        get().saveHistory();
      });
    }
  },

  setDesignName: (name) => set({ designName: name }),

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

  setMarqueeStart: (pt) => set({ marqueeStart: pt }),
  setMarqueeEnd: (pt) => set({ marqueeEnd: pt }),
  setShowMarqueeBox: (show) => set({ showMarqueeBox: show }),

  setContextMenu: (menu) => set({ contextMenu: menu }),

  addTool: (type, imageSrc, shapeType, overrides) => {
    get().saveHistory();

    const defaultConfig = getDefaultConfig(type);
    defaultConfig.type = type;
    defaultConfig.text = type === 'text' ? overrides?.text || 'CALIQUI' : undefined;

    if (shapeType) defaultConfig.shapeType = shapeType;

    const mergedConfig = { ...defaultConfig, ...overrides };

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

    const newDecal: DecalData = {
      id: crypto.randomUUID(),
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
      position: overrides?.position || [0, 0, 0],
      rotation: overrides?.rotation || [0, 0, 0],
      ...defaultConfig,
      ...overrides,
    } as DecalData;

    set((state) => {
      const isGroupedExtract = !!overrides?.groupId;
      return {
        decals: [...state.decals, newDecal],
        selectedIds: isGroupedExtract ? [...state.selectedIds, newDecal.id] : [newDecal.id],
      };
    });
  },

  updateDecal: (id, updates) =>
    set((state) => ({
      decals: state.decals.map((d) => (d.id === id ? { ...d, ...updates } : d)),
    })),

  updateText: async (id, newText) => {
    get().saveHistory();
    const decal = get().decals.find((d) => d.id === id);
    if (decal?.type !== 'text') return;

    const updatedDecal = { ...decal, text: newText };
    const baseSrc = generateAssetTexture(updatedDecal);
    const { src: finalSrc, aspectRatio } = await applyImageFilters({
      ...updatedDecal,
      originalSrc: baseSrc,
    });

    set((state) => ({
      decals: state.decals.map((d) =>
        d.id === id ? { ...d, text: newText, src: finalSrc, aspectRatio } : d,
      ),
    }));
  },

  removeDecal: (id) => {
    get().saveHistory();
    set((state) => ({
      decals: state.decals.filter((d) => d.id !== id),
      selectedIds: state.selectedIds.filter((sid) => sid !== id),
      isDragging: false,
    }));
  },

  deleteSelected: () => {
    const { selectedIds, decals } = get();
    if (selectedIds.length === 0) return;
    get().saveHistory();
    set({
      decals: decals.filter((d) => !selectedIds.includes(d.id)),
      selectedIds: [],
    });
  },

  moveLayerUp: (id) => {
    get().saveHistory();
    set((state) => {
      const index = state.decals.findIndex((d) => d.id === id);
      if (index === -1 || index === state.decals.length - 1) return state;
      const newDecals = [...state.decals];
      [newDecals[index], newDecals[index + 1]] = [newDecals[index + 1], newDecals[index]];
      return { decals: newDecals };
    });
  },

  moveLayerDown: (id) => {
    get().saveHistory();
    set((state) => {
      const index = state.decals.findIndex((d) => d.id === id);
      if (index <= 0) return state;
      const newDecals = [...state.decals];
      [newDecals[index - 1], newDecals[index]] = [newDecals[index], newDecals[index - 1]];
      return { decals: newDecals };
    });
  },

  undo: () => {
    const { past, decals, future } = get();
    if (past.length === 0) return;
    const previous = past[past.length - 1];
    const newPast = past.slice(0, past.length - 1);
    set({
      past: newPast,
      decals: previous,
      future: [JSON.parse(JSON.stringify(decals)), ...future],
    });
  },

  redo: () => {
    const { past, decals, future } = get();
    if (future.length === 0) return;
    const next = future[0];
    const newFuture = future.slice(1);
    set({ past: [...past, JSON.parse(JSON.stringify(decals))], decals: next, future: newFuture });
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
    const newDecals = clipboard.map((d) => ({
      ...d,
      id: crypto.randomUUID(),
      position: [d.position[0] + 0.05, d.position[1] - 0.05, d.position[2]] as [
        number,
        number,
        number,
      ],
    }));
    set({ decals: [...decals, ...newDecals], selectedIds: newDecals.map((d) => d.id) });
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

    set({
      decals: decals.map((d) => (selectedIds.includes(d.id) ? { ...d, groupId: newGroupId } : d)),
    });
  },

  removeFromGroup: () => {
    const { selectedIds, decals } = get();
    if (selectedIds.length === 0) return;

    get().saveHistory();
    set({
      decals: decals.map((d) => (selectedIds.includes(d.id) ? { ...d, groupId: undefined } : d)),
    });
  },

  breakGroup: () => {
    const { selectedIds, decals } = get();
    if (selectedIds.length === 0) return;

    const targetDecal = decals.find((d) => selectedIds.includes(d.id) && d.groupId);
    if (!targetDecal?.groupId) return;

    get().saveHistory();
    set({
      decals: decals.map((d) =>
        d.groupId === targetDecal.groupId ? { ...d, groupId: undefined } : d,
      ),
    });
  },

  applyBackgroundRemoval: async (id) => {
    const state = get();
    const decal = state.decals.find((d) => d.id === id);
    if (!decal?.src || (decal.type !== 'image' && decal.type !== 'drawing')) return;

    set({ isProcessingBgRemoval: true, bgRemovalProgress: 0 });

    await new Promise((resolve) => setTimeout(resolve, 100));

    try {
      const { removeImageBackground } = await import('@/shared/utils/ai-engine');

      const removedSrc = await removeImageBackground(decal.originalSrc || decal.src, (progress) =>
        set({ bgRemovalProgress: progress }),
      );

      const { src: finalSrc, aspectRatio } = await applyImageFilters({
        ...decal,
        originalSrc: removedSrc,
      });

      get().saveHistory();
      get().updateDecal(id, {
        src: finalSrc,
        originalSrc: removedSrc,
        aspectRatio,
      });
    } catch (error) {
      console.error('Failed to remove background', error);
    } finally {
      set({ isProcessingBgRemoval: false, bgRemovalProgress: 0 });
    }
  },

  dispatchAiCommand: async (prompt: string, targetId?: string) => {
    set({ isAiProcessing: true, aiFeedbackMessage: null });
    const { decals, saveHistory, updateDecal, setTshirtColor, addTool, removeDecal } = get();

    const manifest = decals.map((d) => {
      const { src, originalSrc, ...lightweightData } = d;
      return lightweightData;
    });

    const enhancedPrompt = targetId ? `[Focus Layer ID: ${targetId}] ${prompt}` : prompt;

    try {
      const { data, error } = await supabase.functions.invoke('ai-editor', {
        body: { prompt: enhancedPrompt, decalState: manifest },
      });

      if (error) throw new Error(error.message);
      const result = data;

      if (result.action === 'clarify' || result.action === 'no_op') {
        set({ aiFeedbackMessage: result.message || 'Could not apply AI edit.' });
        setTimeout(() => set({ aiFeedbackMessage: null }), 5000);
        return;
      }

      saveHistory();

      if (result.action === 'add_tool' && result.toolType) {
        addTool(result.toolType, undefined, result.shapeType, result.overrides);
        return;
      }

      if (result.action === 'update_workspace' && result.updates?.tshirtColor) {
        setTshirtColor(result.updates.tshirtColor);
        return;
      }

      if (result.action === 'delete_layers' && Array.isArray(result.ids)) {
        for (const id of result.ids) {
          removeDecal(id);
        }
        return;
      }

      if (result.action === 'group_layers' && Array.isArray(result.ids) && result.ids.length > 1) {
        const newGroupId = crypto.randomUUID();
        for (const id of result.ids) {
          updateDecal(id, { groupId: newGroupId });
        }
        return;
      }

      if (result.action === 'update' && Array.isArray(result.updates)) {
        await Promise.all(
          result.updates.map(async (updateReq: { id: string; changes: Partial<DecalData> }) => {
            const { id, changes } = updateReq;
            if (!id || !changes) return;

            // Aggressive Clamping for WebGL/Canvas Safety
            if (changes.scale !== undefined)
              changes.scale = Math.min(Math.max(changes.scale, 0.01), 10);
            if (changes.scaleX !== undefined)
              changes.scaleX = Math.min(Math.max(changes.scaleX, 0.01), 10);
            if (changes.scaleY !== undefined)
              changes.scaleY = Math.min(Math.max(changes.scaleY, 0.01), 10);
            if (changes.position) {
              changes.position = [
                Math.min(Math.max(changes.position[0], -2), 2),
                Math.min(Math.max(changes.position[1], -2), 2),
                Math.min(Math.max(changes.position[2], -2), 2),
              ];
            }
            if (changes.opacity !== undefined)
              changes.opacity = Math.min(Math.max(changes.opacity, 0), 100);
            if (changes.tintOpacity !== undefined)
              changes.tintOpacity = Math.min(Math.max(changes.tintOpacity, 0), 100);
            if (changes.shadowOpacity !== undefined)
              changes.shadowOpacity = Math.min(Math.max(changes.shadowOpacity, 0), 100);
            if (changes.shadowBlur !== undefined)
              changes.shadowBlur = Math.min(Math.max(changes.shadowBlur, 0), 100);
            if (changes.blur !== undefined) changes.blur = Math.min(Math.max(changes.blur, 0), 50);
            if (changes.brightness !== undefined)
              changes.brightness = Math.min(Math.max(changes.brightness, 0), 200);
            if (changes.contrast !== undefined)
              changes.contrast = Math.min(Math.max(changes.contrast, 0), 200);
            if (changes.saturation !== undefined)
              changes.saturation = Math.min(Math.max(changes.saturation, 0), 200);
            if (changes.grayscale !== undefined)
              changes.grayscale = Math.min(Math.max(changes.grayscale, 0), 100);
            if (changes.sepia !== undefined)
              changes.sepia = Math.min(Math.max(changes.sepia, 0), 100);
            if (changes.hueRotate !== undefined)
              changes.hueRotate = Math.min(Math.max(changes.hueRotate, 0), 360);
            if (changes.invert !== undefined)
              changes.invert = Math.min(Math.max(changes.invert, 0), 100);
            if (changes.arc !== undefined) changes.arc = Math.min(Math.max(changes.arc, -360), 360);
            if (changes.wave !== undefined) changes.wave = Math.min(Math.max(changes.wave, 0), 100);
            if (changes.fontSize !== undefined)
              changes.fontSize = Math.min(Math.max(changes.fontSize, 8), 400);

            const targetDecal = decals.find((d) => d.id === id);
            if (!targetDecal) return;

            const updatedDecal = { ...targetDecal, ...changes };

            if (updatedDecal.type === 'image' || updatedDecal.type === 'drawing') {
              const { src: newSrc, aspectRatio } = await applyImageFilters(updatedDecal);
              updateDecal(id, { ...changes, src: newSrc, aspectRatio });
            } else {
              const baseSrc = generateAssetTexture(updatedDecal);
              const { src: finalSrc, aspectRatio } = await applyImageFilters({
                ...updatedDecal,
                originalSrc: baseSrc,
              });
              updateDecal(id, { ...changes, src: finalSrc, originalSrc: baseSrc, aspectRatio });
            }
          }),
        );
      }
    } catch (e) {
      console.error('AI Command failed', e);
      set({ aiFeedbackMessage: 'AI request failed. Please try again.' });
      setTimeout(() => set({ aiFeedbackMessage: null }), 5000);
    } finally {
      set({ isAiProcessing: false });
    }
  },

  setTshirtColor: (color) => set({ tshirtColor: color }),
  setApparelModel: (model) => set({ apparelModel: model }),
  setCameraView: (view) => set({ cameraView: view }),

  addUserAsset: async (blob: Blob, aspectRatio: number) => {
    const id = crypto.randomUUID();
    const src = URL.createObjectURL(blob);

    set((state) => ({
      userAssets: [{ id, src, aspectRatio }, ...state.userAssets],
    }));

    try {
      await saveAssetToDB(id, blob, aspectRatio);
    } catch (e) {
      console.error('Failed to save asset to DB', e);
    }

    return src;
  },

  removeUserAsset: async (id: string) => {
    set((state) => {
      const asset = state.userAssets.find((a) => a.id === id);
      if (asset) URL.revokeObjectURL(asset.src);
      return { userAssets: state.userAssets.filter((a) => a.id !== id) };
    });

    try {
      await deleteAssetFromDB(id);
    } catch (e) {
      console.error('Failed to delete asset from DB', e);
    }
  },

  saveDesign: async () => {
    const state = get();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      throw new Error('Must be logged in to save');
    }

    const fullDecals = JSON.parse(JSON.stringify(state.decals));

    const designPayload = {
      user_id: user.id,
      name: state.designName || 'Untitled Design',
      canvas_state: fullDecals as unknown as Record<string, unknown>[],
      tshirt_color: state.tshirtColor,
      apparel_model: state.apparelModel, // Save the selected model to the database
      thumbnail_url: 'https://via.placeholder.com/512?text=3D+Model',
    };

    if (state.activeDesignId) {
      const { data: updateData, error: updateError } = await supabase
        .from('designs')
        .update(designPayload)
        .eq('id', state.activeDesignId)
        .select('id');

      if (updateError) throw updateError;

      if (updateData && updateData.length > 0) {
        return state.activeDesignId;
      }

      console.warn('Cached Design ID not found in database. Creating a new record instead.');
    }

    const { data: insertData, error: insertError } = await supabase
      .from('designs')
      .insert(designPayload)
      .select('id')
      .single();

    if (insertError) throw insertError;
    if (!insertData) throw new Error('Insert succeeded but no data returned.');

    set({ activeDesignId: insertData.id });
    return insertData.id;
  },
}));

let saveTimeout: ReturnType<typeof setTimeout>;
useEditorStore.subscribe((state) => {
  clearTimeout(saveTimeout);
  saveTimeout = setTimeout(() => {
    try {
      localStorage.setItem(
        'caliqui_workspace',
        JSON.stringify({
          decals: state.decals,
          tshirtColor: state.tshirtColor,
          apparelModel: state.apparelModel, // Remember the model choice locally
          activeDesignId: state.activeDesignId,
          designName: state.designName,
        }),
      );
    } catch (e) {
      console.warn('Workspace save failed (storage limits reached)', e);
    }
  }, 1000);
});
