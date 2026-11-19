/**
 * Single-pointer arbitration for the 3D editor.
 * A gesture is claimed synchronously on pointer-down so R3F bubbling,
 * OrbitControls and child handlers cannot all act on the same pointer.
 */
export type EditorGestureOwner = 'decal' | 'transform' | 'brush' | 'camera' | 'crop' | 'marquee';

type ActiveGesture = { pointerId: number; owner: EditorGestureOwner };

let activeGesture: ActiveGesture | null = null;

export function claimEditorGesture(owner: EditorGestureOwner, pointerId: number): boolean {
  if (activeGesture) {
    return activeGesture.pointerId === pointerId && activeGesture.owner === owner;
  }
  activeGesture = { owner, pointerId };
  return true;
}

export function ownsEditorGesture(owner: EditorGestureOwner, pointerId: number): boolean {
  return activeGesture?.owner === owner && activeGesture.pointerId === pointerId;
}

export function releaseEditorGesture(owner: EditorGestureOwner, pointerId: number): boolean {
  if (!ownsEditorGesture(owner, pointerId)) return false;
  activeGesture = null;
  return true;
}

export function getActiveEditorGesture(): ActiveGesture | null {
  return activeGesture;
}

export function clearEditorGesture(): void {
  activeGesture = null;
}
