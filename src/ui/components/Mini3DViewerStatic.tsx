import { Decal, useGLTF, useTexture } from '@react-three/drei';
import { Canvas, createPortal, useThree } from '@react-three/fiber';
import React, { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import tshirtManUrl from '@/assets/models/tshirtman.glb?url';
import tshirtoversizedUrl from '@/assets/models/tshirtoversized.glb?url';
import tshirtWomanUrl from '@/assets/models/tshirtwoman.glb?url';
import { applyImageFilters, type DecalData, generateAssetTexture } from '@/ui/store/editor-store';

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

export function Mini3DViewerStatic({
  canvasState,
  tshirtColor = '#ffffff',
  apparelModel = 'tshirtman',
  onOpen,
}: {
  canvasState?: Record<string, unknown>[] | null;
  tshirtColor?: string;
  apparelModel?: string;
  onOpen: () => void;
}) {
  const [isInView, setIsInView] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Virtualization: only mount canvas when in or near viewport
  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsInView(entry.isIntersecting);
      },
      { threshold: 0.01, rootMargin: '250px' },
    );

    if (containerRef.current) {
      observer.observe(containerRef.current);
    }

    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={containerRef}
      className="absolute inset-0 w-full h-full bg-[#f8f8f8] overflow-hidden rounded-2xl select-none"
    >
      <button
        type="button"
        aria-label="View product details"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onOpen();
        }}
        className="absolute inset-0 w-full h-full cursor-pointer bg-transparent border-0 p-0 m-0 outline-none z-50 appearance-none"
      />

      {isInView ? (
        <div className="w-full h-full pointer-events-none z-20 relative">
          <Canvas
            frameloop="demand"
            dpr={[1, 1.5]}
            gl={{
              preserveDrawingBuffer: false,
              alpha: true,
              antialias: false,
              powerPreference: 'low-power',
            }}
            camera={{ position: [0, 0, 4.5], fov: 45 }}
            className="w-full h-full outline-none"
          >
            <ambientLight intensity={0.9} />
            <directionalLight position={[0, 3, 4]} intensity={1.2} />
            <directionalLight position={[0, 3, -4]} intensity={0.9} />

            <Suspense fallback={null}>
              <StaticModel
                decals={(canvasState || []) as unknown as DecalData[]}
                color={tshirtColor}
                apparelModel={apparelModel}
              />
            </Suspense>
          </Canvas>
        </div>
      ) : (
        <div className="w-full h-full flex items-center justify-center">
          <div className="w-8 h-8 rounded-full border-2 border-black/10 animate-pulse" />
        </div>
      )}
    </div>
  );
}

function StaticModel({
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
  const [hydratedDecals, setHydratedDecals] = useState<DecalData[]>([]);
  const { invalidate } = useThree();

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
        invalidate();
      }
    });

    return () => {
      isMounted = false;
    };
  }, [decals, invalidate]);

  const copiedScene = useMemo(() => {
    const group = new THREE.Group();
    scene.updateMatrixWorld(true);

    scene.traverse((child) => {
      if (child instanceof THREE.Mesh && child.geometry) {
        const clonedMesh = new THREE.Mesh();
        clonedMesh.geometry = child.geometry.clone();
        clonedMesh.geometry.applyMatrix4(child.matrixWorld);
        clonedMesh.geometry.scale(MODEL_SCALE, MODEL_SCALE, MODEL_SCALE);
        clonedMesh.position.set(0, 0, 0);
        clonedMesh.rotation.set(0, 0, 0);
        clonedMesh.scale.set(1, 1, 1);
        clonedMesh.updateMatrix();

        if (child.material) {
          clonedMesh.material = child.material.clone();
        }

        group.add(clonedMesh);
      }
    });

    return group;
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
      mat.roughness = 0.9;
      mat.metalness = 0.1;
      mat.needsUpdate = true;
      invalidate();
    }
  }, [primaryMesh, color, invalidate]);

  if (!primaryMesh) return <primitive object={copiedScene} />;

  return (
    <group scale={1.1}>
      <primitive object={copiedScene} />
      {hydratedDecals.map((decal, index) => (
        <DecalErrorBoundary key={decal.id || index}>
          <Suspense fallback={null}>
            <StaticDecal decal={decal} mesh={primaryMesh} index={index} />
          </Suspense>
        </DecalErrorBoundary>
      ))}
    </group>
  );
}

function StaticDecal({
  decal,
  mesh,
  index,
}: {
  decal: DecalData;
  mesh: THREE.Mesh;
  index: number;
}) {
  if (!decal.src) return null;
  return <SafeTextureStaticDecal src={decal.src} decal={decal} mesh={mesh} index={index} />;
}

function SafeTextureStaticDecal({
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
  const { invalidate } = useThree();

  useEffect(() => {
    if (texture) {
      invalidate();
    }
  }, [texture, invalidate]);

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

  const safeZDepth = decal.zDepth;
  const scale = new THREE.Vector3(sx, sy, safeZDepth);
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
useGLTF.preload(tshirtoversizedUrl);
