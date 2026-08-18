import {
  ProcessedResult,
  ProcessingPipelineOptions,
} from "./types";
import {
  createCanvas,
  get2DContext,
  stripMetadataFromImageBitmap,
} from "./metadata";
import {
  calculateTargetDimensions,
  canvasToBlob,
  renderResizedCanvas,
} from "./resize";
import { compositeWatermark } from "./watermark";
import { applyAutoColorToCanvas } from "./color";

export async function processImageSource(
  sourceImage: ImageBitmap | CanvasImageSource,
  sourceWidth: number,
  sourceHeight: number,
  options: ProcessingPipelineOptions,
  logoImage?: CanvasImageSource,
  logoWidth?: number,
  logoHeight?: number
): Promise<ProcessedResult> {
  // Step 1: Strip metadata & initialize clean canvas
  const { canvas: workingCanvas } = await stripMetadataFromImageBitmap(
    sourceImage,
    sourceWidth,
    sourceHeight
  );

  // Step 2: Color Adjustment (if enabled)
  let colorAdjusted = false;
  if (
    options.colorAdjustment?.enabled &&
    options.colorAdjustment.intensityPct > 0
  ) {
    applyAutoColorToCanvas(
      workingCanvas,
      options.colorAdjustment.intensityPct
    );
    colorAdjusted = true;
  }

  // Step 3: Watermark Compositing (if enabled)
  let watermarked = false;
  let presetName: string | undefined = undefined;

  if (
    options.watermark?.enabled &&
    options.watermark.preset &&
    logoImage &&
    logoWidth &&
    logoHeight
  ) {
    compositeWatermark(
      workingCanvas,
      logoImage,
      logoWidth,
      logoHeight,
      options.watermark.preset.settings
    );
    watermarked = true;
    presetName = options.watermark.preset.name;
  }

  // Step 4: Resize & Crop
  const calculatedDims = calculateTargetDimensions(
    sourceWidth,
    sourceHeight,
    options.resize
  );

  const finalCanvas = renderResizedCanvas(
    workingCanvas,
    calculatedDims,
    options.resize.format
  );

  // Step 5: Encode to Blob
  const blob = await canvasToBlob(
    finalCanvas,
    options.resize.format,
    options.resize.quality
  );

  // Step 6: Generate small thumbnail for UI (e.g. max 240px)
  const thumbScale = Math.min(
    240 / calculatedDims.targetWidth,
    240 / calculatedDims.targetHeight,
    1
  );
  const thumbW = Math.max(1, Math.round(calculatedDims.targetWidth * thumbScale));
  const thumbH = Math.max(1, Math.round(calculatedDims.targetHeight * thumbScale));
  const thumbCanvas = createCanvas(thumbW, thumbH);
  const thumbCtx = get2DContext(thumbCanvas);
  thumbCtx.drawImage(
    finalCanvas as CanvasImageSource,
    0,
    0,
    calculatedDims.targetWidth,
    calculatedDims.targetHeight,
    0,
    0,
    thumbW,
    thumbH
  );

  let thumbnailDataUrl = "";
  if ("toDataURL" in thumbCanvas) {
    thumbnailDataUrl = (thumbCanvas as HTMLCanvasElement).toDataURL(
      "image/jpeg",
      0.7
    );
  } else {
    // In OffscreenCanvas context, convert to blob then read as data URL or object URL
    const thumbBlob = await (thumbCanvas as OffscreenCanvas).convertToBlob({
      type: "image/jpeg",
      quality: 0.7,
    });
    // In worker, we can transfer blob or use ArrayBuffer
    thumbnailDataUrl = "";
  }

  return {
    blob,
    width: calculatedDims.targetWidth,
    height: calculatedDims.targetHeight,
    byteSize: blob.size,
    format: options.resize.format,
    thumbnailDataUrl,
    operationsApplied: {
      metadataStripped: options.stripMetadata,
      watermarked,
      resized: options.resize.presetId !== "original",
      colorAdjusted,
      presetName,
    },
  };
}
