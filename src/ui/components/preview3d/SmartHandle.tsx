import { type ThreeEvent } from '@react-three/fiber';
import type React from 'react';
import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { type DecalData, useEditorStore } from '@/ui/store/editor-store';
import { claimEditorGesture, ownsEditorGesture, releaseEditorGesture } from './gestureCoordinator';
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
  const pointerIdRef = useRef<number | null>(null);
  const captureTargetRef = useRef<PointerCapturable | null>(null);

  useEffect(() => {
    if (!isDragging && mode !== 'idle') {
      setMode('idle');
    }
  }, [isDragging, mode, setMode]);

  useEffect(() => () => {
    const pointerId = pointerIdRef.current;
    if (pointerId === null) return;
    const released = releaseEditorGesture('transform', pointerId);
    try { captureTargetRef.current?.releasePointerCapture?.(pointerId); } catch {}
    if (released) useEditorStore.getState().setIsDragging(false);
    pointerIdRef.current = null;
    captureTargetRef.current = null;
  }, []);

  const getLocalHit = (e: ThreeEvent<PointerEvent>) => {
    const dummy = new THREE.Object3D();
    primaryMesh.add(dummy);
    dummy.position.set(decal.position[0], decal.position[1], decal.position[2]);
    dummy.rotation.set(decal.rotation[0], decal.rotation[1], decal.rotation[2]);

    // Always apply rotation offset to match the final rendered visual orientation
    // for both resize and rotate handles
    dummy.rotateZ(decal.rotationOffset || 0);
    dummy.updateMatrixWorld(true);

    const worldPos = new THREE.Vector3();
    dummy.getWorldPosition(worldPos);

    const normalMatrix = new THREE.Matrix3().getNormalMatrix(dummy.matrixWorld);
    const planeNormal = new THREE.Vector3(0, 0, 1)
      .applyMatrix3(normalMatrix)
      .normalize();
    const plane = new THREE.Plane().setFromNormalAndCoplanarPoint(planeNormal, worldPos);

    const targetPoint = new THREE.Vector3();
    const hitPoint = e.ray.intersectPlane(plane, targetPoint);

    if (!hitPoint) {
      primaryMesh.remove(dummy);
      return null;
    }

    const dummyWorldInverse = new THREE.Matrix4().copy(dummy.matrixWorld).invert();
    const localHit = hitPoint.clone().applyMatrix4(dummyWorldInverse);

    primaryMesh.remove(dummy);
    return localHit;
  };

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

    sx = Number.isFinite(sx) ? sx : MIN_SCALE;
    sy = Number.isFinite(sy) ? sy : MIN_SCALE;

    return { sx, sy };
  };

  const handlePointerDown = (e: ThreeEvent<PointerEvent>, type: 'resize' | 'rotate') => {
    // Only the primary pointer edits a transform handle. Secondary mouse
    // buttons remain available for camera/context interactions.
    if (e.button !== 0) return;

    // Validate geometry first; only then claim the pointer for this transform handle.
    const localHit = getLocalHit(e);
    if (!localHit || !claimEditorGesture('transform', e.pointerId)) return;
    e.stopPropagation();

    const target = e.target as unknown as PointerCapturable;
    pointerIdRef.current = e.pointerId;
    captureTargetRef.current = target || null;
    if (target && typeof target.setPointerCapture === 'function') {
      try { target.setPointerCapture(e.pointerId); } catch {}
    }

    saveHistory();
    setMode(type);
    setIsDragging(true);
    setSelectedId(decal.id, e.shiftKey || e.ctrlKey || e.metaKey);

    document.body.style.cursor = type === 'rotate' ? ROTATE_CURSOR : scaleCursor;

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
        startScaleX: Math.max(0.0001, trueSx),
        startScaleY: Math.max(0.0001, trueSy),
        startDistance: Math.max(0.0001, Math.sqrt(localHit.x ** 2 + localHit.y ** 2)),
        groupInitialStates,
      };
    }
  };

  const handlePointerMove = (e: ThreeEvent<PointerEvent>, type: 'resize' | 'rotate') => {
    if (!ownsEditorGesture('transform', e.pointerId) || pointerIdRef.current !== e.pointerId) return;
    e.stopPropagation();

    if (mode === type && dragState.current && dragState.current.groupInitialStates) {
      const localHit = getLocalHit(e);
      if (!localHit) return;

      const groupInitialStates = dragState.current.groupInitialStates;

      if (type === 'rotate') {
        const currentAngle = Math.atan2(localHit.y, localHit.x);
        let deltaAngle = currentAngle - dragState.current.startMouseAngle;

        // Normalize delta across the boundary
        if (deltaAngle > Math.PI) deltaAngle -= Math.PI * 2;
        if (deltaAngle < -Math.PI) deltaAngle += Math.PI * 2;

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
          const uniformMult = currentDistance / dragState.current.startDistance;
          scaleRatioX = uniformMult;
          scaleRatioY = uniformMult;
        } else {
          const deltaX = localHit.x - dragState.current.startMouseX;
          const deltaY = localHit.y - dragState.current.startMouseY;

          if (dirX !== 0) {
            const newSx = dragState.current.startScaleX + deltaX * dirX * 2;
            scaleRatioX = newSx / dragState.current.startScaleX;
          }
          if (dirY !== 0) {
            const newSy = dragState.current.startScaleY + deltaY * dirY * 2;
            scaleRatioY = newSy / dragState.current.startScaleY;
          }
        }

        scaleRatioX = Number.isFinite(scaleRatioX) ? Math.max(0.0001, scaleRatioX) : 1;
        scaleRatioY = Number.isFinite(scaleRatioY) ? Math.max(0.0001, scaleRatioY) : 1;

        // Side handles normally resize along one axis. When proportion lock is
        // enabled, convert that change into a uniform scale just like a corner drag.
        if (!isCorner && decal.lockAspectRatio !== false) {
          const uniformRatio = dirX !== 0 ? scaleRatioX : scaleRatioY;
          scaleRatioX = uniformRatio;
          scaleRatioY = uniformRatio;
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
    if (!ownsEditorGesture('transform', e.pointerId) || pointerIdRef.current !== e.pointerId) return;
    e.stopPropagation();

    const target = captureTargetRef.current;
    captureTargetRef.current = null;
    pointerIdRef.current = null;
    if (target && typeof target.releasePointerCapture === 'function') {
      try { target.releasePointerCapture(e.pointerId); } catch {}
    }

    releaseEditorGesture('transform', e.pointerId);
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
        <meshBasicMaterial color="#778b9a" depthTest={false} />
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
        userData={{ isDecalHitbox: true, decalId: decal.id, isTransformHandle: true }}
        position={[0, 0, 0.05]}
        onPointerDown={(e) => handlePointerDown(e, 'resize')}
        onPointerMove={(e) => handlePointerMove(e, 'resize')}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onLostPointerCapture={handlePointerUp}
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
          userData={{ isDecalHitbox: true, decalId: decal.id, isTransformHandle: true }}
          position={[0, 0, 0.05]}
          onPointerDown={(e) => handlePointerDown(e, 'rotate')}
          onPointerMove={(e) => handlePointerMove(e, 'rotate')}
          onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onLostPointerCapture={handlePointerUp}
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
