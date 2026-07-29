import { create } from 'zustand';
import type { EditorCommand } from '@/core/commands/types';
import { DocumentEngine } from '@/core/document/document-engine';
import { createEmptyDocument } from '@/core/document/factory';
import type { ProjectDocument } from '@/core/document/types';

export type MeshPart = string | null;

interface EditorState {
    engine: DocumentEngine;
    document: ProjectDocument | null;
    canUndo: boolean;
    canRedo: boolean;

    selectedId: string | null;
    setSelectedId: (id: string | null) => void;

    activeMesh: MeshPart;
    setActiveMesh: (mesh: MeshPart) => void;

    textures: Record<string, string>;
    setTexture: (mesh: string, dataUrl: string) => void;

    init: () => void;
    dispatch: (command: EditorCommand) => void;
    undo: () => void;
    redo: () => void;
}

const engine = new DocumentEngine();

export const useEditorStore = create<EditorState>((set) => ({
    engine,
    document: null,
    canUndo: false,
    canRedo: false,

    selectedId: null,
    setSelectedId: (id) => set({ selectedId: id }),

    activeMesh: null,
    setActiveMesh: (mesh) => set({ activeMesh: mesh }),

    textures: {},
    setTexture: (mesh, dataUrl) =>
        set((state) => ({
            textures: { ...state.textures, [mesh]: dataUrl },
        })),

    init: () => {
        const doc = createEmptyDocument();
        engine.dispatch({ type: 'LOAD_DOCUMENT', payload: { document: doc }, timestamp: Date.now() });
        set({
            document: engine.getDocument(),
            canUndo: engine.canUndo(),
            canRedo: engine.canRedo(),
            selectedId: null,
            activeMesh: null,
            textures: {},
        });
    },

    dispatch: (command: EditorCommand) => {
        engine.dispatch(command);
        set({
            document: engine.getDocument(),
            canUndo: engine.canUndo(),
            canRedo: engine.canRedo(),
        });
    },

    undo: () => {
        engine.undo();
        set({
            document: engine.getDocument(),
            canUndo: engine.canUndo(),
            canRedo: engine.canRedo(),
        });
    },

    redo: () => {
        engine.redo();
        set({
            document: engine.getDocument(),
            canUndo: engine.canUndo(),
            canRedo: engine.canRedo(),
        });
    },
}));