export type LayerType = 'text' | 'image' | 'shape' | 'svg';

export interface Transform {
  x: number;
  y: number;
  scaleX: number;
  scaleY: number;
  rotation: number;
}

export interface LayerNode {
  id: string;
  type: LayerType;
  name: string;
  visible: boolean;
  locked: boolean;
  properties: Record<string, unknown>;
  transform: Transform;
}

export interface ProjectMetadata {
  title: string;
  createdAt: number;
  updatedAt: number;
  authorId: string | null;
}

export interface ProductConfig {
  manifestId: string;
  colorHex: string;
}

export interface ProjectDocument {
  id: string;
  version: string;
  metadata: ProjectMetadata;
  product: ProductConfig;
  nodes: Record<string, LayerNode>;
  children: string[];
}
