import { useGLTF } from '@react-three/drei';
import { type ThreeEvent, useThree } from '@react-three/fiber';
import { Suspense, useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import tshirtManUrl from '@/assets/models/tshirtman.glb?url';
import tshirtoversizedUrl from '@/assets/models/tshirtoversized.glb?url';
import tshirtWomanUrl from '@/assets/models/tshirtwoman.glb?url';
import { useEditorStore } from '@/ui/store/editor-store';
import { ProjectedDecal } from './ProjectedDecal';

Object.assign(useGLTF, {
  draco: 'https://www.gstatic.com/draco/versioned/decoders/1.5.5/',
});

const MODELS: Record<string, string> = {
  tshirtman: tshirtManUrl,
  tshirtwoman: tshirtWomanUrl,
  tshirtoversized: tshirtoversizedUrl,
};

const MODEL_SCALE = 0.03;

export function TShirtModel() {
  const apparelModel = useEditorStore((state) => state.apparelModel);
  const tshirtColor = useEditorStore((state) => state.tshirtColor);

  const decalIds = useEditorStore((state) => state.decals.map((d) => d.id).join(','));
  const activeModelUrl = MODELS[apparelModel] || tshirtManUrl;
  const { scene: gltfScene } = useGLTF(activeModelUrl);
  const { camera } = useThree();

  const previousModelRef = useRef<string>(apparelModel);
  const decalsLengthRef = useRef<number>(useEditorStore.getState().decals.length);

  const primaryMesh = useMemo<THREE.Mesh | null>(() => {
    let largestMesh: THREE.Mesh | null = null;
    let maxSurfaceArea = -1;

    gltfScene.traverse((child) => {
      if (child instanceof THREE.Mesh && child.geometry) {
        if (!child.visible) return;

        if (!child.geometry.boundingBox) child.geometry.computeBoundingBox();
        const box = child.geometry.boundingBox;

        if (box) {
          const width = box.max.x - box.min.x;
          const height = box.max.y - box.min.y;
          const depth = box.max.z - box.min.z;
          const surfaceArea = 2 * (width * height + height * depth + depth * width);

          if (surfaceArea > maxSurfaceArea) {
            maxSurfaceArea = surfaceArea;
            largestMesh = child;
          }
        }
      }
    });

    if (!largestMesh) return null;

    const baseMesh = largestMesh as THREE.Mesh;
    const isolatedMesh = new THREE.Mesh();
    isolatedMesh.geometry = baseMesh.geometry.clone();
    isolatedMesh.geometry.applyMatrix4(baseMesh.matrixWorld);
    isolatedMesh.geometry.scale(MODEL_SCALE, MODEL_SCALE, MODEL_SCALE);

    isolatedMesh.position.set(0, 0, 0);
    isolatedMesh.rotation.set(0, 0, 0);
    isolatedMesh.scale.set(1, 1, 1);
    isolatedMesh.updateMatrixWorld(true);

    isolatedMesh.matrixAutoUpdate = true;
    isolatedMesh.castShadow = true;
    isolatedMesh.receiveShadow = true;
    isolatedMesh.name = baseMesh.name || `mesh_${baseMesh.uuid}`;
    isolatedMesh.userData.isTargetMesh = true;

    if (baseMesh.material) {
      isolatedMesh.material = (baseMesh.material as THREE.Material).clone();
    }

    return isolatedMesh;
  }, [gltfScene]);

  useEffect(() => {
    if (!primaryMesh?.material) return;

    const applyColor = (mat: THREE.Material) => {
      if (mat instanceof THREE.MeshStandardMaterial) {
        mat.color.set(tshirtColor);
        mat.roughness = 0.9;
        mat.metalness = 0.05;
        mat.needsUpdate = true;
      }
    };

    if (Array.isArray(primaryMesh.material)) {
      primaryMesh.material.forEach(applyColor);
    } else {
      applyColor(primaryMesh.material);
    }
  }, [primaryMesh, tshirtColor]);

  useEffect(() => {
    // TypeScript & Linter Fix: Explicitly check the type of decalIds.
    // This reads the variable for the Hooks linter without creating an unused variable for TS.
    if (!primaryMesh?.geometry || typeof decalIds !== 'string') return;

    const state = useEditorStore.getState();
    const currentDecals = state.decals;

    if (
      currentDecals.length <= decalsLengthRef.current &&
      previousModelRef.current === apparelModel
    )
      return;
    decalsLengthRef.current = currentDecals.length;

    const unplacedDecals = currentDecals.filter(
      (d) => d.position[0] === 0 && d.position[1] === 0 && d.position[2] === 0,
    );
    if (unplacedDecals.length === 0) return;

    camera.updateMatrixWorld(true);

    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(new THREE.Vector2(0, 0), camera);
    const intersects = raycaster.intersectObject(primaryMesh, false);

    unplacedDecals.forEach((decal) => {
      const dummyWorld = new THREE.Object3D();

      if (intersects.length > 0) {
        const hit = intersects[0];
        const worldPos = hit.point.clone();
        const normalMatrix = new THREE.Matrix3().getNormalMatrix(primaryMesh.matrixWorld);
        const worldNormal = hit.face?.normal
          ? hit.face.normal.clone().applyMatrix3(normalMatrix).normalize()
          : new THREE.Vector3(0, 0, 1);

        dummyWorld.position.copy(worldPos);
        if (Math.abs(worldNormal.y) > 0.999) {
          dummyWorld.up.set(0, 0, 1);
        } else {
          dummyWorld.up.set(0, 1, 0);
        }
        dummyWorld.lookAt(worldPos.clone().add(worldNormal));
      } else {
        if (!primaryMesh.geometry.boundingBox) primaryMesh.geometry.computeBoundingBox();
        const box = primaryMesh.geometry.boundingBox;
        if (!box) return;

        const centerLocal = new THREE.Vector3();
        box.getCenter(centerLocal);
        const centerWorld = centerLocal.applyMatrix4(primaryMesh.matrixWorld);
        const camDirWorld = camera.getWorldDirection(new THREE.Vector3());

        dummyWorld.position.copy(centerWorld).sub(camDirWorld.clone().multiplyScalar(0.5));
        dummyWorld.up.set(0, 1, 0);
        dummyWorld.lookAt(dummyWorld.position.clone().sub(camDirWorld));
      }

      dummyWorld.updateMatrixWorld(true);

      const inverseParentMatrix = new THREE.Matrix4().copy(primaryMesh.matrixWorld).invert();
      const localMatrix = new THREE.Matrix4().multiplyMatrices(
        inverseParentMatrix,
        dummyWorld.matrixWorld,
      );

      const localPos = new THREE.Vector3();
      const localQuat = new THREE.Quaternion();
      const localScale = new THREE.Vector3();
      localMatrix.decompose(localPos, localQuat, localScale);
      const localEuler = new THREE.Euler().setFromQuaternion(localQuat);

      let dynamicScale = 0.5;
      if (primaryMesh.geometry.boundingBox) {
        const box = primaryMesh.geometry.boundingBox;
        const shirtWidth = Math.abs(box.max.x - box.min.x);
        dynamicScale = Math.max(shirtWidth * 0.35, 0.1);
      }

      state.updateDecal(decal.id, {
        meshName: primaryMesh.name,
        position: [localPos.x, localPos.y, localPos.z],
        rotation: [localEuler.x, localEuler.y, localEuler.z],
        scale: dynamicScale,
      });
    });
  }, [primaryMesh, camera, apparelModel, decalIds]);

  useEffect(() => {
    if (!primaryMesh?.geometry || previousModelRef.current === apparelModel) return;

    const state = useEditorStore.getState();
    const placedDecals = state.decals.filter(
      (d) => d.position[0] !== 0 || d.position[1] !== 0 || d.position[2] !== 0,
    );

    if (placedDecals.length > 0) {
      placedDecals.forEach((decal) => {
        const dummyWorld = new THREE.Object3D();
        const localPos = new THREE.Vector3(decal.position[0], decal.position[1], decal.position[2]);
        const localEuler = new THREE.Euler(decal.rotation[0], decal.rotation[1], decal.rotation[2]);

        dummyWorld.position.copy(localPos);
        dummyWorld.rotation.copy(localEuler);

        primaryMesh.add(dummyWorld);
        dummyWorld.updateMatrixWorld(true);

        const worldPos = new THREE.Vector3();
        dummyWorld.getWorldPosition(worldPos);

        const forwardDir = new THREE.Vector3(0, 0, 1).applyQuaternion(
          dummyWorld.getWorldQuaternion(new THREE.Quaternion()),
        );

        const rayOrigin = worldPos.clone().add(forwardDir.clone().multiplyScalar(0.5));
        const rayDirection = forwardDir.clone().negate();

        const raycaster = new THREE.Raycaster(rayOrigin, rayDirection);
        const hits = raycaster.intersectObject(primaryMesh, false);

        primaryMesh.remove(dummyWorld);

        if (hits.length > 0) {
          const hitWorldPos = hits[0].point.clone();
          const inverseParentMatrix = new THREE.Matrix4().copy(primaryMesh.matrixWorld).invert();
          const newLocalPos = hitWorldPos.applyMatrix4(inverseParentMatrix);

          state.updateDecal(decal.id, {
            position: [newLocalPos.x, newLocalPos.y, newLocalPos.z],
          });
        }
      });
    }

    previousModelRef.current = apparelModel;
  }, [apparelModel, primaryMesh]);

  if (!primaryMesh) return null;

  const currentIds = decalIds ? decalIds.split(',') : [];

  return (
    <group name="workspace" scale={1.15}>
      <primitive
        object={primaryMesh}
        onPointerDown={(e: ThreeEvent<PointerEvent>) => {
          const hitDecal = e.intersections.some((hit) => hit.object.userData?.isDecalHitbox);
          if (hitDecal) return;

          const { autoSelect, selectedIds, setSelectedId, isDragging, globalToolMode } =
            useEditorStore.getState();

          if (isDragging) return;

          if (!autoSelect && selectedIds.length > 0 && globalToolMode === 'default') {
            e.stopPropagation();
            return;
          }

          if (autoSelect && selectedIds.length > 0) {
            e.stopPropagation();
            setSelectedId(null);
          }
        }}
      />

      {currentIds.map((id, index) => (
        <Suspense fallback={null} key={`${id}-${apparelModel}`}>
          <ProjectedDecal id={id} index={index} primaryMesh={primaryMesh} />
        </Suspense>
      ))}
    </group>
  );
}

useGLTF.preload(tshirtManUrl);
useGLTF.preload(tshirtWomanUrl);
useGLTF.preload(tshirtoversizedUrl);
