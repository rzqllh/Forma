"use client";

import { useState, useRef, useEffect, useCallback, MouseEvent, TouchEvent } from "react";

interface SplitComparisonSliderProps {
  originalSrc: string;
  adjustedSrc: string;
  className?: string;
  alt?: string;
}

export function SplitComparisonSlider({
  originalSrc,
  adjustedSrc,
  className = "",
  alt = "Before and after comparison",
}: SplitComparisonSliderProps) {
  const [splitPos, setSplitPos] = useState<number>(50); // percentage (0 - 100)
  const [isDragging, setIsDragging] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const updatePosition = useCallback((clientX: number) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = clientX - rect.left;
    const percentage = Math.max(0, Math.min(100, (x / rect.width) * 100));
    setSplitPos(percentage);
  }, []);

  const handleMouseDown = () => setIsDragging(true);
  const handleTouchStart = () => setIsDragging(true);

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
      className={`relative select-none overflow-hidden rounded-xl border bg-black/5 shadow-inner ${className}`}
      style={{ touchAction: "none" }}
    >
      {/* Adjusted (After) Image - Background full view */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={adjustedSrc}
        alt={`${alt} - adjusted`}
        className="w-full h-full object-contain pointer-events-none block"
      />

      {/* Original (Before) Image - Clipped to left */}
      <div
        className="absolute inset-0 overflow-hidden pointer-events-none"
        style={{ width: `${splitPos}%` }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={originalSrc}
          alt={`${alt} - original`}
          className="absolute inset-0 w-full h-full object-contain pointer-events-none max-w-none"
          style={{
            width: containerRef.current ? `${containerRef.current.clientWidth}px` : "100%",
            height: "100%",
          }}
        />
      </div>

      {/* Divider Line & Handle */}
      <div
        className="absolute top-0 bottom-0 z-20 cursor-ew-resize flex items-center justify-center group"
        style={{ left: `${splitPos}%`, transform: "translateX(-50%)" }}
        onMouseDown={handleMouseDown}
        onTouchStart={handleTouchStart}
      >
        {/* Vertical Line */}
        <div className="w-0.5 h-full bg-white shadow-[0_0_8px_rgba(0,0,0,0.6)]" />

        {/* Center Circular Handle */}
        <div className="absolute w-8 h-8 rounded-full bg-white text-slate-800 shadow-lg border-2 border-slate-700 flex items-center justify-center text-[10px] font-bold group-hover:scale-110 transition-transform">
          ◀▶
        </div>
      </div>

      {/* Floating Badges */}
      <div className="absolute top-3 left-3 z-10 px-2.5 py-1 rounded bg-black/60 backdrop-blur-md text-white text-[11px] font-medium tracking-wide shadow-sm pointer-events-none">
        Original
      </div>
      <div className="absolute top-3 right-3 z-10 px-2.5 py-1 rounded bg-primary/90 backdrop-blur-md text-white text-[11px] font-medium tracking-wide shadow-sm pointer-events-none">
        Adjusted Preview
      </div>
    </div>
  );
}
