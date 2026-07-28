import type { EditorCommand } from '@/core/commands/types';
import type { ProjectDocument } from '@/core/document/types';

export class DocumentEngine {
  private document: ProjectDocument | null = null;

  private history: ProjectDocument[] = [];
  private historyIndex = -1;
  private readonly MAX_HISTORY = 50;

  public getDocument(): ProjectDocument | null {
    return this.document;
  }

  public dispatch(command: EditorCommand): void {
    if (command.type === 'LOAD_DOCUMENT') {
      this.document = structuredClone(command.payload.document);
      this.history = [structuredClone(this.document)];
      this.historyIndex = 0;
      return;
    }

    if (!this.document) {
      throw new Error('Cannot execute command: No document loaded.');
    }

    this.saveSnapshot();

    const nextDoc = structuredClone(this.document);
    nextDoc.metadata.updatedAt = command.timestamp;

    switch (command.type) {
      case 'ADD_LAYER': {
        const { layer } = command.payload;
        nextDoc.nodes[layer.id] = layer;
        nextDoc.children.push(layer.id);
        break;
      }
      case 'REMOVE_LAYER': {
        const { id } = command.payload;
        delete nextDoc.nodes[id];
        nextDoc.children = nextDoc.children.filter((childId) => childId !== id);
        break;
      }
      case 'UPDATE_LAYER': {
        const { id, updates } = command.payload;
        const existingNode = nextDoc.nodes[id];
        if (existingNode) {
          nextDoc.nodes[id] = {
            ...existingNode,
            ...updates,
            properties: { ...existingNode.properties, ...(updates.properties || {}) },
            transform: { ...existingNode.transform, ...(updates.transform || {}) },
          };
        }
        break;
      }
      case 'REORDER_LAYER': {
        const { id, direction } = command.payload;
        const index = nextDoc.children.indexOf(id);
        if (index === -1) break;

        nextDoc.children.splice(index, 1);

        if (direction === 'top') nextDoc.children.push(id);
        else if (direction === 'bottom') nextDoc.children.unshift(id);
        else if (direction === 'up')
          nextDoc.children.splice(Math.min(index + 1, nextDoc.children.length), 0, id);
        else if (direction === 'down') nextDoc.children.splice(Math.max(index - 1, 0), 0, id);
        break;
      }
      case 'CHANGE_PRODUCT_COLOR': {
        nextDoc.product.colorHex = command.payload.colorHex;
        break;
      }
    }

    this.document = nextDoc;
  }

  public undo(): void {
    if (this.canUndo()) {
      this.historyIndex--;
      this.document = structuredClone(this.history[this.historyIndex]);
    }
  }

  public redo(): void {
    if (this.canRedo()) {
      this.historyIndex++;
      this.document = structuredClone(this.history[this.historyIndex]);
    }
  }

  public canUndo(): boolean {
    return this.historyIndex > 0;
  }

  public canRedo(): boolean {
    return this.historyIndex < this.history.length - 1;
  }

  private saveSnapshot(): void {
    if (!this.document) return;

    if (this.historyIndex < this.history.length - 1) {
      this.history = this.history.slice(0, this.historyIndex + 1);
    }

    this.history.push(structuredClone(this.document));

    if (this.history.length > this.MAX_HISTORY) {
      this.history.shift();
    } else {
      this.historyIndex++;
    }
  }
}
