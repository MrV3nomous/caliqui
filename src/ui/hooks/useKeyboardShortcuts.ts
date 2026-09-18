import { useEffect } from 'react';
import { useEditorStore } from '@/ui/store/editor-store';

export function useKeyboardShortcuts() {
  const { undo, redo, copy, paste, cut, duplicate, deleteSelected, selectAll } = useEditorStore();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if typing in an input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      const ctrlOrCmd = e.ctrlKey || e.metaKey;

      if (ctrlOrCmd) {
        switch (e.key.toLowerCase()) {
          case 'z':
            e.preventDefault();
            if (e.shiftKey) redo();
            else undo();
            break;
          case 'y':
            e.preventDefault();
            redo();
            break;
          case 'c':
            e.preventDefault();
            copy();
            break;
          case 'x':
            e.preventDefault();
            cut();
            break;
          case 'v':
            e.preventDefault();
            paste();
            break;
          case 'd':
            e.preventDefault();
            duplicate();
            break;
          case 'a':
            e.preventDefault();
            selectAll();
            break;
        }
      } else {
        if (e.key === 'Delete' || e.key === 'Backspace') {
          e.preventDefault();
          deleteSelected();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [undo, redo, copy, paste, cut, duplicate, deleteSelected, selectAll]);
}
