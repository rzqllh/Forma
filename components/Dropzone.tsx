"use client";

import { useState, useRef, DragEvent, ChangeEvent } from "react";
import ArrowUpTrayIcon from "@heroicons/react/24/outline/ArrowUpTrayIcon";
import PhotoIcon from "@heroicons/react/24/outline/PhotoIcon";
import ExclamationCircleIcon from "@heroicons/react/24/outline/ExclamationCircleIcon";

interface DropzoneProps {
  onFilesSelected: (files: File[]) => void;
  disabled?: boolean;
}

const ALLOWED_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_RECOMMENDED_SIZE_MB = 45;

export function Dropzone({ onFilesSelected, disabled = false }: DropzoneProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const validateAndHandleFiles = (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;
    setErrorMessage(null);

    const validFiles: File[] = [];
    const invalidTypes: string[] = [];
    const oversizedFiles: string[] = [];

    for (let i = 0; i < fileList.length; i++) {
      const file = fileList[i];
      if (!ALLOWED_MIME_TYPES.includes(file.type)) {
        invalidTypes.push(file.name);
        continue;
      }
      if (file.size > MAX_RECOMMENDED_SIZE_MB * 1024 * 1024) {
        oversizedFiles.push(file.name);
      }
      validFiles.push(file);
    }

    if (invalidTypes.length > 0) {
      setErrorMessage(
        `Beberapa file dilewati karena format belum didukung: ${invalidTypes.slice(0, 3).join(", ")}. Gunakan JPG, PNG, atau WebP ya.`
      );
    } else if (oversizedFiles.length > 0) {
      setErrorMessage(
        `Catatan: Ukuran foto di atas ${MAX_RECOMMENDED_SIZE_MB}MB mungkin butuh waktu sedikit lebih lama saat diproses.`
      );
    }

    if (validFiles.length > 0) {
      onFilesSelected(validFiles);
    }
  };

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (disabled) return;
    setIsDragOver(true);
  };

  const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragOver(false);
    if (disabled) return;
    validateAndHandleFiles(e.dataTransfer.files);
  };

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    validateAndHandleFiles(e.target.files);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  return (
    <div className="w-full flex flex-col gap-3">
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => !disabled && fileInputRef.current?.click()}
        className={`group relative border-2 border-dashed rounded-3xl p-8 sm:p-10 text-center flex flex-col items-center justify-center gap-4 cursor-pointer transition-all duration-300 select-none ${disabled
          ? "opacity-50 cursor-not-allowed border-muted"
          : isDragOver
            ? "border-primary bg-primary/10 scale-[0.99] shadow-lg ring-4 ring-primary/20"
            : "border-border/70 hover:border-primary/60 hover:bg-card/70 bg-card/40 backdrop-blur-sm shadow-sm active:scale-[0.995]"
          }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp"
          onChange={handleFileChange}
          disabled={disabled}
          className="sr-only"
        />

        {/* Upload Visual Indicator: Apple HIG Photography Dropzone */}
        <div className="relative w-16 h-16 rounded-2xl bg-gradient-to-b from-primary/15 to-primary/5 border border-primary/20 flex items-center justify-center shadow-sm text-primary group-hover:scale-105 group-hover:border-primary/40 group-hover:shadow-md transition-all duration-300">
          <PhotoIcon className="w-8 h-8 opacity-80 group-hover:opacity-100 transition-opacity" />
          <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-lg bg-primary text-primary-foreground flex items-center justify-center shadow-md ring-2 ring-background group-hover:scale-110 transition-transform">
            <ArrowUpTrayIcon className="w-3.5 h-3.5 stroke-[2.5]" />
          </div>
        </div>

        {/* Main Text */}
        <div className="flex flex-col gap-1 max-w-md">
          <h3 className="text-sm sm:text-base font-bold tracking-tight text-foreground group-hover:text-primary transition-colors">
            Tarik foto ke sini atau pilih dari perangkat
          </h3>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Bisa pilih beberapa foto sekaligus, termasuk file resolusi tinggi dari kamera atau HP.
          </p>
        </div>

        {/* Footer badges: short, concise, and no awkward wrapping */}
        <div className="flex items-center gap-2 text-[11px] text-muted-foreground pt-0.5">
          <span className="inline-flex items-center gap-1.5 font-medium bg-muted/50 px-2.5 py-1 rounded-lg border border-border/40">
            <PhotoIcon className="w-3.5 h-3.5 text-primary" />
            JPG, PNG, WebP
          </span>
          <span>•</span>
          <span className="font-medium">Diproses langsung di perangkat</span>
        </div>
      </div>

      {errorMessage && (
        <div className="flex items-start gap-2.5 p-3.5 rounded-2xl border border-amber-500/30 bg-amber-500/10 text-amber-900 dark:text-amber-200 text-xs leading-relaxed animate-in fade-in">
          <ExclamationCircleIcon className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{errorMessage}</span>
        </div>
      )}
    </div>
  );
}
