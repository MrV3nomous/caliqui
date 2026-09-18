import {
  ArrowDownToLine,
  ArrowUpToLine,
  ClipboardPaste,
  Copy,
  CopyPlus,
  Group,
  Paintbrush,
  Scissors,
  Trash2,
  Ungroup,
} from 'lucide-react';
import { useEffect, useRef } from 'react';
import { useEditorStore } from '@/ui/store/editor-store';

export function ContextMenu() {
  const {
    contextMenu,
    setContextMenu,
    cut,
    copy,
    paste,
    duplicate,
    deleteSelected,
    moveLayerUp,
    moveLayerDown,
    groupSelected,
    removeFromGroup,
    breakGroup,
    selectedIds,
    decals,
    setDrawingMode,
    setEditingDrawingId,
  } = useEditorStore();

  const menuRef = useRef<HTMLDivElement>(null);

  // Close menu when clicking anywhere else
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setContextMenu(null);
      }
    };

    if (contextMenu) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [contextMenu, setContextMenu]);

  if (!contextMenu) return null;

  const handleAction = (action: () => void) => {
    action();
    setContextMenu(null);
  };

  const canGroup = selectedIds.length > 1;
  const canUngroup = selectedIds.some((id) => {
    const decal = decals.find((d) => d.id === id);
    return decal?.groupId !== undefined;
  });

  const singleSelectedDecal = decals.find((d) => d.id === contextMenu.decalId);
  const isDrawing = singleSelectedDecal?.type === 'drawing';

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: Custom context menu overlay
    <div
      ref={menuRef}
      className="absolute z-50 w-48 bg-white border border-neutral-200 rounded-lg shadow-xl py-1 text-sm text-neutral-700 animate-in fade-in zoom-in duration-150"
      style={{ top: contextMenu.y, left: contextMenu.x }}
      onContextMenu={(e) => e.preventDefault()} // Prevent native browser menu
    >
      {isDrawing && (
        <button
          type="button"
          className="w-full flex items-center gap-2 px-3 py-2 hover:bg-blue-50 hover:text-blue-600 transition-colors font-medium text-blue-700"
          onClick={() =>
            handleAction(() => {
              setEditingDrawingId(contextMenu.decalId);
              setDrawingMode(true);
            })
          }
        >
          <Paintbrush size={14} /> Edit Drawing
        </button>
      )}

      {canGroup && (
        <button
          type="button"
          className="w-full flex items-center gap-2 px-3 py-2 hover:bg-blue-50 hover:text-blue-600 transition-colors"
          onClick={() => handleAction(groupSelected)}
        >
          <Group size={14} /> Group Items
        </button>
      )}
      {canUngroup && (
        <>
          <button
            type="button"
            className="w-full flex items-center gap-2 px-3 py-2 hover:bg-blue-50 hover:text-blue-600 transition-colors"
            onClick={() => handleAction(removeFromGroup)}
          >
            <Ungroup size={14} /> Remove from Group
          </button>
          <button
            type="button"
            className="w-full flex items-center gap-2 px-3 py-2 hover:bg-red-50 text-red-600 transition-colors"
            onClick={() => handleAction(breakGroup)}
          >
            <Ungroup size={14} className="text-red-500" /> Break Group
          </button>
        </>
      )}
      {(canGroup || canUngroup || isDrawing) && <div className="h-px bg-neutral-200 my-1 mx-2" />}

      <button
        type="button"
        className="w-full flex items-center gap-2 px-3 py-2 hover:bg-blue-50 hover:text-blue-600 transition-colors"
        onClick={() => handleAction(cut)}
      >
        <Scissors size={14} /> Cut
      </button>
      <button
        type="button"
        className="w-full flex items-center gap-2 px-3 py-2 hover:bg-blue-50 hover:text-blue-600 transition-colors"
        onClick={() => handleAction(copy)}
      >
        <Copy size={14} /> Copy
      </button>
      <button
        type="button"
        className="w-full flex items-center gap-2 px-3 py-2 hover:bg-blue-50 hover:text-blue-600 transition-colors"
        onClick={() => handleAction(paste)}
      >
        <ClipboardPaste size={14} /> Paste
      </button>
      <button
        type="button"
        className="w-full flex items-center gap-2 px-3 py-2 hover:bg-blue-50 hover:text-blue-600 transition-colors"
        onClick={() => handleAction(duplicate)}
      >
        <CopyPlus size={14} /> Duplicate
      </button>

      <div className="h-px bg-neutral-200 my-1 mx-2" />

      <button
        type="button"
        className="w-full flex items-center gap-2 px-3 py-2 hover:bg-blue-50 hover:text-blue-600 transition-colors"
        onClick={() => handleAction(() => moveLayerUp(contextMenu.decalId))}
      >
        <ArrowUpToLine size={14} /> Bring Forward
      </button>
      <button
        type="button"
        className="w-full flex items-center gap-2 px-3 py-2 hover:bg-blue-50 hover:text-blue-600 transition-colors"
        onClick={() => handleAction(() => moveLayerDown(contextMenu.decalId))}
      >
        <ArrowDownToLine size={14} /> Send Backward
      </button>

      <div className="h-px bg-neutral-200 my-1 mx-2" />

      <button
        type="button"
        className="w-full flex items-center gap-2 px-3 py-2 hover:bg-red-50 text-red-600 transition-colors"
        onClick={() => handleAction(deleteSelected)}
      >
        <Trash2 size={14} /> Delete
      </button>
    </div>
  );
}
