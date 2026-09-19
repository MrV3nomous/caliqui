import { Decal, Environment, Html, OrbitControls, useGLTF, useTexture } from '@react-three/drei';
import { Canvas, createPortal } from '@react-three/fiber';
import React, { Suspense, useEffect, useMemo } from 'react';
import * as THREE from 'three';
import tshirtManUrl from '@/assets/models/tshirtman.glb?url';
import tshirtWomanUrl from '@/assets/models/tshirtwoman.glb?url';
import { PremiumLoader } from '@/ui/components/PremiumLoader';
import { type DecalData, generateAssetTexture } from '@/ui/store/editor-store';

const MODELS: Record<string, string> = {
  tshirtman: tshirtManUrl,
  tshirtwoman: tshirtWomanUrl,
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
  if (!canvasState || canvasState.length === 0) {
    return fallbackImage ? (
      <img
        src={fallbackImage}
        alt="Design Preview"
        className="w-full h-full object-cover mix-blend-multiply pointer-events-none"
      />
    ) : null;
  }

  return (
    <div className="w-full h-full cursor-grab active:cursor-grabbing relative touch-none">
      <Canvas
        camera={{ position: [0, 0, 4.5], fov: 45 }}
        gl={{ preserveDrawingBuffer: true, alpha: true, antialias: true }}
        className="w-full h-full outline-none"
      >
        <ambientLight intensity={0.6} />
        <spotLight position={[10, 10, 10]} angle={0.15} penumbra={1} intensity={1} castShadow />
        <Environment preset="city" />

        {/* PROJECTS THE LOADER DIRECTLY ONTO THE CANVAS */}
        <Suspense
          fallback={
            <Html center>
              <PremiumLoader fullScreen={false} message="" />
            </Html>
          }
        >
          <ViewerModel
            decals={canvasState as unknown as DecalData[]}
            color={tshirtColor}
            apparelModel={apparelModel}
          />
        </Suspense>

        <OrbitControls
          enablePan={false}
          enableZoom={true} // ENABLED ZOOM
          minDistance={2.5} // Prevent zooming inside the model
          maxDistance={6.0} // Prevent zooming too far out
          minPolarAngle={0}
          maxPolarAngle={Math.PI}
        />
      </Canvas>
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
  const { scene } = useGLTF(activeModelUrl);

  const copiedScene = useMemo(() => {
    const clone = scene.clone();

    clone.traverse((child) => {
      // 1. Scale positions identically to the Editor
      if (child.position) {
        child.position.multiplyScalar(MODEL_SCALE);
      }

      if (child instanceof THREE.Mesh) {
        child.castShadow = true;
        child.receiveShadow = true;

        if (child.material) {
          child.material = child.material.clone();
        }

        // 2. Permanently shrink the raw geometry for correct dashboard decal rendering
        if (child.geometry) {
          child.geometry = child.geometry.clone();
          child.geometry.scale(MODEL_SCALE, MODEL_SCALE, MODEL_SCALE);
        }
      }
    });
    return clone;
  }, [scene]);

  const primaryMesh = useMemo<THREE.Mesh | null>(() => {
    let largestMesh: THREE.Mesh | null = null;
    let maxVolume = -1;
    copiedScene.traverse((child) => {
      if (child instanceof THREE.Mesh && child.geometry) {
        if (!child.geometry.boundingBox) child.geometry.computeBoundingBox();
        const box = child.geometry.boundingBox;
        if (box) {
          const vol = (box.max.x - box.min.x) * (box.max.y - box.min.y) * (box.max.z - box.min.z);
          if (vol > maxVolume) {
            maxVolume = vol;
            largestMesh = child;
          }
        }
      }
    });
    return largestMesh;
  }, [copiedScene]);

  useEffect(() => {
    if (!primaryMesh?.material) return;
    const mat = primaryMesh.material as THREE.MeshStandardMaterial;
    if (mat.color && color) {
      mat.color.set(color);
      mat.roughness = 1;
      mat.metalness = 0.5;
      mat.envMapIntensity = 0.2;
      mat.needsUpdate = true;
    }
  }, [primaryMesh, color]);

  if (!primaryMesh) return <primitive object={copiedScene} />;

  return (
    <group scale={1.15}>
      <primitive object={copiedScene} />
      {decals.map((decal, index) => (
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
  const finalSrc =
    decal.src ||
    (decal.type === 'shape' || decal.type === 'text' ? generateAssetTexture(decal) : null);

  if (!finalSrc) return null;

  return <SafeTextureDecal src={finalSrc} decal={decal} mesh={mesh} index={index} />;
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
  const rotation = new THREE.Euler(...(decal.rotation || [0, 0, 0]));

  const ratio = decal.aspectRatio || 1;
  let sx = decal.scaleX ?? decal.scale;
  let sy = decal.scaleY ?? decal.scale;

  if (decal.scaleX === undefined && decal.scaleY === undefined) {
    if (ratio > 1) {
      sx = (decal.scale ?? 0.2) * ratio;
      sy = decal.scale ?? 0.2;
    } else if (ratio < 1) {
      sx = decal.scale ?? 0.2;
      sy = (decal.scale ?? 0.2) / ratio;
    } else {
      sx = decal.scale ?? 0.2;
      sy = decal.scale ?? 0.2;
    }
  }

  const scale = new THREE.Vector3(sx, sy, 0.9);
  const blendMode = decal.blendMode === 'multiply' ? THREE.MultiplyBlending : THREE.NormalBlending;

  return createPortal(
    <Decal
      mesh={{ current: mesh } as React.RefObject<THREE.Mesh>}
      position={position}
      rotation={rotation}
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
