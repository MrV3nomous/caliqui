import type { LayerNode, ProjectDocument } from '@/core/document/types';

export type CommandType =
  | 'ADD_LAYER'
  | 'REMOVE_LAYER'
  | 'UPDATE_LAYER'
  | 'REORDER_LAYER'
  | 'CHANGE_PRODUCT_COLOR'
  | 'LOAD_DOCUMENT';

export interface BaseCommand {
  type: CommandType;
  timestamp: number;
}

export interface AddLayerCommand extends BaseCommand {
  type: 'ADD_LAYER';
  payload: {
    layer: LayerNode;
  };
}

export interface RemoveLayerCommand extends BaseCommand {
  type: 'REMOVE_LAYER';
  payload: {
    id: string;
  };
}

export interface UpdateLayerCommand extends BaseCommand {
  type: 'UPDATE_LAYER';
  payload: {
    id: string;
    updates: Partial<Omit<LayerNode, 'id' | 'type'>>;
  };
}

export interface ReorderLayerCommand extends BaseCommand {
  type: 'REORDER_LAYER';
  payload: {
    id: string;
    direction: 'up' | 'down' | 'top' | 'bottom';
  };
}

export interface ChangeProductColorCommand extends BaseCommand {
  type: 'CHANGE_PRODUCT_COLOR';
  payload: {
    colorHex: string;
  };
}

export interface LoadDocumentCommand extends BaseCommand {
  type: 'LOAD_DOCUMENT';
  payload: {
    document: ProjectDocument;
  };
}

export type EditorCommand =
  | AddLayerCommand
  | RemoveLayerCommand
  | UpdateLayerCommand
  | ReorderLayerCommand
  | ChangeProductColorCommand
  | LoadDocumentCommand;
