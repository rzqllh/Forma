import { PresetSettings } from "@/db/schema";
import { get2DContext } from "./metadata";

export interface WatermarkLayout {
  drawX: number;
  drawY: number;
  width: number;
  height: number;
  centerX: number;
  centerY: number;
  rotationRad: number;
  opacity: number;
}

/**
 * Computes exact placement coordinates and dimensions for watermark compositing
 */
export function calculateWatermarkLayout(
  canvasWidth: number,
  canvasHeight: number,
  logoWidth: number,
  logoHeight: number,
  settings: PresetSettings
): WatermarkLayout {
  // Scale logo relative to canvas width
  const scale = Math.max(1, Math.min(100, settings.scalePct)) / 100;
  const targetLogoWidth = canvasWidth * scale;
  const logoAspectRatio = logoHeight / logoWidth;
  const targetLogoHeight = targetLogoWidth * logoAspectRatio;

  // Margin offset (default 4% of shortest edge)
  const defaultMargin = Math.min(canvasWidth, canvasHeight) * 0.04;
  const marginX =
    settings.offsetX !== undefined
      ? (canvasWidth * settings.offsetX) / 100
      : defaultMargin;
  const marginY =
    settings.offsetY !== undefined
      ? (canvasHeight * settings.offsetY) / 100
      : defaultMargin;

  let x = 0;
  let y = 0;

  switch (settings.position) {
    case "top-left":
      x = marginX;
      y = marginY;
      break;
    case "top-center":
      x = (canvasWidth - targetLogoWidth) / 2;
      y = marginY;
      break;
    case "top-right":
      x = canvasWidth - targetLogoWidth - marginX;
      y = marginY;
      break;
    case "center-left":
      x = marginX;
      y = (canvasHeight - targetLogoHeight) / 2;
      break;
    case "center":
      x = (canvasWidth - targetLogoWidth) / 2;
      y = (canvasHeight - targetLogoHeight) / 2;
      break;
    case "center-right":
      x = canvasWidth - targetLogoWidth - marginX;
      y = (canvasHeight - targetLogoHeight) / 2;
      break;
    case "bottom-left":
      x = marginX;
      y = canvasHeight - targetLogoHeight - marginY;
      break;
    case "bottom-center":
      x = (canvasWidth - targetLogoWidth) / 2;
      y = canvasHeight - targetLogoHeight - marginY;
      break;
    case "bottom-right":
    default:
      x = canvasWidth - targetLogoWidth - marginX;
      y = canvasHeight - targetLogoHeight - marginY;
      break;
  }

  const opacity = Math.max(0, Math.min(100, settings.opacityPct)) / 100;
  const rotationRad = (settings.rotationDeg * Math.PI) / 180;
  const centerX = x + targetLogoWidth / 2;
  const centerY = y + targetLogoHeight / 2;

  return {
    drawX: x,
    drawY: y,
    width: targetLogoWidth,
    height: targetLogoHeight,
    centerX,
    centerY,
    rotationRad,
    opacity,
  };
}

/**
 * Composites a logo watermark onto a target canvas with opacity, scale, and rotation
 */
export function compositeWatermark(
  targetCanvas: HTMLCanvasElement | OffscreenCanvas,
  logoSource: CanvasImageSource,
  logoWidth: number,
  logoHeight: number,
  settings: PresetSettings
): void {
  const ctx = get2DContext(targetCanvas);
  const layout = calculateWatermarkLayout(
    targetCanvas.width,
    targetCanvas.height,
    logoWidth,
    logoHeight,
    settings
  );

  ctx.save();
  ctx.globalAlpha = layout.opacity;

  if (layout.rotationRad !== 0) {
    ctx.translate(layout.centerX, layout.centerY);
    ctx.rotate(layout.rotationRad);
    ctx.drawImage(
      logoSource,
      -layout.width / 2,
      -layout.height / 2,
      layout.width,
      layout.height
    );
  } else {
    ctx.drawImage(
      logoSource,
      layout.drawX,
      layout.drawY,
      layout.width,
      layout.height
    );
  }

  ctx.restore();
}
