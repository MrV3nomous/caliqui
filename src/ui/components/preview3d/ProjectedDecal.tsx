import { Decal, Html } from '@react-three/drei';
import { createPortal, type ThreeEvent, useThree } from '@react-three/fiber';
import { AlignCenter, CopyPlus, Crop, RotateCw, Trash2 } from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import {
  applyBlur,
  applyBucketFill,
  applyBurn,
  applyErase,
  applySaturate,
} from '@/shared/utils/brush-engine';
import { useEditorStore } from '@/ui/store/editor-store';
import { SmartHandle } from './SmartHandle';
import { claimEditorGesture, ownsEditorGesture, releaseEditorGesture } from './gestureCoordinator';
import type { DragState, InteractionMode, PointerCapturable } from './types';

const _raycaster = new THREE.Raycaster();
const _normalMatrix = new THREE.Matrix3();
const _worldNormal = new THREE.Vector3();
const _worldPos = new THREE.Vector3();
const _targetVec = new THREE.Vector3();
const _dummyWorld = new THREE.Object3D();
const _invParent = new THREE.Matrix4();
const _localMatrix = new THREE.Matrix4();
const _localPos = new THREE.Vector3();
const _localQuat = new THREE.Quaternion();
const _localScale = new THREE.Vector3();
const _localEuler = new THREE.Euler();

// Keep the contextual artwork toolbar within the visible canvas even when the
// selected decal is close to a viewport edge (desktop, tablet or mobile).
const calculateContextToolbarPosition = (
  object: THREE.Object3D,
  camera: THREE.Camera,
  size: { width: number; height: number },
): [number, number] => {
  const projected = object.getWorldPosition(new THREE.Vector3()).project(camera);
  const screenX = (projected.x * 0.5 + 0.5) * size.width;
  const screenY = (-projected.y * 0.5 + 0.5) * size.height;
  const horizontalPadding = Math.min(124, Math.max(76, size.width * 0.28));
  const verticalPadding = 38;
  return [
    THREE.MathUtils.clamp(screenX, horizontalPadding, Math.max(horizontalPadding, size.width - horizontalPadding)),
    THREE.MathUtils.clamp(screenY, verticalPadding, Math.max(verticalPadding, size.height - verticalPadding)),
  ];
};

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

export const ProjectedDecal = React.memo(function ProjectedDecal({
  id,
  targetMeshes,
  index,
}: {
  id: string;
  targetMeshes: THREE.Mesh[];
  index: number;
}) {
  const decal = useEditorStore(useCallback((s) => s.decals.find((d) => d.id === id), [id]));
  const isSelected = useEditorStore(useCallback((s) => s.selectedIds.includes(id), [id]));
  const isLocked = Boolean(decal?.locked);
  const isDragging = useEditorStore((s) => s.isDragging);

  // Reactive render states
  const globalToolMode = useEditorStore((s) => s.globalToolMode);
  const showMarqueeBox = useEditorStore((s) => s.showMarqueeBox);

  const [mode, setMode] = useState<InteractionMode>('idle');
  const [isEditingText, setIsEditingText] = useState(false);
  const dragPointerIdRef = useRef<number | null>(null);
  const dragMeshRef = useRef<THREE.Mesh | null>(null);
  const dragCaptureTargetRef = useRef<PointerCapturable | null>(null);
  const dragPlaneRef = useRef<THREE.Plane | null>(null);
  const [alignmentGuides, setAlignmentGuides] = useState({ x: false, y: false });

  // The previous Studio default created a very deep projector (0.8). Migrate
  // that untouched legacy depth; also tighten the angle only when it still has
  // the old default value, preserving user-customized projection settings.
  useEffect(() => {
    if (!decal) return;
    const legacyDepth = decal.zDepth === 0.8;
    if (legacyDepth) {
      useEditorStore.getState().updateDecal(decal.id, {
        zDepth: 0.12,
        ...(decal.angleLimit === 85 ? { angleLimit: 65 } : {}),
      });
    }
  }, [decal?.id, decal?.zDepth, decal?.angleLimit]);

  const lastUpdateRef = useRef<number>(0);
  const paintCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const paintCtxRef = useRef<CanvasRenderingContext2D | null>(null);
  const isPaintingRef = useRef(false);

  const textureRequestRef = useRef<number>(0);
  const textureRef = useRef<THREE.Texture | null>(null);

  // Symmetric material registration
  const materialsRef = useRef<Set<THREE.MeshStandardMaterial>>(new Set());
  const materialRefClosures = useRef(
    new Map<string, (mat: THREE.MeshStandardMaterial | null) => void>(),
  );

  const [, setTexVersion] = useState(0);

  const { gl } = useThree();

  const activeMesh = useMemo(() => {
    return (
      targetMeshes.find((m) => m.name === decal?.meshName) ||
      targetMeshes.find((m) => m.name.toLowerCase().includes('front')) ||
      targetMeshes[0]
    );
  }, [targetMeshes, decal?.meshName]);

  const activeMeshRef = useMemo(
    () => ({ current: activeMesh }) as React.RefObject<THREE.Mesh>,
    [activeMesh],
  );

  const targetMeshRefs = useMemo(() => {
    return targetMeshes.map((m) => ({ current: m }) as React.RefObject<THREE.Mesh>);
  }, [targetMeshes]);

  useEffect(() => {
    if (!isDragging && mode !== 'idle') {
      setMode('idle');
    }
  }, [isDragging, mode]);

  useEffect(() => () => {
    const pointerId = dragPointerIdRef.current;
    if (pointerId === null) return;
    const owner = isPaintingRef.current ? 'brush' : 'decal';
    const released = releaseEditorGesture(owner, pointerId);
    try { dragCaptureTargetRef.current?.releasePointerCapture?.(pointerId); } catch {}
    if (released) useEditorStore.getState().setIsDragging(false);
    dragPointerIdRef.current = null;
    dragCaptureTargetRef.current = null;
    dragMeshRef.current = null;
    dragPlaneRef.current = null;
  }, []);

  const dragState = useRef<DragState>({
    startMouseAngle: 0,
    startRotationOffset: 0,
    startMouseX: 0,
    startMouseY: 0,
    startScaleX: 0,
    startScaleY: 0,
    startDistance: 0,
  });

  const xAlignmentGeometry = useMemo(() => {
    const geometry = new THREE.BufferGeometry();
    geometry.setFromPoints([new THREE.Vector3(0, -0.95, 0), new THREE.Vector3(0, 0.95, 0)]);
    return geometry;
  }, []);
  const yAlignmentGeometry = useMemo(() => {
    const geometry = new THREE.BufferGeometry();
    geometry.setFromPoints([new THREE.Vector3(-0.95, 0, 0), new THREE.Vector3(0.95, 0, 0)]);
    return geometry;
  }, []);

  useEffect(() => () => {
    xAlignmentGeometry.dispose();
    yAlignmentGeometry.dispose();
  }, [xAlignmentGeometry, yAlignmentGeometry]);

  // Strict unmount ownership
  useEffect(() => {
    return () => {
      if (textureRef.current) {
        materialsRef.current.forEach((mat) => {
          if (mat.map === textureRef.current) {
            mat.map = null;
            mat.needsUpdate = true;
          }
        });
        textureRef.current.dispose();
        textureRef.current = null;
      }
    };
  }, []);

  const decalSrc = decal?.src || '';
  const decalType = decal?.type || 'image';

  useEffect(() => {
    const requestId = ++textureRequestRef.current;

    if (isPaintingRef.current || !decalSrc) return;

    let isCancelled = false;

    const displayImg = new Image();
    displayImg.crossOrigin = 'anonymous';
    displayImg.src = decalSrc;
    displayImg.onload = () => {
      if (isCancelled || requestId !== textureRequestRef.current) return;

      const newTex = new THREE.Texture(displayImg);
      newTex.colorSpace = THREE.SRGBColorSpace;
      newTex.anisotropy = Math.min(gl.capabilities.getMaxAnisotropy(), 2);
      newTex.generateMipmaps = false;
      newTex.minFilter = THREE.LinearFilter;
      newTex.magFilter = THREE.LinearFilter;
      newTex.wrapS = decal?.flipX ? THREE.RepeatWrapping : THREE.ClampToEdgeWrapping;
      newTex.wrapT = decal?.flipY ? THREE.RepeatWrapping : THREE.ClampToEdgeWrapping;
      newTex.repeat.set(decal?.flipX ? -1 : 1, decal?.flipY ? -1 : 1);
      newTex.offset.set(decal?.flipX ? 1 : 0, decal?.flipY ? 1 : 0);
      newTex.needsUpdate = true;

      // Unbind and dispose old texture before adopting the new one
      if (textureRef.current) {
        materialsRef.current.forEach((mat) => {
          if (mat.map === textureRef.current) {
            mat.map = null;
            mat.needsUpdate = true;
          }
        });
        textureRef.current.dispose();
      }

      // Assume ownership immediately
      textureRef.current = newTex;
      // Trigger lightweight render version
      setTexVersion((v) => v + 1);
    };

    if (
      decalType === 'image' ||
      decalType === 'drawing' ||
      decalType === 'text' ||
      decalType === 'shape'
    ) {
      const rawImg = new Image();
      rawImg.crossOrigin = 'anonymous';
      rawImg.src = decalSrc;
      rawImg.onload = () => {
        if (isCancelled || requestId !== textureRequestRef.current) return;
        const MAX_SIZE = 1024;
        let w = rawImg.naturalWidth || 512;
        let h = rawImg.naturalHeight || 512;

        if (w > MAX_SIZE || h > MAX_SIZE) {
          const aspect = Math.min(MAX_SIZE / w, MAX_SIZE / h);
          w = Math.floor(w * aspect);
          h = Math.floor(h * aspect);
        }

        if (!paintCanvasRef.current) {
          paintCanvasRef.current = document.createElement('canvas');
          paintCanvasRef.current.width = w;
          paintCanvasRef.current.height = h;
          paintCtxRef.current = paintCanvasRef.current.getContext('2d', {
            willReadFrequently: true,
          });
        } else {
          if (paintCanvasRef.current.width !== w) paintCanvasRef.current.width = w;
          if (paintCanvasRef.current.height !== h) paintCanvasRef.current.height = h;
        }

        if (paintCtxRef.current) {
          paintCtxRef.current.clearRect(0, 0, w, h);
          paintCtxRef.current.drawImage(rawImg, 0, 0, w, h);
        }
      };
    }

    return () => {
      isCancelled = true;
    };
  }, [decalSrc, decalType, decal?.flipX, decal?.flipY, gl.capabilities]);

  useEffect(() => {
    const texture = textureRef.current;
    if (!texture) return;
    texture.wrapS = decal?.flipX ? THREE.RepeatWrapping : THREE.ClampToEdgeWrapping;
    texture.wrapT = decal?.flipY ? THREE.RepeatWrapping : THREE.ClampToEdgeWrapping;
    texture.repeat.set(decal?.flipX ? -1 : 1, decal?.flipY ? -1 : 1);
    texture.offset.set(decal?.flipX ? 1 : 0, decal?.flipY ? 1 : 0);
    texture.needsUpdate = true;
  }, [decal?.flipX, decal?.flipY]);

  const aspectRatio = decal?.aspectRatio;
  const ratio =
    typeof aspectRatio === 'number' && Number.isFinite(aspectRatio)
      ? Math.max(0.0001, aspectRatio)
      : 1;
  let sx = decal?.scaleX ?? decal?.scale ?? 0.5;
  let sy = decal?.scaleY ?? decal?.scale ?? 0.5;

  if (decal?.scaleX === undefined && decal?.scaleY === undefined && decal?.scale) {
    if (ratio > 1) {
      sx = decal.scale * ratio;
      sy = decal.scale;
    } else if (ratio < 1) {
      sx = decal.scale;
      sy = decal.scale / ratio;
    } else {
      sx = decal.scale;
      sy = decal.scale;
    }
  }

  sx = Number.isFinite(sx) && sx > 0 ? sx : 0.5;
  sy = Number.isFinite(sy) && sy > 0 ? sy : 0.5;

  const isPassThrough = decal?.placementMode === 'pass-through';

  const safeZDepth = Number.isFinite(Number(decal?.zDepth))
    ? Math.min(Math.max(Number(decal?.zDepth), 0.01), 15)
    : 0.12;

  const safeAngleLimit = Number.isFinite(Number(decal?.angleLimit))
    ? (Math.max(10, Math.min(90, Number(decal?.angleLimit))) * Math.PI) / 180
    : (65 * Math.PI) / 180;

  const MIN_UI_SIZE = 0.35;
  const uiSx = Math.max(Math.abs(sx || MIN_UI_SIZE), MIN_UI_SIZE);
  const uiSy = Math.max(Math.abs(sy || MIN_UI_SIZE), MIN_UI_SIZE);
  const uiHsX = uiSx / 2;
  const uiHsY = uiSy / 2;

  const { borderGeo } = useMemo(() => {
    const plane = new THREE.PlaneGeometry(1, 1);
    const edges = new THREE.EdgesGeometry(plane);
    plane.dispose();
    return { borderGeo: edges };
  }, []);

  useEffect(() => {
    return () => {
      borderGeo.dispose();
    };
  }, [borderGeo]);

  const rawRotation = decal?.rotation || [0, 0, 0];
  const rawOffset = decal?.rotationOffset || 0;

  const finalRotation = useMemo(() => {
    const dummy = new THREE.Object3D();
    dummy.rotation.set(
      Number.isFinite(rawRotation[0]) ? rawRotation[0] : 0,
      Number.isFinite(rawRotation[1]) ? rawRotation[1] : 0,
      Number.isFinite(rawRotation[2]) ? rawRotation[2] : 0,
    );
    if (rawOffset && Number.isFinite(rawOffset)) {
      dummy.rotateZ(rawOffset);
    }
    return [dummy.rotation.x, dummy.rotation.y, dummy.rotation.z] as [number, number, number];
  }, [rawRotation, rawOffset]);

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
  }, [safeAngleLimit, isPassThrough, finalRotation, activeMesh]);

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

  const handleTextSubmit = (val: string) => {
    if (val.trim() && decal) useEditorStore.getState().updateText(decal.id, val);
    setIsEditingText(false);
  };

  const handlePaint = (e: ThreeEvent<PointerEvent>) => {
    if (!paintCtxRef.current || !paintCanvasRef.current || !decal || !textureRef.current) return;

    const { brushSettings } = useEditorStore.getState();
    const w = paintCanvasRef.current.width;
    const h = paintCanvasRef.current.height;

    const localPoint = e.object.worldToLocal(e.point.clone());
    const scaleFactorX = e.object.scale.x / sx;
    const scaleFactorY = e.object.scale.y / sy;
    const normalizedX = localPoint.x * scaleFactorX;
    const normalizedY = localPoint.y * scaleFactorY;

    const x = (normalizedX + 0.5) * w;
    const y = (-normalizedY + 0.5) * h;

    const ctx = paintCtxRef.current;
    const size = brushSettings.size;
    const intensity = brushSettings.intensity / 100;

    if (globalToolMode === 'blur')
      applyBlur(ctx, x, y, size, Math.max(1, Math.floor(brushSettings.intensity / 10)));
    else if (globalToolMode === 'burn') applyBurn(ctx, x, y, size, intensity);
    else if (globalToolMode === 'saturate') applySaturate(ctx, x, y, size, intensity);
    else if (globalToolMode === 'fill')
      applyBucketFill(ctx, x, y, brushSettings.color || decal.fill || '#3B82F6');
    else if (globalToolMode === 'erase') applyErase(ctx, x, y, size, intensity);

    textureRef.current.image = paintCanvasRef.current;
    textureRef.current.needsUpdate = true;
  };

  if (!decal || decal.placementMode === 'wrap') return null;

  const cameraDirectionForDrag = (
    hit: THREE.Intersection | undefined,
    mesh: THREE.Mesh,
    rotation: [number, number, number],
  ) => {
    const normalMatrix = new THREE.Matrix3().getNormalMatrix(mesh.matrixWorld);
    if (hit?.face?.normal) {
      return hit.face.normal.clone().applyMatrix3(normalMatrix).normalize();
    }
    const localNormal = new THREE.Vector3(0, 0, 1).applyEuler(
      new THREE.Euler(rotation[0], rotation[1], rotation[2]),
    );
    return localNormal.applyMatrix3(normalMatrix).normalize();
  };

  // Each pointer has exactly one owner. Unrelated pointer-up/cancel events must
  // never terminate a drag or unlock OrbitControls owned by another component.
  const finishPointerInteraction = (e: ThreeEvent<PointerEvent>) => {
    if (dragPointerIdRef.current !== e.pointerId || !ownsEditorGesture(isPaintingRef.current ? 'brush' : 'decal', e.pointerId)) return;
    e.stopPropagation();
    const store = useEditorStore.getState();
    const wasPainting = isPaintingRef.current;

    if (wasPainting) {
      isPaintingRef.current = false;
      if (paintCanvasRef.current) {
        const dataUrl = paintCanvasRef.current.toDataURL('image/png');
        const newType = decal.type === 'text' || decal.type === 'shape' ? 'drawing' : decal.type;
        store.updateDecal(decal.id, { src: dataUrl, originalSrc: dataUrl, type: newType });
      }
    } else {
      setAlignmentGuides({ x: false, y: false });
      setMode('idle');
    }

    dragPointerIdRef.current = null;
    dragMeshRef.current = null;
    dragPlaneRef.current = null;
    store.setIsDragging(false);
    releaseEditorGesture(wasPainting ? 'brush' : 'decal', e.pointerId);
    document.body.style.cursor = globalToolMode === 'camera' ? 'grab' : 'default';

    const target = dragCaptureTargetRef.current;
    dragCaptureTargetRef.current = null;
    if (target && typeof target.releasePointerCapture === 'function') {
      try { target.releasePointerCapture(e.pointerId); } catch {}
    }
  };

  const blendMode = getThreeBlending(decal.blendMode);

  const renderMaterial = (key: string) => (
    <meshStandardMaterial
      ref={getMaterialRef(key)}
      key={`mat-${isPassThrough ? 'pass' : 'clip'}-${key}`}
      map={textureRef.current}
      transparent
      blending={blendMode}
      opacity={isEditingText ? 0 : 1}
      polygonOffset
      polygonOffsetFactor={-1 - index * 0.5}
      depthTest={true}
      depthWrite={false}
      roughness={0.7}
      metalness={0.0}
      color={new THREE.Color(0xffffff)}
      onBeforeCompile={customOnBeforeCompile}
    />
  );

  return (
    <>
      {textureRef.current &&
        (isPassThrough
          ? targetMeshes.map((mesh, i) =>
              createPortal(
                <Decal
                  key={`decal-${decal.id}-${mesh.name}`}
                  mesh={targetMeshRefs[i]}
                  position={decal.position}
                  rotation={finalRotation}
                  scale={[sx, sy, safeZDepth]}
                  raycast={() => null}
                  renderOrder={index + 1}
                  castShadow={false}
                  receiveShadow={false}
                >
                  {renderMaterial(`pass-${mesh.name}`)}
                </Decal>,
                mesh,
              ),
            )
          : createPortal(
              <Decal
                mesh={activeMeshRef}
                position={decal.position}
                rotation={finalRotation}
                scale={[sx, sy, safeZDepth]}
                raycast={() => null}
                renderOrder={index + 1}
                castShadow={false}
                receiveShadow={false}
              >
                {renderMaterial(`single-${activeMesh?.name}`)}
              </Decal>,
              activeMesh,
            ))}

      {alignmentGuides.x && createPortal(
        <lineSegments position={[decal.position[0], 0, decal.position[2] + 0.07]} geometry={xAlignmentGeometry}>
          <lineBasicMaterial color="#778b9a" transparent opacity={0.9} depthTest={false} />
        </lineSegments>,
        activeMesh,
      )}
      {alignmentGuides.y && createPortal(
        <lineSegments position={[0, decal.position[1], decal.position[2] + 0.07]} geometry={yAlignmentGeometry}>
          <lineBasicMaterial color="#778b9a" transparent opacity={0.9} depthTest={false} />
        </lineSegments>,
        activeMesh,
      )}
      {createPortal(
        <group position={decal.position} rotation={finalRotation}>
          <group position={[0, 0, 0]}>
            {isEditingText && decal.type === 'text' && (
              <Html center zIndexRange={[100, 0]} position={[0, 0, -0.05]}>
                <div className="bg-white/95 p-2 rounded-lg shadow-2xl border studio-selection-outline backdrop-blur-xl flex items-center justify-center min-w-50 pointer-events-auto">
                  <textarea
                    ref={(el) => el?.focus()}
                    defaultValue={decal.text}
                    onBlur={(e) => handleTextSubmit(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Escape') setIsEditingText(false);
                    }}
                    className="w-full text-center font-bold bg-transparent outline-none text-neutral-800 resize-none"
                    style={{ fontSize: '24px', minHeight: '80px', overflow: 'hidden' }}
                    rows={Math.max(3, decal.text?.split('\n').length || 1)}
                  />
                </div>
              </Html>
            )}

            {/* biome-ignore lint/a11y/noStaticElementInteractions: WebGL mesh interaction map */}
            <mesh
              userData={{ isDecalHitbox: true, decalId: decal.id }}
              // Use a shallow 3D hit volume rather than a coplanar plane. Garment
              // panels are curved, so a thin plane can sit behind the shirt surface;
              // the shirt then wins raycasting and steals the drag from this decal.
              // Keep the interaction volume just ahead of the curved fabric so
              // the shirt mesh cannot win the raycast over the visible selection.
              position={[0, 0, 0.055 + index * 0.0005]}
              scale={isSelected ? [uiSx * 1.02, uiSy * 1.02, 1] : [uiSx, uiSy, 1]}
              castShadow={false}
              receiveShadow={false}
              onContextMenu={(e: ThreeEvent<MouseEvent>) => {
                if (globalToolMode === 'camera' || isLocked) return;
                if (e.nativeEvent && typeof e.nativeEvent.preventDefault === 'function') {
                  e.nativeEvent.preventDefault();
                }

                if (
                  isEditingText ||
                  (!useEditorStore.getState().autoSelect && !isSelected) ||
                  globalToolMode !== 'default'
                )
                  return;
                e.stopPropagation();

                const store = useEditorStore.getState();
                if (!store.selectedIds.includes(decal.id)) store.setSelectedId(decal.id, false);
                store.setContextMenu({
                  x: e.nativeEvent.clientX,
                  y: e.nativeEvent.clientY,
                  decalId: decal.id,
                });
              }}
              onDoubleClick={(e: ThreeEvent<PointerEvent>) => {
                if (globalToolMode === 'camera' || isLocked) return;
                if (
                  (!useEditorStore.getState().autoSelect && !isSelected) ||
                  globalToolMode !== 'default'
                )
                  return;
                e.stopPropagation();

                const store = useEditorStore.getState();
                if (decal.type === 'text') {
                  setIsEditingText(true);
                  setMode('idle');
                  store.setIsDragging(false);
                } else if (decal.type === 'drawing') {
                  store.setEditingDrawingId(decal.id);
                  store.setDrawingMode(true);
                  setMode('idle');
                  store.setIsDragging(false);
                }
              }}
              onPointerDown={(e: ThreeEvent<PointerEvent>) => {
                if (globalToolMode === 'camera' || isEditingText || isLocked) return;
                if (e.button === 2 || e.button !== 0) return;

                const store = useEditorStore.getState();
                const isBrushActive = ['fill', 'blur', 'burn', 'saturate', 'erase'].includes(globalToolMode);

                // With Auto-Select disabled, an unselected decal is not interactive;
                // let the event bubble so the garment camera can own the gesture.
                if (!isBrushActive && !store.autoSelect && !isSelected) return;

                const owner = isBrushActive ? 'brush' : 'decal';
                if (!claimEditorGesture(owner, e.pointerId)) return;
                e.stopPropagation();

                const target = e.target as unknown as PointerCapturable;
                dragCaptureTargetRef.current = target || null;
                dragPointerIdRef.current = e.pointerId;
                if (target && typeof target.setPointerCapture === 'function') {
                  try { target.setPointerCapture(e.pointerId); } catch {}
                }

                if (isBrushActive) {
                  store.saveHistory();
                  if (!store.selectedIds.includes(decal.id)) store.setSelectedId(decal.id, false);
                  isPaintingRef.current = true;
                  document.body.style.cursor = 'crosshair';
                  store.setIsDragging(true);
                  handlePaint(e);
                  return;
                }

                if (showMarqueeBox) {
                  store.setShowMarqueeBox(false);
                  store.setMarqueeStart(null);
                  store.setMarqueeEnd(null);
                }

                store.saveHistory();
                store.setSelectedId(decal.id, e.shiftKey || e.ctrlKey || e.metaKey);
                // Capture the actual shirt mesh hit at pointer-down when available.
                // decal.meshName can be stale after model changes or legacy saves.
                const startMesh = e.intersections
                  .map((hit) => hit.object as THREE.Mesh)
                  .find((object) => targetMeshes.includes(object))
                  || targetMeshes.find((mesh) => mesh.name === decal.meshName)
                  || activeMesh
                  || null;
                dragMeshRef.current = startMesh;

                if (startMesh) {
                  startMesh.updateMatrixWorld(true);
                  const garmentHit = e.intersections.find((hit) => hit.object === startMesh);
                  const planePoint = garmentHit?.point.clone() || new THREE.Vector3(...decal.position).applyMatrix4(startMesh.matrixWorld);
                  const planeNormal = cameraDirectionForDrag(garmentHit, startMesh, finalRotation);
                  dragPlaneRef.current = new THREE.Plane().setFromNormalAndCoplanarPoint(planeNormal, planePoint);
                }

                setAlignmentGuides({ x: false, y: false });
                setMode('drag');
                store.setIsDragging(true);
                document.body.style.cursor = 'grabbing';
              }}
              onPointerMove={(e: ThreeEvent<PointerEvent>) => {
                const ownsBrush = ownsEditorGesture('brush', e.pointerId);
                const ownsDecal = ownsEditorGesture('decal', e.pointerId);
                if (!ownsBrush && !ownsDecal) return;
                e.stopPropagation();

                const isBrushActive = ['fill', 'blur', 'burn', 'saturate', 'erase'].includes(
                  globalToolMode,
                );

                if (isBrushActive && isPaintingRef.current && ownsBrush && dragPointerIdRef.current === e.pointerId) {
                  if (globalToolMode === 'fill') return;
                  handlePaint(e);
                  return;
                }

                // Gesture ownership is stored in a ref so a rapid first move is not
                // lost while React is still committing the selected/dragging state.
                if (ownsDecal && dragPointerIdRef.current === e.pointerId && !isEditingText) {
                  const now = performance.now();
                  if (now - lastUpdateRef.current < 16) return;
                  lastUpdateRef.current = now;

                  _raycaster.ray.copy(e.ray);
                  // Keep a drag on the garment panel where it started. Raycasting every
                  // panel can pick the opposite side through the fabric and make the
                  // artwork appear to jump or float as the camera moves.
                  const dragMesh = dragMeshRef.current;
                  if (!dragMesh) return;
                  dragMesh.updateMatrixWorld(true);
                  const hits = _raycaster.intersectObject(dragMesh, false);
                  let hitMesh: THREE.Mesh = dragMesh;
                  let hasSurfaceHit = hits.length > 0;

                  if (hasSurfaceHit) {
                    const hit = hits[0];
                    hitMesh = hit.object as THREE.Mesh;
                    _worldPos.copy(hit.point);
                    _normalMatrix.getNormalMatrix(hitMesh.matrixWorld);
                    if (hit.face?.normal) {
                      _worldNormal.copy(hit.face.normal).applyMatrix3(_normalMatrix).normalize();
                    } else {
                      _worldNormal.set(0, 0, 1).applyQuaternion(hitMesh.getWorldQuaternion(new THREE.Quaternion())).normalize();
                    }
                  } else {
                    // Curved fabric can briefly miss the ray at panel edges or seams.
                    // Continue on the original drag plane instead of freezing or
                    // switching to a different shirt panel.
                    const dragPlane = dragPlaneRef.current;
                    if (!dragPlane || !e.ray.intersectPlane(dragPlane, _worldPos)) return;
                    _worldNormal.copy(dragPlane.normal).normalize();
                  }

                  {

                    _dummyWorld.position.copy(_worldPos);
                    if (Math.abs(_worldNormal.y) > 0.999) {
                      _dummyWorld.up.set(0, 0, 1);
                    } else {
                      _dummyWorld.up.set(0, 1, 0);
                    }
                    _targetVec.copy(_worldPos).add(_worldNormal);
                    _dummyWorld.lookAt(_targetVec);
                    _dummyWorld.updateMatrix();

                    _invParent.copy(hitMesh.matrixWorld).invert();
                    _localMatrix.multiplyMatrices(_invParent, _dummyWorld.matrix);
                    _localMatrix.decompose(_localPos, _localQuat, _localScale);
                    _localEuler.setFromQuaternion(_localQuat);

                    const store = useEditorStore.getState();
                    const currentDraggedDecal = store.decals.find((d) => d.id === decal.id);
                    if (!currentDraggedDecal) return;
                    const snapTargets = store.decals.filter(
                      (d) => d.id !== decal.id && d.visible !== false && !store.selectedIds.includes(d.id) && !(decal.groupId && d.groupId === decal.groupId),
                    );
                    const snapThreshold = e.altKey ? 0 : 0.025;
                    let snappedX = _localPos.x;
                    let snappedY = _localPos.y;
                    let snappedXGuide = false;
                    let snappedYGuide = false;
                    const nearest = (value: number, candidates: number[]) => {
                      let best = value;
                      let distance = snapThreshold;
                      let snapped = false;
                      candidates.forEach((candidate) => {
                        const nextDistance = Math.abs(candidate - value);
                        if (nextDistance <= distance) {
                          best = candidate;
                          distance = nextDistance;
                          snapped = true;
                        }
                      });
                      return { value: best, snapped };
                    };
                    if (snapThreshold > 0) {
                      const halfW = Math.max(0.01, sx / 2);
                      const halfH = Math.max(0.01, sy / 2);
                      const xCandidates = [0];
                      const yCandidates = [0];
                      snapTargets.forEach((other) => {
                        if (other.meshName && other.meshName !== hitMesh.name) return;
                        if (other.meshSide && other.meshSide !== hitMesh.userData?.panelSide) return;
                        const otherRatio = Math.max(0.0001, other.aspectRatio || 1);
                        const otherScale = Math.max(0.01, other.scale || 0.2);
                        const otherW = Math.max(0.01, (other.scaleX ?? otherScale) * (other.scaleX === undefined && other.scaleY === undefined && otherRatio > 1 ? otherRatio : 1));
                        const otherH = Math.max(0.01, (other.scaleY ?? otherScale) * (other.scaleX === undefined && other.scaleY === undefined && otherRatio < 1 ? 1 / otherRatio : 1));
                        xCandidates.push(other.position[0], other.position[0] - (otherW / 2 + halfW), other.position[0] + (otherW / 2 + halfW));
                        yCandidates.push(other.position[1], other.position[1] - (otherH / 2 + halfH), other.position[1] + (otherH / 2 + halfH));
                      });
                      const nextX = nearest(snappedX, xCandidates);
                      const nextY = nearest(snappedY, yCandidates);
                      snappedXGuide = nextX.snapped;
                      snappedYGuide = nextY.snapped;
                      snappedX = nextX.value;
                      snappedY = nextY.value;
                    }
                    setAlignmentGuides({ x: snappedXGuide, y: snappedYGuide });
                    const deltaX = snappedX - currentDraggedDecal.position[0];
                    const deltaY = snappedY - currentDraggedDecal.position[1];
                    const deltaZ = _localPos.z - currentDraggedDecal.position[2];

                    store.decals.forEach((d) => {
                      if (d.id === decal.id) {
                        store.updateDecal(d.id, {
                          meshName: hitMesh.name,
                          meshSide: hitMesh.userData?.panelSide === 'back' ? 'back' : 'front',
                          position: [snappedX, snappedY, _localPos.z],
                          // Re-orient the projector to the local garment normal as it
                          // travels over curved panels. Keep rotationOffset as the
                          // user's in-plane rotation, so artwork stays upright without
                          // stretching across oblique side surfaces.
                          rotation: [_localEuler.x, _localEuler.y, _localEuler.z],
                        });
                      } else if (
                        store.selectedIds.includes(d.id) ||
                        (decal.groupId && d.groupId === decal.groupId)
                      ) {
                        store.updateDecal(d.id, {
                          position: [
                            d.position[0] + deltaX,
                            d.position[1] + deltaY,
                            d.position[2] + deltaZ,
                          ],
                        });
                      }
                    });
                  }
                }
              }}
              onPointerUp={finishPointerInteraction}
              onPointerCancel={finishPointerInteraction}
              onLostPointerCapture={finishPointerInteraction}
              onPointerOver={(e: ThreeEvent<PointerEvent>) => {
                if (globalToolMode === 'camera') return;
                e.stopPropagation();
                if (globalToolMode !== 'default' && globalToolMode !== 'select') {
                  document.body.style.cursor = 'crosshair';
                } else if (mode === 'idle' && !isEditingText) {
                  document.body.style.cursor = isLocked ? 'not-allowed' : 'grab';
                }
              }}
              onPointerOut={(e: ThreeEvent<PointerEvent>) => {
                if (globalToolMode === 'camera') return;
                e.stopPropagation();
                if (mode === 'idle' && globalToolMode === 'default') {
                  document.body.style.cursor = 'default';
                }
              }}
            >
              <boxGeometry args={[1, 1, 0.03]} />
              <meshBasicMaterial side={THREE.DoubleSide} transparent opacity={0} depthTest={false} depthWrite={false} colorWrite={false} />
            </mesh>

            {isSelected && !isLocked && !isEditingText && globalToolMode === 'default' && !showMarqueeBox && (
              <group position={[0, 0, 0.04 + index * 0.0005]}>
                <lineSegments
                  geometry={borderGeo}
                  scale={[uiSx, uiSy, 1]}
                  renderOrder={998}
                  castShadow={false}
                  receiveShadow={false}
                >
                  <lineBasicMaterial color="#778b9a" depthTest={false} transparent opacity={1} />
                </lineSegments>

                <SmartHandle
                  primaryMesh={activeMesh}
                  position={[-uiHsX, uiHsY, 0]}
                  scaleCursor="nwse-resize"
                  dirX={-1}
                  dirY={1}
                  isCorner={true}
                  decal={decal}
                  mode={mode}
                  setMode={setMode}
                  dragState={dragState}
                />
                <SmartHandle
                  primaryMesh={activeMesh}
                  position={[uiHsX, uiHsY, 0]}
                  scaleCursor="nesw-resize"
                  dirX={1}
                  dirY={1}
                  isCorner={true}
                  decal={decal}
                  mode={mode}
                  setMode={setMode}
                  dragState={dragState}
                />
                <SmartHandle
                  primaryMesh={activeMesh}
                  position={[-uiHsX, -uiHsY, 0]}
                  scaleCursor="nesw-resize"
                  dirX={-1}
                  dirY={-1}
                  isCorner={true}
                  decal={decal}
                  mode={mode}
                  setMode={setMode}
                  dragState={dragState}
                />
                <SmartHandle
                  primaryMesh={activeMesh}
                  position={[uiHsX, -uiHsY, 0]}
                  scaleCursor="nwse-resize"
                  dirX={1}
                  dirY={-1}
                  isCorner={true}
                  decal={decal}
                  mode={mode}
                  setMode={setMode}
                  dragState={dragState}
                />

                <SmartHandle
                  primaryMesh={activeMesh}
                  position={[0, uiHsY, 0]}
                  scaleCursor="ns-resize"
                  dirX={0}
                  dirY={1}
                  isCorner={false}
                  decal={decal}
                  mode={mode}
                  setMode={setMode}
                  dragState={dragState}
                />
                <SmartHandle
                  primaryMesh={activeMesh}
                  position={[0, -uiHsY, 0]}
                  scaleCursor="ns-resize"
                  dirX={0}
                  dirY={-1}
                  isCorner={false}
                  decal={decal}
                  mode={mode}
                  setMode={setMode}
                  dragState={dragState}
                />
                <SmartHandle
                  primaryMesh={activeMesh}
                  position={[uiHsX, 0, 0]}
                  scaleCursor="ew-resize"
                  dirX={1}
                  dirY={0}
                  isCorner={false}
                  decal={decal}
                  mode={mode}
                  setMode={setMode}
                  dragState={dragState}
                />
                <SmartHandle
                  primaryMesh={activeMesh}
                  position={[-uiHsX, 0, 0]}
                  scaleCursor="ew-resize"
                  dirX={-1}
                  dirY={0}
                  isCorner={false}
                  decal={decal}
                  mode={mode}
                  setMode={setMode}
                  dragState={dragState}
                />

                {mode === 'idle' && (
                  <Html
                    position={[Math.max(uiHsX + 0.05, 0.2), Math.max(uiHsY + 0.05, 0.2), 0]}
                    calculatePosition={calculateContextToolbarPosition}
                    center
                    zIndexRange={[100, 0]}
                  >
                    <div className="flex max-w-[calc(100vw-16px)] flex-wrap gap-0.5 bg-white/95 backdrop-blur shadow-lg rounded-xl p-1 border studio-selection-outline pointer-events-auto animate-in fade-in duration-200">
                      {(decal.type === 'image' || decal.type === 'drawing') && (
                        <>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              useEditorStore.getState().setCroppingDecalId(decal.id);
                            }}
                            className="p-2 hover:bg-neutral-100 rounded-lg text-neutral-600 transition-colors"
                            title="Crop Image"
                          >
                            <Crop size={18} />
                          </button>
                          <div className="w-px bg-neutral-200 my-1 mx-1" />
                        </>
                      )}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          const store = useEditorStore.getState();
                          store.setSelectedId(decal.id, false);
                          store.duplicate();
                        }}
                        className="p-1.5 hover:bg-neutral-100 rounded-lg text-neutral-600 transition-colors"
                        title="Duplicate artwork"
                        aria-label="Duplicate artwork"
                      >
                        <CopyPlus size={15} />
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          const store = useEditorStore.getState();
                          store.saveHistory();
                          store.updateDecal(decal.id, { position: [0, 0, decal.position[2]] });
                        }}
                        className="p-1.5 hover:bg-neutral-100 rounded-lg text-neutral-600 transition-colors"
                        title="Centre on garment"
                        aria-label="Centre artwork on garment"
                      >
                        <AlignCenter size={15} />
                      </button>
                      <div className="w-px bg-neutral-200 my-1 mx-0.5" />
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          const store = useEditorStore.getState();
                          store.saveHistory();
                          store.updateDecal(decal.id, {
                            rotationOffset: (decal.rotationOffset || 0) + Math.PI / 2,
                          });
                        }}
                        className="p-2 hover:bg-neutral-100 rounded-lg text-neutral-600 transition-colors"
                        title="Rotate 90°"
                      >
                        <RotateCw size={18} />
                      </button>
                      <div className="w-px bg-neutral-200 my-1 mx-1" />
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          useEditorStore.getState().removeDecal(decal.id);
                        }}
                        className="p-2 hover:bg-red-50 text-red-500 rounded-lg transition-colors"
                        title="Delete"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </Html>
                )}
              </group>
            )}
          </group>
        </group>,
        activeMesh,
      )}
    </>
  );
});
