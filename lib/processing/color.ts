import { createCanvas, get2DContext } from "./metadata";

/**
 * Calculates auto-levels histogram bounds (with 1% clipping) and warm-interior tone curves
 */
export function analyzeHistogram(data: Uint8ClampedArray): {
  minR: number;
  maxR: number;
  minG: number;
  maxG: number;
  minB: number;
  maxB: number;
} {
  const histR = new Uint32Array(256);
  const histG = new Uint32Array(256);
  const histB = new Uint32Array(256);
  const pixelCount = data.length / 4;

  for (let i = 0; i < data.length; i += 4) {
    histR[data[i]]++;
    histG[data[i + 1]]++;
    histB[data[i + 2]]++;
  }

  const clipCount = Math.floor(pixelCount * 0.005); // 0.5% clipping

  function findBounds(hist: Uint32Array): { min: number; max: number } {
    let count = 0;
    let min = 0;
    for (let i = 0; i < 256; i++) {
      count += hist[i];
      if (count > clipCount) {
        min = i;
        break;
      }
    }

    count = 0;
    let max = 255;
    for (let i = 255; i >= 0; i--) {
      count += hist[i];
      if (count > clipCount) {
        max = i;
        break;
      }
    }

    return { min: Math.min(min, 30), max: Math.max(max, 225) };
  }

  const boundsR = findBounds(histR);
  const boundsG = findBounds(histG);
  const boundsB = findBounds(histB);

  return {
    minR: boundsR.min,
    maxR: boundsR.max,
    minG: boundsG.min,
    maxG: boundsG.max,
    minB: boundsB.min,
    maxB: boundsB.max,
  };
}

/**
 * Applies non-destructive auto-color enhancement with intensity blending
 */
export function applyAutoColorToImageData(
  sourceData: ImageData,
  intensityPct: number
): ImageData {
  const intensity = Math.max(0, Math.min(100, intensityPct)) / 100;
  const src = sourceData.data;
  const result = new ImageData(
    new Uint8ClampedArray(src),
    sourceData.width,
    sourceData.height
  );
  const dst = result.data;

  if (intensity === 0) {
    return result;
  }

  const bounds = analyzeHistogram(src);

  const rangeR = Math.max(1, bounds.maxR - bounds.minR);
  const rangeG = Math.max(1, bounds.maxG - bounds.minG);
  const rangeB = Math.max(1, bounds.maxB - bounds.minB);

  for (let i = 0; i < src.length; i += 4) {
    const origR = src[i];
    const origG = src[i + 1];
    const origB = src[i + 2];

    // Auto-levels contrast stretch
    let adjR = ((origR - bounds.minR) / rangeR) * 255;
    let adjG = ((origG - bounds.minG) / rangeG) * 255;
    let adjB = ((origB - bounds.minB) / rangeB) * 255;

    // Subtle warm interior enhancement (slight lift in red/amber midtones, subtle shadow cooling)
    adjR = Math.min(255, Math.max(0, adjR * 1.02));
    adjG = Math.min(255, Math.max(0, adjG * 1.01));
    adjB = Math.min(255, Math.max(0, adjB * 0.99));

    // Linear blend with original pixels according to intensity
    dst[i] = Math.round(origR * (1 - intensity) + adjR * intensity);
    dst[i + 1] = Math.round(origG * (1 - intensity) + adjG * intensity);
    dst[i + 2] = Math.round(origB * (1 - intensity) + adjB * intensity);
    dst[i + 3] = src[i + 3]; // preserve alpha
  }

  return result;
}

/**
 * Applies color correction directly to a canvas
 */
export function applyAutoColorToCanvas(
  canvas: HTMLCanvasElement | OffscreenCanvas,
  intensityPct: number
): void {
  if (intensityPct <= 0) return;
  const ctx = get2DContext(canvas);
  const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const adjusted = applyAutoColorToImageData(imgData, intensityPct);
  ctx.putImageData(adjusted, 0, 0);
}

/**
 * Renders a split before/after comparison into a target preview canvas
 */
export function renderSplitComparison(
  targetCanvas: HTMLCanvasElement | OffscreenCanvas,
  originalCanvas: HTMLCanvasElement | OffscreenCanvas,
  adjustedCanvas: HTMLCanvasElement | OffscreenCanvas,
  splitPositionPct: number // 0 to 100
): void {
  const width = targetCanvas.width;
  const height = targetCanvas.height;
  const ctx = get2DContext(targetCanvas);
  const splitX = Math.round((width * splitPositionPct) / 100);

  ctx.clearRect(0, 0, width, height);

  // Draw adjusted (after) on right side
  ctx.drawImage(adjustedCanvas as CanvasImageSource, 0, 0, width, height);

  // Draw original (before) on left side with clipping
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, splitX, height);
  ctx.clip();
  ctx.drawImage(originalCanvas as CanvasImageSource, 0, 0, width, height);
  ctx.restore();

  // Draw divider line
  ctx.save();
  ctx.strokeStyle = "rgba(255, 255, 255, 0.9)";
  ctx.lineWidth = 2;
  ctx.shadowColor = "rgba(0, 0, 0, 0.5)";
  ctx.shadowBlur = 4;
  ctx.beginPath();
  ctx.moveTo(splitX, 0);
  ctx.lineTo(splitX, height);
  ctx.stroke();

  // Draw split handle circle
  const handleY = height / 2;
  ctx.fillStyle = "#ffffff";
  ctx.beginPath();
  ctx.arc(splitX, handleY, 14, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = "#333333";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(splitX, handleY, 14, 0, Math.PI * 2);
  ctx.stroke();

  // Draw arrows on handle
  ctx.fillStyle = "#333333";
  ctx.font = "bold 12px sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("◀▶", splitX, handleY);
  ctx.restore();
}
