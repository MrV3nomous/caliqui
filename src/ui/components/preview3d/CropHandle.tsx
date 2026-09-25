import { type ThreeEvent, useThree } from '@react-three/fiber';
import type React from 'react';
import { useRef } from 'react';
import * as THREE from 'three';
import type { DecalData } from '@/ui/store/editor-store';
import { useEditorStore } from '@/ui/store/editor-store';
import type { DragState, InteractionMode, PointerCapturable } from './types';

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

  return (
    <group position={position}>
      <mesh
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
          e.stopPropagation();
          if (e.button === 2) return;

          const store = useEditorStore.getState();
          store.saveHistory();

          setMode('crop');
          store.setIsDragging(true);

          _plane.setFromNormalAndCoplanarPoint(
            camera.getWorldDirection(new THREE.Vector3()).negate(),
            e.point,
          );

          _raycaster.setFromCamera(e.pointer, camera);
          _raycaster.ray.intersectPlane(_plane, _intersectPoint);

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

          const target = e.target as unknown as PointerCapturable;
          if (target && typeof target.setPointerCapture === 'function') {
            target.setPointerCapture(e.pointerId);
          }
        }}
        onPointerMove={(e: ThreeEvent<PointerEvent>) => {
          e.stopPropagation();
          if (mode === 'crop' && isHovered.current) {
            _raycaster.setFromCamera(e.pointer, camera);
            _raycaster.ray.intersectPlane(_plane, _intersectPoint);

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
        onPointerUp={(e: ThreeEvent<PointerEvent>) => {
          e.stopPropagation();
          if (mode === 'crop') {
            setMode('idle');
            useEditorStore.getState().setIsDragging(false);

            // Force the canvas to recalculate and generate the new cropped image
            const store = useEditorStore.getState();
            const currentDecal = store.decals.find((d) => d.id === decal.id);
            if (currentDecal) {
              import('@/ui/store/editor-store').then(({ applyImageFilters }) => {
                applyImageFilters(currentDecal).then(({ src, aspectRatio }) => {
                  store.updateDecal(decal.id, { src, aspectRatio });
                });
              });
            }
          }
          const target = e.target as unknown as PointerCapturable;
          if (target && typeof target.releasePointerCapture === 'function') {
            try {
              target.releasePointerCapture(e.pointerId);
            } catch {}
          }
        }}
      >
        {/* Draw a distinct pill-shaped handle for cropping */}
        <capsuleGeometry args={[0.015, Math.max(0.05, Math.abs(dirX) > 0 ? 0.2 : 0), 4, 8]} />
        <meshBasicMaterial color="#ff0000" depthTest={false} transparent opacity={0.8} />
      </mesh>
    </group>
  );
}
