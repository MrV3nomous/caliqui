import { Decal, Html } from '@react-three/drei';
import { createPortal, type ThreeEvent, useThree } from '@react-three/fiber';
import { RotateCw, Trash2 } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import {
  applyBlur,
  applyBucketFill,
  applyBurn,
  applyErase,
  applySaturate,
} from '@/shared/utils/brush-engine';
import { type DecalData, useEditorStore } from '@/ui/store/editor-store';
import { SmartHandle } from './SmartHandle';
import type { DragState, InteractionMode, PointerCapturable } from './types';

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

export function ProjectedDecal({
  decal,
  primaryMesh,
  index,
}: {
  decal: DecalData;
  primaryMesh: THREE.Mesh;
  index: number;
}) {
  const {
    selectedIds,
    setSelectedId,
    setIsDragging,
    isDragging,
    updateDecal,
    removeDecal,
    autoSelect,
    updateText,
    saveHistory,
    setContextMenu,
    setDrawingMode,
    setEditingDrawingId,
    globalToolMode,
    brushSettings,
  } = useEditorStore();

  const [mode, setMode] = useState<InteractionMode>('idle');
  const [isEditingText, setIsEditingText] = useState(false);
  const isSelected = selectedIds.includes(decal.id);

  const paintCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const paintCtxRef = useRef<CanvasRenderingContext2D | null>(null);
  const isPaintingRef = useRef(false);

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

  const { gl, scene } = useThree();

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
    if (isPaintingRef.current) return;

    const displayImg = new Image();
    displayImg.crossOrigin = 'anonymous';
    displayImg.src = decal.src || '';
    displayImg.onload = () => {
      setTexture((prevTexture) => {
        const newTex = new THREE.Texture(displayImg);
        newTex.colorSpace = THREE.SRGBColorSpace;
        newTex.anisotropy = gl.capabilities.getMaxAnisotropy();
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
      decal.type === 'image' ||
      decal.type === 'drawing' ||
      decal.type === 'text' ||
      decal.type === 'shape'
    ) {
      const rawImg = new Image();
      rawImg.crossOrigin = 'anonymous';
      rawImg.src = decal.src || '';
      rawImg.onload = () => {
        const w = rawImg.naturalWidth || 512;
        const h = rawImg.naturalHeight || 512;

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
  }, [decal.src, gl, decal.type]);

  const ratio = decal.aspectRatio || 1;
  let sx = decal.scaleX ?? decal.scale;
  let sy = decal.scaleY ?? decal.scale;

  if (decal.scaleX === undefined && decal.scaleY === undefined) {
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

  // FORCE CLAMP to heavily aggressively restrict the projection so it never reaches the back of the shirt
  const safeZDepth = Math.min(decal.zDepth ?? 0.04, 0.1);

  const MIN_UI_SIZE = 0.15;
  const uiSx = Math.max(Math.abs(sx), MIN_UI_SIZE);
  const uiSy = Math.max(Math.abs(sy), MIN_UI_SIZE);
  const uiHsX = uiSx / 2;
  const uiHsY = uiSy / 2;

  const { planeGeo, borderGeo } = useMemo(() => {
    const plane = new THREE.PlaneGeometry(1, 1);
    const edges = new THREE.EdgesGeometry(plane);
    return { planeGeo: plane, borderGeo: edges };
  }, []);

  useEffect(() => {
    return () => {
      if (paintCanvasRef.current) {
        paintCanvasRef.current.width = 0;
        paintCanvasRef.current.height = 0;
        paintCanvasRef.current = null;
        paintCtxRef.current = null;
      }
      planeGeo.dispose();
      borderGeo.dispose();
    };
  }, [planeGeo, borderGeo]);

  const finalRotation = useMemo(() => {
    const dummy = new THREE.Object3D();
    dummy.rotation.set(decal.rotation[0], decal.rotation[1], decal.rotation[2]);
    if (decal.rotationOffset) dummy.rotateZ(decal.rotationOffset);
    return [dummy.rotation.x, dummy.rotation.y, dummy.rotation.z] as [number, number, number];
  }, [decal.rotation, decal.rotationOffset]);

  const handleTextSubmit = (val: string) => {
    if (val.trim()) updateText(decal.id, val);
    setIsEditingText(false);
  };

  const handlePaint = (e: ThreeEvent<PointerEvent>) => {
    if (!paintCtxRef.current || !paintCanvasRef.current) return;

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

  const blendMode = getThreeBlending(decal.blendMode);
  const isBrushActive = ['fill', 'blur', 'burn', 'saturate', 'erase'].includes(globalToolMode);

  return (
    <>
      {createPortal(
        <Decal
          mesh={{ current: primaryMesh } as React.RefObject<THREE.Mesh>}
          position={decal.position}
          rotation={finalRotation}
          scale={[sx, sy, safeZDepth]}
          raycast={() => null}
          renderOrder={index + 1}
          castShadow={false}
          receiveShadow={false}
        >
          <meshStandardMaterial
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
            color={
              isSelected && !isEditingText ? new THREE.Color(0xddddff) : new THREE.Color(0xffffff)
            }
          />
        </Decal>,
        primaryMesh,
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
              // COMPLETELY DETACHED FROM zDepth
              // Staggered outward slightly by layer index so top-layer decals literally block clicks on bottom decals
              position={[0, 0, index * 0.002]}
              scale={isSelected ? [uiSx * 1.05, uiSy * 1.05, 1] : [uiSx, uiSy, 1]}
              castShadow={false}
              receiveShadow={false}
              onContextMenu={(e: ThreeEvent<MouseEvent>) => {
                if (globalToolMode === 'camera') return;
                if (e.nativeEvent && typeof e.nativeEvent.preventDefault === 'function') {
                  e.nativeEvent.preventDefault();
                }

                if (isEditingText || (!autoSelect && !isSelected) || globalToolMode !== 'default')
                  return;
                e.stopPropagation();

                if (!selectedIds.includes(decal.id)) setSelectedId(decal.id, false);
                setContextMenu({
                  x: e.nativeEvent.clientX,
                  y: e.nativeEvent.clientY,
                  decalId: decal.id,
                });
              }}
              onDoubleClick={(e: ThreeEvent<PointerEvent>) => {
                if (globalToolMode === 'camera') return;
                if ((!autoSelect && !isSelected) || globalToolMode !== 'default') return;
                e.stopPropagation();

                if (decal.type === 'text') {
                  setIsEditingText(true);
                  setMode('idle');
                  setIsDragging(false);
                } else if (decal.type === 'drawing') {
                  setEditingDrawingId(decal.id);
                  setDrawingMode(true);
                  setMode('idle');
                  setIsDragging(false);
                }
              }}
              onPointerDown={(e: ThreeEvent<PointerEvent>) => {
                if (globalToolMode === 'camera') return;
                if (isEditingText) return;
                e.stopPropagation();
                if (e.button === 2) return;

                if (isBrushActive) {
                  saveHistory();
                  if (!selectedIds.includes(decal.id)) setSelectedId(decal.id, false);
                  isPaintingRef.current = true;
                  document.body.style.cursor = 'crosshair';
                  setIsDragging(true);

                  handlePaint(e);

                  const target = e.target as unknown as PointerCapturable;
                  if (target && typeof target.setPointerCapture === 'function') {
                    target.setPointerCapture(e.pointerId);
                  }
                  return;
                }

                if (!autoSelect && !isSelected) return;

                const state = useEditorStore.getState();
                if (state.showMarqueeBox) {
                  state.setShowMarqueeBox(false);
                  state.setMarqueeStart(null);
                  state.setMarqueeEnd(null);
                }

                saveHistory();
                setSelectedId(decal.id, e.shiftKey || e.ctrlKey || e.metaKey);
                setMode('drag');
                setIsDragging(true);
                document.body.style.cursor = 'grabbing';

                const target = e.target as unknown as PointerCapturable;
                if (target && typeof target.setPointerCapture === 'function') {
                  target.setPointerCapture(e.pointerId);
                }
              }}
              onPointerMove={(e: ThreeEvent<PointerEvent>) => {
                if (globalToolMode === 'camera') return;
                e.stopPropagation();

                if (isBrushActive && isPaintingRef.current) {
                  if (globalToolMode === 'fill') return;
                  handlePaint(e);
                  return;
                }

                if (mode === 'drag' && isSelected && !isEditingText) {
                  const raycaster = new THREE.Raycaster();
                  raycaster.ray.copy(e.ray);
                  const hits = raycaster.intersectObject(primaryMesh, false);

                  if (hits.length > 0) {
                    const hit = hits[0];
                    const worldPos = hit.point.clone();
                    const normalMatrix = new THREE.Matrix3().getNormalMatrix(
                      primaryMesh.matrixWorld,
                    );
                    const worldNormal = hit.face?.normal
                      ? hit.face.normal.clone().applyMatrix3(normalMatrix).normalize()
                      : new THREE.Vector3(0, 0, 1);

                    const dummyWorld = new THREE.Object3D();
                    scene.add(dummyWorld);
                    dummyWorld.position.copy(worldPos);

                    if (Math.abs(worldNormal.y) > 0.999) {
                      dummyWorld.up.set(0, 0, 1);
                    } else {
                      dummyWorld.up.set(0, 1, 0);
                    }

                    dummyWorld.lookAt(worldPos.clone().add(worldNormal));
                    dummyWorld.updateMatrixWorld(true);

                    const inverseParentMatrix = new THREE.Matrix4()
                      .copy(primaryMesh.matrixWorld)
                      .invert();
                    const localMatrix = new THREE.Matrix4().multiplyMatrices(
                      inverseParentMatrix,
                      dummyWorld.matrixWorld,
                    );

                    const localPos = new THREE.Vector3();
                    const localQuat = new THREE.Quaternion();
                    const localScale = new THREE.Vector3();
                    localMatrix.decompose(localPos, localQuat, localScale);
                    const localEuler = new THREE.Euler().setFromQuaternion(localQuat);

                    const state = useEditorStore.getState();

                    const deltaX = localPos.x - decal.position[0];
                    const deltaY = localPos.y - decal.position[1];
                    const deltaZ = localPos.z - decal.position[2];

                    state.decals.forEach((d) => {
                      if (d.id === decal.id) {
                        updateDecal(d.id, {
                          meshName: primaryMesh.name,
                          position: [localPos.x, localPos.y, localPos.z],
                          rotation: [localEuler.x, localEuler.y, localEuler.z],
                        });
                      } else if (
                        state.selectedIds.includes(d.id) ||
                        (decal.groupId && d.groupId === decal.groupId)
                      ) {
                        updateDecal(d.id, {
                          position: [
                            d.position[0] + deltaX,
                            d.position[1] + deltaY,
                            d.position[2] + deltaZ,
                          ],
                        });
                      }
                    });

                    dummyWorld.removeFromParent();
                  }
                }
              }}
              onPointerUp={(e: ThreeEvent<PointerEvent>) => {
                if (globalToolMode === 'camera') return;
                e.stopPropagation();

                if (isBrushActive && isPaintingRef.current) {
                  isPaintingRef.current = false;
                  document.body.style.cursor = 'crosshair';
                  setIsDragging(false);

                  if (paintCanvasRef.current) {
                    const dataUrl = paintCanvasRef.current.toDataURL('image/png');
                    const newType =
                      decal.type === 'text' || decal.type === 'shape' ? 'drawing' : decal.type;

                    updateDecal(decal.id, {
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
                  setIsDragging(false);
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
                if (globalToolMode === 'camera') return;
                e.stopPropagation();
                if (globalToolMode !== 'default' && globalToolMode !== 'select') {
                  document.body.style.cursor = 'crosshair';
                } else if (mode === 'idle' && !isEditingText) {
                  document.body.style.cursor = 'grab';
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
              {/* Thicker 0.2 box geometry guarantees the raycaster will catch it even on extreme T-shirt curves */}
              <boxGeometry args={[1, 1, 0.2]} />
              <meshBasicMaterial transparent opacity={0} depthTest={false} depthWrite={false} />
            </mesh>

            {isSelected &&
              !isEditingText &&
              globalToolMode === 'default' &&
              !useEditorStore.getState().showMarqueeBox && (
                // Position handles visually above the 0.2 thickness hitbox (0.1 represents half of 0.2, plus padding)
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
                    primaryMesh={primaryMesh}
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
                    primaryMesh={primaryMesh}
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
                    primaryMesh={primaryMesh}
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
                    primaryMesh={primaryMesh}
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
                    primaryMesh={primaryMesh}
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
                    primaryMesh={primaryMesh}
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
                    primaryMesh={primaryMesh}
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
                    primaryMesh={primaryMesh}
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
                            saveHistory();
                            updateDecal(decal.id, {
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
                            removeDecal(decal.id);
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
        primaryMesh,
      )}
    </>
  );
}
