import { useEffect } from 'react';
import { Card } from '@/ui/design-system';
import { useEditorStore } from '@/ui/store/editor-store';

export function Editor() {
  const init = useEditorStore((state) => state.init);
  const document = useEditorStore((state) => state.document);

  useEffect(() => {
    init();
  }, [init]);

  if (!document) return null;

  return (
    <div className="flex flex-col items-center justify-center">
      <Card className="w-96 h-96 flex items-center justify-center shadow-md bg-surface">
        <div className="text-center space-y-2">
          <p className="text-secondary font-medium">Canvas Rendering Area</p>
          <p className="text-xs text-secondary/70 font-mono">
            Document ID: {document.id.split('-')[0]}
          </p>
        </div>
      </Card>
    </div>
  );
}
