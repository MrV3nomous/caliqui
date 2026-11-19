import { Html } from '@react-three/drei';
import { type ThreeEvent, useFrame, useThree } from '@react-three/fiber';
import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { useEditorStore } from '@/ui/store/editor-store';
import { claimEditorGesture, ownsEditorGesture, releaseEditorGesture } from './gestureCoordinator';

export function MarqueeEngine() {
  const { camera, scene, size } = useThree();
  const {
    globalToolMode,
    setMarqueeStart,
    setMarqueeEnd,
    setShowMarqueeBox,
    showMarqueeBox,
    setIsDragging,
  } = useEditorStore();

  const planeRef = useRef<THREE.Mesh>(null);
  const pointerIdRef = useRef<number | null>(null);
  const captureTargetRef = useRef<{ setPointerCapture?: (id: number) => void; releasePointerCapture?: (id: number) => void } | null>(null);

  // 1. Lock the invisible drag-catcher mesh directly to the camera lens!
  // This guarantees it will never slice through the T-shirt when rotated.
  useFrame(() => {
    if (planeRef.current) {
      planeRef.current.position.copy(camera.position);
      planeRef.current.quaternion.copy(camera.quaternion);
      planeRef.current.translateZ(-1.5); // Float it just in front of the camera lens
    }
  });

  const [screenStart, setScreenStart] = useState<{ x: number; y: number } | null>(null);
  const [screenEnd, setScreenEnd] = useState<{ x: number; y: number } | null>(null);

  const finishMarquee = (pointerId: number) => {
    if (pointerIdRef.current !== pointerId || !ownsEditorGesture('marquee', pointerId)) return false;
    const released = releaseEditorGesture('marquee', pointerId);
    pointerIdRef.current = null;
    try { captureTargetRef.current?.releasePointerCapture?.(pointerId); } catch {}
    captureTargetRef.current = null;
    useEditorStore.getState().setIsDragging(false);
    return released;
  };

  useEffect(() => () => {
    const pointerId = pointerIdRef.current;
    if (pointerId === null) return;
    const released = releaseEditorGesture('marquee', pointerId);
    try { captureTargetRef.current?.releasePointerCapture?.(pointerId); } catch {}
    if (released) useEditorStore.getState().setIsDragging(false);
    pointerIdRef.current = null;
    captureTargetRef.current = null;
  }, []);

  if (globalToolMode !== 'select') return null;

  const left = screenStart && screenEnd ? Math.min(screenStart.x, screenEnd.x) : 0;
  const top = screenStart && screenEnd ? Math.min(screenStart.y, screenEnd.y) : 0;
  const width = screenStart && screenEnd ? Math.abs(screenStart.x - screenEnd.x) : 0;
  const height = screenStart && screenEnd ? Math.abs(screenStart.y - screenEnd.y) : 0;

  // Converts native R3F Normalized Device Coordinates into exact Canvas-relative pixels!
  // This completely ignores the window, sidebars, and scrolling.
  const getCanvasPos = (pointer: THREE.Vector2) => ({
    x: ((pointer.x + 1) / 2) * size.width,
    y: ((-pointer.y + 1) / 2) * size.height,
  });

  return (
    <group>
      {/* Invisible 3D Event Catcher */}
      <mesh
        ref={planeRef}
        visible={true}
        onPointerDown={(e: ThreeEvent<PointerEvent>) => {
          if (e.button !== 0 || !claimEditorGesture('marquee', e.pointerId)) return;
          e.stopPropagation();
          pointerIdRef.current = e.pointerId;
          captureTargetRef.current = e.target as unknown as { setPointerCapture?: (id: number) => void; releasePointerCapture?: (id: number) => void };
          try { captureTargetRef.current.setPointerCapture?.(e.pointerId); } catch {}
          const pos = getCanvasPos(e.pointer);

          setScreenStart(pos);
          setScreenEnd(pos);

          // We pass dummy data just to toggle the store states
          setMarqueeStart([0, 0, 0]);
          setMarqueeEnd([0, 0, 0]);

          setShowMarqueeBox(true);
          setIsDragging(true);

        }}
        onPointerMove={(e: ThreeEvent<PointerEvent>) => {
          const state = useEditorStore.getState();
          if (pointerIdRef.current === e.pointerId && ownsEditorGesture('marquee', e.pointerId) && state.marqueeStart) {
            e.stopPropagation();
            setScreenEnd(getCanvasPos(e.pointer));
          }
        }}
        onLostPointerCapture={(e: ThreeEvent<PointerEvent>) => {
          if (!finishMarquee(e.pointerId)) return;
          const state = useEditorStore.getState();
          state.setMarqueeStart(null);
          state.setMarqueeEnd(null);
          state.setShowMarqueeBox(false);
          setScreenStart(null);
          setScreenEnd(null);
        }}
        onPointerCancel={(e: ThreeEvent<PointerEvent>) => {
          if (!finishMarquee(e.pointerId)) return;
          e.stopPropagation();
          const state = useEditorStore.getState();
          state.setMarqueeStart(null);
          state.setMarqueeEnd(null);
          state.setShowMarqueeBox(false);
          setScreenStart(null);
          setScreenEnd(null);

        }}
        onPointerUp={(e: ThreeEvent<PointerEvent>) => {
          if (pointerIdRef.current !== e.pointerId || !ownsEditorGesture('marquee', e.pointerId)) return;
          e.stopPropagation();
          const state = useEditorStore.getState();
          if (!state.marqueeStart) { finishMarquee(e.pointerId); return; }

          finishMarquee(e.pointerId);

          if (screenStart) {
            const pos = getCanvasPos(e.pointer);
            const dist = Math.hypot(screenStart.x - pos.x, screenStart.y - pos.y);

            if (dist > 10) {
              const selLeft = Math.min(screenStart.x, pos.x);
              const selRight = Math.max(screenStart.x, pos.x);
              const selTop = Math.min(screenStart.y, pos.y);
              const selBottom = Math.max(screenStart.y, pos.y);

              const selected: string[] = [];

              state.decals.forEach((decal) => {
                // Find the physical T-Shirt Mesh
                let pMesh = scene.getObjectByName(decal.meshName || '');
                if (!pMesh) {
                  scene.traverse((c) => {
                    if (
                      !pMesh &&
                      (c as THREE.Mesh).isMesh &&
                      !c.name.includes('Marquee') &&
                      !c.userData.isDecalHitbox
                    ) {
                      pMesh = c as THREE.Mesh;
                    }
                  });
                }

                // Inherit the T-Shirt's World Matrix
                const obj = new THREE.Object3D();
                obj.position.set(...decal.position);
                obj.rotation.set(...decal.rotation);
                if (decal.rotationOffset) obj.rotateZ(decal.rotationOffset);

                if (pMesh) pMesh.add(obj);
                else scene.add(obj);

                obj.updateMatrixWorld(true);

                const worldPos = new THREE.Vector3();
                obj.getWorldPosition(worldPos);
                const worldQuat = new THREE.Quaternion();
                obj.getWorldQuaternion(worldQuat);

                // 2. ABSOLUTE FIX: Front / Back Isolation (Camera Dot Product)
                const normal = new THREE.Vector3(0, 0, 1).applyQuaternion(worldQuat).normalize();
                const toCamera = camera.position.clone().sub(worldPos).normalize();

                // If they point in the same direction, it's > 0.
                // We use -0.2 to allow assets curving slightly over the side edges to still be selected.
                const isFacingFront = normal.dot(toCamera) > -0.2;

                if (isFacingFront) {
                  const sx = decal.scaleX ?? decal.scale;
                  const sy = decal.scaleY ?? decal.scale;
                  const hsX = sx / 2;
                  const hsY = sy / 2;

                  // Get the 4 corners of the asset
                  const corners = [
                    new THREE.Vector3(-hsX, hsY, 0),
                    new THREE.Vector3(hsX, hsY, 0),
                    new THREE.Vector3(hsX, -hsY, 0),
                    new THREE.Vector3(-hsX, -hsY, 0),
                  ];

                  let minPx = Infinity;
                  let maxPx = -Infinity;
                  let minPy = Infinity;
                  let maxPy = -Infinity;

                  // 3. ABSOLUTE FIX: Project corners through the camera onto the exact Canvas Pixels
                  for (const corner of corners) {
                    corner.applyMatrix4(obj.matrixWorld);
                    corner.project(camera);

                    // Match the exact pixel space calculated by getCanvasPos()
                    const cPx = ((corner.x + 1) / 2) * size.width;
                    const cPy = ((-corner.y + 1) / 2) * size.height;

                    minPx = Math.min(minPx, cPx);
                    maxPx = Math.max(maxPx, cPx);
                    minPy = Math.min(minPy, cPy);
                    maxPy = Math.max(maxPy, cPy);
                  }

                  // 4. Absolute pixel-perfect boundary intersection check
                  const isOverlapping =
                    minPx <= selRight && maxPx >= selLeft && minPy <= selBottom && maxPy >= selTop;

                  if (isOverlapping) {
                    selected.push(decal.id);
                  }
                }

                // Cleanup
                if (pMesh) pMesh.remove(obj);
                else scene.remove(obj);
              });

              state.setSelectedIds(selected);
              state.setGlobalToolMode('default');
            } else {
              state.setSelectedIds([]);
            }
          }

          setMarqueeStart(null);
          setMarqueeEnd(null);
          setScreenStart(null);
          setScreenEnd(null);
          setShowMarqueeBox(false);
        }}
      >
        <planeGeometry args={[100, 100]} />
        <meshBasicMaterial
          transparent
          opacity={0}
          depthTest={false}
          depthWrite={false}
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* 5. ABSOLUTE FIX: Safely use <Html> to break out of the 3D Canvas context */}
      <Html fullscreen zIndexRange={[100, 0]} style={{ pointerEvents: 'none' }}>
        <div style={{ position: 'relative', width: '100%', height: '100%' }}>
          {screenStart && screenEnd && showMarqueeBox && width > 0 && height > 0 && (
            <div
              style={{
                position: 'absolute',
                left,
                top,
                width,
                height,
                backgroundColor: 'color-mix(in srgb, var(--studio-ui-accent, #788995) 12%, transparent)',
                border: '1px solid color-mix(in srgb, var(--studio-ui-accent, #788995) 62%, transparent)',
                boxShadow: 'none',
                pointerEvents: 'none',
              }}
            />
          )}
        </div>
      </Html>
    </group>
  );
}
