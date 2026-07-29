import { Image as ImageIcon, Square, Type } from 'lucide-react';
import { useRef } from 'react';
import type { LayerNode } from '@/core/document/types';
import { IconButton } from '@/ui/design-system';
import { useEditorStore } from '@/ui/store/editor-store';

export function Toolbar() {
    const dispatch = useEditorStore((state) => state.dispatch);
    const activeMesh = useEditorStore((state) => state.activeMesh);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const enforceMeshContext = (): boolean => {
        if (!activeMesh) {
            alert("Please select a part of the garment to edit first.");
            return false;
        }
        return true;
    };

    const handleAddShape = () => {
        if (!enforceMeshContext()) return;

        const newLayer: LayerNode = {
            id: crypto.randomUUID(),
            type: 'shape',
            name: 'Rectangle',
            visible: true,
            locked: false,
            properties: { fill: '#3B82F6', meshPart: activeMesh, opacity: 1 },
            transform: { x: 350, y: 350, scaleX: 1, scaleY: 1, rotation: 0 },
        };

        dispatch({
            type: 'ADD_LAYER',
            payload: { layer: newLayer },
            timestamp: Date.now(),
        });
    };

    const handleAddText = () => {
        if (!enforceMeshContext()) return;

        const newLayer: LayerNode = {
            id: crypto.randomUUID(),
            type: 'text',
            name: 'Text Layer',
            visible: true,
            locked: false,
            properties: {
                text: 'Edit me',
                fontSize: 48,
                fill: '#111111',
                fontFamily: 'Inter',
                meshPart: activeMesh,
                opacity: 1,
            },
            transform: { x: 300, y: 350, scaleX: 1, scaleY: 1, rotation: 0 },
        };

        dispatch({
            type: 'ADD_LAYER',
            payload: { layer: newLayer },
            timestamp: Date.now(),
        });
    };

    const triggerImageUpload = () => {
        if (!enforceMeshContext()) return;
        fileInputRef.current?.click();
    };

    const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !activeMesh) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            const base64Src = event.target?.result as string;

            const newLayer: LayerNode = {
                id: crypto.randomUUID(),
                type: 'image',
                name: file.name,
                visible: true,
                locked: false,
                properties: { src: base64Src, meshPart: activeMesh, opacity: 1 },
                transform: { x: 250, y: 250, scaleX: 1, scaleY: 1, rotation: 0 },
            };

            dispatch({
                type: 'ADD_LAYER',
                payload: { layer: newLayer },
                timestamp: Date.now(),
            });
        };

        reader.readAsDataURL(file);
        e.target.value = '';
    };

    return (
        <aside className="w-16 border-r border-border bg-surface flex flex-col items-center py-4 gap-2 shrink-0 z-10">
            <IconButton title="Add Text" onClick={handleAddText}>
                <Type size={20} />
            </IconButton>

            <IconButton title="Add Image" onClick={triggerImageUpload}>
                <ImageIcon size={20} />
            </IconButton>
            <input
                type="file"
                ref={fileInputRef}
                onChange={handleImageUpload}
                accept="image/*"
                className="hidden"
            />

            <IconButton title="Add Shape" onClick={handleAddShape}>
                <Square size={20} />
            </IconButton>
        </aside>
    );
}