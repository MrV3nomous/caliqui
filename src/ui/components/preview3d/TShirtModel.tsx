import { useGLTF } from '@react-three/drei';
import { type ThreeEvent, useThree } from '@react-three/fiber';
import { Suspense, useEffect, useMemo } from 'react';
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

  const copiedScene = useMemo(() => {
    const clone = gltfScene.clone();

    clone.traverse((child) => {
      if (child.position) {
        child.position.multiplyScalar(MODEL_SCALE);
      }

      if (child instanceof THREE.Mesh) {
        child.castShadow = true;
        child.receiveShadow = true;
        if (!child.name) child.name = `mesh_${child.uuid}`;
        child.userData.isTargetMesh = true;

        if (child.material) {
          child.material = child.material.clone();
        }

        if (child.geometry) {
          child.geometry = child.geometry.clone();
          child.geometry.scale(MODEL_SCALE, MODEL_SCALE, MODEL_SCALE);
        }
      }
    });
    return clone;
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

      updateDecal(decal.id, {
        meshName: primaryMesh.name,
        position: [localPos.x, localPos.y, localPos.z],
        rotation: [localEuler.x, localEuler.y, localEuler.z],
        scale: 0.5,
      });
    });
  }, [decals, primaryMesh, camera, updateDecal]);

  if (!primaryMesh) return <primitive object={copiedScene} />;

  return (
    <group name="workspace" scale={1.15}>
      <primitive
        object={copiedScene}
        onPointerDown={(e: ThreeEvent<PointerEvent>) => {
          const hitDecal = e.intersections.some((hit) => hit.object.userData?.isDecalHitbox);
          if (hitDecal) {
            // Strictly guard OrbitControls by ensuring rogue clicks that brush the model
            // while aiming for a decal don't mistakenly unlock the camera
            e.stopPropagation();
            return;
          }
          const { autoSelect, selectedIds, setSelectedId, isDragging } = useEditorStore.getState();
          if (isDragging) return;

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
