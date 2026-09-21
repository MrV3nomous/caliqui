import { ContactShadows, Environment, OrbitControls } from '@react-three/drei';
import { Canvas, useFrame } from '@react-three/fiber';
import { Hand, MousePointer2 } from 'lucide-react';
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
  const cameraView = useEditorStore((state) => state.cameraView);
  const setCameraView = useEditorStore((state) => state.setCameraView);

  useFrame(() => {
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

function ViewControls() {
  const globalToolMode = useEditorStore((state) => state.globalToolMode);
  const setGlobalToolMode = useEditorStore((state) => state.setGlobalToolMode);
  const setSelectedId = useEditorStore((state) => state.setSelectedId);

  return (
    <div className="absolute top-20 lg:top-24 left-4 lg:left-8 z-20 flex p-1 bg-white/90 backdrop-blur-3xl shadow-[0_8px_30px_rgb(0,0,0,0.06)] border border-black/5 rounded-full pointer-events-auto">
      <button
        type="button"
        onClick={() => setGlobalToolMode('default')}
        className={`flex items-center gap-1.5 px-5 py-2 rounded-full text-[11px] font-bold transition-all duration-300 ${globalToolMode !== 'camera' ? 'bg-black text-white shadow-md' : 'text-neutral-500 hover:text-black hover:bg-black/5'}`}
      >
        <MousePointer2 size={14} /> <span className="hidden sm:inline">Edit</span>
      </button>
      <button
        type="button"
        onClick={() => {
          setGlobalToolMode('camera');
          setSelectedId(null);
        }}
        className={`flex items-center gap-1.5 px-5 py-2 rounded-full text-[11px] font-bold transition-all duration-300 ${globalToolMode === 'camera' ? 'bg-black text-white shadow-md' : 'text-neutral-500 hover:text-black hover:bg-black/5'}`}
      >
        <Hand size={14} /> <span className="hidden sm:inline">Move</span>
      </button>
    </div>
  );
}

export function Preview3D() {
  const { isDragging, setIsDragging, isDrawingMode, globalToolMode, setCameraView } =
    useEditorStore();
  const controlsRef = useRef<OrbitControlsImpl>(null);

  return (
    <div className="absolute inset-0 w-full h-full touch-none bg-transparent pointer-events-none">
      <ViewControls />

      {/* Enable pointer events ONLY on the canvas */}
      <div className="absolute inset-0 pointer-events-auto">
        <Canvas
          id="tshirt-canvas"
          dpr={[1, 1.5]}
          gl={{ preserveDrawingBuffer: true, powerPreference: 'high-performance', alpha: true }}
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
          <ambientLight intensity={0.6} />
          <spotLight position={[10, 10, 10]} angle={0.15} penumbra={1} intensity={1} castShadow />
          <Environment preset="city" />

          <React.Suspense fallback={null}>
            <TShirtModel />
          </React.Suspense>

          <ContactShadows
            position={[0, -1.0, 0]}
            opacity={0.2}
            scale={10}
            blur={2.5}
            far={4}
            color="#000000"
          />
          <MarqueeEngine />
          <CameraAnimator controlsRef={controlsRef} />

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
            // ABSOLUTE PRIORITY: OrbitControls is completely disabled during Edit Mode.
            // It is only enabled when the user clicks the "Move" tool.
            enabled={!isDragging && !isDrawingMode && globalToolMode === 'camera'}
          />
        </Canvas>
      </div>
    </div>
  );
}
