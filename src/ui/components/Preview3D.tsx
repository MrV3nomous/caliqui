import { Bvh, ContactShadows, Environment, Lightformer, OrbitControls } from '@react-three/drei';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import { useEditorStore } from '@/ui/store/editor-store';
import { MarqueeEngine } from './preview3d/MarqueeEngine';
import { TShirtModel } from './preview3d/TShirtModel';
import { claimEditorGesture, ownsEditorGesture, releaseEditorGesture } from './preview3d/gestureCoordinator';

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
  useFrame((_, delta) => {
    const { cameraView, setCameraView } = useEditorStore.getState();
    if (!controlsRef.current || cameraView === 'custom') return;
    const targetSpherical = CAMERA_POSITIONS[cameraView];
    if (!targetSpherical) return;

    const controls = controlsRef.current;
    const currentTheta = controls.getAzimuthalAngle();
    const thetaDelta = THREE.MathUtils.euclideanModulo(
      targetSpherical.theta - currentTheta + Math.PI,
      Math.PI * 2,
    ) - Math.PI;
    const frameDelta = Math.min(delta, 0.05);
    const damping = 1 - Math.exp(-8 * frameDelta);

    // OrbitControls setters call update() internally. Temporarily disable its
    // own inertia while applying our frame-rate-independent interpolation, or
    // the two damping layers compound and make preset transitions sluggish.
    const previousDamping = controls.enableDamping;
    controls.enableDamping = false;
    controls.setAzimuthalAngle(currentTheta + thetaDelta * damping);
    controls.setPolarAngle(THREE.MathUtils.damp(controls.getPolarAngle(), targetSpherical.phi, 8, frameDelta));
    controls.enableDamping = previousDamping;
    controls.update();

    const finalTheta = controlsRef.current.getAzimuthalAngle();
    const azDiff = Math.abs(
      THREE.MathUtils.euclideanModulo(targetSpherical.theta - finalTheta + Math.PI, Math.PI * 2) -
        Math.PI,
    );
    const polDiff = Math.abs(controlsRef.current.getPolarAngle() - targetSpherical.phi);

    if (azDiff < 0.01 && polDiff < 0.01) setCameraView('custom');
  });
  return null;
}


type BackgroundOrbitState = {
  pointerId: number;
  startX: number;
  startY: number;
  lastX: number;
  lastY: number;
  moved: boolean;
};

/**
 * Lets the user orbit by dragging the empty canvas around the garment.
 * A raycast check keeps all shirt, artwork, and transform-handle gestures
 * under their existing owners; this only claims a pointer when no design
 * surface or decal hitbox is under it.
 */
function BackgroundOrbitGesture({
  controlsRef,
}: {
  controlsRef: React.RefObject<OrbitControlsImpl | null>;
}) {
  const { gl, camera, scene } = useThree();
  const activePointerRef = useRef<BackgroundOrbitState | null>(null);
  const touchPointsRef = useRef<Map<number, { x: number; y: number }>>(new Map());

  useEffect(() => {
    const canvas = gl.domElement;
    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();

    const isDesignTarget = (object: THREE.Object3D) => {
      let current: THREE.Object3D | null = object;
      while (current) {
        if (current.userData?.isTargetMesh || current.userData?.isDecalHitbox) return true;
        current = current.parent;
      }
      return false;
    };

    const hasDesignHit = (event: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return true;
      pointer.set(
        ((event.clientX - rect.left) / rect.width) * 2 - 1,
        -((event.clientY - rect.top) / rect.height) * 2 + 1,
      );
      raycaster.setFromCamera(pointer, camera);
      return raycaster
        .intersectObjects(scene.children, true)
        .some((intersection) => isDesignTarget(intersection.object));
    };

    const onPointerDown = (event: PointerEvent) => {
      // If a blank-canvas touch gesture is already active, capture a second
      // finger too. This keeps the 2-finger rotate/pinch gesture coherent even
      // when the first finger started outside the garment mesh.
      if (event.pointerType === 'touch' && touchPointsRef.current.size > 0) {
        touchPointsRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
        try { canvas.setPointerCapture(event.pointerId); } catch { /* Pointer capture is best-effort. */ }
        event.preventDefault();
        event.stopImmediatePropagation();
        return;
      }

      if (activePointerRef.current || event.button !== 0) return;
      const state = useEditorStore.getState();
      if (
        state.isDragging ||
        state.isDrawingMode ||
        (state.globalToolMode !== 'default' && state.globalToolMode !== 'select')
      ) return;
      if (hasDesignHit(event)) return;
      if (!claimEditorGesture('camera', event.pointerId)) return;

      activePointerRef.current = {
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        lastX: event.clientX,
        lastY: event.clientY,
        moved: false,
      };
      if (event.pointerType === 'touch') {
        touchPointsRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
      }
      state.setIsDragging(true);
      state.setCameraView('custom');
      try {
        canvas.setPointerCapture(event.pointerId);
      } catch {
        // Pointer capture can fail during browser teardown; window-level
        // pointer events still normally complete the gesture.
      }
      event.preventDefault();
      event.stopImmediatePropagation();
      document.body.style.cursor = 'grabbing';
    };

    const onPointerMove = (event: PointerEvent) => {
      const touchPoints = touchPointsRef.current;
      if (event.pointerType === 'touch' && touchPoints.has(event.pointerId)) {
        const previousPoints = [...touchPoints.values()];
        const oldCenter = previousPoints.length > 1
          ? { x: (previousPoints[0].x + previousPoints[1].x) / 2, y: (previousPoints[0].y + previousPoints[1].y) / 2 }
          : previousPoints[0];
        const oldDistance = previousPoints.length > 1
          ? Math.hypot(previousPoints[0].x - previousPoints[1].x, previousPoints[0].y - previousPoints[1].y)
          : 0;
        touchPoints.set(event.pointerId, { x: event.clientX, y: event.clientY });
        const nextPoints = [...touchPoints.values()];
        const nextCenter = nextPoints.length > 1
          ? { x: (nextPoints[0].x + nextPoints[1].x) / 2, y: (nextPoints[0].y + nextPoints[1].y) / 2 }
          : nextPoints[0];
        const centerDeltaX = nextCenter && oldCenter ? nextCenter.x - oldCenter.x : 0;
        const centerDeltaY = nextCenter && oldCenter ? nextCenter.y - oldCenter.y : 0;
        const nextDistance = nextPoints.length > 1
          ? Math.hypot(nextPoints[0].x - nextPoints[1].x, nextPoints[0].y - nextPoints[1].y)
          : 0;
        const activeGesture = activePointerRef.current;
        if (activeGesture && (Math.hypot(centerDeltaX, centerDeltaY) >= 3 || Math.abs(nextDistance - oldDistance) >= 3)) {
          activeGesture.moved = true;
        }
        const controls = controlsRef.current;
        if (controls && oldCenter && nextCenter) {
          const previousDamping = controls.enableDamping;
          controls.enableDamping = false;
          controls.setAzimuthalAngle(controls.getAzimuthalAngle() - centerDeltaX * 0.008);
          controls.setPolarAngle(THREE.MathUtils.clamp(
            controls.getPolarAngle() - centerDeltaY * 0.008,
            0.28,
            Math.PI - 0.28,
          ));
          if (nextPoints.length > 1 && oldDistance > 1) {
            const direction = camera.position.clone().sub(controls.target);
            const zoomDistance = THREE.MathUtils.clamp(direction.length() * (oldDistance / Math.max(1, nextDistance)), 2.8, 7.5);
            direction.setLength(zoomDistance);
            camera.position.copy(controls.target).add(direction);
          }
          controls.enableDamping = previousDamping;
          controls.update();
          useEditorStore.getState().setCameraView('custom');
        }
        const active = activePointerRef.current;
        if (active?.pointerId === event.pointerId) {
          active.lastX = event.clientX;
          active.lastY = event.clientY;
        }
        event.preventDefault();
        event.stopImmediatePropagation();
        return;
      }

      const gesture = activePointerRef.current;
      if (!gesture || gesture.pointerId !== event.pointerId || !ownsEditorGesture('camera', event.pointerId)) return;
      event.preventDefault();
      event.stopImmediatePropagation();

      const totalDistance = Math.hypot(event.clientX - gesture.startX, event.clientY - gesture.startY);
      const deltaX = event.clientX - gesture.lastX;
      const deltaY = event.clientY - gesture.lastY;
      gesture.lastX = event.clientX;
      gesture.lastY = event.clientY;
      if (!gesture.moved && totalDistance < 3) return;
      gesture.moved = true;

      const controls = controlsRef.current;
      if (!controls) return;
      const previousDamping = controls.enableDamping;
      controls.enableDamping = false;
      controls.setAzimuthalAngle(controls.getAzimuthalAngle() - deltaX * 0.008);
      controls.setPolarAngle(
        THREE.MathUtils.clamp(controls.getPolarAngle() - deltaY * 0.008, 0.28, Math.PI - 0.28),
      );
      controls.enableDamping = previousDamping;
      controls.update();
      useEditorStore.getState().setCameraView('custom');
    };

    const finishGesture = (event: PointerEvent, releaseCapture = true) => {
      if (event.pointerType === 'touch' && touchPointsRef.current.has(event.pointerId)) {
        touchPointsRef.current.delete(event.pointerId);
        if (releaseCapture) {
          try { if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId); } catch { /* Already released. */ }
        }
        const remaining = touchPointsRef.current.size;
        if (remaining > 0) {
          // The camera gesture remains owned by the first finger that claimed it.
          // Do not transfer ownership to the remaining finger: gestureCoordinator
          // still records the original pointer ID.
          event.stopImmediatePropagation();
          return;
        }

        const touchGesture = activePointerRef.current;
        if (!touchGesture || !ownsEditorGesture('camera', touchGesture.pointerId)) return;
        event.stopImmediatePropagation();
        activePointerRef.current = null;
        releaseEditorGesture('camera', touchGesture.pointerId);
        useEditorStore.getState().setIsDragging(false);
        if (releaseCapture) {
          try {
            if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
          } catch {
            // The final touch may not be the pointer that originally claimed the gesture.
          }
        }
        document.body.style.cursor = 'default';
        const state = useEditorStore.getState();
        if (!touchGesture.moved && state.autoSelect && state.selectedIds.length > 0) {
          state.setSelectedId(null);
          state.setContextMenu(null);
        }
        return;
      }

      const gesture = activePointerRef.current;
      if (!gesture || gesture.pointerId !== event.pointerId || !ownsEditorGesture('camera', gesture.pointerId)) return;
      event.stopImmediatePropagation();
      activePointerRef.current = null;
      releaseEditorGesture('camera', gesture.pointerId);
      useEditorStore.getState().setIsDragging(false);
      if (releaseCapture) {
        try {
          if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
        } catch {
          // Capture may already have been released by the browser.
        }
      }
      document.body.style.cursor = 'default';

      const state = useEditorStore.getState();
      if (!gesture.moved && state.autoSelect && state.selectedIds.length > 0) {
        state.setSelectedId(null);
        state.setContextMenu(null);
      }
    };

    const onPointerUp = (event: PointerEvent) => finishGesture(event);
    const onPointerCancel = (event: PointerEvent) => finishGesture(event);
    const onLostPointerCapture = (event: PointerEvent) => finishGesture(event, false);

    canvas.addEventListener('pointerdown', onPointerDown, true);
    canvas.addEventListener('pointermove', onPointerMove, true);
    canvas.addEventListener('pointerup', onPointerUp, true);
    canvas.addEventListener('pointercancel', onPointerCancel, true);
    canvas.addEventListener('lostpointercapture', onLostPointerCapture, true);

    return () => {
      canvas.removeEventListener('pointerdown', onPointerDown, true);
      canvas.removeEventListener('pointermove', onPointerMove, true);
      canvas.removeEventListener('pointerup', onPointerUp, true);
      canvas.removeEventListener('pointercancel', onPointerCancel, true);
      canvas.removeEventListener('lostpointercapture', onLostPointerCapture, true);

      const gesture = activePointerRef.current;
      if (gesture && releaseEditorGesture('camera', gesture.pointerId)) {
        useEditorStore.getState().setIsDragging(false);
        try {
          if (canvas.hasPointerCapture(gesture.pointerId)) canvas.releasePointerCapture(gesture.pointerId);
        } catch {
          // Ignore stale pointer capture on unmount.
        }
      }
      activePointerRef.current = null;
      touchPointsRef.current.clear();
      document.body.style.cursor = 'default';
    };
  }, [camera, controlsRef, gl, scene]);

  return null;
}


function CameraCommandBridge({ controlsRef }: { controlsRef: React.RefObject<OrbitControlsImpl | null> }) {
  const { camera, scene } = useThree();
  useEffect(() => {
    const handleCameraCommand = (event: Event) => {
      const command = (event as CustomEvent<{ command?: string }>).detail?.command;
      const controls = controlsRef.current;
      if (!controls) return;

      if (command === 'zoom-in' || command === 'zoom-out') {
        const direction = camera.position.clone().sub(controls.target);
        const factor = command === 'zoom-in' ? 0.82 : 1.22;
        const nextDistance = THREE.MathUtils.clamp(direction.length() * factor, 2.8, 7.5);
        direction.setLength(nextDistance);
        camera.position.copy(controls.target).add(direction);
        controls.update();
        useEditorStore.getState().setCameraView('custom');
        return;
      }

      if (command === 'reset') {
        controls.reset();
        useEditorStore.getState().setCameraView('front');
        return;
      }

      if (command === 'fit') {
        const bounds = new THREE.Box3();
        scene.traverse((object) => {
          if (object.userData?.isTargetMesh && (object as THREE.Mesh).isMesh) {
            bounds.expandByObject(object);
          }
        });
        if (bounds.isEmpty()) return;
        const center = bounds.getCenter(new THREE.Vector3());
        const size = bounds.getSize(new THREE.Vector3());
        const maxDimension = Math.max(size.x, size.y, size.z, 0.1);
        const fovRadians = THREE.MathUtils.degToRad((camera as THREE.PerspectiveCamera).fov || 45);
        const fitDistance = (maxDimension / (2 * Math.tan(fovRadians / 2))) * 1.18;
        const direction = camera.position.clone().sub(controls.target);
        if (direction.lengthSq() < 0.001) direction.set(0, 0, 1);
        direction.normalize().multiplyScalar(THREE.MathUtils.clamp(fitDistance, 2.8, 7.5));
        controls.target.copy(center);
        camera.position.copy(center).add(direction);
        controls.update();
        useEditorStore.getState().setCameraView('custom');
      }
    };

    window.addEventListener('caliqui:camera-command', handleCameraCommand);
    return () => window.removeEventListener('caliqui:camera-command', handleCameraCommand);
  }, [camera, controlsRef, scene]);
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
  const isCameraOverride = globalToolMode === 'camera';
  // Every 3D edit gesture sets isDragging. Keep OrbitControls out of those gestures.
  const controlsEnabled = !isDragging && !isDrawingMode;

  return (
    <OrbitControls
      ref={controlsRef}
      makeDefault
      minPolarAngle={0.28}
      maxPolarAngle={Math.PI - 0.28}
      minDistance={2.8}
      maxDistance={7.5}
      enablePan={false}
      enableZoom
      enableRotate
      enableDamping
      dampingFactor={0.085}
      rotateSpeed={0.8}
      zoomSpeed={0.85}
      mouseButtons={{
        // In normal edit mode, left-drag on a blank garment surface is handled
        // by TShirtModel after hit-testing. OrbitControls must not also pan it.
        // Holding Space temporarily restores direct left-button orbit anywhere.
        LEFT: isCameraOverride ? THREE.MOUSE.ROTATE : THREE.MOUSE.PAN,
        MIDDLE: THREE.MOUSE.DOLLY,
        RIGHT: THREE.MOUSE.PAN,
      }}
      touches={{
        // One finger remains available for artwork manipulation. Two fingers
        // are reserved for garment orbit + pinch zoom.
        ONE: isCameraOverride ? THREE.TOUCH.ROTATE : THREE.TOUCH.PAN,
        TWO: THREE.TOUCH.DOLLY_ROTATE,
      }}
      enabled={controlsEnabled}
    />
  );
}

export function Preview3D() {
  const setCameraView = useEditorStore((s) => s.setCameraView);
  const controlsRef = useRef<OrbitControlsImpl>(null);

  return (
    <div className="studio-canvas-layer absolute inset-0 w-full h-full touch-none bg-transparent pointer-events-none select-none">
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
          onPointerMissed={(e) => {
            if (e.type === 'pointerup' || e.type === 'pointermove') return;
            const state = useEditorStore.getState();
            // Camera gestures are for inspecting the garment, not changing selection.
            if (state.globalToolMode === 'camera') return;
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
              <TShirtModel controlsRef={controlsRef} />
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
          <CameraCommandBridge controlsRef={controlsRef} />
          <BackgroundOrbitGesture controlsRef={controlsRef} />
          <StoreBoundOrbitControls controlsRef={controlsRef} />
        </Canvas>
      </div>
    </div>
  );
}
