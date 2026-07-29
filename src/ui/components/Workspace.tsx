import { useEffect, useRef } from 'react';
import { FabricAdapter } from '@/adapters/rendering/FabricAdapter';
import { useEditorStore } from '@/ui/store/editor-store';

export function Workspace() {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const adapterRef = useRef<FabricAdapter | null>(null);

    const document = useEditorStore((state) => state.document);
    const dispatch = useEditorStore((state) => state.dispatch);
    const setSelectedId = useEditorStore((state) => state.setSelectedId);

    const activeMesh = useEditorStore((state) => state.activeMesh);
    const setTexture = useEditorStore((state) => state.setTexture);

    useEffect(() => {
        if (!canvasRef.current) return;

        const adapter = new FabricAdapter();
        adapter.initialize(canvasRef.current);

        adapter.onTransform = (id, transform) => {
            dispatch({
                type: 'UPDATE_LAYER',
                payload: {
                    id,
                    updates: { transform },
                },
                timestamp: Date.now(),
            });
        };

        adapter.onTextChange = (id, text) => {
            const activeLayer = useEditorStore.getState().document?.nodes[id];
            if (!activeLayer) return;

            dispatch({
                type: 'UPDATE_LAYER',
                payload: {
                    id,
                    updates: {
                        properties: { ...activeLayer.properties, text },
                    },
                },
                timestamp: Date.now(),
            });
        };

        adapter.onSelect = (id) => {
            setSelectedId(id);
        };

        // Forward the Base64 canvas export to Zustand to texture the 3D model
        adapter.onTextureUpdate = (dataUrl) => {
            const currentMesh = useEditorStore.getState().activeMesh;
            if (currentMesh) {
                setTexture(currentMesh, dataUrl);
            }
        };

        adapterRef.current = adapter;

        return () => {
            adapter.destroy();
            adapterRef.current = null;
        };
    }, [dispatch, setSelectedId, setTexture]);

    // Pass activeMesh into the render call so Fabric only renders elements for this specific UV map
    useEffect(() => {
        if (adapterRef.current && document) {
            adapterRef.current.render(document, activeMesh);
        }
    }, [document, activeMesh]);

    return (
        <div className="w-full h-full flex items-center justify-center overflow-auto p-4">
            {/* We add a faint checkerboard so the user can see transparent areas of their UV canvas */}
            <div className="shadow-2xl ring-1 ring-border bg-white rounded-sm overflow-hidden"
                style={{ backgroundImage: 'repeating-conic-gradient(#f1f5f9 0% 25%, white 0% 50%)', backgroundSize: '20px 20px' }}>
                <canvas ref={canvasRef} />
            </div>
        </div>
    );
}