import { Download, Redo, Sparkles, Undo, X } from 'lucide-react';
import { useEffect } from 'react';
import { env } from '@/shared/env';
import { LayersPanel } from '@/ui/components/LayersPanel';
import { Preview3D } from '@/ui/components/Preview3D';
import { PropertiesPanel } from '@/ui/components/PropertiesPanel';
import { Toolbar } from '@/ui/components/Toolbar';
import { Workspace } from '@/ui/components/Workspace';
import { Button, IconButton, Input, Label } from '@/ui/design-system';
import { useEditorStore } from '@/ui/store/editor-store';

export function EditorLayout() {
  const { canUndo, canRedo, undo, redo, activeMesh, setActiveMesh, init } = useEditorStore();

  // Initialize the document when the editor loads
  useEffect(() => {
    init();
  }, [init]);

  return (
    <div className="w-screen h-screen flex flex-col bg-background font-sans overflow-hidden">
      <header className="h-14 border-b border-border bg-surface flex items-center justify-between px-4 shrink-0 z-20 shadow-sm">
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
            Export Mockup
          </Button>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden relative">
        <Toolbar />
        <LayersPanel />

        <main className="flex-1 relative bg-background overflow-hidden flex items-center justify-center">
          <Preview3D />

          {activeMesh && (
            <div className="absolute inset-8 bg-surface shadow-2xl border border-border rounded-xl z-50 flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
              <div className="h-12 border-b border-border flex items-center justify-between px-4 bg-surface/50">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
                  <span className="font-semibold text-primary">Editing UV Map: {activeMesh}</span>
                </div>
                <IconButton onClick={() => setActiveMesh(null)} title="Close 2D Editor">
                  <X size={20} />
                </IconButton>
              </div>
              <div className="flex-1 relative bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] bg-opacity-5">
                <Workspace />
              </div>
            </div>
          )}
        </main>

        <PropertiesPanel />
      </div>

      <footer className="h-16 border-t border-border bg-surface flex items-center px-6 gap-6 shrink-0 z-20">
        <div className="flex items-center gap-2 shrink-0">
          <Sparkles size={18} className="text-blue-500" />
          <Label className="text-primary font-medium text-sm">AI Generation</Label>
        </div>
        <Input
          placeholder="e.g., A futuristic cyberpunk jacket with glowing neon accents..."
          className="flex-1 max-w-3xl bg-background"
        />
        <Button variant="primary" className="gap-2">
          Generate Assets
        </Button>
      </footer>
    </div>
  );
}
