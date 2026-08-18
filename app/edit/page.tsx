"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import AdjustmentsHorizontalIcon from "@heroicons/react/24/outline/AdjustmentsHorizontalIcon";
import ShieldCheckIcon from "@heroicons/react/24/outline/ShieldCheckIcon";
import BookmarkIcon from "@heroicons/react/24/outline/BookmarkIcon";
import ArrowsPointingOutIcon from "@heroicons/react/24/outline/ArrowsPointingOutIcon";
import AdjustmentsVerticalIcon from "@heroicons/react/24/outline/AdjustmentsVerticalIcon";
import ArrowPathIcon from "@heroicons/react/24/outline/ArrowPathIcon";
import PlayIcon from "@heroicons/react/24/outline/PlayIcon";
import ArrowDownTrayIcon from "@heroicons/react/24/outline/ArrowDownTrayIcon";
import ArrowLeftIcon from "@heroicons/react/24/outline/ArrowLeftIcon";
import CheckCircleIcon from "@heroicons/react/24/outline/CheckCircleIcon";
import PhotoIcon from "@heroicons/react/24/outline/PhotoIcon";

import { getQueueManager } from "@/lib/queue/manager";
import { QueueJob, QueueSummary } from "@/lib/queue/types";
import {
  ProcessingPipelineOptions,
  ResizePresetId,
} from "@/lib/processing/types";
import { RESIZE_PRESETS } from "@/lib/processing/resize";
import { fetchPresets } from "@/lib/api/client";
import { Preset } from "@/db/schema";
import { SplitComparisonSlider } from "@/components/SplitComparisonSlider";

export default function EditPage() {
  const router = useRouter();
  const [jobs, setJobs] = useState<QueueJob[]>([]);
  const [summary, setSummary] = useState<QueueSummary>({
    total: 0,
    queued: 0,
    processing: 0,
    done: 0,
    error: 0,
    progressPct: 0,
    isProcessing: false,
  });

  const [activeJobId, setActiveJobId] = useState<string | null>(null);
  const [presets, setPresets] = useState<Preset[]>([]);
  const [selectedPresetId, setSelectedPresetId] = useState<string>("");

  // Editor Operations State
  const [options, setOptions] = useState<ProcessingPipelineOptions>({
    stripMetadata: true,
    watermark: undefined,
    resize: {
      presetId: "client-delivery-hd",
      fitMode: "contain",
      format: "image/jpeg",
      quality: 0.9,
    },
    colorAdjustment: {
      enabled: false,
      intensityPct: 50,
    },
  });

  useEffect(() => {
    const queue = getQueueManager();
    const unsub = queue.subscribe((currentJobs, currentSummary) => {
      setJobs(currentJobs);
      setSummary(currentSummary);

      if (!activeJobId && currentJobs.length > 0) {
        setActiveJobId(currentJobs[0].id);
      }
    });

    fetchPresets()
      .then((list) => setPresets(list))
      .catch((err) => console.warn("Gagal memuat preset:", err));

    return unsub;
  }, [activeJobId]);

  const activeJob = useMemo(() => {
    return jobs.find((j) => j.id === activeJobId) || jobs[0] || null;
  }, [jobs, activeJobId]);

  const handleSelectJob = (job: QueueJob) => {
    setActiveJobId(job.id);
  };

  const handleToggleMetadata = () => {
    setOptions((prev) => ({
      ...prev,
      stripMetadata: !prev.stripMetadata,
    }));
  };

  const handleSelectPreset = (presetId: string) => {
    setSelectedPresetId(presetId);
    if (!presetId) {
      setOptions((prev) => ({ ...prev, watermark: undefined }));
      return;
    }
    const preset = presets.find((p) => p.id === presetId);
    if (preset) {
      setOptions((prev) => ({
        ...prev,
        watermark: {
          enabled: true,
          preset: {
            id: preset.id,
            name: preset.name,
            logoUrl: preset.logoUrl,
            settings: preset.settings,
          },
        },
      }));
    }
  };

  const handleResizePresetChange = (presetKey: ResizePresetId) => {
    setOptions((prev) => ({
      ...prev,
      resize: {
        ...prev.resize,
        presetId: presetKey,
      },
    }));
  };

  const handleColorToggle = () => {
    setOptions((prev) => ({
      ...prev,
      colorAdjustment: {
        enabled: !prev.colorAdjustment?.enabled,
        intensityPct: prev.colorAdjustment?.intensityPct || 50,
      },
    }));
  };

  const handleColorIntensityChange = (intensityPct: number) => {
    setOptions((prev) => ({
      ...prev,
      colorAdjustment: {
        enabled: true,
        intensityPct,
      },
    }));
  };

  const handleResetColor = () => {
    setOptions((prev) => ({
      ...prev,
      colorAdjustment: {
        enabled: false,
        intensityPct: 50,
      },
    }));
  };

  const handleStartBatch = () => {
    const queue = getQueueManager();
    jobs.forEach((job) => {
      queue.updateJobOptions(job.id, options);
    });
  };

  if (jobs.length === 0) {
    return (
      <div className="max-w-xl mx-auto py-20 px-6 text-center flex flex-col items-center justify-center gap-4 animate-fade-in">
        <div className="w-16 h-16 rounded-3xl bg-muted flex items-center justify-center text-muted-foreground shadow-inner">
          <PhotoIcon className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-bold tracking-tight text-foreground">
          Belum Ada Foto di Sesi Aktif
        </h2>
        <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
          Yuk masukkan foto-foto hasil photoshoot di menu Koleksi Foto terlebih dahulu.
        </p>
        <Link
          href="/"
          className="mt-3 px-6 py-2.5 bg-primary text-primary-foreground font-semibold text-xs rounded-xl hover:bg-primary/90 transition-all shadow-sm active:scale-95"
        >
          Buka Koleksi Foto
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[calc(100vh-3.5rem)] overflow-hidden animate-fade-in">
      {/* Top Header Controls Bar */}
      <div className="h-12 border-b border-border/50 bg-card/60 backdrop-blur-md px-6 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <Link
            href="/"
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground font-semibold px-2.5 py-1 rounded-lg border border-border/50 hover:bg-muted/50 transition-all active:scale-95"
          >
            <ArrowLeftIcon className="w-3.5 h-3.5" />
            <span>Koleksi</span>
          </Link>
          <span className="text-xs text-muted-foreground">/</span>
          <span className="text-xs font-bold text-foreground">Studio Finishing</span>
          <span className="text-[11px] text-muted-foreground font-mono">
            ({jobs.length} foto)
          </span>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleStartBatch}
            disabled={summary.isProcessing}
            className="flex items-center gap-2 px-3.5 py-1.5 text-xs font-semibold rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 transition-all shadow-sm disabled:opacity-50 active:scale-95"
          >
            {summary.isProcessing ? (
              <ArrowPathIcon className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <PlayIcon className="w-3.5 h-3.5" />
            )}
            <span>
              {summary.isProcessing ? "Memproses Batch..." : "Proses Semua Foto"}
            </span>
          </button>

          <Link
            href="/export"
            className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold rounded-xl border border-border/60 bg-background hover:bg-muted transition-all active:scale-95"
          >
            <ArrowDownTrayIcon className="w-3.5 h-3.5" />
            <span>Ekspor ({summary.done})</span>
          </Link>
        </div>
      </div>

      {/* Main Two-Panel Layout */}
      <div className="flex-1 flex overflow-hidden">
        {/* ----------------------------------------------------------- */}
        {/* LEFT COLUMN: OPERATIONS & TUNING CONTROLS */}
        {/* ----------------------------------------------------------- */}
        <div className="w-80 sm:w-96 border-r border-border/50 bg-card/60 backdrop-blur-xl overflow-y-auto p-5 sm:p-6 flex flex-col gap-6 shrink-0">
          {/* Operation 1: EXIF Metadata Stripping */}
          <div className="rounded-2xl border border-border/60 bg-card/80 p-4 sm:p-5 flex flex-col gap-3 shadow-sm hover:border-primary/40 transition-colors">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-primary/10 text-primary">
                  <ShieldCheckIcon className="w-4 h-4" />
                </div>
                <div className="flex flex-col">
                  <span className="text-xs font-bold text-foreground">
                    Pembersih Metadata EXIF
                  </span>
                  <span className="text-[11px] text-muted-foreground">
                    Hapus GPS & data kamera
                  </span>
                </div>
              </div>

              <input
                type="checkbox"
                checked={options.stripMetadata}
                onChange={handleToggleMetadata}
                className="w-4 h-4 accent-primary cursor-pointer rounded transition-transform active:scale-90"
              />
            </div>
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              Sangat disarankan sebelum kirim foto ke klien agar lokasi rumah dan privasi klien tetap aman.
            </p>
          </div>

          {/* Operation 2: Watermark Preset Selection */}
          <div className="rounded-2xl border border-border/60 bg-card/80 p-4 sm:p-5 flex flex-col gap-3.5 shadow-sm hover:border-primary/40 transition-colors">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-accent/10 text-accent">
                  <BookmarkIcon className="w-4 h-4" />
                </div>
                <div className="flex flex-col">
                  <span className="text-xs font-bold text-foreground">
                    Preset Watermark Klien
                  </span>
                  <span className="text-[11px] text-muted-foreground">
                    Logo brand otomatis
                  </span>
                </div>
              </div>

              <Link
                href="/presets"
                className="text-[11px] font-semibold text-primary hover:underline"
              >
                Kelola
              </Link>
            </div>

            <select
              value={selectedPresetId}
              onChange={(e) => handleSelectPreset(e.target.value)}
              className="w-full text-xs font-medium rounded-xl border border-border/60 bg-background px-3.5 py-2.5 shadow-sm focus-visible:ring-2 focus-visible:ring-primary"
            >
              <option value="">Tanpa Watermark</option>
              {presets.map((preset) => (
                <option key={preset.id} value={preset.id}>
                  {preset.name} ({preset.settings.position})
                </option>
              ))}
            </select>

            {options.watermark?.preset && (
              <div className="text-[11px] text-muted-foreground bg-muted/50 p-3 rounded-xl flex items-center justify-between font-mono animate-in fade-in">
                <span>Transparansi: {options.watermark.preset.settings.opacityPct}%</span>
                <span>Ukuran: {options.watermark.preset.settings.scalePct}%</span>
                <span className="capitalize font-sans">
                  {options.watermark.preset.settings.position.replace("-", " ")}
                </span>
              </div>
            )}
          </div>

          {/* Operation 3: Resize & Compress Preset */}
          <div className="rounded-2xl border border-border/60 bg-card/80 p-4 sm:p-5 flex flex-col gap-3.5 shadow-sm hover:border-primary/40 transition-colors">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-brand-500/10 text-brand-600 dark:text-brand-400">
                <ArrowsPointingOutIcon className="w-4 h-4" />
              </div>
              <div className="flex flex-col">
                <span className="text-xs font-bold text-foreground">
                  Ukuran & Rasio Foto
                </span>
                <span className="text-[11px] text-muted-foreground">
                  Pilihan ukuran siap kirim
                </span>
              </div>
            </div>

            {/* Preset Selector Grid */}
            <div className="grid grid-cols-2 gap-2">
              {Object.entries(RESIZE_PRESETS).map(([key, config]) => {
                const isSelected = options.resize.presetId === key;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => handleResizePresetChange(key as ResizePresetId)}
                    className={`p-3 rounded-xl border text-left flex flex-col gap-1 transition-all duration-200 active:scale-95 ${
                      isSelected
                        ? "bg-primary text-primary-foreground border-primary font-semibold shadow-sm"
                        : "bg-background text-muted-foreground hover:text-foreground hover:bg-muted border-border/60"
                    }`}
                  >
                    <span className="text-xs font-bold leading-tight truncate">
                      {config.label}
                    </span>
                    <span
                      className={`text-[10px] font-mono ${
                        isSelected ? "text-primary-foreground/80" : "text-muted-foreground"
                      }`}
                    >
                      {config.width && config.height ? `${config.width}x${config.height}` : config.maxDimension ? `Max ${config.maxDimension}px` : "Asli"}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Fit Mode Selector (Cover vs Contain) */}
            <div className="flex flex-col gap-1.5 pt-2 border-t border-border/50">
              <span className="text-xs font-semibold text-foreground">Metode Penyesuaian Rasio</span>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() =>
                    setOptions((prev) => ({
                      ...prev,
                      resize: { ...prev.resize, fitMode: "cover" },
                    }))
                  }
                  className={`py-2 px-2.5 rounded-xl text-xs font-medium border text-center transition-all active:scale-95 ${
                    options.resize.fitMode === "cover"
                      ? "bg-primary text-primary-foreground border-primary font-semibold shadow-sm"
                      : "bg-background text-muted-foreground hover:text-foreground hover:bg-muted border-border/60"
                  }`}
                >
                  Potong Pas (Cover)
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setOptions((prev) => ({
                      ...prev,
                      resize: { ...prev.resize, fitMode: "contain" },
                    }))
                  }
                  className={`py-2 px-2.5 rounded-xl text-xs font-medium border text-center transition-all active:scale-95 ${
                    options.resize.fitMode === "contain"
                      ? "bg-primary text-primary-foreground border-primary font-semibold shadow-sm"
                      : "bg-background text-muted-foreground hover:text-foreground hover:bg-muted border-border/60"
                  }`}
                >
                  Muat Utuh (Contain)
                </button>
              </div>
            </div>

            {/* Format Selector (JPEG, WebP, PNG) */}
            <div className="flex flex-col gap-1.5 pt-2 border-t border-border/50">
              <span className="text-xs font-semibold text-foreground">Format File Output</span>
              <div className="grid grid-cols-3 gap-2">
                {(
                  [
                    { id: "image/jpeg", label: "JPG" },
                    { id: "image/webp", label: "WebP" },
                    { id: "image/png", label: "PNG" },
                  ] as const
                ).map((fmt) => {
                  const isChosen = options.resize.format === fmt.id;
                  return (
                    <button
                      key={fmt.id}
                      type="button"
                      onClick={() =>
                        setOptions((prev) => ({
                          ...prev,
                          resize: { ...prev.resize, format: fmt.id },
                        }))
                      }
                      className={`py-2 px-2 rounded-xl text-xs font-medium border text-center transition-all active:scale-95 ${
                        isChosen
                          ? "bg-primary text-primary-foreground border-primary font-semibold shadow-sm"
                          : "bg-background text-muted-foreground hover:text-foreground hover:bg-muted border-border/60"
                      }`}
                    >
                      {fmt.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Quality Compression (Lossy for JPG/WebP, Lossless for PNG) */}
            <div className="flex flex-col gap-2 pt-2 border-t border-border/50">
              {options.resize.format === "image/png" ? (
                <div className="p-2.5 rounded-xl bg-muted/60 border border-border/50 text-[11px] text-muted-foreground leading-relaxed">
                  <span className="font-semibold text-foreground block mb-0.5">PNG Lossless</span>
                  Format PNG dikompresi tanpa penurunan kualitas piksel foto asli.
                </div>
              ) : (
                <>
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-foreground">
                      Kualitas Kompresi ({options.resize.format === "image/webp" ? "WebP" : "JPG"})
                    </span>
                    <span className="font-mono text-muted-foreground">
                      {Math.round(options.resize.quality * 100)}%
                    </span>
                  </div>
                  <input
                    type="range"
                    min="0.5"
                    max="1.0"
                    step="0.05"
                    value={options.resize.quality}
                    onChange={(e) =>
                      setOptions((prev) => ({
                        ...prev,
                        resize: {
                          ...prev.resize,
                          quality: parseFloat(e.target.value),
                        },
                      }))
                    }
                    className="w-full accent-primary mt-1"
                  />
                </>
              )}
            </div>
          </div>

          {/* Operation 4: Non-Destructive Auto-Color Preview */}
          <div className="rounded-2xl border border-border/60 bg-card/80 p-4 sm:p-5 flex flex-col gap-3.5 shadow-sm hover:border-primary/40 transition-colors">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400">
                  <AdjustmentsVerticalIcon className="w-4 h-4" />
                </div>
                <div className="flex flex-col">
                  <span className="text-xs font-bold text-foreground">
                    Preview Warna Otomatis
                  </span>
                  <span className="text-[11px] text-muted-foreground">
                    Sentuhan warna interior hangat
                  </span>
                </div>
              </div>

              <input
                type="checkbox"
                checked={options.colorAdjustment?.enabled || false}
                onChange={handleColorToggle}
                className="w-4 h-4 accent-primary cursor-pointer rounded transition-transform active:scale-90"
              />
            </div>

            {options.colorAdjustment?.enabled && (
              <div className="flex flex-col gap-3 pt-3 border-t border-border/50 animate-in fade-in">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-foreground">Intensitas Warna</span>
                  <span className="font-mono text-muted-foreground">
                    {options.colorAdjustment.intensityPct}%
                  </span>
                </div>
                <input
                  type="range"
                  min="10"
                  max="100"
                  value={options.colorAdjustment.intensityPct}
                  onChange={(e) =>
                    handleColorIntensityChange(parseInt(e.target.value))
                  }
                  className="w-full accent-primary mt-1"
                />

                <button
                  type="button"
                  onClick={handleResetColor}
                  className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground hover:text-foreground py-2 rounded-xl border border-border/60 hover:bg-muted/50 transition-all active:scale-95"
                >
                  <ArrowPathIcon className="w-3.5 h-3.5" />
                  <span>Kembalikan ke Warna Asli</span>
                </button>
              </div>
            )}
          </div>
        </div>

        {/* ----------------------------------------------------------- */}
        {/* RIGHT COLUMN: MAIN VIEWPORT & FILMSTRIP */}
        {/* ----------------------------------------------------------- */}
        <div className="flex-1 flex flex-col bg-background/50 overflow-hidden">
          {/* Main Inspection Canvas Viewport */}
          <div className="flex-1 p-6 sm:p-8 flex items-center justify-center relative overflow-hidden">
            {activeJob ? (
              <div className="w-full h-full max-h-[68vh] flex items-center justify-center relative">
                {options.colorAdjustment?.enabled ? (
                  // Before / After Split Slider
                  <SplitComparisonSlider
                    originalSrc={activeJob.objectUrl}
                    adjustedSrc={activeJob.resultBlobUrl || activeJob.objectUrl}
                    className="max-w-full max-h-full shadow-2xl rounded-2xl overflow-hidden border border-black/10 dark:border-white/10"
                    alt={activeJob.originalFilename}
                  />
                ) : (
                  // Standard Preview Viewport
                  <div className="relative max-w-full max-h-full rounded-2xl overflow-hidden shadow-2xl border border-black/10 dark:border-white/10 bg-black/10 flex items-center justify-center">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={activeJob.resultBlobUrl || activeJob.objectUrl}
                      alt={activeJob.originalFilename}
                      className="max-w-full max-h-[64vh] object-contain block rounded-2xl transition-all duration-300"
                    />

                    {activeJob.state === "done" && (
                      <div className="absolute bottom-4 right-4 px-3.5 py-1.5 bg-black/75 backdrop-blur-md rounded-full text-white text-xs flex items-center gap-2 shadow-lg animate-fade-in">
                        <CheckCircleIcon className="w-4 h-4 text-emerald-400" />
                        <span className="font-medium">Selesai Diproses</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <div className="text-xs text-muted-foreground">Pilih foto dari daftar di bawah</div>
            )}
          </div>

          {/* Bottom Filmstrip Carousel */}
          <div className="h-28 border-t border-border/50 bg-card/80 backdrop-blur-md px-6 py-3 flex items-center gap-3.5 overflow-x-auto shrink-0">
            {jobs.map((job, idx) => {
              const isSelected = job.id === activeJob?.id;
              return (
                <button
                  key={job.id}
                  type="button"
                  onClick={() => handleSelectJob(job)}
                  className={`group relative h-20 aspect-[4/3] rounded-xl overflow-hidden border-2 shrink-0 transition-all duration-200 active:scale-95 ${
                    isSelected
                      ? "border-primary ring-4 ring-primary/20 scale-105 shadow-md"
                      : "border-border/60 opacity-70 hover:opacity-100 hover:scale-[1.02]"
                  }`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={job.thumbnailUrl || job.objectUrl}
                    alt={job.originalFilename}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                  <div className="absolute bottom-1.5 left-1.5 px-1.5 py-0.5 rounded-md bg-black/75 text-white text-[9px] font-bold font-mono">
                    #{idx + 1}
                  </div>
                  {job.state === "done" && (
                    <div className="absolute top-1.5 right-1.5 p-0.5 rounded-full bg-emerald-600 text-white shadow-sm">
                      <CheckCircleIcon className="w-3 h-3" />
                    </div>
                  )}
                </button>
              );
            })}
          </div>

          {/* Action Bar Footer */}
          <div className="h-16 border-t border-border/50 bg-card/90 backdrop-blur-md px-6 flex items-center justify-between gap-4 shrink-0">
            <div className="flex items-center gap-3">
              <span className="text-xs text-muted-foreground">
                Progres Batch: <span className="font-semibold text-foreground">{summary.done}</span> dari {summary.total} foto selesai
              </span>
              {summary.isProcessing && (
                <div className="flex items-center gap-1.5 text-xs text-accent font-semibold">
                  <ArrowPathIcon className="w-3.5 h-3.5 animate-spin" />
                  <span>Sedang memproses...</span>
                </div>
              )}
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={handleStartBatch}
                disabled={summary.isProcessing}
                className="flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-xl border border-border/60 bg-background hover:bg-muted disabled:opacity-50 transition-all active:scale-95 shadow-sm"
              >
                <PlayIcon className="w-3.5 h-3.5 text-primary" />
                <span>Proses Semua Foto</span>
              </button>

              <Link
                href="/export"
                className="flex items-center gap-2 px-5 py-2 text-xs font-semibold rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 transition-all active:scale-95 shadow-sm"
              >
                <ArrowDownTrayIcon className="w-3.5 h-3.5" />
                <span>Lanjut ke Ekspor</span>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
