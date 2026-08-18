/**
 * Metadata Cleaner
 * Strips EXIF, GPS, camera metadata, and date-time headers by rasterizing pixel
 * data onto a fresh Canvas context, then re-encoding without metadata headers.
 */

export function createCanvas(
  width: number,
  height: number
): HTMLCanvasElement | OffscreenCanvas {
  if (typeof OffscreenCanvas !== "undefined") {
    return new OffscreenCanvas(width, height);
  }
  if (typeof document !== "undefined") {
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    return canvas;
  }
  throw new Error("No Canvas implementation available in current environment");
}

export function get2DContext(
  canvas: HTMLCanvasElement | OffscreenCanvas
): CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D {
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("Failed to acquire 2D canvas rendering context");
  }
  return ctx as CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;
}

export async function stripMetadataFromImageBitmap(
  bitmap: ImageBitmap | CanvasImageSource,
  width: number,
  height: number
): Promise<{
  canvas: HTMLCanvasElement | OffscreenCanvas;
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;
}> {
  const canvas = createCanvas(width, height);
  const ctx = get2DContext(canvas);
  ctx.drawImage(bitmap, 0, 0, width, height);
  return { canvas, ctx };
}

/**
 * Checks if a byte buffer contains standard EXIF JPEG marker (0xFF, 0xE1)
 */
export function hasExifHeader(buffer: ArrayBuffer): boolean {
  const bytes = new Uint8Array(buffer);
  if (bytes.length < 4) return false;
  // JPEG start-of-image 0xFF 0xD8
  if (bytes[0] === 0xff && bytes[1] === 0xd8) {
    for (let i = 2; i < Math.min(bytes.length - 4, 1024); i++) {
      // APP1 Marker (EXIF) 0xFF 0xE1
      if (bytes[i] === 0xff && bytes[i + 1] === 0xe1) {
        return true;
      }
    }
  }
  return false;
}
