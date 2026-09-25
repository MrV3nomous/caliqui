import {
  Bvh,
  Decal,
  Environment,
  Html,
  Lightformer,
  OrbitControls,
  useGLTF,
  useTexture,
} from '@react-three/drei';
import { Canvas, createPortal, useThree } from '@react-three/fiber';
import React, { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import tshirtManUrl from '@/assets/models/tshirtman.glb?url';
import tshirtoversizedUrl from '@/assets/models/tshirtoversized.glb?url';
import tshirtWomanUrl from '@/assets/models/tshirtwoman.glb?url';
import { PremiumLoader } from '@/ui/components/PremiumLoader';
import { applyImageFilters, type DecalData, generateAssetTexture } from '@/ui/store/editor-store';

Object.assign(useGLTF, {
  draco: 'https://www.gstatic.com/draco/versioned/decoders/1.5.5/',
});

const MODELS: Record<string, string> = {
  tshirtman: tshirtManUrl,
  tshirtwoman: tshirtWomanUrl,
  tshirtoversized: tshirtoversizedUrl,
};

const MODEL_SCALE = 0.03;

class DecalErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  render() {
    if (this.state.hasError) return null;
    return this.props.children;
  }
}

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

export function Mini3DViewer({
  canvasState,
  tshirtColor = '#ffffff',
  fallbackImage,
  apparelModel = 'tshirtman',
}: {
  canvasState?: Record<string, unknown>[] | null;
  tshirtColor?: string;
  fallbackImage?: string | null;
  apparelModel?: string;
}) {
  return (
    <div className="w-full h-full cursor-grab active:cursor-grabbing relative touch-none">
      <Canvas
        camera={{ position: [0, 0, 4.5], fov: 45 }}
        dpr={[1, 1.5]}
        gl={{
          preserveDrawingBuffer: false,
          alpha: true,
          antialias: true,
          powerPreference: 'high-performance',
        }}
        className="w-full h-full outline-none"
      >
        <ambientLight intensity={0.35} />
        <hemisphereLight intensity={0.25} color="#ffffff" groundColor="#999999" />
        <directionalLight position={[2, 5, 5]} intensity={0.4} />

        <Environment resolution={256}>
          <Lightformer
            form="rect"
            intensity={0.8}
            position={[0, 5, 0]}
            scale={[10, 10, 1]}
            rotation={[-Math.PI / 2, 0, 0]}
          />
          <Lightformer form="rect" intensity={0.4} position={[0, 0, 5]} scale={[10, 10, 1]} />
          <Lightformer
            form="rect"
            intensity={0.8}
            position={[-5, 0, -5]}
            scale={[10, 10, 1]}
            rotation={[0, Math.PI / 4, 0]}
          />
          <Lightformer
            form="rect"
            intensity={0.8}
            position={[5, 0, -5]}
            scale={[10, 10, 1]}
            rotation={[0, -Math.PI / 4, 0]}
          />
        </Environment>

        <Suspense
          fallback={
            <Html center>
              <PremiumLoader fullScreen={false} message="" />
            </Html>
          }
        >
          <Bvh firstHitOnly>
            <ViewerModel
              decals={(canvasState || []) as unknown as DecalData[]}
              color={tshirtColor}
              apparelModel={apparelModel}
            />
          </Bvh>
        </Suspense>

        <OrbitControls
          enablePan={false}
          enableZoom={true}
          minDistance={2.5}
          maxDistance={6.0}
          minPolarAngle={0}
          maxPolarAngle={Math.PI}
        />
      </Canvas>

      {(!canvasState || canvasState.length === 0) && fallbackImage && (
        <img
          src={fallbackImage}
          alt="Design Preview"
          className="absolute inset-0 w-full h-full object-cover mix-blend-multiply pointer-events-none opacity-0"
        />
      )}
    </div>
  );
}

function ViewerModel({
  decals,
  color,
  apparelModel,
}: {
  decals: DecalData[];
  color: string;
  apparelModel: string;
}) {
  const activeModelUrl = MODELS[apparelModel] || tshirtManUrl;
  const { scene: gltfScene } = useGLTF(activeModelUrl);
  const [hydratedDecals, setHydratedDecals] = useState<DecalData[]>([]);

  useEffect(() => {
    let isMounted = true;

    Promise.all(
      decals.map(async (d) => {
        if (d.src?.startsWith('data:')) {
          return d;
        }

        if (d.type === 'shape' || d.type === 'text') {
          const baseSrc = generateAssetTexture(d);
          const { src: finalSrc, aspectRatio } = await applyImageFilters({
            ...d,
            originalSrc: baseSrc,
          });
          return { ...d, src: finalSrc, originalSrc: baseSrc, aspectRatio };
        }

        if ((d.type === 'image' || d.type === 'drawing') && (d.originalSrc || d.src)) {
          const { src: finalSrc, aspectRatio } = await applyImageFilters({
            ...d,
            originalSrc: d.originalSrc || d.src,
          });
          return { ...d, src: finalSrc, aspectRatio };
        }

        return d;
      }),
    ).then((hydrated) => {
      if (isMounted) {
        setHydratedDecals(hydrated);
      }
    });

    return () => {
      isMounted = false;
    };
  }, [decals]);

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
    targetMeshes.forEach((mesh) => {
      if (mesh.material instanceof THREE.MeshStandardMaterial) {
        mesh.material.color.set(color);
        mesh.material.roughness = 0.9;
        mesh.material.metalness = 0.05;
        mesh.material.needsUpdate = true;
      }
    });
  }, [targetMeshes, color]);

  if (targetMeshes.length === 0) return null;

  const wrapDecal = hydratedDecals.find((d) => d.placementMode === 'wrap');
  const standardDecals = hydratedDecals.filter((d) => d.placementMode !== 'wrap');

  return (
    <group scale={1.1}>
      <primitive object={copiedScene} />
      {wrapDecal && <WrapMaterial meshes={targetMeshes} decal={wrapDecal} />}
      {standardDecals.map((decal, index) => (
        <DecalErrorBoundary key={decal.id || index}>
          <Suspense fallback={null}>
            <ViewerDecal decal={decal} targetMeshes={targetMeshes} index={index} />
          </Suspense>
        </DecalErrorBoundary>
      ))}
    </group>
  );
}

function ViewerDecal({
  decal,
  targetMeshes,
  index,
}: {
  decal: DecalData;
  targetMeshes: THREE.Mesh[];
  index: number;
}) {
  if (!decal.src || decal.placementMode === 'wrap') return null;
  return (
    <SafeTextureDecal src={decal.src} decal={decal} targetMeshes={targetMeshes} index={index} />
  );
}

function SafeTextureDecal({
  src,
  decal,
  targetMeshes,
  index,
}: {
  src: string;
  decal: DecalData;
  targetMeshes: THREE.Mesh[];
  index: number;
}) {
  const { gl } = useThree();

  if (!gl.localClippingEnabled) {
    gl.localClippingEnabled = true;
  }

  const texture = useTexture(src);
  const position = new THREE.Vector3(...(decal.position || [0, 0, 0]));

  const activeMesh =
    targetMeshes.find((m) => m.name === decal.meshName) ||
    targetMeshes.find((m) => m.name.toLowerCase().includes('front')) ||
    targetMeshes[0];

  const finalRotation = useMemo(() => {
    const dummy = new THREE.Object3D();
    dummy.rotation.set(
      Number.isNaN(decal.rotation?.[0]) ? 0 : decal.rotation[0],
      Number.isNaN(decal.rotation?.[1]) ? 0 : decal.rotation[1],
      Number.isNaN(decal.rotation?.[2]) ? 0 : decal.rotation[2],
    );
    if (decal.rotationOffset) dummy.rotateZ(decal.rotationOffset);
    return [dummy.rotation.x, dummy.rotation.y, dummy.rotation.z] as [number, number, number];
  }, [decal.rotation, decal.rotationOffset]);

  const ratio = decal.aspectRatio || 1;
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

  const finalSx = Number(sx) || 0.35;
  const finalSy = Number(sy) || 0.35;

  const isPassThrough = decal.placementMode === 'pass-through';
  const isFront = decal.position ? decal.position[2] >= 0 : true;

  const clipPlane = useMemo(() => {
    if (isPassThrough) return null;
    const isUnplaced =
      decal?.position[0] === 0 && decal?.position[1] === 0 && decal?.position[2] === 0;
    if (isUnplaced) return null;

    return new THREE.Plane(new THREE.Vector3(0, 0, isFront ? 1 : -1), 0.01);
  }, [isPassThrough, isFront, decal?.position]);

  const safeZDepth = Number.isNaN(Number(decal.zDepth))
    ? 0.15
    : Math.max(Number(decal.zDepth), 0.01);

  const safeAngleLimit = Number.isNaN(Number(decal?.angleLimit))
    ? (85 * Math.PI) / 180
    : (Math.max(10, Math.min(90, Number(decal?.angleLimit))) * Math.PI) / 180;

  const uniformsRef = useRef({
    uProjectorDir: { value: new THREE.Vector3(0, 0, 1) },
    uAngleLimit: { value: Math.cos(safeAngleLimit) },
  });

  useEffect(() => {
    uniformsRef.current.uAngleLimit.value = Math.cos(safeAngleLimit);
    const localDir = new THREE.Vector3(0, 0, 1).applyEuler(
      new THREE.Euler(finalRotation[0], finalRotation[1], finalRotation[2]),
    );
    const worldDir = localDir.transformDirection(activeMesh.matrixWorld).normalize();
    uniformsRef.current.uProjectorDir.value.copy(worldDir);
  }, [safeAngleLimit, finalRotation, activeMesh]);

  // biome-ignore lint/suspicious/noExplicitAny: Internal Three.js shader type varies by version
  const customOnBeforeCompile = useCallback((shader: any) => {
    shader.uniforms.uProjectorDir = uniformsRef.current.uProjectorDir;
    shader.uniforms.uAngleLimit = uniformsRef.current.uAngleLimit;

    shader.vertexShader = `
      varying vec3 vWorldNormalCustom;
      ${shader.vertexShader}
    `.replace(
      `#include <beginnormal_vertex>`,
      `#include <beginnormal_vertex>
       vWorldNormalCustom = normalize(mat3(modelMatrix) * objectNormal);
      `,
    );

    shader.fragmentShader = `
      uniform vec3 uProjectorDir;
      uniform float uAngleLimit;
      varying vec3 vWorldNormalCustom;
      ${shader.fragmentShader}
    `.replace(
      `#include <alphatest_fragment>`,
      `#include <alphatest_fragment>
       // FIX: Added abs() to dot product for pass-through visibility on opposite side
       float dotP = abs(dot(normalize(vWorldNormalCustom), uProjectorDir));
       if (dotP < uAngleLimit) {
           discard;
       }
      `,
    );
  }, []);

  const scale = new THREE.Vector3(finalSx, finalSy, safeZDepth);
  const blendMode = decal.blendMode === 'multiply' ? THREE.MultiplyBlending : THREE.NormalBlending;

  const renderMaterial = () => (
    <meshStandardMaterial
      key={`mat-${isPassThrough ? 'pass' : 'clip'}-${isFront ? 'front' : 'back'}`}
      map={texture}
      transparent
      polygonOffset
      polygonOffsetFactor={-1 - index * 0.5}
      depthTest={true}
      depthWrite={false}
      roughness={0.9}
      metalness={0.0}
      blending={blendMode}
      clippingPlanes={clipPlane ? [clipPlane] : []}
      onBeforeCompile={customOnBeforeCompile}
    />
  );

  return (
    <>
      {isPassThrough
        ? targetMeshes.map((mesh) =>
            createPortal(
              <Decal
                key={`decal-${decal.id}-${mesh.name}`}
                mesh={{ current: mesh } as React.RefObject<THREE.Mesh>}
                position={position}
                rotation={finalRotation}
                scale={scale}
                renderOrder={index + 1}
              >
                {renderMaterial()}
              </Decal>,
              mesh,
            ),
          )
        : createPortal(
            <Decal
              mesh={{ current: activeMesh } as React.RefObject<THREE.Mesh>}
              position={position}
              rotation={finalRotation}
              scale={scale}
              renderOrder={index + 1}
            >
              {renderMaterial()}
            </Decal>,
            activeMesh,
          )}
    </>
  );
}

useGLTF.preload(tshirtManUrl);
useGLTF.preload(tshirtWomanUrl);
useGLTF.preload(tshirtoversizedUrl);
