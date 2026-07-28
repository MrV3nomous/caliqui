import { Canvas, type FabricObject, IText, Rect } from 'fabric';
import type { LayerNode, ProjectDocument } from '@/core/document/types';

type EditorFabricObject = FabricObject & { data?: { id: string } };

export class FabricAdapter {
  private canvas: Canvas | null = null;

  public onTransform?: (id: string, transform: LayerNode['transform']) => void;
  public onSelect?: (id: string | null) => void;
  public onTextChange?: (id: string, text: string) => void;

  public initialize(canvasElement: HTMLCanvasElement): void {
    this.canvas = new Canvas(canvasElement, {
      width: 800,
      height: 600,
      backgroundColor: '#ffffff',
      selection: true,
    });

    this.canvas.on('object:modified', (e) => {
      const obj = e.target as EditorFabricObject;
      if (!obj?.data?.id || !this.onTransform) return;

      this.onTransform(obj.data.id, {
        x: obj.left ?? 0,
        y: obj.top ?? 0,
        scaleX: obj.scaleX ?? 1,
        scaleY: obj.scaleY ?? 1,
        rotation: obj.angle ?? 0,
      });
    });

    this.canvas.on('text:changed', (e) => {
      const obj = e.target as EditorFabricObject & { text?: string };
      if (!obj?.data?.id || !this.onTextChange) return;
      if (typeof obj.text === 'string') {
        this.onTextChange(obj.data.id, obj.text);
      }
    });

    const handleSelection = (e: { selected?: FabricObject[] }) => {
      const obj = e.selected?.[0] as EditorFabricObject;
      if (obj?.data?.id && this.onSelect) {
        this.onSelect(obj.data.id);
      }
    };

    this.canvas.on('selection:created', handleSelection);
    this.canvas.on('selection:updated', handleSelection);
    this.canvas.on('selection:cleared', () => {
      if (this.onSelect) this.onSelect(null);
    });
  }

  public render(document: ProjectDocument | null): void {
    if (!this.canvas || !document) return;

    const activeObject = this.canvas.getActiveObject() as EditorFabricObject | undefined;
    const activeId = activeObject?.data?.id;

    this.canvas.clear();
    this.canvas.backgroundColor = '#ffffff';

    let newActiveObject: FabricObject | null = null;

    for (const layerId of document.children) {
      const node = document.nodes[layerId];
      if (!node?.visible) continue;

      const drawnObj = this.drawNode(node);
      if (drawnObj && node.id === activeId) {
        newActiveObject = drawnObj;
      }
    }

    if (newActiveObject) {
      this.canvas.setActiveObject(newActiveObject);
    }

    this.canvas.renderAll();
  }

  private drawNode(node: LayerNode): FabricObject | null {
    if (!this.canvas) return null;

    if (node.type === 'shape' && node.name === 'Rectangle') {
      const rect = new Rect({
        left: node.transform.x,
        top: node.transform.y,
        width: 100 * node.transform.scaleX,
        height: 100 * node.transform.scaleY,
        fill: (node.properties.fill as string) || '#000000',
        angle: node.transform.rotation,
        selectable: !node.locked,
      }) as EditorFabricObject;

      rect.data = { id: node.id };
      this.canvas.add(rect);
      return rect;
    }

    if (node.type === 'text') {
      const textObj = new IText((node.properties.text as string) || '', {
        left: node.transform.x,
        top: node.transform.y,
        fontSize: (node.properties.fontSize as number) || 24,
        fill: (node.properties.fill as string) || '#000000',
        fontFamily: (node.properties.fontFamily as string) || 'Inter',
        scaleX: node.transform.scaleX,
        scaleY: node.transform.scaleY,
        angle: node.transform.rotation,
        selectable: !node.locked,
      }) as EditorFabricObject;

      textObj.data = { id: node.id };
      this.canvas.add(textObj);
      return textObj;
    }

    return null;
  }

  public destroy(): void {
    if (this.canvas) {
      this.canvas.dispose();
      this.canvas = null;
    }
  }
}
