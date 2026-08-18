import { describe, it, expect } from "vitest";
import {
  calculateTargetDimensions,
  RESIZE_PRESETS,
} from "@/lib/processing/resize";
import { calculateWatermarkLayout } from "@/lib/processing/watermark";
import {
  analyzeHistogram,
  applyAutoColorToImageData,
} from "@/lib/processing/color";
import { hasExifHeader } from "@/lib/processing/metadata";

describe("Processing Engine: Resize & Dimension Calculations", () => {
  it("preserves original dimensions when 'original' preset is chosen", () => {
    const dims = calculateTargetDimensions(4000, 3000, {
      presetId: "original",
      format: "image/jpeg",
      quality: 0.85,
    });
    expect(dims.targetWidth).toBe(4000);
    expect(dims.targetHeight).toBe(3000);
    expect(dims.sourceX).toBe(0);
    expect(dims.sourceY).toBe(0);
  });

  it("calculates Instagram Portrait (1080x1350, 4:5) cover crop correctly", () => {
    // 4000 x 3000 landscape input -> crops sides to 4:5 ratio
    const dims = calculateTargetDimensions(4000, 3000, {
      presetId: "instagram-portrait",
      format: "image/jpeg",
      quality: 0.85,
    });
    expect(dims.targetWidth).toBe(1080);
    expect(dims.targetHeight).toBe(1350);
    expect(dims.sourceWidth).toBe(2400); // 3000 * (4/5) = 2400
    expect(dims.sourceHeight).toBe(3000);
    expect(dims.sourceX).toBe(800); // (4000 - 2400) / 2 = 800
    expect(dims.sourceY).toBe(0);
  });

  it("calculates Instagram Square (1080x1080, 1:1) cover crop correctly", () => {
    const dims = calculateTargetDimensions(4000, 3000, {
      presetId: "instagram-square",
      format: "image/jpeg",
      quality: 0.85,
    });
    expect(dims.targetWidth).toBe(1080);
    expect(dims.targetHeight).toBe(1080);
    expect(dims.sourceWidth).toBe(3000);
    expect(dims.sourceHeight).toBe(3000);
    expect(dims.sourceX).toBe(500); // (4000 - 3000) / 2 = 500
  });

  it("calculates Instagram Story (1080x1920, 9:16) cover crop correctly", () => {
    const dims = calculateTargetDimensions(3000, 4000, {
      presetId: "instagram-story",
      format: "image/jpeg",
      quality: 0.85,
    });
    expect(dims.targetWidth).toBe(1080);
    expect(dims.targetHeight).toBe(1920);
  });

  it("calculates repositionable horizontal crop offsets correctly (x: 0, 50, 100)", () => {
    // 4000 x 3000 input -> target 4:5 (2400 x 3000 crop area), maxShiftX = 1600
    // Left crop (x = 0)
    const leftDims = calculateTargetDimensions(4000, 3000, {
      presetId: "instagram-portrait",
      cropOffset: { x: 0, y: 50 },
      format: "image/jpeg",
      quality: 0.85,
    });
    expect(leftDims.sourceX).toBe(0);

    // Center crop (x = 50)
    const centerDims = calculateTargetDimensions(4000, 3000, {
      presetId: "instagram-portrait",
      cropOffset: { x: 50, y: 50 },
      format: "image/jpeg",
      quality: 0.85,
    });
    expect(centerDims.sourceX).toBe(800);

    // Right crop (x = 100)
    const rightDims = calculateTargetDimensions(4000, 3000, {
      presetId: "instagram-portrait",
      cropOffset: { x: 100, y: 50 },
      format: "image/jpeg",
      quality: 0.85,
    });
    expect(rightDims.sourceX).toBe(1600);
  });

  it("calculates repositionable vertical crop offsets correctly (y: 0, 50, 100)", () => {
    // 3000 x 4000 portrait input cropped to 1:1 (3000 x 3000 crop area), maxShiftY = 1000
    // Top crop (y = 0)
    const topDims = calculateTargetDimensions(3000, 4000, {
      presetId: "instagram-square",
      cropOffset: { x: 50, y: 0 },
      format: "image/jpeg",
      quality: 0.85,
    });
    expect(topDims.sourceY).toBe(0);

    // Center crop (y = 50)
    const centerDims = calculateTargetDimensions(3000, 4000, {
      presetId: "instagram-square",
      cropOffset: { x: 50, y: 50 },
      format: "image/jpeg",
      quality: 0.85,
    });
    expect(centerDims.sourceY).toBe(500);

    // Bottom crop (y = 100)
    const bottomDims = calculateTargetDimensions(3000, 4000, {
      presetId: "instagram-square",
      cropOffset: { x: 50, y: 100 },
      format: "image/jpeg",
      quality: 0.85,
    });
    expect(bottomDims.sourceY).toBe(1000);
  });

  it("clamps out-of-range crop offsets safely to [0, 100]", () => {
    const clampedUnder = calculateTargetDimensions(4000, 3000, {
      presetId: "instagram-portrait",
      cropOffset: { x: -25, y: -50 },
      format: "image/jpeg",
      quality: 0.85,
    });
    expect(clampedUnder.sourceX).toBe(0);

    const clampedOver = calculateTargetDimensions(4000, 3000, {
      presetId: "instagram-portrait",
      cropOffset: { x: 150, y: 200 },
      format: "image/jpeg",
      quality: 0.85,
    });
    expect(clampedOver.sourceX).toBe(1600);
  });

  it("downscales images larger than 2048px for Web Portfolio preset", () => {
    const dims = calculateTargetDimensions(4000, 2000, {
      presetId: "web-portfolio",
      format: "image/webp",
      quality: 0.8,
    });
    expect(dims.targetWidth).toBe(2048);
    expect(dims.targetHeight).toBe(1024);
  });

  it("does not upscale images smaller than 2048px for Web Portfolio preset", () => {
    const dims = calculateTargetDimensions(1600, 1200, {
      presetId: "web-portfolio",
      format: "image/webp",
      quality: 0.8,
    });
    expect(dims.targetWidth).toBe(1600);
    expect(dims.targetHeight).toBe(1200);
  });

  it("handles custom dimensions with contain fit mode", () => {
    const dims = calculateTargetDimensions(4000, 3000, {
      presetId: "custom",
      customWidth: 1200,
      customHeight: 1200,
      fitMode: "contain",
      format: "image/jpeg",
      quality: 0.85,
    });
    expect(dims.targetWidth).toBe(1200);
    expect(dims.targetHeight).toBe(900);
  });
});

describe("Processing Engine: Watermark Layout Calculations", () => {
  const canvasW = 2000;
  const canvasH = 1500;
  const logoW = 400;
  const logoH = 200;

  it("positions watermark in bottom-right anchor correctly", () => {
    const layout = calculateWatermarkLayout(canvasW, canvasH, logoW, logoH, {
      position: "bottom-right",
      opacityPct: 80,
      scalePct: 15, // 15% of 2000 = 300px
      rotationDeg: 0,
    });

    expect(layout.width).toBe(300);
    expect(layout.height).toBe(150); // aspect ratio 200/400 * 300 = 150
    expect(layout.opacity).toBe(0.8);
    expect(layout.rotationRad).toBe(0);
    // default margin is 4% of min(2000, 1500) = 60px
    expect(layout.drawX).toBe(2000 - 300 - 60);
    expect(layout.drawY).toBe(1500 - 150 - 60);
  });

  it("positions watermark in center anchor correctly", () => {
    const layout = calculateWatermarkLayout(canvasW, canvasH, logoW, logoH, {
      position: "center",
      opacityPct: 50,
      scalePct: 20, // 400px
      rotationDeg: -45,
    });

    expect(layout.width).toBe(400);
    expect(layout.height).toBe(200);
    expect(layout.opacity).toBe(0.5);
    expect(layout.drawX).toBe((2000 - 400) / 2);
    expect(layout.drawY).toBe((1500 - 200) / 2);
    expect(layout.rotationRad).toBe((-45 * Math.PI) / 180);
  });

  it("positions watermark in top-left anchor correctly", () => {
    const layout = calculateWatermarkLayout(canvasW, canvasH, logoW, logoH, {
      position: "top-left",
      opacityPct: 100,
      scalePct: 10,
      rotationDeg: 0,
      offsetX: 5, // 5% of 2000 = 100px
      offsetY: 5, // 5% of 1500 = 75px
    });

    expect(layout.drawX).toBe(100);
    expect(layout.drawY).toBe(75);
    expect(layout.opacity).toBe(1.0);
  });
});

describe("Processing Engine: Color Adjustment & Histogram", () => {
  it("calculates histogram boundaries from pixel data", () => {
    // Create a 10x10 mock image buffer
    const buffer = new Uint8ClampedArray(10 * 10 * 4);
    for (let i = 0; i < buffer.length; i += 4) {
      buffer[i] = 50; // R
      buffer[i + 1] = 100; // G
      buffer[i + 2] = 150; // B
      buffer[i + 3] = 255; // A
    }

    const bounds = analyzeHistogram(buffer);
    expect(bounds.minR).toBeLessThanOrEqual(50);
    expect(bounds.maxR).toBeGreaterThanOrEqual(50);
    expect(bounds.minG).toBeLessThanOrEqual(100);
    expect(bounds.maxG).toBeGreaterThanOrEqual(100);
  });

  it("0% intensity returns identical pixel values (non-destructive)", () => {
    const srcData = new ImageData(10, 10);
    for (let i = 0; i < srcData.data.length; i += 4) {
      srcData.data[i] = 80;
      srcData.data[i + 1] = 120;
      srcData.data[i + 2] = 160;
      srcData.data[i + 3] = 255;
    }

    const result = applyAutoColorToImageData(srcData, 0);
    expect(result.data[0]).toBe(80);
    expect(result.data[1]).toBe(120);
    expect(result.data[2]).toBe(160);
    expect(result.data[3]).toBe(255);
  });

  it("70% intensity enhances pixels within valid 0-255 range", () => {
    const srcData = new ImageData(10, 10);
    for (let i = 0; i < srcData.data.length; i += 4) {
      srcData.data[i] = 60;
      srcData.data[i + 1] = 90;
      srcData.data[i + 2] = 140;
      srcData.data[i + 3] = 255;
    }

    const result = applyAutoColorToImageData(srcData, 70);
    for (let i = 0; i < result.data.length; i += 4) {
      expect(result.data[i]).toBeGreaterThanOrEqual(0);
      expect(result.data[i]).toBeLessThanOrEqual(255);
      expect(result.data[i + 1]).toBeGreaterThanOrEqual(0);
      expect(result.data[i + 1]).toBeLessThanOrEqual(255);
      expect(result.data[i + 2]).toBeGreaterThanOrEqual(0);
      expect(result.data[i + 2]).toBeLessThanOrEqual(255);
      expect(result.data[i + 3]).toBe(255);
    }
  });
});

describe("Processing Engine: Metadata Detection", () => {
  it("detects EXIF APP1 header marker in JPEG buffers", () => {
    // Valid JPEG header with APP1 marker: FF D8 FF E1
    const buffer = new Uint8Array([0xff, 0xd8, 0xff, 0xe1, 0x00, 0x10, 0x45, 0x78, 0x69, 0x66]).buffer;
    expect(hasExifHeader(buffer)).toBe(true);
  });

  it("returns false for buffers without EXIF header", () => {
    // JPEG header without APP1 (e.g. clean canvas output: FF D8 FF DB)
    const cleanBuffer = new Uint8Array([0xff, 0xd8, 0xff, 0xdb, 0x00, 0x43]).buffer;
    expect(hasExifHeader(cleanBuffer)).toBe(false);

    // PNG header
    const pngBuffer = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).buffer;
    expect(hasExifHeader(pngBuffer)).toBe(false);
  });
});
