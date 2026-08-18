"use client";

import { useState, useRef, useEffect, useCallback } from "react";

interface SplitComparisonSliderProps {
  originalSrc: string;
  adjustedSrc: string;
  className?: string;
  alt?: string;
  onImageClick?: () => void;
}

export function SplitComparisonSlider({
  originalSrc,
  adjustedSrc,
  className = "",
  alt = "Before and after comparison",
  onImageClick,
}: SplitComparisonSliderProps) {
  const [splitPos, setSplitPos] = useState<number>(50); // percentage (0 - 100)
  const [isDragging, setIsDragging] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const updatePosition = useCallback((clientX: number) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    if (rect.width <= 0) return;
    const x = clientX - rect.left;
    const percentage = Math.max(0, Math.min(100, (x / rect.width) * 100));
    setSplitPos(percentage);
  }, []);

  const handleMouseDown = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    e.stopPropagation();
    setIsDragging(true);
  };

  useEffect(() => {
    const handleMouseMove = (e: globalThis.MouseEvent) => {
      if (!isDragging) return;
      updatePosition(e.clientX);
    };

    const handleTouchMove = (e: globalThis.TouchEvent) => {
      if (!isDragging || e.touches.length === 0) return;
      updatePosition(e.touches[0].clientX);
    };

    const handleEnd = () => setIsDragging(false);

    if (isDragging) {
      window.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("mouseup", handleEnd);
      window.addEventListener("touchmove", handleTouchMove);
      window.addEventListener("touchend", handleEnd);
    }

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleEnd);
      window.removeEventListener("touchmove", handleTouchMove);
      window.removeEventListener("touchend", handleEnd);
    };
  }, [isDragging, updatePosition]);

  return (
    <div
      ref={containerRef}
      onClick={() => {
        if (!isDragging && onImageClick) onImageClick();
      }}
      className={`relative select-none overflow-hidden rounded-2xl border border-black/10 dark:border-white/10 bg-black/5 shadow-2xl cursor-pointer ${className}`}
      style={{ touchAction: "none" }}
    >
      {/* Background: Adjusted / After Image (Full width/height) */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={adjustedSrc}
        alt={`${alt} - adjusted`}
        className="w-full h-full max-h-[64vh] object-contain pointer-events-none block"
      />

      {/* Foreground: Original / Before Image (Clipped with precise clip-path) */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={originalSrc}
        alt={`${alt} - original`}
        className="absolute inset-0 w-full h-full max-h-[64vh] object-contain pointer-events-none block"
        style={{
          clipPath: `polygon(0% 0%, ${splitPos}% 0%, ${splitPos}% 100%, 0% 100%)`,
          WebkitClipPath: `polygon(0% 0%, ${splitPos}% 0%, ${splitPos}% 100%, 0% 100%)`,
        }}
      />

      {/* Divider Line & Interactive Handle */}
      <div
        className="absolute top-0 bottom-0 z-20 cursor-ew-resize flex items-center justify-center pointer-events-auto"
        style={{ left: `${splitPos}%`, transform: "translateX(-50%)" }}
        onMouseDown={handleMouseDown}
        onTouchStart={handleTouchStart}
      >
        {/* Vertical Divider Line */}
        <div className="w-0.5 h-full bg-white shadow-[0_0_10px_rgba(0,0,0,0.8)]" />

        {/* Center Circular Tactile Handle */}
        <div className="absolute w-8 h-8 rounded-full bg-white text-slate-800 shadow-xl border-2 border-slate-700 flex items-center justify-center text-[10px] font-bold hover:scale-110 active:scale-95 transition-transform">
          ◀▶
        </div>
      </div>

      {/* Floating Badges */}
      <div className="absolute top-3 left-3 z-10 px-3 py-1 rounded-full bg-black/70 backdrop-blur-md text-white text-[11px] font-medium tracking-wide shadow-sm pointer-events-none">
        Foto Asli (Before)
      </div>
      <div className="absolute top-3 right-3 z-10 px-3 py-1 rounded-full bg-primary/90 backdrop-blur-md text-white text-[11px] font-medium tracking-wide shadow-sm pointer-events-none">
        Hasil Penyesuaian (After)
      </div>
    </div>
  );
}
