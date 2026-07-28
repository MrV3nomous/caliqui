import { Trash2 } from 'lucide-react';
import { IconButton } from '@/ui/design-system';
import { useEditorStore } from '@/ui/store/editor-store';

export function LayersPanel() {
  const document = useEditorStore((state) => state.document);
  const dispatch = useEditorStore((state) => state.dispatch);

  if (!document) return null;

  const layers = [...document.children].reverse().map((id) => document.nodes[id]);

  const handleDelete = (id: string) => {
    dispatch({
      type: 'REMOVE_LAYER',
      payload: { id },
      timestamp: Date.now(),
    });
  };

  return (
    <aside className="w-64 border-r border-border bg-surface/50 flex flex-col shrink-0">
      <div className="p-3 border-b border-border flex justify-between items-center">
        <span className="text-xs font-semibold uppercase tracking-wider text-secondary">
          Layers
        </span>
      </div>

      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {layers.length === 0 && (
          <div className="text-center p-4 text-sm text-secondary">Canvas is empty</div>
        )}

        {layers.map((layer) => (
          <div
            key={layer.id}
            className="flex items-center justify-between p-2 rounded-md hover:bg-background border border-transparent hover:border-border group transition-all"
          >
            <span className="text-sm text-primary truncate">{layer.name}</span>
            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <IconButton size="sm" onClick={() => handleDelete(layer.id)} title="Delete Layer">
                <Trash2 size={14} />
              </IconButton>
            </div>
          </div>
        ))}
      </div>
    </aside>
  );
}
