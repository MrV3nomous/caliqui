import { Bvh, Decal, Environment, Lightformer, useGLTF, useTexture } from '@react-three/drei';
import { Canvas, createPortal, useThree } from '@react-three/fiber';
import React, { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
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

function WrapMaterial({ meshes, decal }: { meshes: THREE.Mesh[]; decal: DecalData }) {
  const texture = useTexture(decal.src || '');
  const { invalidate } = useThree();

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

    invalidate();

    return () => {
      meshes.forEach((mesh) => {
        if (mesh.material instanceof THREE.MeshStandardMaterial) {
          mesh.material.map = null;
          mesh.material.needsUpdate = true;
        }
      });
      invalidate();
    };
  }, [texture, meshes, decal.scale, decal.scaleX, decal.scaleY, invalidate]);

  return null;
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
    targetMeshes.forEach((mesh) => {
      if (mesh.material instanceof THREE.MeshStandardMaterial) {
        mesh.material.color.set(color);
        mesh.material.roughness = 0.9;
        mesh.material.metalness = 0.1;
        mesh.material.needsUpdate = true;
      }
    });
    invalidate();
  }, [targetMeshes, color, invalidate]);

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
            <StaticDecal decal={decal} targetMeshes={targetMeshes} index={index} />
          </Suspense>
        </DecalErrorBoundary>
      ))}
    </group>
  );
}

function StaticDecal({
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
    <SafeTextureStaticDecal
      src={decal.src}
      decal={decal}
      targetMeshes={targetMeshes}
      index={index}
    />
  );
}

function SafeTextureStaticDecal({
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
  const { gl, invalidate } = useThree();

  if (!gl.localClippingEnabled) {
    gl.localClippingEnabled = true;
  }

  const [texture, setTexture] = useState(() => {
    const t = new THREE.Texture();
    t.generateMipmaps = false;
    t.minFilter = THREE.LinearFilter;
    t.magFilter = THREE.LinearFilter;
    t.wrapS = THREE.ClampToEdgeWrapping;
    t.wrapT = THREE.ClampToEdgeWrapping;
    return t;
  });

  const activeMesh =
    targetMeshes.find((m) => m.name === decal.meshName) ||
    targetMeshes.find((m) => m.name.toLowerCase().includes('front')) ||
    targetMeshes[0];

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
    : Math.max(decal.zDepth as number, 0.01);

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
      new THREE.Euler(rotation.x, rotation.y, rotation.z),
    );
    const worldDir = localDir.transformDirection(activeMesh.matrixWorld).normalize();
    uniformsRef.current.uProjectorDir.value.copy(worldDir);
    invalidate();
  }, [safeAngleLimit, rotation, activeMesh, invalidate]);

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
                // FIX: Changed finalRotation back to rotation for Static mode compatibility
                rotation={rotation}
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
              // FIX: Changed finalRotation back to rotation for Static mode compatibility
              rotation={rotation}
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
