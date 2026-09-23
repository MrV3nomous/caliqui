import { useGLTF } from '@react-three/drei';
import { type ThreeEvent, useThree } from '@react-three/fiber';
import { Suspense, useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import tshirtManUrl from '@/assets/models/tshirtman.glb?url';
import tshirtoversizedUrl from '@/assets/models/tshirtoversized.glb?url';
import tshirtWomanUrl from '@/assets/models/tshirtwoman.glb?url';
import { useEditorStore } from '@/ui/store/editor-store';
import { ProjectedDecal } from './ProjectedDecal';

const MODELS: Record<string, string> = {
  tshirtman: tshirtManUrl,
  tshirtwoman: tshirtWomanUrl,
  tshirtoversized: tshirtoversizedUrl,
};

const MODEL_SCALE = 0.03;

export function TShirtModel() {
  const apparelModel = useEditorStore((state) => state.apparelModel);
  const activeModelUrl = MODELS[apparelModel] || tshirtManUrl;

  const { scene: gltfScene } = useGLTF(activeModelUrl);
  const { decals, updateDecal, tshirtColor } = useEditorStore();
  const { camera } = useThree();

  const previousModelRef = useRef<string>(apparelModel);

  const copiedScene = useMemo(() => {
    const group = new THREE.Group();
    gltfScene.updateMatrixWorld(true);

    gltfScene.traverse((child) => {
      if (child instanceof THREE.Mesh && child.geometry) {
        const clonedMesh = new THREE.Mesh();

        clonedMesh.geometry = child.geometry.clone();
        clonedMesh.geometry.applyMatrix4(child.matrixWorld);
        clonedMesh.geometry.scale(MODEL_SCALE, MODEL_SCALE, MODEL_SCALE);

        // Bake transforms so all meshes share the exact same origin coordinate space
        clonedMesh.position.set(0, 0, 0);
        clonedMesh.rotation.set(0, 0, 0);
        clonedMesh.scale.set(1, 1, 1);
        clonedMesh.updateMatrix();

        clonedMesh.castShadow = true;
        clonedMesh.receiveShadow = true;
        clonedMesh.name = child.name || `mesh_${child.uuid}`;
        clonedMesh.userData.isTargetMesh = true;

        if (child.material) {
          clonedMesh.material = child.material.clone();
        }

        group.add(clonedMesh);
      }
    });

    return group;
  }, [gltfScene]);

  // ARRAY DETECTION: Collect ALL visible meshes to support multi-part clothing models
  const targetMeshes = useMemo<THREE.Mesh[]>(() => {
    const meshes: THREE.Mesh[] = [];
    copiedScene.traverse((child) => {
      if (child instanceof THREE.Mesh && child.geometry) {
        if (!child.visible) return;
        if (child.material && (child.material as THREE.Material).opacity === 0) return;
        meshes.push(child);
      }
    });
    return meshes;
  }, [copiedScene]);

  // UNIFIED BOUNDING BOX: Wraps perfectly around all collected mesh parts
  const groupBoundingBox = useMemo(() => {
    const box = new THREE.Box3();
    targetMeshes.forEach((mesh) => {
      if (!mesh.geometry.boundingBox) mesh.geometry.computeBoundingBox();
      if (mesh.geometry.boundingBox) {
        box.union(mesh.geometry.boundingBox);
      }
    });
    return box;
  }, [targetMeshes]);

  // UNIFIED COLORING: Colors all parts of the shirt seamlessly
  useEffect(() => {
    targetMeshes.forEach((mesh) => {
      if (mesh.material instanceof THREE.MeshStandardMaterial) {
        mesh.material.color.set(tshirtColor);
        mesh.material.roughness = 0.9;
        mesh.material.metalness = 0.05;
        mesh.material.needsUpdate = true;
      } else {
        const mat = mesh.material as THREE.Material & {
          color?: THREE.Color;
          roughness?: number;
          metalness?: number;
        };
        if (mat.color) {
          mat.color.set(tshirtColor);
          mat.roughness = 0.9;
          mat.metalness = 0.05;
          mat.needsUpdate = true;
        }
      }
    });
  }, [targetMeshes, tshirtColor]);

  // INITIAL PLACEMENT
  useEffect(() => {
    if (targetMeshes.length === 0) return;

    const unplacedDecals = decals.filter(
      (d) => d.position[0] === 0 && d.position[1] === 0 && d.position[2] === 0,
    );
    if (unplacedDecals.length === 0) return;

    targetMeshes.forEach((m) => {
      m.updateMatrixWorld(true);
    });
    camera.updateMatrixWorld(true);

    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(new THREE.Vector2(0, 0), camera);

    // Intersect against ALL parts of the shirt
    const intersects = raycaster.intersectObjects(targetMeshes, false);

    unplacedDecals.forEach((decal) => {
      const dummyWorld = new THREE.Object3D();
      const referenceMatrix = targetMeshes[0].matrixWorld;

      if (intersects.length > 0) {
        const hit = intersects[0];
        const worldPos = hit.point.clone();
        const normalMatrix = new THREE.Matrix3().getNormalMatrix(hit.object.matrixWorld);
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
        const centerLocal = new THREE.Vector3();
        groupBoundingBox.getCenter(centerLocal);
        const centerWorld = centerLocal.applyMatrix4(referenceMatrix);
        const camDirWorld = camera.getWorldDirection(new THREE.Vector3());

        dummyWorld.position.copy(centerWorld).sub(camDirWorld.clone().multiplyScalar(0.5));
        dummyWorld.up.set(0, 1, 0);
        dummyWorld.lookAt(dummyWorld.position.clone().sub(camDirWorld));
      }

      dummyWorld.updateMatrixWorld(true);

      const inverseParentMatrix = new THREE.Matrix4().copy(referenceMatrix).invert();
      const localMatrix = new THREE.Matrix4().multiplyMatrices(
        inverseParentMatrix,
        dummyWorld.matrixWorld,
      );

      const localPos = new THREE.Vector3();
      const localQuat = new THREE.Quaternion();
      const localScale = new THREE.Vector3();
      localMatrix.decompose(localPos, localQuat, localScale);
      const localEuler = new THREE.Euler().setFromQuaternion(localQuat);

      const shirtWidth = Math.abs(groupBoundingBox.max.x - groupBoundingBox.min.x);
      const dynamicScale = Math.max(shirtWidth * 0.35, 0.1);

      updateDecal(decal.id, {
        position: [localPos.x, localPos.y, localPos.z],
        rotation: [localEuler.x, localEuler.y, localEuler.z],
        scale: dynamicScale,
      });
    });
  }, [decals, targetMeshes, camera, groupBoundingBox, updateDecal]);

  // RE-SNAP ENGINE
  useEffect(() => {
    if (targetMeshes.length === 0 || previousModelRef.current === apparelModel) return;

    const placedDecals = decals.filter(
      (d) => d.position[0] !== 0 || d.position[1] !== 0 || d.position[2] !== 0,
    );

    if (placedDecals.length > 0) {
      targetMeshes.forEach((m) => {
        m.updateMatrixWorld(true);
      });
      const referenceMatrix = targetMeshes[0].matrixWorld;

      placedDecals.forEach((decal) => {
        const dummyWorld = new THREE.Object3D();
        const localPos = new THREE.Vector3(decal.position[0], decal.position[1], decal.position[2]);
        const localEuler = new THREE.Euler(decal.rotation[0], decal.rotation[1], decal.rotation[2]);

        dummyWorld.position.copy(localPos);
        dummyWorld.rotation.copy(localEuler);

        targetMeshes[0].add(dummyWorld);
        dummyWorld.updateMatrixWorld(true);

        const worldPos = new THREE.Vector3();
        dummyWorld.getWorldPosition(worldPos);

        const forwardDir = new THREE.Vector3(0, 0, 1).applyQuaternion(
          dummyWorld.getWorldQuaternion(new THREE.Quaternion()),
        );

        const rayOrigin = worldPos.clone().add(forwardDir.clone().multiplyScalar(0.5));
        const rayDirection = forwardDir.clone().negate();

        const raycaster = new THREE.Raycaster(rayOrigin, rayDirection);
        const hits = raycaster.intersectObjects(targetMeshes, false);

        targetMeshes[0].remove(dummyWorld);

        if (hits.length > 0) {
          const hitWorldPos = hits[0].point.clone();
          const inverseParentMatrix = new THREE.Matrix4().copy(referenceMatrix).invert();
          const newLocalPos = hitWorldPos.applyMatrix4(inverseParentMatrix);

          updateDecal(decal.id, {
            position: [newLocalPos.x, newLocalPos.y, newLocalPos.z],
          });
        }
      });
    }

    previousModelRef.current = apparelModel;
  }, [apparelModel, targetMeshes, decals, updateDecal]);

  if (targetMeshes.length === 0) return <primitive object={copiedScene} />;

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

      {decals.map((decal, index) => (
        <Suspense fallback={null} key={`${decal.id}-${apparelModel}`}>
          <ProjectedDecal index={index} decal={decal} targetMeshes={targetMeshes} />
        </Suspense>
      ))}
    </group>
  );
}

useGLTF.preload(tshirtManUrl);
useGLTF.preload(tshirtWomanUrl);
useGLTF.preload(tshirtoversizedUrl);
