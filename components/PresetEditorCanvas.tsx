"use client";

import { useEffect, useRef } from "react";
import { PresetSettings } from "@/db/schema";
import { compositeWatermark } from "@/lib/processing/watermark";
import { createCanvas, get2DContext } from "@/lib/processing/metadata";

interface PresetEditorCanvasProps {
  settings: PresetSettings;
  logoUrl?: string;
  className?: string;
}

// Default interior sample background
const SAMPLE_BG_WIDTH = 800;
const SAMPLE_BG_HEIGHT = 600;

export function PresetEditorCanvas({
  settings,
  logoUrl,
  className = "",
}: PresetEditorCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const logoImageRef = useRef<HTMLImageElement | null>(null);

  // Load logo image when logoUrl changes
  useEffect(() => {
    if (!logoUrl) {
      logoImageRef.current = null;
      return;
    }

    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      logoImageRef.current = img;
      render();
    };
    img.src = logoUrl;
  }, [logoUrl]);

  const render = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = get2DContext(canvas);

    canvas.width = SAMPLE_BG_WIDTH;
    canvas.height = SAMPLE_BG_HEIGHT;

    // Draw simulated interior photoshoot background (warm stone and wood gradient)
    const grad = ctx.createLinearGradient(0, 0, SAMPLE_BG_WIDTH, SAMPLE_BG_HEIGHT);
    grad.addColorStop(0, "#2c3e35");
    grad.addColorStop(0.5, "#4a5d52");
    grad.addColorStop(1, "#1a2721");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, SAMPLE_BG_WIDTH, SAMPLE_BG_HEIGHT);

    // Draw stylized architectural grid lines simulating an interior space
    ctx.strokeStyle = "rgba(255, 255, 255, 0.08)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(100, 100);
    ctx.lineTo(700, 100);
    ctx.lineTo(700, 500);
    ctx.lineTo(100, 500);
    ctx.closePath();
    ctx.stroke();

    ctx.fillStyle = "rgba(255, 255, 255, 0.25)";
    ctx.font = "14px sans-serif";
    ctx.fillText("Sample Interior Photo Preview (800 x 600)", 24, 36);

    // If logo is loaded, composite it using the pure processing function
    if (logoImageRef.current) {
      compositeWatermark(
        canvas,
        logoImageRef.current,
        logoImageRef.current.naturalWidth,
        logoImageRef.current.naturalHeight,
        settings
      );
    } else {
      // Draw placeholder watermark text
      ctx.save();
      ctx.fillStyle = `rgba(255, 255, 255, ${settings.opacityPct / 100})`;
      ctx.font = "bold 20px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("[ LOGO PLACEHOLDER ]", SAMPLE_BG_WIDTH / 2, SAMPLE_BG_HEIGHT / 2);
      ctx.restore();
    }
  };

  useEffect(() => {
    render();
  }, [settings]);

  return (
    <div className={`relative overflow-hidden rounded-xl border bg-black/20 shadow-sm ${className}`}>
      <canvas
        ref={canvasRef}
        className="w-full h-auto block rounded-xl"
        style={{ aspectRatio: `${SAMPLE_BG_WIDTH} / ${SAMPLE_BG_HEIGHT}` }}
      />
    </div>
  );
}
