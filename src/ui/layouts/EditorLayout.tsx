import {
  LayoutDashboard,
  Loader2,
  LogOut,
  Redo,
  ShoppingBag,
  Sparkles,
  Store,
  Undo,
  User as UserIcon,
  X,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import type { LayerNode } from '@/core/document/types';
import { env } from '@/shared/env';
import { LayersPanel } from '@/ui/components/LayersPanel';
import { Preview3D } from '@/ui/components/Preview3D';
import { PropertiesPanel } from '@/ui/components/PropertiesPanel';
import { Toolbar } from '@/ui/components/Toolbar';
import { Workspace } from '@/ui/components/Workspace';
import { Button, IconButton, Input, Label } from '@/ui/design-system';
import { useAuthStore } from '@/ui/store/auth-store';
import { useCheckoutStore } from '@/ui/store/checkout-store';
import { useEditorStore } from '@/ui/store/editor-store';

export function EditorLayout() {
  const { canUndo, canRedo, undo, redo, activeMesh, setActiveMesh, init, dispatch } =
    useEditorStore();

  const { user, isAuthenticated, openAuthModal, logout } = useAuthStore();
  const { openCheckout } = useCheckoutStore();
  // AI State
  const [prompt, setPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);

  const handleOrderIntent = () => {
    if (!isAuthenticated) {
      openAuthModal();
    } else {
      openCheckout();
    }
  };

  useEffect(() => {
    init();
  }, [init]);

  const handleGenerate = async () => {
    if (!activeMesh) {
      alert('Please select a part of the garment to apply the AI design to.');
      return;
    }
    if (!prompt.trim()) return;

    setIsGenerating(true);

    // MOCK AI API CALL: Simulate a 2-second generation delay
    await new Promise((resolve) => setTimeout(resolve, 2000));

    // For the skeleton, we use a placeholder image API based on the user's prompt text
    const encodedPrompt = encodeURIComponent(prompt);
    // Fetch a real image as a blob so we can convert it to base64 for our engine
    try {
      const response = await fetch(
        `https://api.dicebear.com/7.x/bottts/png?seed=${encodedPrompt}&size=400`,
      );
      const blob = await response.blob();
      const reader = new FileReader();

      reader.onloadend = () => {
        const base64data = reader.result as string;

        const newLayer: LayerNode = {
          id: crypto.randomUUID(),
          type: 'image',
          name: `AI: ${prompt.slice(0, 15)}...`,
          visible: true,
          locked: false,
          properties: { src: base64data, meshPart: activeMesh, opacity: 1 },
          // Center it on the 2D canvas
          transform: { x: 200, y: 200, scaleX: 1, scaleY: 1, rotation: 0 },
        };

        dispatch({
          type: 'ADD_LAYER',
          payload: { layer: newLayer },
          timestamp: Date.now(),
        });

        setIsGenerating(false);
        setPrompt('');
      };
      reader.readAsDataURL(blob);
    } catch (error) {
      console.error('AI Generation failed', error);
      setIsGenerating(false);
    }
  };

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

        <div className="flex items-center gap-3">
          {/* NEW: Link to Marketplace */}
          <Link to="/marketplace">
            <Button variant="outline" size="sm" className="gap-2 hidden md:flex">
              <Store size={16} /> Explore
            </Button>
          </Link>

          <div className="h-4 w-px bg-border hidden md:block" />

          {/* Auth Controls */}
          {isAuthenticated ? (
            <div className="flex items-center gap-2 mr-2">
              <span className="text-sm text-secondary font-medium mr-2 hidden md:block">
                {user?.email}
              </span>

              <Link to="/dashboard">
                <IconButton size="sm" title="Dashboard">
                  <LayoutDashboard size={16} />
                </IconButton>
              </Link>

              <IconButton size="sm" onClick={logout} title="Sign Out">
                <LogOut size={16} />
              </IconButton>
            </div>
          ) : (
            <Button variant="outline" size="sm" className="gap-2 mr-2" onClick={openAuthModal}>
              <UserIcon size={16} />
              Sign In
            </Button>
          )}

          <div className="h-4 w-px bg-border mr-1" />

          <Button variant="primary" size="sm" className="gap-2" onClick={handleOrderIntent}>
            <ShoppingBag size={16} />
            Order Custom Apparel
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

      <footer className="h-16 border-t border-border bg-surface flex items-center px-6 gap-6 shrink-0 z-20 transition-colors">
        <div className="flex items-center gap-2 shrink-0">
          <Sparkles
            size={18}
            className={isGenerating ? 'text-secondary animate-pulse' : 'text-blue-500'}
          />
          <Label className="text-primary font-medium text-sm">AI Generation</Label>
        </div>
        <Input
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleGenerate();
          }}
          placeholder="e.g., A cyberpunk skull graphic..."
          className="flex-1 max-w-3xl bg-background"
          disabled={isGenerating}
        />
        <Button
          variant="primary"
          className="gap-2 w-40"
          onClick={handleGenerate}
          disabled={isGenerating || !prompt.trim()}
        >
          {isGenerating ? (
            <>
              <Loader2 size={16} className="animate-spin" /> Generating...
            </>
          ) : (
            'Generate Assets'
          )}
        </Button>
      </footer>
    </div>
  );
}
