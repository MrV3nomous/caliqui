import { Input, Label } from '@/ui/design-system';
import { useEditorStore } from '@/ui/store/editor-store';

export function PropertiesPanel() {
  const document = useEditorStore((state) => state.document);
  const selectedId = useEditorStore((state) => state.selectedId);
  const dispatch = useEditorStore((state) => state.dispatch);

  if (!document || !selectedId) {
    return (
      <aside className="w-64 border-l border-border bg-surface/50 flex flex-col shrink-0 p-4 items-center justify-center text-center">
        <span className="text-sm text-secondary">No layer selected</span>
      </aside>
    );
  }

  const activeLayer = document.nodes[selectedId];
  if (!activeLayer) return null;

  const handleColorChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    dispatch({
      type: 'UPDATE_LAYER',
      payload: {
        id: selectedId,
        updates: {
          properties: { ...activeLayer.properties, fill: e.target.value },
        },
      },
      timestamp: Date.now(),
    });
  };

  const handleTextChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    dispatch({
      type: 'UPDATE_LAYER',
      payload: {
        id: selectedId,
        updates: {
          properties: { ...activeLayer.properties, text: e.target.value },
        },
      },
      timestamp: Date.now(),
    });
  };

  const handleFontSizeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const fontSize = Number(e.target.value);
    dispatch({
      type: 'UPDATE_LAYER',
      payload: {
        id: selectedId,
        updates: {
          properties: { ...activeLayer.properties, fontSize },
        },
      },
      timestamp: Date.now(),
    });
  };

  return (
    <aside className="w-64 border-l border-border bg-surface/50 flex flex-col shrink-0">
      <div className="p-3 border-b border-border">
        <span className="text-xs font-semibold uppercase tracking-wider text-secondary">
          Properties
        </span>
      </div>

      <div className="p-4 space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="layer-name">Layer Name</Label>
          <Input id="layer-name" value={activeLayer.name} disabled className="bg-background" />
        </div>

        {activeLayer.type === 'shape' && (
          <div className="space-y-1.5">
            <Label htmlFor="fill-color">Fill Color</Label>
            <div className="flex gap-2">
              <Input
                id="fill-color"
                type="color"
                value={(activeLayer.properties.fill as string) || '#000000'}
                onChange={handleColorChange}
                className="w-12 p-1 cursor-pointer"
              />
              <Input
                value={(activeLayer.properties.fill as string) || '#000000'}
                onChange={handleColorChange}
                className="flex-1 font-mono uppercase text-xs"
              />
            </div>
          </div>
        )}

        {activeLayer.type === 'text' && (
          <>
            <div className="space-y-1.5">
              <Label htmlFor="text-content">Content</Label>
              <Input
                id="text-content"
                value={(activeLayer.properties.text as string) || ''}
                onChange={handleTextChange}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="font-size">Font Size (px)</Label>
              <Input
                id="font-size"
                type="number"
                value={(activeLayer.properties.fontSize as number) || 24}
                onChange={handleFontSizeChange}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="text-color">Text Color</Label>
              <div className="flex gap-2">
                <Input
                  id="text-color"
                  type="color"
                  value={(activeLayer.properties.fill as string) || '#000000'}
                  onChange={handleColorChange}
                  className="w-12 p-1 cursor-pointer"
                />
                <Input
                  value={(activeLayer.properties.fill as string) || '#000000'}
                  onChange={handleColorChange}
                  className="flex-1 font-mono uppercase text-xs"
                />
              </div>
            </div>
          </>
        )}
      </div>
    </aside>
  );
}
