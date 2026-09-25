import { useGLTF, useTexture } from '@react-three/drei';
import type { ThreeEvent } from '@react-three/fiber';
import { Suspense, useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import tshirtManUrl from '@/assets/models/tshirtman.glb?url';
import tshirtoversizedUrl from '@/assets/models/tshirtoversized.glb?url';
import tshirtWomanUrl from '@/assets/models/tshirtwoman.glb?url';
import { type DecalData, useEditorStore } from '@/ui/store/editor-store';
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

function WrapMaterial({ meshes, decal }: { meshes: THREE.Mesh[]; decal: DecalData }) {
  const texture = useTexture(decal.src || '');

  useEffect(() => {
    if (!texture) return;
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;

    const sx = decal.scaleX || decal.scale || 1;
    const sy = decal.scaleY || decal.scale || 1;
    texture.repeat.set(1 / sx, 1 / sy);

    meshes.forEach((mesh) => {
      if (mesh.material instanceof THREE.MeshStandardMaterial) {
        mesh.material.map = texture;
        mesh.material.needsUpdate = true;
      }
    });

    return () => {
      meshes.forEach((mesh) => {
        if (mesh.material instanceof THREE.MeshStandardMaterial) {
          mesh.material.map = null;
          mesh.material.needsUpdate = true;
        }
      });
    };
  }, [texture, meshes, decal.scale, decal.scaleX, decal.scaleY]);

  return null;
}

export function TShirtModel() {
  const apparelModel = useEditorStore((state) => state.apparelModel);
  const tshirtColor = useEditorStore((state) => state.tshirtColor);

  const activeModelUrl = MODELS[apparelModel] || tshirtManUrl;
  const { scene: gltfScene } = useGLTF(activeModelUrl);

  const previousModelRef = useRef<string>(apparelModel);

  // Creates a highly specific dependency string that forces re-evaluating placement
  const layoutTrigger = useEditorStore((state) =>
    state.decals.map((d) => `${d.id}|${d.placementMode}`).join(','),
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
        clonedMesh.userData.isTargetMesh = true;

        if (child.material) {
          clonedMesh.material = (child.material as THREE.Material).clone();
        }

        group.add(clonedMesh);
      }
    });

    return group;
  }, [gltfScene]);

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

  useEffect(() => {
    if (targetMeshes.length === 0) return;

    const applyColor = (mat: THREE.Material) => {
      if (mat instanceof THREE.MeshStandardMaterial) {
        mat.color.set(tshirtColor);
        mat.roughness = 0.9;
        mat.metalness = 0.05;
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

  // Model swap re-snap
  useEffect(() => {
    if (targetMeshes.length === 0 || previousModelRef.current === apparelModel) return;

    const state = useEditorStore.getState();
    const placedDecals = state.decals.filter(
      (d) =>
        (d.position[0] !== 0 || d.position[1] !== 0 || d.position[2] !== 0) &&
        d.placementMode !== 'wrap',
    );

    if (placedDecals.length > 0) {
      placedDecals.forEach((decal) => {
        const targetMesh = targetMeshes.find((m) => m.name === decal.meshName) || targetMeshes[0];

        const dummyWorld = new THREE.Object3D();
        const localPos = new THREE.Vector3(decal.position[0], decal.position[1], decal.position[2]);
        const localEuler = new THREE.Euler(decal.rotation[0], decal.rotation[1], decal.rotation[2]);

        dummyWorld.position.copy(localPos);
        dummyWorld.rotation.copy(localEuler);

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

        if (hits.length > 0) {
          const hitWorldPos = hits[0].point.clone();
          const inverseParentMatrix = new THREE.Matrix4().copy(targetMesh.matrixWorld).invert();
          const newLocalPos = hitWorldPos.applyMatrix4(inverseParentMatrix);

          state.updateDecal(decal.id, {
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
    (id) => state.decals.find((d) => d.id === id)?.placementMode === 'wrap',
  );
  const wrapDecal = wrapDecalId ? state.decals.find((d) => d.id === wrapDecalId) : null;
  const standardIds = currentIds.filter(
    (id) => state.decals.find((d) => d.id === id)?.placementMode !== 'wrap',
  );

  return (
    <group name="workspace" scale={1.15}>
      <primitive
        object={copiedScene}
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

      {wrapDecal && <WrapMaterial meshes={targetMeshes} decal={wrapDecal} />}

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
