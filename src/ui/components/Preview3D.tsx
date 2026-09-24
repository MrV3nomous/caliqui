import { Bvh, ContactShadows, Environment, Lightformer, OrbitControls } from '@react-three/drei';
import { Canvas, useFrame } from '@react-three/fiber';
import React, { useRef } from 'react';
import * as THREE from 'three';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import { useEditorStore } from '@/ui/store/editor-store';
import { MarqueeEngine } from './preview3d/MarqueeEngine';
import { TShirtModel } from './preview3d/TShirtModel';

const CAMERA_POSITIONS = {
  front: new THREE.Spherical(4.5, Math.PI / 2, 0),
  back: new THREE.Spherical(4.5, Math.PI / 2, Math.PI),
  left: new THREE.Spherical(4.5, Math.PI / 2, -Math.PI / 2),
  right: new THREE.Spherical(4.5, Math.PI / 2, Math.PI / 2),
  top: new THREE.Spherical(4.5, Math.PI / 4, 0),
};

function CameraAnimator({
  controlsRef,
}: {
  controlsRef: React.RefObject<OrbitControlsImpl | null>;
}) {
  useFrame(() => {
    const { cameraView, setCameraView } = useEditorStore.getState();
    if (!controlsRef.current || cameraView === 'custom') return;
    const targetSpherical = CAMERA_POSITIONS[cameraView];
    if (!targetSpherical) return;

    controlsRef.current.setAzimuthalAngle(
      THREE.MathUtils.lerp(controlsRef.current.getAzimuthalAngle(), targetSpherical.theta, 0.1),
    );
    controlsRef.current.setPolarAngle(
      THREE.MathUtils.lerp(controlsRef.current.getPolarAngle(), targetSpherical.phi, 0.1),
    );
    controlsRef.current.update();

    const azDiff = Math.abs(controlsRef.current.getAzimuthalAngle() - targetSpherical.theta);
    const polDiff = Math.abs(controlsRef.current.getPolarAngle() - targetSpherical.phi);

    if (azDiff < 0.01 && polDiff < 0.01) setCameraView('custom');
  });
  return null;
}

function StoreBoundOrbitControls({
  controlsRef,
}: {
  controlsRef: React.RefObject<OrbitControlsImpl | null>;
}) {
  const isDragging = useEditorStore((s) => s.isDragging);
  const isDrawingMode = useEditorStore((s) => s.isDrawingMode);
  const globalToolMode = useEditorStore((s) => s.globalToolMode);

  return (
    <OrbitControls
      ref={controlsRef}
      makeDefault
      minPolarAngle={0}
      maxPolarAngle={Math.PI}
      enablePan={true}
      enableZoom={true}
      mouseButtons={{
        LEFT: THREE.MOUSE.ROTATE,
        MIDDLE: THREE.MOUSE.DOLLY,
        RIGHT: THREE.MOUSE.PAN,
      }}
      enabled={!isDragging && !isDrawingMode && globalToolMode === 'camera'}
    />
  );
}

export function Preview3D() {
  const setIsDragging = useEditorStore((s) => s.setIsDragging);
  const setCameraView = useEditorStore((s) => s.setCameraView);
  const controlsRef = useRef<OrbitControlsImpl>(null);

  return (
    <div className="absolute inset-0 w-full h-full touch-none bg-transparent pointer-events-none">
      <div className="absolute inset-0 pointer-events-auto">
        <Canvas
          id="tshirt-canvas"
          dpr={[1, 1.5]}
          gl={{
            preserveDrawingBuffer: false,
            powerPreference: 'high-performance',
            alpha: true,
            antialias: true,
          }}
          camera={{ position: [0, 0, 4.5], fov: 45 }}
          onPointerDown={() => setCameraView('custom')}
          onPointerUp={() => {
            setIsDragging(false);
            document.body.style.cursor = 'default';
          }}
          onPointerMissed={(e) => {
            if (e.type === 'pointerup' || e.type === 'pointermove') return;
            const state = useEditorStore.getState();
            if (!state.isDragging && state.autoSelect && state.globalToolMode !== 'select') {
              state.setSelectedId(null);
              state.setContextMenu(null);
            }
          }}
        >
          {/* 1. Base Lighting: Softened to allow shadows to exist in the wrinkles */}
          <ambientLight intensity={0.95} />
          <hemisphereLight intensity={0.75} color="#ffffff" groundColor="#999999" />

          {/* 2. Main Light: Shifted off-center (X: 2) to cast nice, subtle shadows across the folds */}
          <directionalLight position={[2, 5, 5]} intensity={0.9} />

          {/* 3. Environment: Intensities drastically reduced to stop "blowing out" the white fabric */}
          <Environment resolution={256}>
            {/* Soft top lighting */}
            <Lightformer
              form="rect"
              intensity={0.8}
              position={[0, 5, 0]}
              scale={[10, 10, 1]}
              rotation={[-Math.PI / 2, 0, 0]}
            />
            {/* Very subtle front fill */}
            <Lightformer form="rect" intensity={0.4} position={[0, 0, 5]} scale={[10, 10, 1]} />
            {/* Rim lights to separate the shirt from the white background */}
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

          <Bvh firstHitOnly>
            <React.Suspense fallback={null}>
              <TShirtModel />
            </React.Suspense>
          </Bvh>

          <ContactShadows
            frames={1}
            position={[0, -1.0, 0]}
            opacity={0.25}
            scale={10}
            blur={2.5}
            far={4}
            color="#000000"
          />
          <MarqueeEngine />
          <CameraAnimator controlsRef={controlsRef} />
          <StoreBoundOrbitControls controlsRef={controlsRef} />
        </Canvas>
      </div>
    </div>
  );
}
