export async function processAndCompressImage(
  file: File | Blob,
  maxSizeBytes = 90 * 1024, // 90KB Target
): Promise<{ blob: Blob; aspectRatio: number }> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();

    img.onload = async () => {
      URL.revokeObjectURL(url);

      let width = img.naturalWidth;
      let height = img.naturalHeight;
      const aspectRatio = width / height;

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

      // Recursive compression function to hit the target size
      const compressToTarget = async (
        currentWidth: number,
        currentHeight: number,
        quality: number,
      ): Promise<Blob> => {
        canvas.width = currentWidth;
        canvas.height = currentHeight;

        // Clear and draw
        ctx.clearRect(0, 0, currentWidth, currentHeight);
        ctx.drawImage(img, 0, 0, currentWidth, currentHeight);

        return new Promise<Blob>((resolveBlob, rejectBlob) => {
          canvas.toBlob(
            async (blob) => {
              if (!blob) return rejectBlob(new Error('Conversion failed'));

              if (blob.size <= maxSizeBytes || (currentWidth < 300 && quality <= 0.3)) {
                // Target hit OR we've shrunk it as much as reasonably possible
                resolveBlob(blob);
              } else {
                // Still too large. Reduce dimensions by 15% and quality slightly
                const newWidth = Math.max(currentWidth * 0.85, 100);
                const newHeight = newWidth / aspectRatio;
                const newQuality = Math.max(quality - 0.1, 0.3);

                try {
                  const smallerBlob = await compressToTarget(newWidth, newHeight, newQuality);
                  resolveBlob(smallerBlob);
                } catch (e) {
                  rejectBlob(e);
                }
              }
            },
            'image/webp',
            quality,
          );
        });
      };

      try {
        // Start compression loop at high quality
        const finalBlob = await compressToTarget(width, height, 0.85);
        resolve({ blob: finalBlob, aspectRatio });
      } catch (err) {
        reject(err);
      }
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Failed to load image'));
    };

    img.src = url;
  });
}
