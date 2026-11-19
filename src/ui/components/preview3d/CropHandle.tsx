import { type ThreeEvent, useThree } from '@react-three/fiber';
import type React from 'react';
import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import type { DecalData } from '@/ui/store/editor-store';
import { useEditorStore } from '@/ui/store/editor-store';
import type { DragState, InteractionMode, PointerCapturable } from './types';
import { claimEditorGesture, ownsEditorGesture, releaseEditorGesture } from './gestureCoordinator';

const _raycaster = new THREE.Raycaster();
const _plane = new THREE.Plane();
const _intersectPoint = new THREE.Vector3();

export function CropHandle({
  position,
  scaleCursor,
  dirX,
  dirY,
  decal,
  mode,
  setMode,
  dragState,
}: {
  position: [number, number, number];
  scaleCursor: string;
  dirX: number;
  dirY: number;
  decal: DecalData;
  mode: InteractionMode;
  setMode: (m: InteractionMode) => void;
  dragState: React.MutableRefObject<DragState>;
}) {
  const { camera } = useThree();
  const isHovered = useRef(false);
  const cropRequestRef = useRef(0);
  const pointerIdRef = useRef<number | null>(null);
  const captureTargetRef = useRef<PointerCapturable | null>(null);

  const finishCropPointer = (e: ThreeEvent<PointerEvent>) => {
    if (pointerIdRef.current !== e.pointerId || !ownsEditorGesture('crop', e.pointerId)) return;
    e.stopPropagation();
    const released = releaseEditorGesture('crop', e.pointerId);
    pointerIdRef.current = null;
    if (released) {
      setMode('idle');
      const store = useEditorStore.getState();
      store.setIsDragging(false);
      const currentDecal = store.decals.find((d) => d.id === decal.id);
      if (currentDecal) {
        const requestId = ++cropRequestRef.current;
        import('@/ui/store/editor-store').then(({ applyImageFilters }) => {
          return applyImageFilters(currentDecal);
        }).then(({ src, aspectRatio }) => {
          if (requestId !== cropRequestRef.current) return;
          const latest = useEditorStore.getState().decals.find((d) => d.id === decal.id);
          if (!latest) return;
          useEditorStore.getState().updateDecal(decal.id, { src, aspectRatio });
        }).catch((error) => console.error('Failed to apply crop:', error));
      }
    }
    const target = captureTargetRef.current;
    captureTargetRef.current = null;
    if (target && typeof target.releasePointerCapture === 'function') {
      try { target.releasePointerCapture(e.pointerId); } catch {}
    }
    document.body.style.cursor = 'default';
  };

  useEffect(() => () => {
    const pointerId = pointerIdRef.current;
    if (pointerId === null) return;
    const released = releaseEditorGesture('crop', pointerId);
    try { captureTargetRef.current?.releasePointerCapture?.(pointerId); } catch {}
    if (released) useEditorStore.getState().setIsDragging(false);
    pointerIdRef.current = null;
    captureTargetRef.current = null;
    document.body.style.cursor = 'default';
  }, []);

  return (
    <group position={position}>
      <mesh
        userData={{ isDecalHitbox: true, decalId: decal.id, isCropHandle: true }}
        onPointerOver={(e: ThreeEvent<PointerEvent>) => {
          e.stopPropagation();
          isHovered.current = true;
          if (mode === 'idle' || mode === 'crop') {
            document.body.style.cursor = scaleCursor;
          }
        }}
        onPointerOut={(e: ThreeEvent<PointerEvent>) => {
          e.stopPropagation();
          isHovered.current = false;
          if (mode === 'idle') document.body.style.cursor = 'grab';
        }}
        onPointerDown={(e: ThreeEvent<PointerEvent>) => {
          if (e.button !== 0 || !claimEditorGesture('crop', e.pointerId)) return;
          e.stopPropagation();
          pointerIdRef.current = e.pointerId;
          const target = e.target as unknown as PointerCapturable;
          captureTargetRef.current = target || null;
          try { target?.setPointerCapture?.(e.pointerId); } catch {}
          cropRequestRef.current += 1;

          const store = useEditorStore.getState();
          store.saveHistory();

          setMode('crop');
          store.setIsDragging(true);

          _plane.setFromNormalAndCoplanarPoint(
            camera.getWorldDirection(new THREE.Vector3()).negate(),
            e.point,
          );

          _raycaster.setFromCamera(e.pointer, camera);
          if (!_raycaster.ray.intersectPlane(_plane, _intersectPoint)) {
            releaseEditorGesture('crop', e.pointerId);
            pointerIdRef.current = null;
            const captureTarget = captureTargetRef.current;
            captureTargetRef.current = null;
            try { captureTarget?.releasePointerCapture?.(e.pointerId); } catch {}
            setMode('idle');
            store.setIsDragging(false);
            return;
          }

          dragState.current = {
            ...dragState.current,
            startMouseX: _intersectPoint.x,
            startMouseY: _intersectPoint.y,
            // Store the initial crop states
            startScaleX: decal.cropX || 0,
            startScaleY: decal.cropY || 0,
            startRotationOffset: decal.cropW || 100,
            startDistance: decal.cropH || 100,
          };

        }}
        onPointerMove={(e: ThreeEvent<PointerEvent>) => {
          if (pointerIdRef.current !== e.pointerId || !ownsEditorGesture('crop', e.pointerId)) return;
          e.stopPropagation();
          if (mode === 'crop') {
            _raycaster.setFromCamera(e.pointer, camera);
            if (!_raycaster.ray.intersectPlane(_plane, _intersectPoint)) return;

            const dx = _intersectPoint.x - dragState.current.startMouseX;
            const dy = _intersectPoint.y - dragState.current.startMouseY;

            // Invert dy because 3D Y is up, but crop Y is down (from top-left)
            const sensitivity = 50;
            const percentDx = dx * sensitivity;
            const percentDy = -dy * sensitivity;

            let newCropX = dragState.current.startScaleX;
            let newCropY = dragState.current.startScaleY;
            let newCropW = dragState.current.startRotationOffset;
            let newCropH = dragState.current.startDistance;

            if (dirX === -1) {
              // Left edge moving
              newCropX = Math.min(Math.max(0, newCropX + percentDx), newCropX + newCropW - 5);
              newCropW =
                dragState.current.startRotationOffset - (newCropX - dragState.current.startScaleX);
            } else if (dirX === 1) {
              // Right edge moving
              newCropW = Math.min(Math.max(5, newCropW + percentDx), 100 - newCropX);
            }

            if (dirY === 1) {
              // Top edge moving
              newCropY = Math.min(Math.max(0, newCropY + percentDy), newCropY + newCropH - 5);
              newCropH =
                dragState.current.startDistance - (newCropY - dragState.current.startScaleY);
            } else if (dirY === -1) {
              // Bottom edge moving
              newCropH = Math.min(Math.max(5, newCropH - percentDy), 100 - newCropY);
            }

            useEditorStore.getState().updateDecal(decal.id, {
              cropX: newCropX,
              cropY: newCropY,
              cropW: newCropW,
              cropH: newCropH,
            });
          }
        }}
        onPointerUp={finishCropPointer}
        onPointerCancel={finishCropPointer}
        onLostPointerCapture={finishCropPointer}

      >
        {/* Draw a distinct pill-shaped handle for cropping */}
        <capsuleGeometry args={[0.015, Math.max(0.05, Math.abs(dirX) > 0 ? 0.2 : 0), 4, 8]} />
        <meshBasicMaterial color="#ff0000" depthTest={false} transparent opacity={0.8} />
      </mesh>
    </group>
  );
}
