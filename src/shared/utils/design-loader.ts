import { saveWorkspaceToDB } from '@/shared/utils/asset-db';
import { useEditorStore } from '@/ui/store/editor-store';

export interface SavedDesignWorkspace {
  id: string;
  name?: string | null;
  canvas_state?: Record<string, unknown>[] | null;
  tshirt_color?: string | null;
  apparel_model?: string | null;
}

const APPAREL_MODELS = new Set(['tshirtman', 'tshirtwoman', 'tshirtoversized']);

/**
 * Stages a cloud-saved design in the editor's IndexedDB workspace. First run
 * the editor's transition/persistence barrier so an older autosave cannot race
 * and overwrite the design being staged. EditorLayout then loads the staged
 * snapshot when navigation mounts the editor.
 */
export async function loadSavedDesignIntoEditor(design: SavedDesignWorkspace): Promise<void> {
  const apparelModel = APPAREL_MODELS.has(design.apparel_model || '')
    ? design.apparel_model
    : 'tshirtman';

  // Drain any previous editor transition/persistence before replacing its
  // IndexedDB checkpoint with this selected design.
  await useEditorStore.getState().init();

  await saveWorkspaceToDB(
    JSON.stringify({
      decals: Array.isArray(design.canvas_state) ? design.canvas_state : [],
      tshirtColor: design.tshirt_color || '#ffffff',
      apparelModel,
      activeDesignId: design.id,
      designName: design.name?.trim() || 'Untitled Design',
      remixSourceId: null,
    }),
  );

}
