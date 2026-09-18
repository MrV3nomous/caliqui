import type { Config } from '@imgly/background-removal';
import * as imglyPkg from '@imgly/background-removal';

// Define the exact signature of the removal function to satisfy Biome
type ImglyRemover = (src: string, config?: Config) => Promise<Blob>;

export const removeImageBackground = async (
  imageSrc: string,
  onProgress?: (progress: number) => void,
): Promise<string> => {
  let lastProgress = -1;
  const config: Config = {
    // "isnet_quint8" is the official type-safe name for the ~40MB quantized model
    model: 'isnet_quint8',
    progress: (_key, current, total) => {
      if (onProgress && total > 0) {
        const percent = Math.round((current / total) * 100);
        // PERFORMANCE FIX: Only trigger a React render if the percentage actually changed
        if (percent !== lastProgress) {
          lastProgress = percent;
          onProgress(percent);
        }
      }
    },
  };
  try {
    // Safely resolve the background removal function to bypass Vite ESM default export issues
    // We use the strict ImglyRemover type instead of the banned 'Function' type
    const imgly = imglyPkg as unknown as {
      default?: ImglyRemover;
      removeBackground?: ImglyRemover;
    };

    // Dynamically pluck the correct function depending on how the browser resolves the module
    const remover = (imgly.default ?? imgly.removeBackground ?? imglyPkg) as ImglyRemover;

    const blob = await remover(imageSrc, config);

    // Convert the resulting PNG Blob to a Base64 Data URL so our 3D engine can render it
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch (error) {
    console.error('Background removal failed:', error);
    throw error;
  }
};
