import { Bvh, Decal, Environment, Lightformer, useGLTF } from '@react-three/drei';
import { Canvas, createPortal, useThree } from '@react-three/fiber';
import React, { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import tshirtManUrl from '@/assets/models/tshirtman.glb?url';
import tshirtoversizedUrl from '@/assets/models/tshirtoversized.glb?url';
import tshirtWomanUrl from '@/assets/models/tshirtwoman.glb?url';
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

            <Suspense fallback={null}>
              <Bvh firstHitOnly>
                <StaticModel
                  decals={(canvasState || []) as unknown as DecalData[]}
                  color={tshirtColor}
                  apparelModel={apparelModel}
                />
              </Bvh>
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
  const { scene: gltfScene } = useGLTF(activeModelUrl);
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

  const primaryMesh = useMemo<THREE.Mesh | null>(() => {
    let largestMesh: THREE.Mesh | null = null;
    let maxSurfaceArea = -1;
    gltfScene.traverse((child) => {
      if (child instanceof THREE.Mesh && child.geometry) {
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
        mat.metalness = 0.1;
        mat.needsUpdate = true;
      }
    };

    if (Array.isArray(primaryMesh.material)) {
      primaryMesh.material.forEach(applyColor);
    } else {
      applyColor(primaryMesh.material);
    }

    invalidate();
  }, [primaryMesh, color, invalidate]);

  if (!primaryMesh) return null;

  return (
    <group scale={1.1}>
      <primitive object={primaryMesh} />
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
  const { gl, invalidate } = useThree();
  const [texture, setTexture] = useState(() => {
    const t = new THREE.Texture();
    t.generateMipmaps = false;
    t.minFilter = THREE.LinearFilter;
    t.magFilter = THREE.LinearFilter;
    t.wrapS = THREE.ClampToEdgeWrapping;
    t.wrapT = THREE.ClampToEdgeWrapping;
    return t;
  });

  useEffect(() => {
    return () => {
      texture.dispose();
    };
  }, [texture]);

  useEffect(() => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.src = src;
    img.onload = () => {
      const MAX_SIZE = 1024;
      let w = img.naturalWidth || 512;
      let h = img.naturalHeight || 512;

      if (w > MAX_SIZE || h > MAX_SIZE) {
        const aspect = Math.min(MAX_SIZE / w, MAX_SIZE / h);
        w = Math.floor(w * aspect);
        h = Math.floor(h * aspect);
      }

      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(img, 0, 0, w, h);
        setTexture((prev) => {
          const newTex = new THREE.Texture(canvas);
          newTex.colorSpace = THREE.SRGBColorSpace;
          newTex.anisotropy = Math.min(gl.capabilities.getMaxAnisotropy(), 2);
          newTex.generateMipmaps = false;
          newTex.minFilter = THREE.LinearFilter;
          newTex.magFilter = THREE.LinearFilter;
          newTex.wrapS = THREE.ClampToEdgeWrapping;
          newTex.wrapT = THREE.ClampToEdgeWrapping;
          newTex.needsUpdate = true;
          prev.dispose();
          invalidate();
          return newTex;
        });
      }
    };
  }, [src, gl, invalidate]);

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

  const finalSx = Number(sx) || 0.2;
  const finalSy = Number(sy) || 0.2;

  // FIX: Goldilocks depth constraint applied to static viewer as well.
  const safeZDepth = Number.isNaN(Number(decal.zDepth))
    ? 0.15
    : Math.max(decal.zDepth as number, 0.1);

  const scale = new THREE.Vector3(finalSx, finalSy, safeZDepth);
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
