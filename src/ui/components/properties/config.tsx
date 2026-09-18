import { AlignCenter, AlignLeft, AlignRight } from 'lucide-react';
import type { ReactNode } from 'react';

export type ControlType = 'slider' | 'color' | 'select' | 'text' | 'button-group' | 'action';

export interface ControlOption {
  label: string;
  value: string | number;
  icon?: ReactNode;
}

export interface PropertyDef {
  id: string; // The key it maps to in DecalData (e.g., 'opacity', 'blur')
  label: string; // UI Label
  type: ControlType;
  min?: number; // For sliders
  max?: number;
  step?: number;
  options?: ControlOption[]; // For selects and button-groups
  suffix?: string; // e.g., 'px', '%', '°'
  actionType?: string; // For buttons like 'replace-image'
}

export interface PropertyGroup {
  id: string;
  title: string;
  properties: PropertyDef[];
}

// ==========================================
// REUSABLE PROPERTY GROUPS
// ==========================================

const SHAPE_TYPE_GROUP: PropertyGroup = {
  id: 'shape-type',
  title: 'Shape Settings',
  properties: [
    {
      id: 'shapeType',
      label: 'Shape',
      type: 'select',
      options: [
        { label: 'Rectangle', value: 'rectangle' },
        { label: 'Circle', value: 'circle' },
        { label: 'Triangle', value: 'triangle' },
        { label: 'Star', value: 'star' },
        { label: 'Diamond', value: 'diamond' },
        { label: 'Hexagon', value: 'hexagon' },
        { label: 'Octagon', value: 'octagon' },
        { label: 'Pentagon', value: 'pentagon' },
        { label: 'Ellipse', value: 'ellipse' },
        { label: 'Capsule', value: 'capsule' },
        { label: 'Cross', value: 'cross' },
        { label: 'Heart', value: 'heart' },
        { label: 'Cloud', value: 'cloud' },
        { label: 'Arrow', value: 'arrow' },
        { label: 'Parallelogram', value: 'parallelogram' },
        { label: 'Trapezoid', value: 'trapezoid' },
        { label: 'Chat Bubble', value: 'chat-bubble' },
        { label: 'Shield', value: 'shield' },
        { label: 'Badge', value: 'badge' },
        { label: 'Bookmark', value: 'bookmark' },
      ],
    },
  ],
};

const TRANSFORM_GROUP: PropertyGroup = {
  id: 'transform',
  title: 'Transform',
  properties: [
    { id: 'scale', label: 'Scale', type: 'slider', min: 1, max: 500, step: 1, suffix: '%' },
    {
      id: 'rotationOffset',
      label: 'Rotation',
      type: 'slider',
      min: -180,
      max: 180,
      step: 1,
      suffix: '°',
    },
  ],
};

const APPEARANCE_GROUP: PropertyGroup = {
  id: 'appearance',
  title: 'Appearance',
  properties: [
    { id: 'fill', label: 'Fill Color', type: 'color' },
    { id: 'opacity', label: 'Opacity', type: 'slider', min: 0, max: 100, step: 1, suffix: '%' },
  ],
};

const IMAGE_APPEARANCE_GROUP: PropertyGroup = {
  id: 'image-appearance',
  title: 'Appearance',
  properties: [
    { id: 'opacity', label: 'Opacity', type: 'slider', min: 0, max: 100, step: 1, suffix: '%' },
    { id: 'tintColor', label: 'Tint Color', type: 'color' },
    {
      id: 'tintOpacity',
      label: 'Tint Intensity',
      type: 'slider',
      min: 0,
      max: 100,
      step: 1,
      suffix: '%',
    },
  ],
};

const STROKE_GROUP: PropertyGroup = {
  id: 'stroke',
  title: 'Stroke / Border',
  properties: [
    { id: 'strokeWidth', label: 'Width', type: 'slider', min: 0, max: 64, step: 1, suffix: 'px' },
    { id: 'strokeColor', label: 'Color', type: 'color' },
    {
      id: 'borderStyle',
      label: 'Style',
      type: 'select',
      options: [
        { label: 'Solid', value: 'solid' },
        { label: 'Dashed', value: 'dashed' },
        { label: 'Dotted', value: 'dotted' },
      ],
    },
  ],
};

const RADIUS_GROUP: PropertyGroup = {
  id: 'radius',
  title: 'Corner Radius',
  properties: [
    {
      id: 'borderRadius',
      label: 'Radius',
      type: 'slider',
      min: 0,
      max: 256,
      step: 1,
      suffix: 'px',
    },
  ],
};

const SHADOW_GROUP: PropertyGroup = {
  id: 'shadow',
  title: 'Shadow & Glow',
  properties: [
    { id: 'shadowColor', label: 'Color', type: 'color' },
    { id: 'shadowBlur', label: 'Blur', type: 'slider', min: 0, max: 100, step: 1, suffix: 'px' },
    {
      id: 'shadowOffsetX',
      label: 'X Offset',
      type: 'slider',
      min: -100,
      max: 100,
      step: 1,
      suffix: 'px',
    },
    {
      id: 'shadowOffsetY',
      label: 'Y Offset',
      type: 'slider',
      min: -100,
      max: 100,
      step: 1,
      suffix: 'px',
    },
    {
      id: 'shadowOpacity',
      label: 'Opacity',
      type: 'slider',
      min: 0,
      max: 100,
      step: 1,
      suffix: '%',
    },
  ],
};

const TYPOGRAPHY_GROUP: PropertyGroup = {
  id: 'typography',
  title: 'Typography',
  properties: [
    { id: 'text', label: 'Content', type: 'text' },
    {
      id: 'fontFamily',
      label: 'Font',
      type: 'select',
      options: [
        { label: 'Arial', value: 'Arial' },
        { label: 'Arial Black', value: 'Arial Black' },
        { label: 'Baskerville', value: 'Baskerville' },
        { label: 'Bebas Neue', value: 'Bebas Neue' },
        { label: 'Brush Script MT', value: 'Brush Script MT' },
        { label: 'Cabin', value: 'Cabin' },
        { label: 'Cairo', value: 'Cairo' },
        { label: 'Cambria', value: 'Cambria' },
        { label: 'Candara', value: 'Candara' },
        { label: 'Caveat', value: 'Caveat' },
        { label: 'Century Gothic', value: 'Century Gothic' },
        { label: 'Cinzel', value: 'Cinzel' },
        { label: 'Comic Sans MS', value: 'Comic Sans MS' },
        { label: 'Consolas', value: 'Consolas' },
        { label: 'Courier New', value: 'Courier New' },
        { label: 'Crimson Text', value: 'Crimson Text' },
        { label: 'Dancing Script', value: 'Dancing Script' },
        { label: 'Dosis', value: 'Dosis' },
        { label: 'Exo', value: 'Exo' },
        { label: 'Fjalla One', value: 'Fjalla One' },
        { label: 'Franklin Gothic Medium', value: 'Franklin Gothic Medium' },
        { label: 'Garamond', value: 'Garamond' },
        { label: 'Geneva', value: 'Geneva' },
        { label: 'Georgia', value: 'Georgia' },
        { label: 'Heebo', value: 'Heebo' },
        { label: 'Helvetica', value: 'Helvetica' },
        { label: 'Hind', value: 'Hind' },
        { label: 'IBM Plex Sans', value: 'IBM Plex Sans' },
        { label: 'Impact', value: 'Impact' },
        { label: 'Inconsolata', value: 'Inconsolata' },
        { label: 'Inter', value: 'Inter' },
        { label: 'Josefin Sans', value: 'Josefin Sans' },
        { label: 'Kanit', value: 'Kanit' },
        { label: 'Karla', value: 'Karla' },
        { label: 'Lato', value: 'Lato' },
        { label: 'Libre Franklin', value: 'Libre Franklin' },
        { label: 'Lora', value: 'Lora' },
        { label: 'Lucida Bright', value: 'Lucida Bright' },
        { label: 'Lucida Console', value: 'Lucida Console' },
        { label: 'Lucida Sans Unicode', value: 'Lucida Sans Unicode' },
        { label: 'Merriweather', value: 'Merriweather' },
        { label: 'Montserrat', value: 'Montserrat' },
        { label: 'Mukta', value: 'Mukta' },
        { label: 'Muli', value: 'Muli' },
        { label: 'Noto Sans', value: 'Noto Sans' },
        { label: 'Nunito', value: 'Nunito' },
        { label: 'Open Sans', value: 'Open Sans' },
        { label: 'Oswald', value: 'Oswald' },
        { label: 'Oxygen', value: 'Oxygen' },
        { label: 'Pacifico', value: 'Pacifico' },
        { label: 'Palatino', value: 'Palatino' },
        { label: 'Papyrus', value: 'Papyrus' },
        { label: 'Playfair Display', value: 'Playfair Display' },
        { label: 'Poppins', value: 'Poppins' },
        { label: 'PT Sans', value: 'PT Sans' },
        { label: 'PT Serif', value: 'PT Serif' },
        { label: 'Quicksand', value: 'Quicksand' },
        { label: 'Raleway', value: 'Raleway' },
        { label: 'Righteous', value: 'Righteous' },
        { label: 'Roboto', value: 'Roboto' },
        { label: 'Rubik', value: 'Rubik' },
        { label: 'Signika', value: 'Signika' },
        { label: 'Source Sans Pro', value: 'Source Sans Pro' },
        { label: 'Tahoma', value: 'Tahoma' },
        { label: 'Teko', value: 'Teko' },
        { label: 'Times New Roman', value: 'Times New Roman' },
        { label: 'Titillium Web', value: 'Titillium Web' },
        { label: 'Trebuchet MS', value: 'Trebuchet MS' },
        { label: 'Ubuntu', value: 'Ubuntu' },
        { label: 'Verdana', value: 'Verdana' },
        { label: 'Work Sans', value: 'Work Sans' },
      ],
    },
    {
      id: 'fontWeight',
      label: 'Weight',
      type: 'select',
      options: [
        { label: 'Light', value: '300' },
        { label: 'Regular', value: '400' },
        { label: 'Medium', value: '500' },
        { label: 'SemiBold', value: '600' },
        { label: 'Bold', value: '700' },
        { label: 'Black', value: '900' },
      ],
    },
    {
      id: 'textAlign',
      label: 'Alignment',
      type: 'button-group',
      options: [
        { label: 'Left', value: 'left', icon: <AlignLeft size={16} /> },
        { label: 'Center', value: 'center', icon: <AlignCenter size={16} /> },
        { label: 'Right', value: 'right', icon: <AlignRight size={16} /> },
      ],
    },
    {
      id: 'letterSpacing',
      label: 'Letter Spacing',
      type: 'slider',
      min: -10,
      max: 50,
      step: 1,
      suffix: 'px',
    },
    {
      id: 'lineHeight',
      label: 'Line Height',
      type: 'slider',
      min: 0.5,
      max: 3,
      step: 0.1,
      suffix: 'x',
    },
  ],
};

const TEXT_DISTORTION_GROUP: PropertyGroup = {
  id: 'text-distortion',
  title: 'Text Distortion',
  properties: [
    { id: 'arc', label: 'Arc Curve', type: 'slider', min: -100, max: 100, step: 1, suffix: '%' },
    {
      id: 'wave',
      label: 'Wave Intensity',
      type: 'slider',
      min: -100,
      max: 100,
      step: 1,
      suffix: '%',
    },
  ],
};

const IMAGE_ACTIONS_GROUP: PropertyGroup = {
  id: 'image-actions',
  title: 'Image Content',
  properties: [
    { id: 'replaceImage', label: 'Replace Image', type: 'action', actionType: 'replace-image' },
    {
      id: 'squeezeX',
      label: 'Squeeze X',
      type: 'slider',
      min: 0.1,
      max: 2,
      step: 0.05,
      suffix: 'x',
    },
    {
      id: 'squeezeY',
      label: 'Squeeze Y',
      type: 'slider',
      min: 0.1,
      max: 2,
      step: 0.05,
      suffix: 'x',
    },
  ],
};

// FIX: New group specifically for custom Drawing overlays
const DRAWING_ACTIONS_GROUP: PropertyGroup = {
  id: 'drawing-actions',
  title: 'Drawing Content',
  properties: [
    { id: 'editDrawing', label: 'Edit Drawing', type: 'action', actionType: 'edit-drawing' },
    {
      id: 'squeezeX',
      label: 'Squeeze X',
      type: 'slider',
      min: 0.1,
      max: 2,
      step: 0.05,
      suffix: 'x',
    },
    {
      id: 'squeezeY',
      label: 'Squeeze Y',
      type: 'slider',
      min: 0.1,
      max: 2,
      step: 0.05,
      suffix: 'x',
    },
  ],
};

const FILTERS_GROUP: PropertyGroup = {
  id: 'filters',
  title: 'Image Filters',
  properties: [
    { id: 'blur', label: 'Blur', type: 'slider', min: 0, max: 50, step: 1, suffix: 'px' },
    {
      id: 'brightness',
      label: 'Brightness',
      type: 'slider',
      min: 0,
      max: 300,
      step: 1,
      suffix: '%',
    },
    { id: 'contrast', label: 'Contrast', type: 'slider', min: 0, max: 300, step: 1, suffix: '%' },
    {
      id: 'saturation',
      label: 'Saturation',
      type: 'slider',
      min: 0,
      max: 300,
      step: 1,
      suffix: '%',
    },
    {
      id: 'grayscale',
      label: 'Grayscale',
      type: 'slider',
      min: 0,
      max: 100,
      step: 1,
      suffix: '%',
    },
    { id: 'sepia', label: 'Sepia', type: 'slider', min: 0, max: 100, step: 1, suffix: '%' },
    {
      id: 'hueRotate',
      label: 'Hue Rotate',
      type: 'slider',
      min: 0,
      max: 360,
      step: 1,
      suffix: '°',
    },
    { id: 'invert', label: 'Invert', type: 'slider', min: 0, max: 100, step: 1, suffix: '%' },
  ],
};

const BLEND_MODE_GROUP: PropertyGroup = {
  id: 'blend-mode',
  title: 'Blend Mode',
  properties: [
    {
      id: 'blendMode',
      label: 'Mode',
      type: 'select',
      options: [
        { label: 'Normal', value: 'normal' },
        { label: 'Multiply', value: 'multiply' },
        { label: 'Screen', value: 'screen' },
        { label: 'Overlay', value: 'overlay' },
        { label: 'Darken', value: 'darken' },
        { label: 'Lighten', value: 'lighten' },
        { label: 'Color Dodge', value: 'color-dodge' },
        { label: 'Color Burn', value: 'color-burn' },
        { label: 'Difference', value: 'difference' },
        { label: 'Exclusion', value: 'exclusion' },
        { label: 'Hue', value: 'hue' },
        { label: 'Saturation', value: 'saturation' },
        { label: 'Color', value: 'color' },
        { label: 'Luminosity', value: 'luminosity' },
      ],
    },
  ],
};

// ==========================================
// ASSET MAPPINGS (What tools get what features)
// ==========================================

export const TOOL_CONFIG_MAP: Record<string, PropertyGroup[]> = {
  text: [
    TRANSFORM_GROUP,
    TYPOGRAPHY_GROUP,
    APPEARANCE_GROUP,
    STROKE_GROUP,
    SHADOW_GROUP,
    TEXT_DISTORTION_GROUP,
  ],
  shape: [
    SHAPE_TYPE_GROUP,
    TRANSFORM_GROUP,
    APPEARANCE_GROUP,
    STROKE_GROUP,
    RADIUS_GROUP,
    SHADOW_GROUP,
  ],
  image: [
    TRANSFORM_GROUP,
    IMAGE_ACTIONS_GROUP,
    IMAGE_APPEARANCE_GROUP,
    FILTERS_GROUP,
    BLEND_MODE_GROUP,
    STROKE_GROUP,
    RADIUS_GROUP,
    SHADOW_GROUP,
  ],
  // FIX: Provide explicit support for drawing overlays
  drawing: [
    TRANSFORM_GROUP,
    DRAWING_ACTIONS_GROUP,
    IMAGE_APPEARANCE_GROUP,
    FILTERS_GROUP,
    BLEND_MODE_GROUP,
    STROKE_GROUP,
    RADIUS_GROUP,
    SHADOW_GROUP,
  ],
};
