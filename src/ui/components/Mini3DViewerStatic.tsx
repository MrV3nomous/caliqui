import { Bvh, Decal, Environment, Lightformer, useGLTF } from '@react-three/drei';
import { Canvas, useThree } from '@react-three/fiber';
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

const getThreeBlending = (mode?: string) => {
  switch (mode) {
    case 'multiply':
    case 'darken':
    case 'color-burn':
      return THREE.MultiplyBlending;
    case 'screen':
    case 'lighten':
    case 'color-dodge':
      return THREE.AdditiveBlending;
    case 'difference':
    case 'exclusion':
      return THREE.SubtractiveBlending;
    default:
      return THREE.NormalBlending;
  }
};

class DecalErrorBoundary extends React.Component<
  { children: React.ReactNode; resetKey: string },
  { hasError: boolean; lastKey: string }
> {
  constructor(props: { children: React.ReactNode; resetKey: string }) {
    super(props);
    this.state = { hasError: false, lastKey: props.resetKey };
  }
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  static getDerivedStateFromProps(
    props: { resetKey: string },
    state: { hasError: boolean; lastKey: string },
  ) {
    if (state.hasError && props.resetKey !== state.lastKey) {
      return { hasError: false, lastKey: props.resetKey };
    }
    return { lastKey: props.resetKey };
  }
  render() {
    if (this.state.hasError) return null;
    return this.props.children;
  }
}

function WrapMaterial({ meshes, decal }: { meshes: THREE.Mesh[]; decal: DecalData }) {
  const { invalidate } = useThree();
  const activeTextureRef = useRef<THREE.Texture | null>(null);
  const textureRequestRef = useRef<number>(0);
  const [, setTexVersion] = useState(0);

  // Strict Unmount Lifecycle
  useEffect(() => {
    return () => {
      if (activeTextureRef.current) {
        meshes.forEach((mesh) => {
          if (mesh.material instanceof THREE.MeshStandardMaterial) {
            if (mesh.material.map === activeTextureRef.current) {
              mesh.material.map = null;
              mesh.material.needsUpdate = true;
            }
          }
        });
        activeTextureRef.current.dispose();
        activeTextureRef.current = null;
      }
    };
  }, [meshes]);

  // Texture Fetching Lifecycle
  useEffect(() => {
    if (!decal.src) {
      if (activeTextureRef.current) {
        meshes.forEach((mesh) => {
          if (mesh.material instanceof THREE.MeshStandardMaterial) {
            if (mesh.material.map === activeTextureRef.current) {
              mesh.material.map = null;
              mesh.material.needsUpdate = true;
            }
          }
        });
        activeTextureRef.current.dispose();
        activeTextureRef.current = null;
        setTexVersion((v) => v + 1);
        invalidate();
      }
      return;
    }

    const requestId = ++textureRequestRef.current;
    let isCancelled = false;

    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.src = decal.src;
    img.onload = () => {
      if (isCancelled || requestId !== textureRequestRef.current) return;

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

        const newTex = new THREE.Texture(canvas);
        newTex.colorSpace = THREE.SRGBColorSpace;
        newTex.generateMipmaps = false;
        newTex.minFilter = THREE.LinearFilter;
        newTex.magFilter = THREE.LinearFilter;
        newTex.wrapS = THREE.ClampToEdgeWrapping;
        newTex.wrapT = THREE.ClampToEdgeWrapping;
        newTex.needsUpdate = true;

        if (activeTextureRef.current) {
          meshes.forEach((mesh) => {
            if (mesh.material instanceof THREE.MeshStandardMaterial) {
              if (mesh.material.map === activeTextureRef.current) {
                mesh.material.map = null;
                mesh.material.needsUpdate = true;
              }
            }
          });
          activeTextureRef.current.dispose();
        }

        activeTextureRef.current = newTex;
        setTexVersion((v) => v + 1);
        invalidate();
      }
    };

    return () => {
      isCancelled = true;
    };
  }, [decal.src, decal.flipX, decal.flipY, meshes, invalidate]);

  // Transform Updates Lifecycle
  useEffect(() => {
    if (!activeTextureRef.current) return;

    const aspect =
      typeof decal.aspectRatio === 'number' && Number.isFinite(decal.aspectRatio)
        ? Math.max(0.0001, decal.aspectRatio)
        : 1;

    let sx = decal.scaleX ?? decal.scale;
    let sy = decal.scaleY ?? decal.scale;

    if (decal.scaleX === undefined && decal.scaleY === undefined) {
      if (aspect > 1) {
        sx = (decal.scale ?? 0.35) * aspect;
        sy = decal.scale ?? 0.35;
      } else if (aspect < 1) {
        sx = decal.scale ?? 0.35;
        sy = (decal.scale ?? 0.35) / aspect;
      } else {
        sx = decal.scale ?? 0.35;
        sy = decal.scale ?? 0.35;
      }
    }

    const finalSx = typeof sx === 'number' && Number.isFinite(sx) && sx > 0 ? sx : 0.35;
    const finalSy = typeof sy === 'number' && Number.isFinite(sy) && sy > 0 ? sy : 0.35;

    activeTextureRef.current.repeat.set((decal.flipX ? -1 : 1) / finalSx, (decal.flipY ? -1 : 1) / finalSy);
    activeTextureRef.current.offset.set(decal.flipX ? 1 : 0, decal.flipY ? 1 : 0);
    activeTextureRef.current.needsUpdate = true;

    meshes.forEach((mesh) => {
      if (mesh.material instanceof THREE.MeshStandardMaterial) {
        mesh.material.map = activeTextureRef.current;
        mesh.material.needsUpdate = true;
      }
    });

    invalidate();
  }, [decal.scale, decal.scaleX, decal.scaleY, decal.aspectRatio, decal.flipX, decal.flipY, meshes, invalidate]);

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
      className="absolute inset-0 w-full h-full bg-transparent overflow-hidden select-none"
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
            camera={{ position: [0, -0.05, 4.0], fov: 35 }}
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
                  key={apparelModel}
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
  const hydrationVersionRef = useRef<number>(0);

  useEffect(() => {
    const version = ++hydrationVersionRef.current;
    let isMounted = true;

    Promise.all(
      decals.filter((d) => d.visible !== false).map(async (d) => {
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
      if (isMounted && version === hydrationVersionRef.current) {
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
          if (Array.isArray(child.material)) {
            clonedMesh.material = child.material.map((m) => m.clone());
          } else {
            clonedMesh.material = child.material.clone();
          }
        }

        group.add(clonedMesh);
      }
    });

    return group;
  }, [gltfScene]);

  // Safely dispose explicitly cloned resources when model swaps/unmounts
  useEffect(() => {
    return () => {
      copiedScene.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          if (child.geometry) child.geometry.dispose();
          if (child.material) {
            if (Array.isArray(child.material)) {
              child.material.forEach((m) => {
                m.dispose();
              });
            } else {
              child.material.dispose();
            }
          }
        }
      });
    };
  }, [copiedScene]);

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
        mesh.material.roughness = 0.7;
        mesh.material.metalness = 0.0;
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
        <DecalErrorBoundary key={decal.id || index} resetKey={`${decal.id}-${decal.src}`}>
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
  const textureRequestRef = useRef<number>(0);

  const activeTextureRef = useRef<THREE.Texture | null>(null);
  const materialsRef = useRef<Set<THREE.MeshStandardMaterial>>(new Set());
  const materialRefClosures = useRef(
    new Map<string, (mat: THREE.MeshStandardMaterial | null) => void>(),
  );
  const [, setTexVersion] = useState(0);

  const activeMesh = useMemo(() => {
    return (
      targetMeshes.find((m) => m.name === decal.meshName) ||
      targetMeshes.find((m) => m.name.toLowerCase().includes('front')) ||
      targetMeshes[0]
    );
  }, [targetMeshes, decal.meshName]);

  const activeMeshRef = useMemo(
    () => ({ current: activeMesh }) as React.RefObject<THREE.Mesh>,
    [activeMesh],
  );

  const targetMeshRefs = useMemo(() => {
    return targetMeshes.map((m) => ({ current: m }) as React.RefObject<THREE.Mesh>);
  }, [targetMeshes]);

  // Strict Unmount Lifecycle
  useEffect(() => {
    return () => {
      if (activeTextureRef.current) {
        materialsRef.current.forEach((mat) => {
          if (mat.map === activeTextureRef.current) {
            mat.map = null;
            mat.needsUpdate = true;
          }
        });
        activeTextureRef.current.dispose();
        activeTextureRef.current = null;
      }
    };
  }, []);

  // Fetching & Loading Lifecycle
  useEffect(() => {
    if (!src) {
      if (activeTextureRef.current) {
        materialsRef.current.forEach((mat) => {
          if (mat.map === activeTextureRef.current) {
            mat.map = null;
            mat.needsUpdate = true;
          }
        });
        activeTextureRef.current.dispose();
        activeTextureRef.current = null;
        setTexVersion((v) => v + 1);
        invalidate();
      }
      return;
    }

    const requestId = ++textureRequestRef.current;
    let isCancelled = false;

    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.src = src;
    img.onload = () => {
      if (isCancelled || requestId !== textureRequestRef.current) return;

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
        ctx.save();
        ctx.translate(decal.flipX ? w : 0, decal.flipY ? h : 0);
        ctx.scale(decal.flipX ? -1 : 1, decal.flipY ? -1 : 1);
        ctx.drawImage(img, 0, 0, w, h);
        ctx.restore();

        const newTex = new THREE.Texture(canvas);
        newTex.colorSpace = THREE.SRGBColorSpace;
        newTex.anisotropy = Math.min(gl.capabilities.getMaxAnisotropy(), 2);
        newTex.generateMipmaps = false;
        newTex.minFilter = THREE.LinearFilter;
        newTex.magFilter = THREE.LinearFilter;
        newTex.wrapS = THREE.ClampToEdgeWrapping;
        newTex.wrapT = THREE.ClampToEdgeWrapping;
        newTex.needsUpdate = true;

        if (activeTextureRef.current) {
          materialsRef.current.forEach((mat) => {
            if (mat.map === activeTextureRef.current) {
              mat.map = null;
              mat.needsUpdate = true;
            }
          });
          activeTextureRef.current.dispose();
        }

        activeTextureRef.current = newTex;
        setTexVersion((v) => v + 1);
        invalidate();
      }
    };

    return () => {
      isCancelled = true;
    };
  }, [src, gl, invalidate, decal.flipX, decal.flipY]);

  const position = new THREE.Vector3(
    Number.isFinite(decal.position?.[0]) ? decal.position[0] : 0,
    Number.isFinite(decal.position?.[1]) ? decal.position[1] : 0,
    Number.isFinite(decal.position?.[2]) ? decal.position[2] : 0,
  );

  const finalRotation = useMemo(() => {
    const dummy = new THREE.Object3D();
    dummy.rotation.set(
      Number.isFinite(decal.rotation?.[0]) ? decal.rotation[0] : 0,
      Number.isFinite(decal.rotation?.[1]) ? decal.rotation[1] : 0,
      Number.isFinite(decal.rotation?.[2]) ? decal.rotation[2] : 0,
    );
    if (decal.rotationOffset && Number.isFinite(decal.rotationOffset)) {
      dummy.rotateZ(decal.rotationOffset);
    }
    return [dummy.rotation.x, dummy.rotation.y, dummy.rotation.z] as [number, number, number];
  }, [decal.rotation, decal.rotationOffset]);

  const aspect =
    typeof decal.aspectRatio === 'number' && Number.isFinite(decal.aspectRatio)
      ? Math.max(0.0001, decal.aspectRatio)
      : 1;

  let sx = decal.scaleX ?? decal.scale;
  let sy = decal.scaleY ?? decal.scale;

  if (decal.scaleX === undefined && decal.scaleY === undefined) {
    if (aspect > 1) {
      sx = (decal.scale ?? 0.35) * aspect;
      sy = decal.scale ?? 0.35;
    } else if (aspect < 1) {
      sx = decal.scale ?? 0.35;
      sy = (decal.scale ?? 0.35) / aspect;
    } else {
      sx = decal.scale ?? 0.35;
      sy = decal.scale ?? 0.35;
    }
  }

  const finalSx = typeof sx === 'number' && Number.isFinite(sx) && sx > 0 ? sx : 0.35;
  const finalSy = typeof sy === 'number' && Number.isFinite(sy) && sy > 0 ? sy : 0.35;

  const isPassThrough = decal.placementMode === 'pass-through';

  const safeZDepth = Number.isFinite(Number(decal.zDepth))
    ? Math.min(Math.max(Number(decal.zDepth), 0.01), 15)
    : 0.12;

  const safeAngleLimit = Number.isFinite(Number(decal.angleLimit))
    ? (Math.max(10, Math.min(90, Number(decal.angleLimit))) * Math.PI) / 180
    : (65 * Math.PI) / 180;

  const uniformsRef = useRef({
    uProjectorDir: { value: new THREE.Vector3(0, 0, 1) },
    uAngleLimit: { value: Math.cos(safeAngleLimit) },
    uPassThrough: { value: isPassThrough ? 1.0 : 0.0 },
  });

  useEffect(() => {
    if (!activeMesh) return;
    uniformsRef.current.uAngleLimit.value = Math.cos(safeAngleLimit);
    uniformsRef.current.uPassThrough.value = isPassThrough ? 1.0 : 0.0;

    const localDir = new THREE.Vector3(0, 0, 1).applyEuler(
      new THREE.Euler(finalRotation[0], finalRotation[1], finalRotation[2]),
    );
    const worldDir = localDir.transformDirection(activeMesh.matrixWorld).normalize();
    uniformsRef.current.uProjectorDir.value.copy(worldDir);
    invalidate();
  }, [safeAngleLimit, isPassThrough, finalRotation, activeMesh, invalidate]);

  // biome-ignore lint/suspicious/noExplicitAny: Three.js onBeforeCompile shader type is version-dependent
  const customOnBeforeCompile = useCallback((shader: any) => {
    shader.uniforms.uProjectorDir = uniformsRef.current.uProjectorDir;
    shader.uniforms.uAngleLimit = uniformsRef.current.uAngleLimit;
    shader.uniforms.uPassThrough = uniformsRef.current.uPassThrough;

    shader.vertexShader = `
      varying vec3 vWorldNormalCustom;
      ${shader.vertexShader}
    `.replace(
      `#include <beginnormal_vertex>`,
      `#include <beginnormal_vertex>
       // Synchronized mathematically correct normal transform for non-uniform matrices
       vWorldNormalCustom = normalize(mat3(transpose(inverse(modelMatrix))) * objectNormal);
      `,
    );

    shader.fragmentShader = `
      uniform vec3 uProjectorDir;
      uniform float uAngleLimit;
      uniform float uPassThrough;
      varying vec3 vWorldNormalCustom;
      ${shader.fragmentShader}
    `.replace(
      `#include <alphatest_fragment>`,
      `#include <alphatest_fragment>
       float dotP = dot(normalize(vWorldNormalCustom), uProjectorDir);
       if (uPassThrough < 0.5) {
           if (dotP < uAngleLimit) {
               discard;
           }
       } else {
           if (abs(dotP) < uAngleLimit) {
               discard;
           }
       }
      `,
    );
  }, []);

  const getMaterialRef = useCallback((key: string) => {
    const existing = materialRefClosures.current.get(key);
    if (existing) return existing;

    let registeredMaterial: THREE.MeshStandardMaterial | null = null;

    const ref = (mat: THREE.MeshStandardMaterial | null) => {
      if (registeredMaterial) {
        materialsRef.current.delete(registeredMaterial);
        registeredMaterial = null;
      }

      if (mat) {
        registeredMaterial = mat;
        materialsRef.current.add(mat);
      }
    };

    materialRefClosures.current.set(key, ref);
    return ref;
  }, []);

  const scale = new THREE.Vector3(finalSx, finalSy, safeZDepth);
  const blendMode = getThreeBlending(decal.blendMode);

  if (!activeTextureRef.current) return null;

  const renderMaterial = (key: string) => (
    <meshStandardMaterial
      ref={getMaterialRef(key)}
      key={`mat-${isPassThrough ? 'pass' : 'clip'}-${key}`}
      map={activeTextureRef.current}
      transparent
      polygonOffset
      polygonOffsetFactor={-1 - index * 0.5}
      depthTest={true}
      depthWrite={false}
      roughness={0.7}
      metalness={0.0}
      blending={blendMode}
      onBeforeCompile={customOnBeforeCompile}
    />
  );

  return (
    <>
      {isPassThrough ? (
        targetMeshes.map((mesh, i) => (
          <Decal
            key={`decal-${decal.id}-${mesh.name}`}
            mesh={targetMeshRefs[i]}
            position={position}
            rotation={finalRotation}
            scale={scale}
            renderOrder={index + 1}
          >
            {renderMaterial(`pass-${mesh.name}`)}
          </Decal>
        ))
      ) : (
        <Decal
          mesh={activeMeshRef}
          position={position}
          rotation={finalRotation}
          scale={scale}
          renderOrder={index + 1}
        >
          {renderMaterial(`single-${activeMesh?.name}`)}
        </Decal>
      )}
    </>
  );
}

useGLTF.preload(tshirtManUrl);
useGLTF.preload(tshirtWomanUrl);
useGLTF.preload(tshirtoversizedUrl);
