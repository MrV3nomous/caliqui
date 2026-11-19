const toError = (value: unknown, fallbackMessage: string): Error => {
  return value instanceof Error ? value : new Error(fallbackMessage);
};

const safeDimension = (value: number): number => {
  return Math.max(1, Math.round(Number.isFinite(value) ? value : 1));
};

export async function processAndCompressImage(
  file: File | Blob,
  maxSizeBytes = 90 * 1024, // 90KB Target
): Promise<{ blob: Blob; aspectRatio: number }> {
  return new Promise((resolve, reject) => {
    if (!Number.isFinite(maxSizeBytes) || maxSizeBytes <= 0) {
      return reject(new Error('Invalid max size bytes'));
    }

    const url = URL.createObjectURL(file);
    const img = new Image();

    img.onload = async () => {
      URL.revokeObjectURL(url);

      try {
        const originalWidth = img.naturalWidth;
        const originalHeight = img.naturalHeight;

        if (
          !Number.isFinite(originalWidth) ||
          originalWidth <= 0 ||
          !Number.isFinite(originalHeight) ||
          originalHeight <= 0
        ) {
          return reject(new Error('Invalid image dimensions'));
        }

        const aspectRatio = originalWidth / originalHeight;

        let width = originalWidth;
        let height = originalHeight;

        // Aggressive initial downscale if the image is massive
        const MAX_INITIAL_DIMENSION = 1200;
        if (width > MAX_INITIAL_DIMENSION || height > MAX_INITIAL_DIMENSION) {
          if (width > height) {
            width = MAX_INITIAL_DIMENSION;
            height = MAX_INITIAL_DIMENSION / aspectRatio;
          } else {
            height = MAX_INITIAL_DIMENSION;
            width = MAX_INITIAL_DIMENSION * aspectRatio;
          }
        }

        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');

        if (!ctx) {
          return reject(new Error('Failed to get canvas context'));
        }

        const getCanvasBlob = (
          currentWidth: number,
          currentHeight: number,
          quality: number,
        ): Promise<Blob> => {
          return new Promise((resolveBlob, rejectBlob) => {
            try {
              canvas.width = safeDimension(currentWidth);
              canvas.height = safeDimension(currentHeight);

              ctx.clearRect(0, 0, canvas.width, canvas.height);
              ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

              canvas.toBlob(
                (blob) => {
                  if (!blob) {
                    rejectBlob(new Error('Canvas to Blob conversion failed'));
                  } else {
                    resolveBlob(blob);
                  }
                },
                'image/webp',
                quality,
              );
            } catch (e) {
              rejectBlob(toError(e, 'Image encoding failed'));
            }
          });
        };

        let currentWidth = width;
        let currentHeight = height;
        let currentQuality = 0.85;
        let lastBlob: Blob | null = null;

        const MAX_ITERATIONS = 10;
        let iteration = 0;

        while (iteration < MAX_ITERATIONS) {
          iteration++;

          lastBlob = await getCanvasBlob(currentWidth, currentHeight, currentQuality);

          // Success if we hit the target size OR if we've hit the compression floor
          if (lastBlob.size <= maxSizeBytes || (currentWidth < 300 && currentQuality <= 0.3)) {
            return resolve({ blob: lastBlob, aspectRatio });
          }

          currentWidth = Math.max(currentWidth * 0.85, 100);
          currentHeight = currentWidth / aspectRatio;
          currentQuality = Math.max(currentQuality - 0.1, 0.3);
        }

        // If we hit MAX_ITERATIONS without meeting the target, return the smallest we got
        if (lastBlob) {
          resolve({ blob: lastBlob, aspectRatio });
        } else {
          reject(new Error('Compression loop exhausted without producing a valid blob.'));
        }
      } catch (err) {
        reject(toError(err, 'Image compression failed'));
      }
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Failed to load image'));
    };

    img.src = url;
  });
}
