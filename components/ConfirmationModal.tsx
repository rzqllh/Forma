"use client";

import { useEffect, useRef } from "react";
import ExclamationTriangleIcon from "@heroicons/react/24/outline/ExclamationTriangleIcon";
import XMarkIcon from "@heroicons/react/24/outline/XMarkIcon";

interface ConfirmationModalProps {
  isOpen: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  isDestructive?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmationModal({
  isOpen,
  title,
  description,
  confirmLabel = "Konfirmasi",
  cancelLabel = "Batal",
  isDestructive = true,
  onConfirm,
  onCancel,
}: ConfirmationModalProps) {
  const confirmBtnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => confirmBtnRef.current?.focus(), 50);

      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === "Escape") {
          onCancel();
        }
      };
      window.addEventListener("keydown", handleKeyDown);
      return () => window.removeEventListener("keydown", handleKeyDown);
    }
  }, [isOpen, onCancel]);

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-md animate-in fade-in duration-200"
    >
      <div className="relative w-full max-w-md bg-card text-card-foreground rounded-3xl border border-black/5 dark:border-white/10 shadow-2xl p-6 sm:p-7 flex flex-col gap-6 animate-in zoom-in-95 duration-200">
        {/* Close Button */}
        <button
          onClick={onCancel}
          type="button"
          aria-label="Tutup dialog"
          className="absolute top-5 right-5 text-muted-foreground hover:text-foreground p-1.5 rounded-full hover:bg-muted/60 transition-colors focus-visible:ring-2 focus-visible:ring-primary"
        >
          <XMarkIcon className="w-5 h-5" />
        </button>

        {/* Icon & Heading */}
        <div className="flex items-start gap-4">
          <div
            className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 shadow-sm ${
              isDestructive
                ? "bg-destructive/10 text-destructive"
                : "bg-primary/10 text-primary"
            }`}
          >
            <ExclamationTriangleIcon className="w-6 h-6" />
          </div>
          <div className="flex flex-col gap-1.5 pr-6">
            <h3 id="modal-title" className="text-base sm:text-lg font-bold tracking-tight leading-snug">
              {title}
            </h3>
            <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
              {description}
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-3 pt-2 border-t border-border/50">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2.5 rounded-xl text-xs font-semibold border bg-background hover:bg-muted transition-all active:scale-95"
          >
            {cancelLabel}
          </button>
          <button
            ref={confirmBtnRef}
            type="button"
            onClick={onConfirm}
            className={`px-5 py-2.5 rounded-xl text-xs font-semibold text-white transition-all shadow-sm active:scale-95 ${
              isDestructive
                ? "bg-destructive hover:bg-destructive/90"
                : "bg-primary hover:bg-primary/90"
            }`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
