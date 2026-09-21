import { useGLTF } from '@react-three/drei';
import { type ThreeEvent, useThree } from '@react-three/fiber';
import { Suspense, useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import tshirtManUrl from '@/assets/models/tshirtman.glb?url';
import tshirtWomanUrl from '@/assets/models/tshirtwoman.glb?url';
import { useEditorStore } from '@/ui/store/editor-store';
import { ProjectedDecal } from './ProjectedDecal';

const MODELS: Record<string, string> = {
  tshirtman: tshirtManUrl,
  tshirtwoman: tshirtWomanUrl,
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

  const primaryMesh = useMemo<THREE.Mesh | null>(() => {
    let largestMesh: THREE.Mesh | null = null;
    let maxVolume = -1;
    copiedScene.traverse((child) => {
      if (child instanceof THREE.Mesh && child.geometry) {
        if (!child.geometry.boundingBox) child.geometry.computeBoundingBox();
        const box = child.geometry.boundingBox;
        if (box) {
          const volume =
            (box.max.x - box.min.x) * (box.max.y - box.min.y) * (box.max.z - box.min.z);
          if (volume > maxVolume) {
            maxVolume = volume;
            largestMesh = child;
          }
        }
      }
    });
    return largestMesh;
  }, [copiedScene]);

  useEffect(() => {
    if (!primaryMesh?.material) return;

    if (primaryMesh.material instanceof THREE.MeshStandardMaterial) {
      primaryMesh.material.color.set(tshirtColor);
      primaryMesh.material.roughness = 0.85;
      primaryMesh.material.metalness = 0.0;
      primaryMesh.material.metalnessMap = null;
      primaryMesh.material.roughnessMap = null;
      primaryMesh.material.envMapIntensity = 0.4;
      primaryMesh.material.needsUpdate = true;
    } else {
      const mat = primaryMesh.material as THREE.Material & {
        color?: THREE.Color;
        roughness?: number;
        metalness?: number;
        metalnessMap?: null;
        roughnessMap?: null;
        envMapIntensity?: number;
      };
      if (mat.color) {
        mat.color.set(tshirtColor);
        mat.roughness = 0.85;
        mat.metalness = 0.0;
        mat.metalnessMap = null;
        mat.roughnessMap = null;
        mat.envMapIntensity = 0.4;
        mat.needsUpdate = true;
      }
    }
  }, [primaryMesh, tshirtColor]);

  // INITIAL PLACEMENT: Handles spawning new decals perfectly
  useEffect(() => {
    if (!primaryMesh?.geometry) return;

    const unplacedDecals = decals.filter(
      (d) => d.position[0] === 0 && d.position[1] === 0 && d.position[2] === 0,
    );
    if (unplacedDecals.length === 0) return;

    primaryMesh.updateMatrixWorld(true);
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
        const shirtWidth = box.max.x - box.min.x;
        dynamicScale = shirtWidth * 0.35; 
      }

      updateDecal(decal.id, {
        meshName: primaryMesh.name,
        position: [localPos.x, localPos.y, localPos.z],
        rotation: [localEuler.x, localEuler.y, localEuler.z],
        scale: dynamicScale,
      });
    });
  }, [decals, primaryMesh, camera, updateDecal]);

  // RE-SNAP ENGINE: Pulls buried decals perfectly up to the new surface when swapping models
  useEffect(() => {
    if (!primaryMesh?.geometry || previousModelRef.current === apparelModel) return;
    
    const placedDecals = decals.filter(
      (d) => d.position[0] !== 0 || d.position[1] !== 0 || d.position[2] !== 0
    );

    if (placedDecals.length > 0) {
      primaryMesh.updateMatrixWorld(true);

      placedDecals.forEach((decal) => {
        const dummyWorld = new THREE.Object3D();
        const localPos = new THREE.Vector3(decal.position[0], decal.position[1], decal.position[2]);
        const localEuler = new THREE.Euler(decal.rotation[0], decal.rotation[1], decal.rotation[2]);
        const localQuat = new THREE.Quaternion().setFromEuler(localEuler);
        
        dummyWorld.position.copy(localPos);
        dummyWorld.quaternion.copy(localQuat);
        
        primaryMesh.add(dummyWorld);
        dummyWorld.updateMatrixWorld(true);
        
        const worldPos = new THREE.Vector3();
        dummyWorld.getWorldPosition(worldPos);
        
        // Decal Z points away from mesh. We grab that forward vector to pull the raycaster out safely.
        const forwardDir = new THREE.Vector3(0, 0, 1).applyQuaternion(dummyWorld.getWorldQuaternion(new THREE.Quaternion()));
        
        // Pull back 0.5 units along normal, then shoot straight back toward the new mesh
        const rayOrigin = worldPos.clone().add(forwardDir.clone().multiplyScalar(0.5));
        const rayDirection = forwardDir.clone().negate();
        
        const raycaster = new THREE.Raycaster(rayOrigin, rayDirection);
        const hits = raycaster.intersectObject(primaryMesh, false);
        
        primaryMesh.remove(dummyWorld);

        if (hits.length > 0) {
          const hit = hits[0];
          const hitWorldPos = hit.point.clone();
          const normalMatrix = new THREE.Matrix3().getNormalMatrix(primaryMesh.matrixWorld);
          const worldNormal = hit.face?.normal
            ? hit.face.normal.clone().applyMatrix3(normalMatrix).normalize()
            : new THREE.Vector3(0, 0, 1);

          const newDummy = new THREE.Object3D();
          newDummy.position.copy(hitWorldPos);
          if (Math.abs(worldNormal.y) > 0.999) {
            newDummy.up.set(0, 0, 1);
          } else {
            newDummy.up.set(0, 1, 0);
          }
          newDummy.lookAt(hitWorldPos.clone().add(worldNormal));
          newDummy.updateMatrixWorld(true);

          const inverseParentMatrix = new THREE.Matrix4().copy(primaryMesh.matrixWorld).invert();
          const localMatrix = new THREE.Matrix4().multiplyMatrices(
            inverseParentMatrix,
            newDummy.matrixWorld,
          );

          const newLocalPos = new THREE.Vector3();
          const newLocalQuat = new THREE.Quaternion();
          const newLocalScale = new THREE.Vector3();
          localMatrix.decompose(newLocalPos, newLocalQuat, newLocalScale);
          const newLocalEuler = new THREE.Euler().setFromQuaternion(newLocalQuat);

          updateDecal(decal.id, {
            position: [newLocalPos.x, newLocalPos.y, newLocalPos.z],
            rotation: [newLocalEuler.x, newLocalEuler.y, newLocalEuler.z],
          });
        }
      });
    }

    previousModelRef.current = apparelModel;
  }, [apparelModel, primaryMesh, decals, updateDecal]);

  if (!primaryMesh) return <primitive object={copiedScene} />;

  return (
    <group name="workspace" scale={1.15}>
      <primitive
        object={copiedScene}
        onPointerDown={(e: ThreeEvent<PointerEvent>) => {
          const hitDecal = e.intersections.some((hit) => hit.object.userData?.isDecalHitbox);
          if (hitDecal) return;

          const { autoSelect, selectedIds, setSelectedId, isDragging, globalToolMode } = useEditorStore.getState();

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
          <ProjectedDecal index={index} decal={decal} primaryMesh={primaryMesh} />
        </Suspense>
      ))}
    </group>
  );
}

useGLTF.preload(tshirtManUrl);
useGLTF.preload(tshirtWomanUrl);