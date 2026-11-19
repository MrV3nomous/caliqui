import { useGLTF, useTexture } from '@react-three/drei';
import { type ThreeEvent, useFrame, useThree } from '@react-three/fiber';
import { type RefObject, Suspense, useCallback, useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import tshirtManUrl from '@/assets/models/tshirtman.glb?url';
import tshirtoversizedUrl from '@/assets/models/tshirtoversized.glb?url';
import tshirtWomanUrl from '@/assets/models/tshirtwoman.glb?url';
import { useEditorStore } from '@/ui/store/editor-store';
import { ProjectedDecal } from './ProjectedDecal';
import type { PointerCapturable } from './types';
import { claimEditorGesture, ownsEditorGesture, releaseEditorGesture } from './gestureCoordinator';

Object.assign(useGLTF, {
  draco: 'https://www.gstatic.com/draco/versioned/decoders/1.5.5/',
});

const MODELS: Record<string, string> = {
  tshirtman: tshirtManUrl,
  tshirtwoman: tshirtWomanUrl,
  tshirtoversized: tshirtoversizedUrl,
};

const MODEL_SCALE = 0.03;

// Transparent 1x1 pixel fallback to prevent Drei's useTexture Suspense failure on empty src
const FALLBACK_TEXTURE =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';

function WrapMaterial({ meshes, decalId }: { meshes: THREE.Mesh[]; decalId: string }) {
  // Targeted reactivity: only this component re-renders when the wrap decal's scale/aspect changes
  const decal = useEditorStore(
    useCallback((s) => s.decals.find((d) => d.id === decalId), [decalId]),
  );
  const src = decal?.src || FALLBACK_TEXTURE;
  const texture = useTexture(src);

  useEffect(() => {
    if (!texture || !decal) return;
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;

    const aspectRatio = decal.aspectRatio;
    const ratio =
      typeof aspectRatio === 'number' && Number.isFinite(aspectRatio)
        ? Math.max(0.0001, aspectRatio)
        : 1;
    let sx = decal.scaleX ?? decal.scale;
    let sy = decal.scaleY ?? decal.scale;

    if (decal.scaleX === undefined && decal.scaleY === undefined) {
      if (ratio > 1) {
        sx = (decal.scale ?? 0.35) * ratio;
        sy = decal.scale ?? 0.35;
      } else if (ratio < 1) {
        sx = decal.scale ?? 0.35;
        sy = (decal.scale ?? 0.35) / ratio;
      } else {
        sx = decal.scale ?? 0.35;
        sy = decal.scale ?? 0.35;
      }
    }

    const finalSx = typeof sx === 'number' && Number.isFinite(sx) && sx > 0 ? sx : 0.35;
    const finalSy = typeof sy === 'number' && Number.isFinite(sy) && sy > 0 ? sy : 0.35;

    texture.repeat.set(1 / finalSx, 1 / finalSy);
    texture.needsUpdate = true;

    const applyMap = (mesh: THREE.Mesh) => {
      if (Array.isArray(mesh.material)) {
        mesh.material.forEach((m) => {
          if (m instanceof THREE.MeshStandardMaterial) {
            m.map = texture;
            m.needsUpdate = true;
          }
        });
      } else if (mesh.material instanceof THREE.MeshStandardMaterial) {
        mesh.material.map = texture;
        mesh.material.needsUpdate = true;
      }
    };

    const clearMap = (mesh: THREE.Mesh) => {
      if (Array.isArray(mesh.material)) {
        mesh.material.forEach((m) => {
          if (m instanceof THREE.MeshStandardMaterial && m.map === texture) {
            m.map = null;
            m.needsUpdate = true;
          }
        });
      } else if (
        mesh.material instanceof THREE.MeshStandardMaterial &&
        mesh.material.map === texture
      ) {
        mesh.material.map = null;
        mesh.material.needsUpdate = true;
      }
    };

    meshes.forEach(applyMap);

    return () => {
      // Safely detach without disposing, since Drei owns this texture's lifecycle
      meshes.forEach(clearMap);
    };
  }, [texture, meshes, decal]); // Safe to depend on decal object here due to the targeted store subscription

  return null;
}

type OrbitGestureState = {
  pointerId: number;
  startX: number;
  startY: number;
  lastX: number;
  lastY: number;
  moved: boolean;
};

type TShirtModelProps = {
  controlsRef: RefObject<OrbitControlsImpl | null>;
};

export function TShirtModel({ controlsRef }: TShirtModelProps) {
  const apparelModel = useEditorStore((state) => state.apparelModel);
  const tshirtColor = useEditorStore((state) => state.tshirtColor);

  const activeModelUrl = MODELS[apparelModel] || tshirtManUrl;
  const { scene: gltfScene } = useGLTF(activeModelUrl);
  const { camera, gl } = useThree();

  const previousModelRef = useRef<string>(apparelModel);
  const raycasterRef = useRef(new THREE.Raycaster());
  const dummyWorldRef = useRef(new THREE.Object3D());
  const orbitGestureRef = useRef<OrbitGestureState | null>(null);
  const touchPointerIdsRef = useRef<Set<number>>(new Set());
  const cameraCaptureTargetRef = useRef<PointerCapturable | null>(null);
  const releaseCameraCapture = useCallback((pointerId: number) => {
    const target = cameraCaptureTargetRef.current;
    cameraCaptureTargetRef.current = null;
    try { target?.releasePointerCapture?.(pointerId); } catch {}
    // Native canvas capture is a fallback for browser/R3F combinations that do
    // not expose capture methods on the event target proxy.
    try { if (gl.domElement.hasPointerCapture(pointerId)) gl.domElement.releasePointerCapture(pointerId); } catch {}
  }, [gl]);
  const setIsDragging = useEditorStore((state) => state.setIsDragging);

  useEffect(() => () => {
    const gesture = orbitGestureRef.current;
    if (gesture) {
      const released = releaseEditorGesture('camera', gesture.pointerId);
      if (released && useEditorStore.getState().isDragging) useEditorStore.getState().setIsDragging(false);
      releaseCameraCapture(gesture.pointerId);
    }
    orbitGestureRef.current = null;
    touchPointerIdsRef.current.clear();
  }, [gl, releaseCameraCapture]);

  const layoutTrigger = useEditorStore((state) =>
    state.decals.map((d) => `${d.id}|${d.placementMode}|${d.meshName || ''}|${d.visible !== false}`).join(','),
  );

  const copiedScene = useMemo(() => {
    const group = new THREE.Group();
    gltfScene.updateMatrixWorld(true);

    gltfScene.traverse((child) => {
      if (child instanceof THREE.Mesh && child.geometry) {
        const clonedMesh = new THREE.Mesh();
        clonedMesh.geometry = child.geometry.clone();
        clonedMesh.geometry.applyMatrix4(child.matrixWorld);
        clonedMesh.geometry.scale(MODEL_SCALE, MODEL_SCALE, MODEL_SCALE);

        clonedMesh.position.set(0, 0, 0);
        clonedMesh.rotation.set(0, 0, 0);
        clonedMesh.scale.set(1, 1, 1);
        clonedMesh.updateMatrixWorld(true);

        clonedMesh.matrixAutoUpdate = true;
        clonedMesh.castShadow = true;
        clonedMesh.receiveShadow = true;
        clonedMesh.name = child.name || `mesh_${child.uuid}`;
        let panelNode: THREE.Object3D | null = child;
        let panelSide: 'front' | 'back' = 'front';
        while (panelNode && panelNode !== gltfScene) {
          if (panelNode.name.toLowerCase().includes('back')) {
            panelSide = 'back';
            break;
          }
          if (panelNode.name.toLowerCase().includes('front')) {
            panelSide = 'front';
            break;
          }
          panelNode = panelNode.parent;
        }
        clonedMesh.userData.isTargetMesh = true;
        clonedMesh.userData.panelSide = panelSide;

        if (child.material) {
          // Safe array cloning for multi-material GLTF geometries
          if (Array.isArray(child.material)) {
            clonedMesh.material = child.material.map((m) => m.clone());
          } else {
            clonedMesh.material = child.material.clone();
          }
        }

        group.add(clonedMesh);
      }
    });

    return group;
  }, [gltfScene]);

  // Safely dispose the explicitly cloned resources when the model swaps or unmounts
  useEffect(() => {
    return () => {
      copiedScene.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          if (child.geometry) child.geometry.dispose();
          if (child.material) {
            if (Array.isArray(child.material)) {
              child.material.forEach((m) => {
                m.dispose();
              });
            } else {
              child.material.dispose();
            }
          }
        }
      });
    };
  }, [copiedScene]);

  const targetMeshes = useMemo<THREE.Mesh[]>(() => {
    const meshes: THREE.Mesh[] = [];
    copiedScene.traverse((child) => {
      if (child instanceof THREE.Mesh && child.userData.isTargetMesh && child.visible) {
        if (child.material && (child.material as THREE.Material).opacity === 0) return;
        meshes.push(child);
      }
    });
    return meshes;
  }, [copiedScene]);

  // GLB model origins are not their visual centres. Measure the transformed
  // garment meshes and move the camera target (not the artwork/model data) to
  // the actual garment centre. Shifting camera and target by the same vector
  // preserves the current viewing direction and keeps saved decal coordinates
  // untouched. saveState also makes Reset return to this centred framing.
  useEffect(() => {
    const controls = controlsRef.current;
    if (!controls || targetMeshes.length === 0) return;

    const bounds = new THREE.Box3();
    targetMeshes.forEach((mesh) => {
      mesh.updateWorldMatrix(true, false);
      bounds.expandByObject(mesh);
    });
    if (bounds.isEmpty()) return;

    const garmentCenter = bounds.getCenter(new THREE.Vector3());
    const shift = garmentCenter.sub(controls.target);
    if (shift.lengthSq() < 1e-8) return;

    controls.target.add(shift);
    camera.position.add(shift);
    camera.updateMatrixWorld();
    controls.update();
    controls.saveState();
  }, [apparelModel, camera, controlsRef, targetMeshes]);

  // Backfill panel identity for existing saved designs created before panelSide
  // was persisted. Mesh names remain unchanged because decal projection relies on them.
  useEffect(() => {
    if (!layoutTrigger || targetMeshes.length === 0) return;
    const state = useEditorStore.getState();
    state.decals.forEach((decal) => {
      if (decal.meshSide || !decal.meshName) return;
      const mesh = targetMeshes.find((item) => item.name === decal.meshName);
      if (mesh) state.updateDecal(decal.id, { meshSide: mesh.userData?.panelSide === 'back' ? 'back' : 'front' });
    });
  }, [targetMeshes, layoutTrigger]);


  useEffect(() => {
    if (targetMeshes.length === 0) return;

    const applyColor = (mat: THREE.Material) => {
      if (mat instanceof THREE.MeshStandardMaterial) {
        mat.color.set(tshirtColor);
        mat.roughness = 0.7; // Match preview
        mat.metalness = 0.0; // Match preview
        mat.needsUpdate = true;
      }
    };

    targetMeshes.forEach((mesh) => {
      if (Array.isArray(mesh.material)) {
        mesh.material.forEach(applyColor);
      } else if (mesh.material) {
        applyColor(mesh.material);
      }
    });
  }, [targetMeshes, tshirtColor]);

  // CONTINUOUS PLACEMENT RETRY
  // Runs every frame to check if any decal needs placement and the camera finally hits a valid shirt surface.
  useFrame(() => {
    if (targetMeshes.length === 0) return;

    const state = useEditorStore.getState();
    const unplacedDecals = state.decals.filter(
      (d) => d.needsInitialPlacement === true && d.placementMode !== 'wrap',
    );

    if (unplacedDecals.length === 0) return;

    camera.updateMatrixWorld(true);
    raycasterRef.current.setFromCamera(new THREE.Vector2(0, 0), camera);
    const intersects = raycasterRef.current.intersectObjects(targetMeshes, false);

    // If the ray misses the shirt completely, do nothing. Keep waiting until the user points at the shirt.
    if (intersects.length === 0) return;

    const hit = intersects[0];
    const hitMesh = hit.object as THREE.Mesh;
    const worldPos = hit.point.clone();
    const normalMatrix = new THREE.Matrix3().getNormalMatrix(hitMesh.matrixWorld);
    const worldNormal = hit.face?.normal
      ? hit.face.normal.clone().applyMatrix3(normalMatrix).normalize()
      : new THREE.Vector3(0, 0, 1);

    // Push dummy slightly away from surface to prevent z-fighting / floating inside mesh
    const safeWorldPos = worldPos.clone().add(worldNormal.clone().multiplyScalar(0.02));

    const dummyWorld = dummyWorldRef.current;
    dummyWorld.position.copy(safeWorldPos);
    if (Math.abs(worldNormal.y) > 0.999) {
      dummyWorld.up.set(0, 0, 1);
    } else {
      dummyWorld.up.set(0, 1, 0);
    }
    dummyWorld.lookAt(safeWorldPos.clone().add(worldNormal));
    dummyWorld.updateMatrixWorld(true);

    const inverseParentMatrix = new THREE.Matrix4().copy(hitMesh.matrixWorld).invert();
    const localMatrix = new THREE.Matrix4().multiplyMatrices(
      inverseParentMatrix,
      dummyWorld.matrixWorld,
    );

    const localPos = new THREE.Vector3();
    const localQuat = new THREE.Quaternion();
    const localScale = new THREE.Vector3();
    localMatrix.decompose(localPos, localQuat, localScale);
    const localEuler = new THREE.Euler().setFromQuaternion(localQuat);

    if (!hitMesh.geometry.boundingBox) hitMesh.geometry.computeBoundingBox();
    let dynamicScale = 0.5;
    if (hitMesh.geometry.boundingBox) {
      const box = hitMesh.geometry.boundingBox;
      const shirtWidth = Math.abs(box.max.x - box.min.x);
      dynamicScale = Math.max(shirtWidth * 0.35, 0.1);
      if (!Number.isFinite(dynamicScale) || dynamicScale <= 0) dynamicScale = 0.5;
    }

    // Safely update all pending decals that just found a valid surface
    unplacedDecals.forEach((decal) => {
      state.updateDecal(decal.id, {
        meshName: hitMesh.name,
        meshSide: hitMesh.userData?.panelSide === 'back' ? 'back' : 'front',
        position: [localPos.x, localPos.y, localPos.z],
        rotation: [localEuler.x, localEuler.y, localEuler.z],
        scale:
          typeof decal.initialPlacementScale === 'number' && Number.isFinite(decal.initialPlacementScale)
            ? Math.min(Math.max(decal.initialPlacementScale, 0.01), 10)
            : dynamicScale,
        initialPlacementScale: undefined,
        needsInitialPlacement: false, // Prevents layout oscillation
      });
    });
  });

  // MODEL SWAP RE-SNAP
  useEffect(() => {
    if (targetMeshes.length === 0 || previousModelRef.current === apparelModel) return;

    const state = useEditorStore.getState();
    const placedDecals = state.decals.filter(
      (d) => !d.needsInitialPlacement && d.placementMode !== 'wrap',
    );

    if (placedDecals.length > 0) {
      placedDecals.forEach((decal) => {
        // Fallback: 1. Exact match, 2. Front mesh, 3. First mesh
        const targetMesh =
          targetMeshes.find((m) => m.name === decal.meshName) ||
          targetMeshes.find((m) => m.name.toLowerCase().includes('front')) ||
          targetMeshes[0];

        if (!targetMesh) return;

        const dummyWorld = new THREE.Object3D();
        const localPos = new THREE.Vector3(
          Number.isFinite(decal.position?.[0]) ? decal.position[0] : 0,
          Number.isFinite(decal.position?.[1]) ? decal.position[1] : 0,
          Number.isFinite(decal.position?.[2]) ? decal.position[2] : 0,
        );
        const localEuler = new THREE.Euler(
          Number.isFinite(decal.rotation?.[0]) ? decal.rotation[0] : 0,
          Number.isFinite(decal.rotation?.[1]) ? decal.rotation[1] : 0,
          Number.isFinite(decal.rotation?.[2]) ? decal.rotation[2] : 0,
        );

        dummyWorld.position.copy(localPos);
        dummyWorld.rotation.copy(localEuler);

        // Match the final rendering orientation so the downward ray uses the true projector dir
        if (decal.rotationOffset && Number.isFinite(decal.rotationOffset)) {
          dummyWorld.rotateZ(decal.rotationOffset);
        }

        targetMesh.add(dummyWorld);
        dummyWorld.updateMatrixWorld(true);

        const worldPos = new THREE.Vector3();
        dummyWorld.getWorldPosition(worldPos);

        const forwardDir = new THREE.Vector3(0, 0, 1).applyQuaternion(
          dummyWorld.getWorldQuaternion(new THREE.Quaternion()),
        );

        const rayOrigin = worldPos.clone().add(forwardDir.clone().multiplyScalar(0.5));
        const rayDirection = forwardDir.clone().negate();

        const raycaster = new THREE.Raycaster(rayOrigin, rayDirection);
        const hits = raycaster.intersectObject(targetMesh, false);

        targetMesh.remove(dummyWorld);

        // Retain existing transform strictly if the resnap raycast misses
        if (hits.length > 0) {
          const hitWorldPos = hits[0].point.clone();
          const inverseParentMatrix = new THREE.Matrix4().copy(targetMesh.matrixWorld).invert();
          const newLocalPos = hitWorldPos.applyMatrix4(inverseParentMatrix);

          state.updateDecal(decal.id, {
            meshName: targetMesh.name, // Ensure meshName is updated to the fallback if it missed the exact match
            meshSide: targetMesh.userData?.panelSide === 'back' ? 'back' : 'front',
            position: [newLocalPos.x, newLocalPos.y, newLocalPos.z],
          });
        }
      });
    }

    previousModelRef.current = apparelModel;
  }, [apparelModel, targetMeshes]);

  if (targetMeshes.length === 0) return null;

  const state = useEditorStore.getState();
  const currentIds = layoutTrigger ? layoutTrigger.split(',').map((t) => t.split('|')[0]) : [];

  const wrapDecalId = currentIds.find(
    (id) => {
      const decal = state.decals.find((d) => d.id === id);
      return decal?.visible !== false && decal?.placementMode === 'wrap';
    },
  );

  const standardIds = currentIds.filter(
    (id) => {
      const decal = state.decals.find((d) => d.id === id);
      return decal?.visible !== false && decal?.placementMode !== 'wrap';
    },
  );

  return (
    <group name="workspace" scale={1.15}>
      <primitive
        object={copiedScene}
        onPointerDown={(e: ThreeEvent<PointerEvent>) => {
          const pointerType = e.nativeEvent?.pointerType ?? 'mouse';

          if (pointerType === 'touch') {
            touchPointerIdsRef.current.add(e.pointerId);
            // A second finger hands navigation over to OrbitControls' native
            // two-touch dolly/rotate gesture. Never run our one-finger camera
            // gesture at the same time.
            if (touchPointerIdsRef.current.size > 1) {
              const active = orbitGestureRef.current;
              if (active && ownsEditorGesture('camera', active.pointerId)) {
                releaseEditorGesture('camera', active.pointerId);
                orbitGestureRef.current = null;
                releaseCameraCapture(active.pointerId);
                document.body.style.cursor = 'default';
              }
              return;
            }
          }

          const store = useEditorStore.getState();
          if (store.isDragging || store.globalToolMode === 'camera' || e.button !== 0) return;
          if (store.globalToolMode !== 'default' || store.isDrawingMode) return;

          // The shirt surface can be geometrically closer to the camera ray than
          // a decal's invisible selector on curved fabric. Inspect every hit before
          // claiming the camera so an interactive decal gets first refusal even
          // when its hitbox is a later intersection in the raycast list.
          const interactiveDecalUnderPointer = e.intersections.some((hit) => {
            const userData = hit.object.userData as {
              isDecalHitbox?: boolean;
              decalId?: string;
              isTransformHandle?: boolean;
              isCropHandle?: boolean;
            };
            if (!userData.isDecalHitbox) return false;
            // Unknown interactive hitboxes fail safely in favour of editing.
            // That prevents a future handle from being stolen by camera orbit
            // simply because its author forgot to add a decal id.
            if (!userData.decalId) return true;
            return store.autoSelect || store.selectedIds.includes(userData.decalId);
          });
          if (interactiveDecalUnderPointer) return;

          // The camera only claims a pointer that genuinely began on unoccupied garment surface.
          if (!claimEditorGesture('camera', e.pointerId)) return;
          e.stopPropagation();

          orbitGestureRef.current = {
            pointerId: e.pointerId,
            startX: e.nativeEvent.clientX,
            startY: e.nativeEvent.clientY,
            lastX: e.nativeEvent.clientX,
            lastY: e.nativeEvent.clientY,
            moved: false,
          };

          if (pointerType !== 'touch') setIsDragging(true);
          const captureTarget = e.target as unknown as PointerCapturable;
          cameraCaptureTargetRef.current = captureTarget || null;
          try { captureTarget?.setPointerCapture?.(e.pointerId); } catch {
            try { gl.domElement.setPointerCapture(e.pointerId); } catch {}
          }
          document.body.style.cursor = 'grab';
        }}
        onPointerMove={(e: ThreeEvent<PointerEvent>) => {
          const gesture = orbitGestureRef.current;
          if (!gesture || gesture.pointerId !== e.pointerId || !ownsEditorGesture('camera', e.pointerId)) return;
          if ((e.nativeEvent?.pointerType ?? 'mouse') === 'touch' && touchPointerIdsRef.current.size > 1) return;
          e.stopPropagation();

          const x = e.nativeEvent.clientX;
          const y = e.nativeEvent.clientY;
          const totalDistance = Math.hypot(x - gesture.startX, y - gesture.startY);
          if (!gesture.moved && totalDistance < 3) return;
          gesture.moved = true;
          document.body.style.cursor = 'grabbing';

          const deltaX = x - gesture.lastX;
          const deltaY = y - gesture.lastY;
          gesture.lastX = x;
          gesture.lastY = y;

          const controls = controlsRef.current;
          if (!controls) return;

          const previousDamping = controls.enableDamping;
          controls.enableDamping = false;
          controls.setAzimuthalAngle(controls.getAzimuthalAngle() - deltaX * 0.008);
          controls.setPolarAngle(THREE.MathUtils.clamp(
            controls.getPolarAngle() - deltaY * 0.008,
            0.28,
            Math.PI - 0.28,
          ));
          controls.enableDamping = previousDamping;
          controls.update();
          useEditorStore.getState().setCameraView('custom');
        }}
        onPointerUp={(e: ThreeEvent<PointerEvent>) => {
          if ((e.nativeEvent?.pointerType ?? 'mouse') === 'touch') touchPointerIdsRef.current.delete(e.pointerId);
          const gesture = orbitGestureRef.current;
          if (!gesture || gesture.pointerId !== e.pointerId || !ownsEditorGesture('camera', e.pointerId)) return;
          e.stopPropagation();
          orbitGestureRef.current = null;
          releaseEditorGesture('camera', e.pointerId);
          if ((e.nativeEvent?.pointerType ?? 'mouse') !== 'touch') setIsDragging(false);
          releaseCameraCapture(e.pointerId);
          document.body.style.cursor = 'default';

          const state = useEditorStore.getState();
          if (!gesture.moved && state.autoSelect && state.selectedIds.length > 0) {
            state.setSelectedId(null);
            state.setContextMenu(null);
          }
        }}
        onPointerCancel={(e: ThreeEvent<PointerEvent>) => {
          if ((e.nativeEvent?.pointerType ?? 'mouse') === 'touch') touchPointerIdsRef.current.delete(e.pointerId);
          const gesture = orbitGestureRef.current;
          if (!gesture || gesture.pointerId !== e.pointerId || !ownsEditorGesture('camera', e.pointerId)) return;
          e.stopPropagation();
          orbitGestureRef.current = null;
          releaseEditorGesture('camera', e.pointerId);
          if ((e.nativeEvent?.pointerType ?? 'mouse') !== 'touch') setIsDragging(false);
          releaseCameraCapture(e.pointerId);
          document.body.style.cursor = 'default';
        }}
        onLostPointerCapture={(e: ThreeEvent<PointerEvent>) => {
          if ((e.nativeEvent?.pointerType ?? 'mouse') === 'touch') touchPointerIdsRef.current.delete(e.pointerId);
          const gesture = orbitGestureRef.current;
          if (!gesture || gesture.pointerId !== e.pointerId || !ownsEditorGesture('camera', e.pointerId)) return;
          orbitGestureRef.current = null;
          releaseEditorGesture('camera', e.pointerId);
          if ((e.nativeEvent?.pointerType ?? 'mouse') !== 'touch') setIsDragging(false);
          releaseCameraCapture(e.pointerId);
          document.body.style.cursor = 'default';
        }}
      />

      {wrapDecalId && <WrapMaterial meshes={targetMeshes} decalId={wrapDecalId} />}

      {standardIds.map((id, index) => (
        <Suspense fallback={null} key={`${id}-${apparelModel}`}>
          <ProjectedDecal id={id} index={index} targetMeshes={targetMeshes} />
        </Suspense>
      ))}
    </group>
  );
}

useGLTF.preload(tshirtManUrl);
useGLTF.preload(tshirtWomanUrl);
useGLTF.preload(tshirtoversizedUrl);
