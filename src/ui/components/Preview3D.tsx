import { ContactShadows, Environment, OrbitControls, useGLTF } from '@react-three/drei';
import { Canvas, type ThreeEvent } from '@react-three/fiber';
import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { useEditorStore } from '@/ui/store/editor-store';

function TShirtModel() {
  // Load the exact asset path you provided
  const { scene } = useGLTF('/src/assets/models/tshirtman1.glb');
  const setActiveMesh = useEditorStore((state) => state.setActiveMesh);
  const textures = useEditorStore((state) => state.textures);

  // Clone the scene so we don't mutate the globally cached asset
  const copiedScene = useMemo(() => scene.clone(), [scene]);

  // Whenever the 2D textures in the store update, re-apply them to the 3D material
  useEffect(() => {
    copiedScene.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        child.castShadow = true;
        child.receiveShadow = true;

        // If we have a Fabric.js 2D canvas export for this specific mesh part
        if (textures[child.name]) {
          const loader = new THREE.TextureLoader();
          loader.load(textures[child.name], (texture) => {
            // GLTF models require UVs to be flipped on the Y axis
            texture.flipY = false;
            texture.colorSpace = THREE.SRGBColorSpace;

            if (child.material) {
              // Clone the material so parts don't accidentally share the same texture
              child.material = child.material.clone();
              child.material.map = texture;
              child.material.needsUpdate = true;
            }
          });
        }
      }
    });
  }, [copiedScene, textures]);

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: R3F primitives are canvas elements, not DOM
    <primitive
      object={copiedScene}
      scale={2} // Sketchfab models are often small; scale it up
      position={[0, -1, 0]}
      onClick={(e: ThreeEvent<MouseEvent>) => {
        e.stopPropagation(); // Prevent clicking through to the back of the shirt
        if (e.object.name) {
          setActiveMesh(e.object.name);
        }
      }}
      onPointerOver={(e: ThreeEvent<PointerEvent>) => {
        e.stopPropagation();
        document.body.style.cursor = 'crosshair';
      }}
      onPointerOut={(e: ThreeEvent<PointerEvent>) => {
        e.stopPropagation();
        document.body.style.cursor = 'default';
      }}
    />
  );
}

export function Preview3D() {
  return (
    <div className="w-full h-full bg-neutral-100 relative">
      <Canvas camera={{ position: [0, 0, 5], fov: 45 }}>
        <ambientLight intensity={0.6} />
        <spotLight position={[10, 10, 10]} angle={0.15} penumbra={1} intensity={1} castShadow />
        <Environment preset="city" />

        <TShirtModel />

        <ContactShadows position={[0, -1.5, 0]} opacity={0.5} scale={10} blur={2} far={4} />
        <OrbitControls makeDefault minPolarAngle={Math.PI / 4} maxPolarAngle={Math.PI / 1.5} />
      </Canvas>

      <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-surface/80 backdrop-blur-sm border border-border px-4 py-2 rounded-full text-xs font-semibold tracking-wider text-secondary shadow-sm pointer-events-none z-10">
        Click any part of the 3D model to edit its UV map
      </div>
    </div>
  );
}
