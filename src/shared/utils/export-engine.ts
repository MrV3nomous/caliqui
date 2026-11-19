import type { DecalData } from '@/ui/store/editor-store';

export const PRINT_CANVAS_SIZE = 4096; // 4096×4096 transparent print export canvas

const safeNumber = (value: unknown, fallback = 0): number =>
  typeof value === 'number' && Number.isFinite(value) ? value : fallback;

const safePositive = (value: unknown, fallback = 1): number =>
  typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : fallback;

const canvasToBlob = (canvas: HTMLCanvasElement, type: string): Promise<Blob> => {
  return new Promise((resolve, reject) => {
    try {
      canvas.toBlob((blob) => {
        if (blob) {
          resolve(blob);
        } else {
          reject(new Error('Failed to encode canvas to Blob.'));
        }
      }, type);
    } catch (error) {
      reject(
        error instanceof Error ? error : new Error('Synchronous error during canvas encoding.'),
      );
    }
  });
};

export const generateMockup = (canvas: HTMLCanvasElement): string => {
  try {
    const dataUrl = canvas.toDataURL('image/png');
    if (!dataUrl || dataUrl === 'data:,') {
      throw new Error('Canvas export failed or returned empty data.');
    }
    return dataUrl;
  } catch (error) {
    throw error instanceof Error
      ? error
      : new Error('Unknown error generating mockup data URL. Check for tainted canvas issues.');
  }
};

const renderArtwork = async (
  decals: DecalData[],
  outputSize: number,
  watermarkText?: string,
): Promise<Blob> => {
  const canvas = document.createElement('canvas');
  canvas.width = outputSize;
  canvas.height = outputSize;
  const ctx = canvas.getContext('2d');

  if (!ctx) {
    throw new Error('Failed to initialize 2D canvas context');
  }

  // Ensure transparent background for DTG printers
  ctx.clearRect(0, 0, outputSize, outputSize);

  // Filter out irrelevant tools (like camera or select modes if they leak into state)
  const validDecals = decals.filter(
    (d) =>
      d.src &&
      (d.type === 'shape' || d.type === 'text' || d.type === 'image' || d.type === 'drawing'),
  );

  if (validDecals.length === 0) {
    // Return a blank transparent blob if no designs exist
    return canvasToBlob(canvas, 'image/png');
  }

  const loadedImages = await Promise.all(
    validDecals.map(
      (decal) =>
        new Promise<{ img: HTMLImageElement; decal: DecalData }>((resolve, reject) => {
          const img = new Image();
          img.crossOrigin = 'anonymous'; // Prevent CORS tainting from Supabase URLs

          img.onload = () => resolve({ img, decal });

          img.onerror = () => {
            reject(new Error(`Failed to load artwork for decal ${decal.id}`));
          };

          img.src = decal.src || '';
        }),
    ),
  );

  loadedImages.forEach(({ img, decal }) => {
    ctx.save();

    // Spatial Math: Map WebGL coordinates (-0.5 to 0.5) to Canvas Pixels (0 to 4096)
    // WebGL origin is center [0,0]. Canvas origin is top-left [0,0].
    // WebGL Y is up. Canvas Y is down.

    // Safely extract position array or provide fallbacks
    const posX = Array.isArray(decal.position) ? safeNumber(decal.position[0]) : 0;
    const posY = Array.isArray(decal.position) ? safeNumber(decal.position[1]) : 0;

    // Map abstract 3D position to flat 2D pixels
    const pixelX = (posX + 0.5) * outputSize;
    const pixelY = (-posY + 0.5) * outputSize;

    // Base resolution of our decal textures is 512px. Scale it relative to the 4096px board.
    const baseSize = 512;
    const safeDecalScale = safePositive(decal.scale, 0.2); // Fallback to a reasonable default
    const renderScale = safeDecalScale * (outputSize / baseSize);

    const aspect = safePositive(decal.aspectRatio, 1);
    const drawWidth = baseSize * renderScale;
    const drawHeight = (baseSize / aspect) * renderScale;

    // Navigate to the pivot point (center of the image)
    ctx.translate(pixelX, pixelY);

    // Apply Z-axis rotation (WebGL rotation is mapped to Z for flat objects)
    const rotationZ = Array.isArray(decal.rotation) ? safeNumber(decal.rotation[2]) : 0;
    const rotationOffset = safeNumber(decal.rotationOffset, 0);
    ctx.rotate(rotationZ + rotationOffset);

    // Apply scale modifiers (squeeze)
    const scaleX = safePositive(decal.scaleX, 1);
    const scaleY = safePositive(decal.scaleY, 1);
    ctx.scale(scaleX, scaleY);

    // Draw the image offset by half its size to center it on the pivot
    ctx.drawImage(img, -drawWidth / 2, -drawHeight / 2, drawWidth, drawHeight);

    ctx.restore();
  });

  if (watermarkText) {
    // Customer-facing review previews are deliberately lower resolution and carry
    // a watermark in the pixels themselves, not merely as a removable UI overlay.
    ctx.save();
    ctx.translate(outputSize / 2, outputSize / 2);
    ctx.rotate(-Math.PI / 6);
    const fontSize = Math.max(24, Math.round(outputSize * 0.045));
    ctx.font = `700 ${fontSize}px Arial, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = 'rgba(35, 35, 35, 0.18)';
    const spacing = Math.max(220, Math.round(outputSize * 0.36));
    for (let y = -outputSize; y <= outputSize; y += spacing) {
      for (let x = -outputSize; x <= outputSize; x += spacing) {
        ctx.fillText(watermarkText, x, y);
      }
    }
    ctx.restore();
  }

  return canvasToBlob(canvas, 'image/png');
};

/** Brand-only high-resolution artwork generation. Customer UI must not expose this output. */
export const generatePrintFile = async (decals: DecalData[]): Promise<Blob> =>
  renderArtwork(decals, PRINT_CANVAS_SIZE);

/** Low-resolution, permanently watermarked artwork used only for customer review. */
export const generateDesignPreview = async (decals: DecalData[]): Promise<Blob> =>
  renderArtwork(decals, 1024, 'CALIQUI · DESIGN PREVIEW');
