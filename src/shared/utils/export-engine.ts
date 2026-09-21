import type { DecalData } from '@/ui/store/editor-store';

export const PRINT_CANVAS_SIZE = 4096; // 300 DPI industry standard for DTG

export const generateMockup = (canvas: HTMLCanvasElement): string => {
  // Captures the exact state of the Three.js WebGL viewport
  return canvas.toDataURL('image/png', 1.0);
};

export const generatePrintFile = async (decals: DecalData[]): Promise<Blob> => {
  return new Promise((resolve, reject) => {
    const canvas = document.createElement('canvas');
    canvas.width = PRINT_CANVAS_SIZE;
    canvas.height = PRINT_CANVAS_SIZE;
    const ctx = canvas.getContext('2d');

    if (!ctx) {
      return reject(new Error('Failed to initialize 2D canvas context'));
    }

    // Ensure transparent background for DTG printers
    ctx.clearRect(0, 0, PRINT_CANVAS_SIZE, PRINT_CANVAS_SIZE);

    // Filter out irrelevant tools (like camera or select modes if they leak into state)
    const validDecals = decals.filter(
      (d) =>
        d.src &&
        (d.type === 'shape' || d.type === 'text' || d.type === 'image' || d.type === 'drawing'),
    );

    if (validDecals.length === 0) {
      // Return a blank transparent blob if no designs exist
      canvas.toBlob((blob) => {
        if (blob) resolve(blob);
        else reject(new Error('Failed to generate blob'));
      }, 'image/png');
      return;
    }

    let loadedCount = 0;
    const imagesToDraw: { img: HTMLImageElement; decal: DecalData }[] = [];

    validDecals.forEach((decal, index) => {
      const img = new Image();
      img.crossOrigin = 'anonymous'; // Prevent CORS tainting from Supabase URLs

      img.onload = () => {
        // Store in array to maintain Z-index order regardless of load times
        imagesToDraw[index] = { img, decal };
        loadedCount++;

        if (loadedCount === validDecals.length) {
          drawAllAndResolve();
        }
      };

      img.onerror = () => {
        console.warn(`Failed to load asset for decal ID: ${decal.id}`);
        loadedCount++;
        if (loadedCount === validDecals.length) {
          drawAllAndResolve();
        }
      };

      img.src = decal.src || '';
    });

    const drawAllAndResolve = () => {
      // Remove any failed loads (undefined indexes)
      const validImages = imagesToDraw.filter(Boolean);

      validImages.forEach(({ img, decal }) => {
        ctx.save();

        // Spatial Math: Map WebGL coordinates (-0.5 to 0.5) to Canvas Pixels (0 to 4096)
        // WebGL origin is center [0,0]. Canvas origin is top-left [0,0].
        // WebGL Y is up. Canvas Y is down.
        const [x, y] = decal.position;

        // Map abstract 3D position to flat 2D pixels
        const pixelX = (x + 0.5) * PRINT_CANVAS_SIZE;
        const pixelY = (-y + 0.5) * PRINT_CANVAS_SIZE;

        // Base resolution of our decal textures is 512px. Scale it relative to the 4096px board.
        const baseSize = 512;
        const renderScale = decal.scale * (PRINT_CANVAS_SIZE / baseSize);

        const drawWidth = baseSize * renderScale;
        const drawHeight = (baseSize / (decal.aspectRatio || 1)) * renderScale;

        // Navigate to the pivot point (center of the image)
        ctx.translate(pixelX, pixelY);

        // Apply Z-axis rotation (WebGL rotation is mapped to Z for flat objects)
        const rotationZ = decal.rotation[2] || 0;
        const rotationOffset = decal.rotationOffset || 0;
        ctx.rotate(rotationZ + rotationOffset);

        // Apply scale modifiers (squeeze)
        const scaleX = decal.scaleX || 1;
        const scaleY = decal.scaleY || 1;
        ctx.scale(scaleX, scaleY);

        // Draw the image offset by half its size to center it on the pivot
        ctx.drawImage(img, -drawWidth / 2, -drawHeight / 2, drawWidth, drawHeight);

        ctx.restore();
      });

      canvas.toBlob((blob) => {
        if (blob) resolve(blob);
        else reject(new Error('Blob creation failed.'));
      }, 'image/png');
    };
  });
};
