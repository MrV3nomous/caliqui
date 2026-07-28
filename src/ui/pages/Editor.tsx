import { useEffect } from 'react';
import { Workspace } from '@/ui/components/Workspace';
import { useEditorStore } from '@/ui/store/editor-store';

export function Editor() {
  const init = useEditorStore((state) => state.init);
  const document = useEditorStore((state) => state.document);

  useEffect(() => {
    init();
  }, [init]);

  if (!document) return null;

  return (
    <div className="absolute inset-0">
      <Workspace />
    </div>
  );
}
