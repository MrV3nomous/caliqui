export async function processAndCompressImage(
  file: File,
): Promise<{ blob: Blob; aspectRatio: number }> {
  return new Promise((resolve, reject) => {
    // Create a temporary object URL to read the file into an Image element
    const url = URL.createObjectURL(file);
    const img = new Image();

    img.onload = () => {
      // Immediately revoke the URL to prevent memory leaks
      URL.revokeObjectURL(url);

      let width = img.naturalWidth;
      let height = img.naturalHeight;
      const aspectRatio = width / height;

      // 4K Print Quality Cap - More than enough for pristine 300DPI physical printing
      const MAX_DIMENSION = 4096;

      if (width > MAX_DIMENSION || height > MAX_DIMENSION) {
        if (width > height) {
          width = MAX_DIMENSION;
          height = MAX_DIMENSION / aspectRatio;
        } else {
          height = MAX_DIMENSION;
          width = MAX_DIMENSION * aspectRatio;
        }
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');

      if (!ctx) {
        return reject(new Error('Failed to get canvas context'));
      }

      // Draw the image scaled to the new dimensions
      ctx.drawImage(img, 0, 0, width, height);

      // Convert to WebP for massive file size savings while preserving transparency and quality
      canvas.toBlob(
        (blob) => {
          if (blob) {
            resolve({ blob, aspectRatio });
          } else {
            reject(new Error('Canvas to Blob conversion failed'));
          }
        },
        'image/webp',
        0.9, // 90% quality compression
      );
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Failed to load image'));
    };

    img.src = url;
  });
}
