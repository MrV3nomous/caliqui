import { Decal, Html } from '@react-three/drei';
import { createPortal, type ThreeEvent, useThree } from '@react-three/fiber';
import { RotateCw, Trash2 } from 'lucide-react';
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
  const isDragging = useEditorStore((s) => s.isDragging);

  const [mode, setMode] = useState<InteractionMode>('idle');
  const [isEditingText, setIsEditingText] = useState(false);

  const lastUpdateRef = useRef<number>(0);
  const paintCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const paintCtxRef = useRef<CanvasRenderingContext2D | null>(null);
  const isPaintingRef = useRef(false);

  const { gl } = useThree();

  // FIX 1: Synchronously enable clipping so the material compiles perfectly on Frame 1
  if (!gl.localClippingEnabled) {
    gl.localClippingEnabled = true;
  }

  const activeMesh = useMemo(() => {
    return (
      targetMeshes.find((m) => m.name === decal?.meshName) ||
      targetMeshes.find((m) => m.name.toLowerCase().includes('front')) ||
      targetMeshes[0]
    );
  }, [targetMeshes, decal?.meshName]);

  useEffect(() => {
    if (!isDragging && mode !== 'idle') {
      setMode('idle');
    }
  }, [isDragging, mode]);

  const dragState = useRef<DragState>({
    startMouseAngle: 0,
    startRotationOffset: 0,
    startMouseX: 0,
    startMouseY: 0,
    startScaleX: 0,
    startScaleY: 0,
    startDistance: 0,
  });

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

  const decalSrc = decal?.src || '';
  const decalType = decal?.type || 'image';

  useEffect(() => {
    if (isPaintingRef.current || !decalSrc) return;

    const displayImg = new Image();
    displayImg.crossOrigin = 'anonymous';
    displayImg.src = decalSrc;
    displayImg.onload = () => {
      setTexture((prevTexture) => {
        const newTex = new THREE.Texture(displayImg);
        newTex.colorSpace = THREE.SRGBColorSpace;
        newTex.anisotropy = 2;
        newTex.generateMipmaps = false;
        newTex.minFilter = THREE.LinearFilter;
        newTex.magFilter = THREE.LinearFilter;
        newTex.wrapS = THREE.ClampToEdgeWrapping;
        newTex.wrapT = THREE.ClampToEdgeWrapping;
        newTex.needsUpdate = true;

        prevTexture.dispose();
        return newTex;
      });
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
  }, [decalSrc, decalType]);

  const ratio = decal?.aspectRatio || 1;
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

  sx = Number.isNaN(sx) ? 0.5 : sx;
  sy = Number.isNaN(sy) ? 0.5 : sy;

  const isPassThrough = decal?.placementMode === 'pass-through';
  const isFront = decal?.position ? decal.position[2] >= 0 : true;

  // FIX 2: Added a 0.01 tolerance buffer to completely eliminate mathematically perfect Z-fighting
  const clipPlane = useMemo(() => {
    if (isPassThrough) return null;
    return new THREE.Plane(new THREE.Vector3(0, 0, isFront ? 1 : -1), 0.01);
  }, [isPassThrough, isFront]);

  const safeZDepth = Number.isNaN(Number(decal?.zDepth))
    ? 0.15
    : Math.max(Number(decal?.zDepth), 0.01);

  const MIN_UI_SIZE = 0.15;
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
      Number.isNaN(rawRotation[0]) ? 0 : rawRotation[0],
      Number.isNaN(rawRotation[1]) ? 0 : rawRotation[1],
      Number.isNaN(rawRotation[2]) ? 0 : rawRotation[2],
    );
    if (rawOffset) dummy.rotateZ(rawOffset);
    return [dummy.rotation.x, dummy.rotation.y, dummy.rotation.z] as [number, number, number];
  }, [rawRotation, rawOffset]);

  const handleTextSubmit = (val: string) => {
    if (val.trim() && decal) useEditorStore.getState().updateText(decal.id, val);
    setIsEditingText(false);
  };

  const handlePaint = (e: ThreeEvent<PointerEvent>) => {
    if (!paintCtxRef.current || !paintCanvasRef.current || !decal) return;

    const { globalToolMode, brushSettings } = useEditorStore.getState();
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

    texture.image = paintCanvasRef.current;
    texture.needsUpdate = true;
  };

  if (!decal || decal.placementMode === 'wrap') return null;

  const blendMode = getThreeBlending(decal.blendMode);

  // FIX 3: Dynamic key forces R3F to safely remount the material when switching modes, stopping invisible state lock
  const renderMaterial = () => (
    <meshStandardMaterial
      key={`mat-${isPassThrough ? 'pass' : 'clip'}-${isFront ? 'front' : 'back'}`}
      map={texture}
      transparent
      blending={blendMode}
      opacity={isEditingText ? 0 : 1}
      polygonOffset
      polygonOffsetFactor={-1 - index * 0.5}
      depthTest={true}
      depthWrite={false}
      roughness={0.7}
      metalness={0.0}
      color={isSelected && !isEditingText ? new THREE.Color(0xddddff) : new THREE.Color(0xffffff)}
      clippingPlanes={clipPlane ? [clipPlane] : []}
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
                position={decal.position}
                rotation={finalRotation}
                scale={[sx, sy, safeZDepth]}
                raycast={() => null}
                renderOrder={index + 1}
                castShadow={false}
                receiveShadow={false}
              >
                {renderMaterial()}
              </Decal>,
              mesh,
            ),
          )
        : createPortal(
            <Decal
              mesh={{ current: activeMesh } as React.RefObject<THREE.Mesh>}
              position={decal.position}
              rotation={finalRotation}
              scale={[sx, sy, safeZDepth]}
              raycast={() => null}
              renderOrder={index + 1}
              castShadow={false}
              receiveShadow={false}
            >
              {renderMaterial()}
            </Decal>,
            activeMesh,
          )}

      {createPortal(
        <group position={decal.position} rotation={finalRotation}>
          <group position={[0, 0, 0]}>
            {isEditingText && decal.type === 'text' && (
              <Html center zIndexRange={[100, 0]} position={[0, 0, -0.05]}>
                <div className="bg-white/95 p-2 rounded-lg shadow-2xl border border-blue-500/50 backdrop-blur-xl flex items-center justify-center min-w-50 pointer-events-auto">
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
              userData={{ isDecalHitbox: true }}
              position={[0, 0, index * 0.002]}
              scale={isSelected ? [uiSx * 1.05, uiSy * 1.05, 1] : [uiSx, uiSy, 1]}
              castShadow={false}
              receiveShadow={false}
              onContextMenu={(e: ThreeEvent<MouseEvent>) => {
                const store = useEditorStore.getState();
                if (store.globalToolMode === 'camera') return;
                if (e.nativeEvent && typeof e.nativeEvent.preventDefault === 'function') {
                  e.nativeEvent.preventDefault();
                }

                if (
                  isEditingText ||
                  (!store.autoSelect && !isSelected) ||
                  store.globalToolMode !== 'default'
                )
                  return;
                e.stopPropagation();

                if (!store.selectedIds.includes(decal.id)) store.setSelectedId(decal.id, false);
                store.setContextMenu({
                  x: e.nativeEvent.clientX,
                  y: e.nativeEvent.clientY,
                  decalId: decal.id,
                });
              }}
              onDoubleClick={(e: ThreeEvent<PointerEvent>) => {
                const store = useEditorStore.getState();
                if (store.globalToolMode === 'camera') return;
                if ((!store.autoSelect && !isSelected) || store.globalToolMode !== 'default')
                  return;
                e.stopPropagation();

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
                const store = useEditorStore.getState();
                if (store.globalToolMode === 'camera') return;
                if (isEditingText) return;
                e.stopPropagation();
                if (e.button === 2) return;

                const isBrushActive = ['fill', 'blur', 'burn', 'saturate', 'erase'].includes(
                  store.globalToolMode,
                );

                if (isBrushActive) {
                  store.saveHistory();
                  if (!store.selectedIds.includes(decal.id)) store.setSelectedId(decal.id, false);
                  isPaintingRef.current = true;
                  document.body.style.cursor = 'crosshair';
                  store.setIsDragging(true);

                  handlePaint(e);

                  const target = e.target as unknown as PointerCapturable;
                  if (target && typeof target.setPointerCapture === 'function') {
                    target.setPointerCapture(e.pointerId);
                  }
                  return;
                }

                if (!store.autoSelect && !isSelected) return;

                if (store.showMarqueeBox) {
                  store.setShowMarqueeBox(false);
                  store.setMarqueeStart(null);
                  store.setMarqueeEnd(null);
                }

                store.saveHistory();
                store.setSelectedId(decal.id, e.shiftKey || e.ctrlKey || e.metaKey);
                setMode('drag');
                store.setIsDragging(true);
                document.body.style.cursor = 'grabbing';

                const target = e.target as unknown as PointerCapturable;
                if (target && typeof target.setPointerCapture === 'function') {
                  target.setPointerCapture(e.pointerId);
                }
              }}
              onPointerMove={(e: ThreeEvent<PointerEvent>) => {
                const store = useEditorStore.getState();
                if (store.globalToolMode === 'camera') return;
                e.stopPropagation();

                const isBrushActive = ['fill', 'blur', 'burn', 'saturate', 'erase'].includes(
                  store.globalToolMode,
                );

                if (isBrushActive && isPaintingRef.current) {
                  if (store.globalToolMode === 'fill') return;
                  handlePaint(e);
                  return;
                }

                if (mode === 'drag' && isSelected && !isEditingText) {
                  const now = performance.now();
                  if (now - lastUpdateRef.current < 32) return;
                  lastUpdateRef.current = now;

                  _raycaster.ray.copy(e.ray);
                  const hits = _raycaster.intersectObjects(targetMeshes, false);

                  if (hits.length > 0) {
                    const hit = hits[0];
                    const hitMesh = hit.object as THREE.Mesh;

                    _worldPos.copy(hit.point);
                    _normalMatrix.getNormalMatrix(hitMesh.matrixWorld);

                    if (hit.face?.normal) {
                      _worldNormal.copy(hit.face.normal).applyMatrix3(_normalMatrix).normalize();
                    } else {
                      _worldNormal.set(0, 0, 1);
                    }

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

                    const deltaX = _localPos.x - decal.position[0];
                    const deltaY = _localPos.y - decal.position[1];
                    const deltaZ = _localPos.z - decal.position[2];

                    store.decals.forEach((d) => {
                      if (d.id === decal.id) {
                        store.updateDecal(d.id, {
                          meshName: hitMesh.name,
                          position: [_localPos.x, _localPos.y, _localPos.z],
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
              onPointerUp={(e: ThreeEvent<PointerEvent>) => {
                const store = useEditorStore.getState();
                if (store.globalToolMode === 'camera') return;
                e.stopPropagation();

                const isBrushActive = ['fill', 'blur', 'burn', 'saturate', 'erase'].includes(
                  store.globalToolMode,
                );

                if (isBrushActive && isPaintingRef.current) {
                  isPaintingRef.current = false;
                  document.body.style.cursor = 'crosshair';
                  store.setIsDragging(false);

                  if (paintCanvasRef.current) {
                    const dataUrl = paintCanvasRef.current.toDataURL('image/png');
                    const newType =
                      decal.type === 'text' || decal.type === 'shape' ? 'drawing' : decal.type;

                    store.updateDecal(decal.id, {
                      src: dataUrl,
                      originalSrc: dataUrl,
                      type: newType,
                    });
                  }

                  const target = e.target as unknown as PointerCapturable;
                  if (target && typeof target.releasePointerCapture === 'function') {
                    try {
                      target.releasePointerCapture(e.pointerId);
                    } catch {}
                  }
                  return;
                }

                if (mode === 'drag') {
                  setMode('idle');
                  store.setIsDragging(false);
                  document.body.style.cursor = 'grab';
                }

                const target = e.target as unknown as PointerCapturable;
                if (target && typeof target.releasePointerCapture === 'function') {
                  try {
                    target.releasePointerCapture(e.pointerId);
                  } catch {}
                }
              }}
              onPointerOver={(e: ThreeEvent<PointerEvent>) => {
                const store = useEditorStore.getState();
                if (store.globalToolMode === 'camera') return;
                e.stopPropagation();
                if (store.globalToolMode !== 'default' && store.globalToolMode !== 'select') {
                  document.body.style.cursor = 'crosshair';
                } else if (mode === 'idle' && !isEditingText) {
                  document.body.style.cursor = 'grab';
                }
              }}
              onPointerOut={(e: ThreeEvent<PointerEvent>) => {
                const store = useEditorStore.getState();
                if (store.globalToolMode === 'camera') return;
                e.stopPropagation();
                if (mode === 'idle' && store.globalToolMode === 'default') {
                  document.body.style.cursor = 'default';
                }
              }}
            >
              <boxGeometry args={[1, 1, 0.2]} />
              <meshBasicMaterial transparent opacity={0} depthTest={false} depthWrite={false} />
            </mesh>

            {isSelected &&
              !isEditingText &&
              useEditorStore.getState().globalToolMode === 'default' &&
              !useEditorStore.getState().showMarqueeBox && (
                <group position={[0, 0, 0.11 + index * 0.002]}>
                  <lineSegments
                    geometry={borderGeo}
                    scale={[uiSx, uiSy, 1]}
                    renderOrder={998}
                    castShadow={false}
                    receiveShadow={false}
                  >
                    <lineBasicMaterial color="#0d99ff" depthTest={false} transparent opacity={1} />
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
                    <Html position={[uiHsX + 0.05, uiHsY + 0.05, 0]} center zIndexRange={[100, 0]}>
                      <div className="flex gap-1 bg-white/95 backdrop-blur shadow-xl rounded-xl p-1.5 border border-blue-200 pointer-events-auto transform translate-x-4 -translate-y-4 animate-in fade-in duration-200">
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
