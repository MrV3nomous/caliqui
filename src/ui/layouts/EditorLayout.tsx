import { Download, Redo, Undo } from 'lucide-react';
import { Outlet } from 'react-router';
import { env } from '@/shared/env';
import { LayersPanel } from '@/ui/components/LayersPanel';
import { Toolbar } from '@/ui/components/Toolbar';
import { Button, IconButton } from '@/ui/design-system';
import { useEditorStore } from '@/ui/store/editor-store';

export function EditorLayout() {
  const { canUndo, canRedo, undo, redo } = useEditorStore();

  return (
    <div className="w-screen h-screen flex flex-col bg-background font-sans overflow-hidden">
      <header className="h-14 border-b border-border bg-surface flex items-center justify-between px-4 shrink-0 z-10">
        <div className="flex items-center gap-4">
          <span className="font-semibold text-primary">{env.VITE_APP_NAME}</span>
          <div className="h-4 w-px bg-border" />
          <div className="flex gap-1">
            <IconButton size="sm" onClick={undo} disabled={!canUndo} title="Undo">
              <Undo size={16} />
            </IconButton>
            <IconButton size="sm" onClick={redo} disabled={!canRedo} title="Redo">
              <Redo size={16} />
            </IconButton>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="primary" size="sm" className="gap-2">
            <Download size={16} />
            Export
          </Button>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        <Toolbar />
        <LayersPanel />

        <main className="flex-1 relative bg-background overflow-hidden flex items-center justify-center bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] bg-opacity-5">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
