import { type ThreeEvent, useThree } from '@react-three/fiber';
import type React from 'react';
import { useEffect } from 'react';
import * as THREE from 'three';
import { type DecalData, useEditorStore } from '@/ui/store/editor-store';
import {
  type DragState,
  type InteractionMode,
  MAX_SCALE,
  MIN_SCALE,
  type PointerCapturable,
  ROTATE_CURSOR,
} from './types';

interface ExtendedDragState extends DragState {
  groupInitialStates?: Record<string, { sx: number; sy: number; s: number; rot: number }>;
}

export function SmartHandle({
  position,
  scaleCursor,
  decal,
  mode,
  setMode,
  dragState,
  dirX,
  dirY,
  isCorner,
  primaryMesh,
}: {
  position: [number, number, number];
  scaleCursor: string;
  decal: DecalData;
  mode: InteractionMode;
  setMode: (mode: InteractionMode) => void;
  dragState: React.RefObject<ExtendedDragState>;
  dirX: number;
  dirY: number;
  isCorner: boolean;
  primaryMesh: THREE.Mesh;
}) {
  const {
    updateDecal,
    setIsDragging,
    isDragging,
    setSelectedId,
    saveHistory,
    decals,
    selectedIds,
  } = useEditorStore();
  const { camera } = useThree();

  useEffect(() => {
    if (!isDragging && mode !== 'idle') {
      setMode('idle');
    }
  }, [isDragging, mode, setMode]);

  const getLocalHit = (e: ThreeEvent<PointerEvent>, applyRotationOffset: boolean) => {
    const dummy = new THREE.Object3D();
    primaryMesh.add(dummy);
    dummy.position.set(...decal.position);
    dummy.rotation.set(decal.rotation[0], decal.rotation[1], decal.rotation[2]);
    if (applyRotationOffset) dummy.rotateZ(decal.rotationOffset || 0);
    dummy.updateMatrixWorld(true);

    const worldPos = new THREE.Vector3();
    dummy.getWorldPosition(worldPos);

    const planeNormal = camera.getWorldDirection(new THREE.Vector3()).negate();
    const plane = new THREE.Plane().setFromNormalAndCoplanarPoint(planeNormal, worldPos);

    const hitPoint = new THREE.Vector3();
    e.ray.intersectPlane(plane, hitPoint);

    if (!hitPoint) {
      primaryMesh.remove(dummy);
      return null;
    }

    const dummyWorldInverse = new THREE.Matrix4().copy(dummy.matrixWorld).invert();
    const localHit = hitPoint.clone().applyMatrix4(dummyWorldInverse);

    primaryMesh.remove(dummy);
    return localHit;
  };

  // FIX: Helper to calculate the true starting scale factoring in the dynamic aspect ratio
  const getTrueScale = (d: DecalData) => {
    const ratio = d.aspectRatio || 1;
    let sx = d.scaleX ?? d.scale;
    let sy = d.scaleY ?? d.scale;

    if (d.scaleX === undefined && d.scaleY === undefined) {
      if (ratio > 1) {
        sx = d.scale * ratio;
        sy = d.scale;
      } else if (ratio < 1) {
        sx = d.scale;
        sy = d.scale / ratio;
      }
    }
    return { sx, sy };
  };

  const handlePointerDown = (e: ThreeEvent<PointerEvent>, type: 'resize' | 'rotate') => {
    e.stopPropagation();

    const target = e.target as unknown as PointerCapturable;
    if (target && typeof target.setPointerCapture === 'function') {
      target.setPointerCapture(e.pointerId);
    }

    saveHistory();
    setMode(type);
    setIsDragging(true);
    setSelectedId(decal.id, e.shiftKey || e.ctrlKey || e.metaKey);

    document.body.style.cursor = type === 'rotate' ? ROTATE_CURSOR : scaleCursor;

    const localHit = getLocalHit(e, type === 'resize');
    if (localHit) {
      const { sx: trueSx, sy: trueSy } = getTrueScale(decal);

      const groupInitialStates: Record<string, { sx: number; sy: number; s: number; rot: number }> =
        {};

      decals.forEach((d) => {
        if (
          d.id === decal.id ||
          (decal.groupId && d.groupId === decal.groupId) ||
          (selectedIds.includes(decal.id) && selectedIds.includes(d.id))
        ) {
          const { sx: dSx, sy: dSy } = getTrueScale(d);
          groupInitialStates[d.id] = {
            sx: dSx,
            sy: dSy,
            s: d.scale,
            rot: d.rotationOffset || 0,
          };
        }
      });

      if (dragState.current) {
        dragState.current = {
          startMouseAngle: Math.atan2(localHit.y, localHit.x),
          startRotationOffset: decal.rotationOffset || 0,
          startMouseX: localHit.x,
          startMouseY: localHit.y,
          startScaleX: trueSx,
          startScaleY: trueSy,
          startDistance: Math.sqrt(localHit.x ** 2 + localHit.y ** 2),
          groupInitialStates,
        };
      }
    }
  };

  const handlePointerMove = (e: ThreeEvent<PointerEvent>, type: 'resize' | 'rotate') => {
    e.stopPropagation();

    if (mode === type && dragState.current && dragState.current.groupInitialStates) {
      const localHit = getLocalHit(e, type === 'resize');
      if (!localHit) return;

      const groupInitialStates = dragState.current.groupInitialStates;

      if (type === 'rotate') {
        const currentAngle = Math.atan2(localHit.y, localHit.x);
        let deltaAngle = currentAngle - dragState.current.startMouseAngle;

        if (e.shiftKey) {
          const absoluteRotation = dragState.current.startRotationOffset + deltaAngle;
          const snappedRotation = Math.round(absoluteRotation / (Math.PI / 4)) * (Math.PI / 4);
          deltaAngle = snappedRotation - dragState.current.startRotationOffset;
        }

        Object.keys(groupInitialStates).forEach((id) => {
          updateDecal(id, { rotationOffset: groupInitialStates[id].rot + deltaAngle });
        });
      } else {
        let scaleRatioX = 1;
        let scaleRatioY = 1;

        if (isCorner) {
          const currentDistance = Math.sqrt(localHit.x ** 2 + localHit.y ** 2);
          const uniformMult = currentDistance / Math.max(0.0001, dragState.current.startDistance);
          scaleRatioX = uniformMult;
          scaleRatioY = uniformMult;
        } else {
          const deltaX = localHit.x - dragState.current.startMouseX;
          const deltaY = localHit.y - dragState.current.startMouseY;

          if (dirX !== 0) {
            const newSx = Math.max(MIN_SCALE, dragState.current.startScaleX + deltaX * dirX * 2);
            scaleRatioX = newSx / dragState.current.startScaleX;
          }
          if (dirY !== 0) {
            const newSy = Math.max(MIN_SCALE, dragState.current.startScaleY + deltaY * dirY * 2);
            scaleRatioY = newSy / dragState.current.startScaleY;
          }
        }

        Object.keys(groupInitialStates).forEach((id) => {
          const initial = groupInitialStates[id];
          const newSx = Math.min(MAX_SCALE, Math.max(MIN_SCALE, initial.sx * scaleRatioX));
          const newSy = Math.min(MAX_SCALE, Math.max(MIN_SCALE, initial.sy * scaleRatioY));

          updateDecal(id, {
            scaleX: newSx,
            scaleY: newSy,
            scale: Math.max(newSx, newSy),
          });
        });
      }
    }
  };

  const handlePointerUp = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();

    const target = e.target as unknown as PointerCapturable;
    if (target && typeof target.releasePointerCapture === 'function') {
      try {
        target.releasePointerCapture(e.pointerId);
      } catch {}
    }

    setMode('idle');
    setIsDragging(false);
    document.body.style.cursor = 'default';
  };

  return (
    <group position={position}>
      <mesh
        position={[0, 0, 0.01]}
        renderOrder={998}
        raycast={() => null}
        castShadow={false}
        receiveShadow={false}
      >
        <circleGeometry args={[0.032, 32]} />
        <meshBasicMaterial color="#0d99ff" depthTest={false} />
      </mesh>
      <mesh
        position={[0, 0, 0.015]}
        renderOrder={999}
        raycast={() => null}
        castShadow={false}
        receiveShadow={false}
      >
        <circleGeometry args={[0.025, 32]} />
        <meshBasicMaterial color="#ffffff" depthTest={false} />
      </mesh>

      <mesh
        userData={{ isDecalHitbox: true }}
        position={[0, 0, 0.05]}
        onPointerDown={(e) => handlePointerDown(e, 'resize')}
        onPointerMove={(e) => handlePointerMove(e, 'resize')}
        onPointerUp={handlePointerUp}
        onPointerOver={(e) => {
          e.stopPropagation();
          if (mode === 'idle') document.body.style.cursor = scaleCursor;
        }}
        onPointerOut={(e) => {
          e.stopPropagation();
          if (mode === 'idle') document.body.style.cursor = 'default';
        }}
        castShadow={false}
        receiveShadow={false}
      >
        <sphereGeometry args={[0.12, 16, 16]} />
        <meshBasicMaterial transparent opacity={0} depthTest={false} depthWrite={false} />
      </mesh>

      {isCorner && (
        <mesh
          userData={{ isDecalHitbox: true }}
          position={[0, 0, 0.05]}
          onPointerDown={(e) => handlePointerDown(e, 'rotate')}
          onPointerMove={(e) => handlePointerMove(e, 'rotate')}
          onPointerUp={handlePointerUp}
          onPointerOver={(e) => {
            e.stopPropagation();
            if (mode === 'idle') document.body.style.cursor = ROTATE_CURSOR;
          }}
          onPointerOut={(e) => {
            e.stopPropagation();
            if (mode === 'idle') document.body.style.cursor = 'default';
          }}
          castShadow={false}
          receiveShadow={false}
        >
          <torusGeometry args={[0.18, 0.05, 8, 32]} />
          <meshBasicMaterial transparent opacity={0} depthTest={false} depthWrite={false} />
        </mesh>
      )}
    </group>
  );
}
