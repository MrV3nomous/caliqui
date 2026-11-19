import { useEffect, useRef } from 'react';
import { type GlobalToolType, useEditorStore } from '@/ui/store/editor-store';

const isTextEntryTarget = (target: EventTarget | null): boolean => {
  if (!(target instanceof HTMLElement)) return false;
  return Boolean(
    target.isContentEditable ||
      target.closest('input, textarea, select, [contenteditable="true"], [role="textbox"]'),
  );
};

const isInteractiveTarget = (target: EventTarget | null): boolean => {
  if (!(target instanceof HTMLElement)) return false;
  return Boolean(target.closest('button, a, [role="button"]'));
};

export function useKeyboardShortcuts() {
  const { undo, redo, copy, paste, cut, duplicate, deleteSelected, selectAll } = useEditorStore();
  const previousToolMode = useRef<GlobalToolType | null>(null);
  const spaceHeld = useRef(false);

  useEffect(() => {
    const restoreTool = () => {
      if (!spaceHeld.current) return;
      spaceHeld.current = false;
      const state = useEditorStore.getState();
      if (state.globalToolMode === 'camera') {
        state.setGlobalToolMode(previousToolMode.current ?? 'default');
      }
      previousToolMode.current = null;
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (isTextEntryTarget(e.target)) return;

      // Hold Space to temporarily inspect the garment. The previous tool and
      // selected artwork remain intact and are restored when Space is released.
      if (e.code === 'Space' && !e.repeat) {
        if (isInteractiveTarget(e.target)) return;
        const state = useEditorStore.getState();
        // Never change interaction mode midway through an artwork/brush drag.
        // The active pointer gesture must finish before camera navigation begins.
        if (state.isDragging) {
          e.preventDefault();
          return;
        }
        e.preventDefault();
        if (!spaceHeld.current) {
          previousToolMode.current = state.globalToolMode;
          spaceHeld.current = true;
          state.setGlobalToolMode('camera');
        }
        return;
      }

      // V is an explicit Edit shortcut, never a toggle.
      if (!e.ctrlKey && !e.metaKey && e.key.toLowerCase() === 'v' && !isInteractiveTarget(e.target)) {
        e.preventDefault();
        useEditorStore.getState().setGlobalToolMode('default');
        return;
      }

      const ctrlOrCmd = e.ctrlKey || e.metaKey;
      if (ctrlOrCmd) {
        switch (e.key.toLowerCase()) {
          case 'z':
            e.preventDefault();
            if (useEditorStore.getState().isDrawingMode) {
              window.dispatchEvent(new CustomEvent('caliqui:drawing-history', { detail: { action: e.shiftKey ? 'redo' : 'undo' } }));
            } else if (e.shiftKey) redo();
            else undo();
            break;
          case 'y':
            e.preventDefault();
            if (useEditorStore.getState().isDrawingMode) window.dispatchEvent(new CustomEvent('caliqui:drawing-history', { detail: { action: 'redo' } }));
            else redo();
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
      } else if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) {
        if (isInteractiveTarget(e.target)) return;
        const state = useEditorStore.getState();
        if (state.isDrawingMode || state.globalToolMode === 'camera' || state.selectedIds.length === 0) return;
        const step = e.shiftKey ? 0.1 : 0.01;
        const dx = e.key === 'ArrowLeft' ? -step : e.key === 'ArrowRight' ? step : 0;
        const dy = e.key === 'ArrowUp' ? step : e.key === 'ArrowDown' ? -step : 0;
        const movable = state.decals.filter((decal) => state.selectedIds.includes(decal.id) && decal.locked !== true && decal.visible !== false);
        if (movable.length > 0 && !e.repeat) {
          e.preventDefault();
          state.saveHistory();
          movable.forEach((decal) => state.updateDecal(decal.id, { position: [decal.position[0] + dx, decal.position[1] + dy, decal.position[2]] }));
        }
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        if (isInteractiveTarget(e.target) || useEditorStore.getState().isDrawingMode) return;
        e.preventDefault();
        deleteSelected();
      } else if (e.key === 'Escape') {
        const state = useEditorStore.getState();
        if (state.globalToolMode === 'camera') state.setGlobalToolMode('default');
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') restoreTool();
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('blur', restoreTool);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('blur', restoreTool);
      restoreTool();
    };
  }, [undo, redo, copy, paste, cut, duplicate, deleteSelected, selectAll]);
}
