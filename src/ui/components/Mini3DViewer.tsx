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
import { Canvas, createPortal } from '@react-three/fiber';
import React, { Suspense, useEffect, useMemo, useState } from 'react';
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
    isolatedMesh.name = baseMesh.name || `mesh_${baseMesh.uuid}`;

    if (baseMesh.material) {
      isolatedMesh.material = (baseMesh.material as THREE.Material).clone();
    }

    return isolatedMesh;
  }, [gltfScene]);

  useEffect(() => {
    if (!primaryMesh?.material) return;

    const applyColor = (mat: THREE.Material) => {
      if (mat instanceof THREE.MeshStandardMaterial) {
        mat.color.set(color);
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
  }, [primaryMesh, color]);

  if (!primaryMesh) return null;

  return (
    <group scale={1.1}>
      <primitive object={primaryMesh} />
      {hydratedDecals.map((decal, index) => (
        <DecalErrorBoundary key={decal.id || index}>
          <Suspense fallback={null}>
            <ViewerDecal decal={decal} mesh={primaryMesh} index={index} />
          </Suspense>
        </DecalErrorBoundary>
      ))}
    </group>
  );
}

function ViewerDecal({
  decal,
  mesh,
  index,
}: {
  decal: DecalData;
  mesh: THREE.Mesh;
  index: number;
}) {
  if (!decal.src) return null;
  return <SafeTextureDecal src={decal.src} decal={decal} mesh={mesh} index={index} />;
}

function SafeTextureDecal({
  src,
  decal,
  mesh,
  index,
}: {
  src: string;
  decal: DecalData;
  mesh: THREE.Mesh;
  index: number;
}) {
  const texture = useTexture(src);
  const position = new THREE.Vector3(...(decal.position || [0, 0, 0]));

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

  // FIX: Applied the Goldilocks depth constraint to the viewers as well
  const safeZDepth = Number.isNaN(Number(decal.zDepth))
    ? 0.15
    : Math.max(Number(decal.zDepth), 0.1);

  const scale = new THREE.Vector3(finalSx, finalSy, safeZDepth);
  const blendMode = decal.blendMode === 'multiply' ? THREE.MultiplyBlending : THREE.NormalBlending;

  return createPortal(
    <Decal
      mesh={{ current: mesh } as React.RefObject<THREE.Mesh>}
      position={position}
      rotation={finalRotation}
      scale={scale}
      renderOrder={index + 1}
    >
      <meshStandardMaterial
        map={texture}
        transparent
        polygonOffset
        polygonOffsetFactor={-1 - index * 0.5}
        depthTest={true}
        depthWrite={false}
        roughness={0.9}
        metalness={0.0}
        blending={blendMode}
      />
    </Decal>,
    mesh,
  );
}

useGLTF.preload(tshirtManUrl);
useGLTF.preload(tshirtWomanUrl);
useGLTF.preload(tshirtoversizedUrl);
