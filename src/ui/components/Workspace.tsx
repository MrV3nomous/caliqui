import { useEffect, useRef } from 'react';
import { FabricAdapter } from '@/adapters/rendering/FabricAdapter';
import { useEditorStore } from '@/ui/store/editor-store';

export function Workspace() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const adapterRef = useRef<FabricAdapter | null>(null);

  const document = useEditorStore((state) => state.document);
  const dispatch = useEditorStore((state) => state.dispatch);
  const setSelectedId = useEditorStore((state) => state.setSelectedId);

  useEffect(() => {
    if (!canvasRef.current) return;

    const adapter = new FabricAdapter();
    adapter.initialize(canvasRef.current);

    adapter.onTransform = (id, transform) => {
      dispatch({
        type: 'UPDATE_LAYER',
        payload: {
          id,
          updates: { transform },
        },
        timestamp: Date.now(),
      });
    };

    adapter.onTextChange = (id, text) => {
      const activeLayer = useEditorStore.getState().document?.nodes[id];
      if (!activeLayer) return;

      dispatch({
        type: 'UPDATE_LAYER',
        payload: {
          id,
          updates: {
            properties: { ...activeLayer.properties, text },
          },
        },
        timestamp: Date.now(),
      });
    };

    adapter.onSelect = (id) => {
      setSelectedId(id);
    };

    adapterRef.current = adapter;

    return () => {
      adapter.destroy();
      adapterRef.current = null;
    };
  }, [dispatch, setSelectedId]);

  useEffect(() => {
    if (adapterRef.current && document) {
      adapterRef.current.render(document);
    }
  }, [document]);

  return (
    <div className="w-full h-full flex items-center justify-center overflow-auto p-8">
      <div className="shadow-2xl ring-1 ring-border bg-surface">
        <canvas ref={canvasRef} />
      </div>
    </div>
  );
}
