import {
  OutputFormat,
  ResizeOptions,
  ResizePresetConfig,
  ResizePresetId,
} from "./types";
import { createCanvas, get2DContext } from "./metadata";

export const RESIZE_PRESETS: Record<ResizePresetId, ResizePresetConfig> = {
  original: {
    id: "original",
    label: "Original Size",
    description: "Keep original resolution without downscaling",
    fitMode: "contain",
  },
  "instagram-portrait": {
    id: "instagram-portrait",
    label: "Instagram Portrait (4:5)",
    description: "1080 x 1350 px optimized for feed posts",
    width: 1080,
    height: 1350,
    aspectRatio: 4 / 5,
    fitMode: "cover",
  },
  "instagram-square": {
    id: "instagram-square",
    label: "Instagram Square (1:1)",
    description: "1080 x 1080 px for standard feed grid",
    width: 1080,
    height: 1080,
    aspectRatio: 1,
    fitMode: "cover",
  },
  "instagram-story": {
    id: "instagram-story",
    label: "Instagram Story & Reels (9:16)",
    description: "1080 x 1920 px vertical fullscreen",
    width: 1080,
    height: 1920,
    aspectRatio: 9 / 16,
    fitMode: "cover",
  },
  "web-portfolio": {
    id: "web-portfolio",
    label: "Web Portfolio (2048px Max)",
    description: "Downscale longest edge to 2048px for fast page loading",
    maxDimension: 2048,
    fitMode: "contain",
  },
  "client-delivery-hd": {
    id: "client-delivery-hd",
    label: "Client Delivery HD (2560px Max)",
    description: "2560px max width/height high-fidelity delivery",
    maxDimension: 2560,
    fitMode: "contain",
  },
  custom: {
    id: "custom",
    label: "Custom Dimensions",
    description: "Specify explicit width and height",
    fitMode: "contain",
  },
};

export interface CalculatedDimensions {
  targetWidth: number;
  targetHeight: number;
  sourceX: number;
  sourceY: number;
  sourceWidth: number;
  sourceHeight: number;
  destX: number;
  destY: number;
  destWidth: number;
  destHeight: number;
}

export function calculateTargetDimensions(
  srcWidth: number,
  srcHeight: number,
  options: ResizeOptions
): CalculatedDimensions {
  const preset = RESIZE_PRESETS[options.presetId] || RESIZE_PRESETS.original;
  const fitMode = options.fitMode || preset.fitMode;

  const rawOffsetX = options.cropOffset?.x ?? 50;
  const rawOffsetY = options.cropOffset?.y ?? 50;
  const offsetX = Math.max(0, Math.min(100, rawOffsetX));
  const offsetY = Math.max(0, Math.min(100, rawOffsetY));

  if (preset.id === "original") {
    return {
      targetWidth: srcWidth,
      targetHeight: srcHeight,
      sourceX: 0,
      sourceY: 0,
      sourceWidth: srcWidth,
      sourceHeight: srcHeight,
      destX: 0,
      destY: 0,
      destWidth: srcWidth,
      destHeight: srcHeight,
    };
  }

  if (preset.id === "custom") {
    const customW = options.customWidth || srcWidth;
    const customH = options.customHeight || srcHeight;

    if (fitMode === "cover") {
      const srcRatio = srcWidth / srcHeight;
      const targetRatio = customW / customH;
      let sW = srcWidth;
      let sH = srcHeight;
      let sX = 0;
      let sY = 0;

      if (srcRatio > targetRatio) {
        sW = srcHeight * targetRatio;
        const maxShiftX = srcWidth - sW;
        sX = maxShiftX * (offsetX / 100);
      } else {
        sH = srcWidth / targetRatio;
        const maxShiftY = srcHeight - sH;
        sY = maxShiftY * (offsetY / 100);
      }

      return {
        targetWidth: customW,
        targetHeight: customH,
        sourceX: Math.round(sX),
        sourceY: Math.round(sY),
        sourceWidth: Math.round(sW),
        sourceHeight: Math.round(sH),
        destX: 0,
        destY: 0,
        destWidth: customW,
        destHeight: customH,
      };
    } else {
      // contain: fit inside customW x customH while preserving src aspect
      const scale = Math.min(customW / srcWidth, customH / srcHeight, 1);
      const targetW = Math.round(srcWidth * scale);
      const targetH = Math.round(srcHeight * scale);
      return {
        targetWidth: targetW,
        targetHeight: targetH,
        sourceX: 0,
        sourceY: 0,
        sourceWidth: srcWidth,
        sourceHeight: srcHeight,
        destX: 0,
        destY: 0,
        destWidth: targetW,
        destHeight: targetH,
      };
    }
  }

  if (preset.maxDimension) {
    const maxDim = preset.maxDimension;
    const longestEdge = Math.max(srcWidth, srcHeight);
    if (longestEdge <= maxDim) {
      return {
        targetWidth: srcWidth,
        targetHeight: srcHeight,
        sourceX: 0,
        sourceY: 0,
        sourceWidth: srcWidth,
        sourceHeight: srcHeight,
        destX: 0,
        destY: 0,
        destWidth: srcWidth,
        destHeight: srcHeight,
      };
    }
    const scale = maxDim / longestEdge;
    const targetW = Math.round(srcWidth * scale);
    const targetH = Math.round(srcHeight * scale);
    return {
      targetWidth: targetW,
      targetHeight: targetH,
      sourceX: 0,
      sourceY: 0,
      sourceWidth: srcWidth,
      sourceHeight: srcHeight,
      destX: 0,
      destY: 0,
      destWidth: targetW,
      destHeight: targetH,
    };
  }

  if (preset.width && preset.height) {
    const targetW = preset.width;
    const targetH = preset.height;

    if (fitMode === "cover") {
      const srcRatio = srcWidth / srcHeight;
      const targetRatio = targetW / targetH;
      let sW = srcWidth;
      let sH = srcHeight;
      let sX = 0;
      let sY = 0;

      if (srcRatio > targetRatio) {
        sW = srcHeight * targetRatio;
        const maxShiftX = srcWidth - sW;
        sX = maxShiftX * (offsetX / 100);
      } else {
        sH = srcWidth / targetRatio;
        const maxShiftY = srcHeight - sH;
        sY = maxShiftY * (offsetY / 100);
      }

      return {
        targetWidth: targetW,
        targetHeight: targetH,
        sourceX: Math.round(sX),
        sourceY: Math.round(sY),
        sourceWidth: Math.round(sW),
        sourceHeight: Math.round(sH),
        destX: 0,
        destY: 0,
        destWidth: targetW,
        destHeight: targetH,
      };
    } else {
      // contain: preserve src aspect ratio and fit within target bounds
      const scale = Math.min(targetW / srcWidth, targetH / srcHeight, 1);
      const outW = Math.round(srcWidth * scale);
      const outH = Math.round(srcHeight * scale);
      return {
        targetWidth: outW,
        targetHeight: outH,
        sourceX: 0,
        sourceY: 0,
        sourceWidth: srcWidth,
        sourceHeight: srcHeight,
        destX: 0,
        destY: 0,
        destWidth: outW,
        destHeight: outH,
      };
    }
  }

  return {
    targetWidth: srcWidth,
    targetHeight: srcHeight,
    sourceX: 0,
    sourceY: 0,
    sourceWidth: srcWidth,
    sourceHeight: srcHeight,
    destX: 0,
    destY: 0,
    destWidth: srcWidth,
    destHeight: srcHeight,
  };
}

/**
 * Resizes source canvas to target dimensions and returns rendered canvas
 */
export function renderResizedCanvas(
  sourceCanvas: HTMLCanvasElement | OffscreenCanvas,
  dim: CalculatedDimensions,
  outputFormat: OutputFormat
): HTMLCanvasElement | OffscreenCanvas {
  const targetCanvas = createCanvas(dim.targetWidth, dim.targetHeight);
  const targetCtx = get2DContext(targetCanvas);

  // If converting to JPEG, fill with clean white background so transparent areas don't render black
  if (outputFormat === "image/jpeg") {
    targetCtx.fillStyle = "#ffffff";
    targetCtx.fillRect(0, 0, dim.targetWidth, dim.targetHeight);
  }

  targetCtx.imageSmoothingEnabled = true;
  targetCtx.imageSmoothingQuality = "high";

  targetCtx.drawImage(
    sourceCanvas as CanvasImageSource,
    dim.sourceX,
    dim.sourceY,
    dim.sourceWidth,
    dim.sourceHeight,
    dim.destX,
    dim.destY,
    dim.destWidth,
    dim.destHeight
  );

  return targetCanvas;
}

/**
 * Encodes canvas to Blob
 */
export async function canvasToBlob(
  canvas: HTMLCanvasElement | OffscreenCanvas,
  format: OutputFormat,
  quality: number
): Promise<Blob> {
  const clampedQuality = Math.max(0.1, Math.min(1.0, quality));

  if ("convertToBlob" in canvas) {
    return await (canvas as OffscreenCanvas).convertToBlob({
      type: format,
      quality: clampedQuality,
    });
  }

  if ("toBlob" in canvas) {
    return new Promise<Blob>((resolve, reject) => {
      (canvas as HTMLCanvasElement).toBlob(
        (blob) => {
          if (blob) {
            resolve(blob);
          } else {
            reject(new Error("Failed to encode canvas to blob"));
          }
        },
        format,
        clampedQuality
      );
    });
  }

  throw new Error("Canvas encoding is not supported in this environment");
}
