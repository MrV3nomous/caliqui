// Helper to parse Hex to RGB
const hexToRgb = (hex: string) => {
  let c = hex.replace('#', '');
  if (c.length === 3)
    c = c
      .split('')
      .map((x) => x + x)
      .join('');
  return {
    r: parseInt(c.slice(0, 2), 16) || 0,
    g: parseInt(c.slice(2, 4), 16) || 0,
    b: parseInt(c.slice(4, 6), 16) || 0,
    a: 255,
  };
};

const colorsMatch = (
  data: Uint8ClampedArray,
  pos: number,
  targetR: number,
  targetG: number,
  targetB: number,
  targetA: number,
  tolerance: number,
) => {
  const r = data[pos];
  const g = data[pos + 1];
  const b = data[pos + 2];
  const a = data[pos + 3];

  if (a === 0 && targetA === 0) return true;

  return (
    Math.abs(r - targetR) <= tolerance &&
    Math.abs(g - targetG) <= tolerance &&
    Math.abs(b - targetB) <= tolerance &&
    Math.abs(a - targetA) <= tolerance
  );
};

export const applyBucketFill = (
  ctx: CanvasRenderingContext2D,
  startX: number,
  startY: number,
  fillColorHex: string,
  tolerance = 32,
) => {
  const width = ctx.canvas.width;
  const height = ctx.canvas.height;

  const x = Math.floor(Math.max(0, Math.min(startX, width - 1)));
  const y = Math.floor(Math.max(0, Math.min(startY, height - 1)));

  const imageData = ctx.getImageData(0, 0, width, height);
  const data = imageData.data;

  const targetPos = (y * width + x) * 4;
  const targetR = data[targetPos];
  const targetG = data[targetPos + 1];
  const targetB = data[targetPos + 2];
  const targetA = data[targetPos + 3];

  const fill = hexToRgb(fillColorHex);

  if (colorsMatch(data, targetPos, fill.r, fill.g, fill.b, fill.a, 0)) {
    return;
  }

  const stack = [x, y];

  while (stack.length > 0) {
    const curY = stack.pop();
    const curX = stack.pop();

    if (curY === undefined || curX === undefined) break;

    const pos = (curY * width + curX) * 4;

    if (colorsMatch(data, pos, targetR, targetG, targetB, targetA, tolerance)) {
      data[pos] = fill.r;
      data[pos + 1] = fill.g;
      data[pos + 2] = fill.b;
      data[pos + 3] = fill.a;

      if (curX > 0) stack.push(curX - 1, curY);
      if (curX < width - 1) stack.push(curX + 1, curY);
      if (curY > 0) stack.push(curX, curY - 1);
      if (curY < height - 1) stack.push(curX, curY + 1);
    }
  }

  ctx.putImageData(imageData, 0, 0);
};

const processBrushChunk = (
  ctx: CanvasRenderingContext2D,
  centerX: number,
  centerY: number,
  size: number,
  processPixel: (
    r: number,
    g: number,
    b: number,
    a: number,
    distance: number,
  ) => [number, number, number],
) => {
  const radius = Math.floor(size / 2);
  const startX = Math.max(0, Math.floor(centerX - radius));
  const startY = Math.max(0, Math.floor(centerY - radius));
  const chunkWidth = Math.min(ctx.canvas.width - startX, radius * 2);
  const chunkHeight = Math.min(ctx.canvas.height - startY, radius * 2);

  if (chunkWidth <= 0 || chunkHeight <= 0) return;

  const imageData = ctx.getImageData(startX, startY, chunkWidth, chunkHeight);
  const data = imageData.data;

  for (let y = 0; y < chunkHeight; y++) {
    for (let x = 0; x < chunkWidth; x++) {
      const dx = startX + x - centerX;
      const dy = startY + y - centerY;
      const distance = Math.sqrt(dx * dx + dy * dy);

      if (distance <= radius) {
        const i = (y * chunkWidth + x) * 4;

        if (data[i + 3] === 0) continue;

        const [newR, newG, newB] = processPixel(
          data[i],
          data[i + 1],
          data[i + 2],
          data[i + 3],
          distance,
        );

        const falloff = 1 - distance / radius;

        data[i] = data[i] + (newR - data[i]) * falloff;
        data[i + 1] = data[i + 1] + (newG - data[i + 1]) * falloff;
        data[i + 2] = data[i + 2] + (newB - data[i + 2]) * falloff;
      }
    }
  }

  ctx.putImageData(imageData, startX, startY);
};

export const applyBurn = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  intensity: number = 0.15,
) => {
  processBrushChunk(ctx, x, y, size, (r, g, b) => {
    return [
      Math.max(0, r - r * intensity),
      Math.max(0, g - g * intensity),
      Math.max(0, b - b * intensity),
    ];
  });
};

export const applySaturate = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  intensity: number = 0.2,
) => {
  processBrushChunk(ctx, x, y, size, (r, g, b) => {
    const luminance = 0.299 * r + 0.587 * g + 0.114 * b;
    return [
      Math.min(255, r + (r - luminance) * intensity),
      Math.min(255, g + (g - luminance) * intensity),
      Math.min(255, b + (b - luminance) * intensity),
    ];
  });
};

export const applyBlur = (
  ctx: CanvasRenderingContext2D,
  centerX: number,
  centerY: number,
  size: number,
  intensity: number = 2,
) => {
  const radius = Math.floor(size / 2);
  const startX = Math.max(0, Math.floor(centerX - radius));
  const startY = Math.max(0, Math.floor(centerY - radius));
  const chunkWidth = Math.min(ctx.canvas.width - startX, radius * 2);
  const chunkHeight = Math.min(ctx.canvas.height - startY, radius * 2);

  if (chunkWidth <= 0 || chunkHeight <= 0) return;

  const imageData = ctx.getImageData(startX, startY, chunkWidth, chunkHeight);
  const originalData = new Uint8ClampedArray(imageData.data);
  const data = imageData.data;

  const blurStrength = Math.max(1, Math.floor(intensity / 10));

  for (let y = 0; y < chunkHeight; y++) {
    for (let x = 0; x < chunkWidth; x++) {
      const dx = startX + x - centerX;
      const dy = startY + y - centerY;
      const distance = Math.sqrt(dx * dx + dy * dy);

      if (distance <= radius) {
        const i = (y * chunkWidth + x) * 4;

        let r = 0,
          g = 0,
          b = 0,
          a = 0,
          weightSum = 0,
          count = 0;

        for (let cy = -blurStrength; cy <= blurStrength; cy++) {
          for (let cx = -blurStrength; cx <= blurStrength; cx++) {
            const ny = y + cy;
            const nx = x + cx;
            if (nx >= 0 && nx < chunkWidth && ny >= 0 && ny < chunkHeight) {
              const ni = (ny * chunkWidth + nx) * 4;
              const alpha = originalData[ni + 3];
              if (alpha > 0) {
                const weight = alpha / 255;
                r += originalData[ni] * weight;
                g += originalData[ni + 1] * weight;
                b += originalData[ni + 2] * weight;
                weightSum += weight;
                a += alpha;
                count++;
              }
            }
          }
        }

        if (count > 0) {
          const falloff = 1 - distance / radius;
          const finalR = weightSum > 0 ? r / weightSum : 0;
          const finalG = weightSum > 0 ? g / weightSum : 0;
          const finalB = weightSum > 0 ? b / weightSum : 0;
          const finalA = a / count;

          data[i] = data[i] + (finalR - data[i]) * falloff;
          data[i + 1] = data[i + 1] + (finalG - data[i + 1]) * falloff;
          data[i + 2] = data[i + 2] + (finalB - data[i + 2]) * falloff;
          data[i + 3] = data[i + 3] + (finalA - data[i + 3]) * falloff;
        }
      }
    }
  }

  ctx.putImageData(imageData, startX, startY);
};

export const applyCrop = (
  ctx: CanvasRenderingContext2D,
  rect: { x: number; y: number; width: number; height: number },
  inverse = false,
) => {
  const width = ctx.canvas.width;
  const height = ctx.canvas.height;

  let rx = rect.x;
  let ry = rect.y;
  let rw = rect.width;
  let rh = rect.height;

  if (rw < 0) {
    rx += rw;
    rw = Math.abs(rw);
  }
  if (rh < 0) {
    ry += rh;
    rh = Math.abs(rh);
  }

  let startX = Math.floor(rx);
  let startY = Math.floor(ry);
  let rectWidth = Math.floor(rw);
  let rectHeight = Math.floor(rh);

  if (startX < 0) {
    rectWidth += startX;
    startX = 0;
  }
  if (startY < 0) {
    rectHeight += startY;
    startY = 0;
  }
  if (startX + rectWidth > width) {
    rectWidth = width - startX;
  }
  if (startY + rectHeight > height) {
    rectHeight = height - startY;
  }

  if (rectWidth <= 0 || rectHeight <= 0) {
    if (!inverse) ctx.clearRect(0, 0, width, height);
    return;
  }

  const imageData = ctx.getImageData(0, 0, width, height);
  const data = imageData.data;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const inBounds =
        x >= startX && x < startX + rectWidth && y >= startY && y < startY + rectHeight;
      const shouldClear = inverse ? inBounds : !inBounds;

      if (shouldClear) {
        const i = (y * width + x) * 4;
        data[i] = 0;
        data[i + 1] = 0;
        data[i + 2] = 0;
        data[i + 3] = 0;
      }
    }
  }

  ctx.putImageData(imageData, 0, 0);
};

/**
 * Scans a canvas to find the absolute tightest bounding box surrounding non-transparent pixels.
 * Used to snap hitboxes perfectly around extracted assets!
 */
export const getTightBoundingBox = (canvas: HTMLCanvasElement) => {
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return null;

  const width = canvas.width;
  const height = canvas.height;
  const imageData = ctx.getImageData(0, 0, width, height);
  const data = imageData.data;

  let minX = width;
  let minY = height;
  let maxX = 0;
  let maxY = 0;
  let hasPixels = false;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const alpha = data[(y * width + x) * 4 + 3];
      if (alpha > 0) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
        hasPixels = true;
      }
    }
  }

  if (!hasPixels) return null;

  return {
    x: minX,
    y: minY,
    width: maxX - minX + 1,
    height: maxY - minY + 1,
  };
};

export const applyErase = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  intensity: number,
) => {
  ctx.save();
  // This is the magic canvas property that turns brush strokes into transparency
  ctx.globalCompositeOperation = 'destination-out';

  ctx.beginPath();
  ctx.arc(x, y, size / 2, 0, Math.PI * 2);

  // Intensity dictates how "hard" the eraser is. 1 = full erase, lower = soft fade.
  ctx.fillStyle = `rgba(0, 0, 0, ${intensity})`;
  ctx.fill();

  ctx.restore();
};
