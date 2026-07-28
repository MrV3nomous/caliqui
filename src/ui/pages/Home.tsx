import { ArrowRight, MousePointer2, Sparkles } from 'lucide-react';
import { Link } from 'react-router';
import { env } from '@/shared/env';
import { Button, Card, FloatingPanel, IconButton, Input, Label, Select } from '@/ui/design-system';

export function Home() {
  return (
    <div className="flex flex-col items-center justify-center w-full h-full space-y-8 p-8 overflow-y-auto relative">
      <div className="text-center space-y-2">
        <h1 className="text-3xl font-medium tracking-tight text-primary">{env.VITE_APP_NAME}</h1>
        <p className="text-secondary">Sprint 2: Design System Complete.</p>
        <Link to="/editor">
          <Button variant="primary" className="gap-2">
            Launch Editor Workspace <ArrowRight size={16} />
          </Button>
        </Link>
      </div>

      <Card className="p-8 max-w-2xl w-full flex flex-col md:flex-row gap-12">
        <div className="flex flex-col gap-8 flex-1">
          <div className="flex flex-col gap-3">
            <h2 className="text-sm font-semibold text-primary uppercase tracking-wider">
              Buttons & Toolbars
            </h2>
            <div className="flex flex-wrap gap-3">
              <Button variant="primary">Primary</Button>
              <Button variant="secondary">Secondary</Button>
              <Button variant="outline">Outline</Button>
            </div>
            <div className="flex gap-2 p-2 border border-border rounded-md bg-background w-fit mt-2">
              <IconButton size="sm" isActive>
                <MousePointer2 size={16} />
              </IconButton>
              <IconButton size="sm">
                <Sparkles size={16} />
              </IconButton>
            </div>
          </div>

          <div className="flex flex-col gap-4">
            <h2 className="text-sm font-semibold text-primary uppercase tracking-wider">
              Form Elements
            </h2>
            <div className="space-y-1.5">
              <Label htmlFor="ai-prompt">AI Prompt</Label>
              <Input id="ai-prompt" placeholder="A futuristic cyberpunk jacket..." />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="font-select">Typography</Label>
              <Select id="font-select">
                <option value="inter">Inter (Default)</option>
                <option value="helvetica">Helvetica</option>
                <option value="comic-sans">Comic Sans (Why not?)</option>
              </Select>
            </div>
          </div>
        </div>

        <div className="flex-1 relative bg-background rounded-lg border border-border flex items-center justify-center min-h-75">
          <span className="text-secondary text-sm">Canvas Area</span>

          <FloatingPanel title="Layer Properties" className="relative shadow-md z-10 w-56">
            <div className="space-y-1.5">
              <Label>Blend Mode</Label>
              <Select>
                <option>Normal</option>
                <option>Multiply</option>
                <option>Overlay</option>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Opacity</Label>
              <Input type="number" defaultValue={100} min={0} max={100} />
            </div>
            <Button variant="outline" className="w-full mt-2">
              Apply Magic
            </Button>
          </FloatingPanel>
        </div>
      </Card>
    </div>
  );
}
