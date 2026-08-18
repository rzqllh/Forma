"use client";

import { useState, useEffect, useMemo, useCallback, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
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
import MagnifyingGlassPlusIcon from "@heroicons/react/24/outline/MagnifyingGlassPlusIcon";
import XMarkIcon from "@heroicons/react/24/outline/XMarkIcon";
import ArrowUturnLeftIcon from "@heroicons/react/24/outline/ArrowUturnLeftIcon";
import ArrowUturnRightIcon from "@heroicons/react/24/outline/ArrowUturnRightIcon";
import PlusIcon from "@heroicons/react/24/outline/PlusIcon";

import { getQueueManager } from "@/lib/queue/manager";
import { QueueJob, QueueSummary } from "@/lib/queue/types";
import {
  OutputFormat,
  ProcessingPipelineOptions,
  ResizePresetId,
} from "@/lib/processing/types";
import { RESIZE_PRESETS } from "@/lib/processing/resize";
import { fetchPresets } from "@/lib/api/client";
import { Preset } from "@/db/schema";
import { SplitComparisonSlider } from "@/components/SplitComparisonSlider";
import { CustomSelect } from "@/components/CustomSelect";

const PRESET_DISPLAY_DATA: Record<
  ResizePresetId,
  { name: string; tag: string }
> = {
  original: { name: "Ukuran Asli", tag: "Resolusi Penuh" },
  "instagram-portrait": { name: "IG Portrait", tag: "4:5 • 1080×1350" },
  "instagram-square": { name: "IG Square", tag: "1:1 • 1080×1080" },
  "instagram-story": { name: "IG Story / Reels", tag: "9:16 • 1080×1920" },
  "web-portfolio": { name: "Web Portfolio", tag: "Maks. 2048px" },
  "client-delivery-hd": { name: "Client Delivery", tag: "Maks. 2560px HD" },
  custom: { name: "Dimensi Kustom", tag: "Kustom" },
};

export default function EditPage() {
  return (
    <Suspense
      fallback={
        <div className="h-[calc(100dvh-3.5rem)] flex items-center justify-center gap-2 text-xs text-muted-foreground">
          <ArrowPathIcon className="w-4 h-4 animate-spin text-primary" />
          <span>Memuat Studio Editor...</span>
        </div>
      }
    >
      <EditPageContent />
    </Suspense>
  );
}

function EditPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
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
  const [lightboxOpen, setLightboxOpen] = useState(false);

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

  // Bounded History Stack for Undo/Redo (Max 25 states)
  const [history, setHistory] = useState<ProcessingPipelineOptions[]>([options]);
  const [historyIndex, setHistoryIndex] = useState(0);

  const pushHistory = useCallback(
    (newOpts: ProcessingPipelineOptions) => {
      setHistory((prev) => {
        const next = [...prev.slice(0, historyIndex + 1), newOpts];
        if (next.length > 25) next.shift();
        return next;
      });
      setHistoryIndex((prev) => Math.min(prev + 1, 24));
    },
    [historyIndex]
  );

  const activeJob = useMemo(() => {
    return jobs.find((j) => j.id === activeJobId) || jobs[0] || null;
  }, [jobs, activeJobId]);

  // Live Auto-reprocess active job when options change
  const applyOptionsToActive = useCallback(
    (newOptions: ProcessingPipelineOptions, skipHistory = false) => {
      setOptions(newOptions);
      if (!skipHistory) {
        pushHistory(newOptions);
      }
      if (activeJob) {
        const queue = getQueueManager();
        queue.updateJobOptions(activeJob.id, newOptions);
        queue.startBatch();
      }
    },
    [activeJob, pushHistory]
  );

  // Undo / Redo Handlers
  const handleUndo = useCallback(() => {
    if (historyIndex > 0) {
      const prevOpts = history[historyIndex - 1];
      setHistoryIndex(historyIndex - 1);
      applyOptionsToActive(prevOpts, true);
    }
  }, [historyIndex, history, applyOptionsToActive]);

  const handleRedo = useCallback(() => {
    if (historyIndex < history.length - 1) {
      const nextOpts = history[historyIndex + 1];
      setHistoryIndex(historyIndex + 1);
      applyOptionsToActive(nextOpts, true);
    }
  }, [historyIndex, history, applyOptionsToActive]);

  // Initial mount & session restoration from IndexedDB
  useEffect(() => {
    const queue = getQueueManager();

    // Auto-restore session from IndexedDB if in-memory queue is empty on refresh
    queue.restoreSavedSession().then(() => {
      const currentJobs = queue.getJobs();
      if (currentJobs.length > 0 && !activeJobId) {
        setActiveJobId(currentJobs[0].id);
      }
    });

    const unsub = queue.subscribe((currentJobs, currentSummary) => {
      setJobs(currentJobs);
      setSummary(currentSummary);

      if (!activeJobId && currentJobs.length > 0) {
        setActiveJobId(currentJobs[0].id);
      }
    });

    fetchPresets()
      .then((list) => {
        setPresets(list);
        const presetParam = searchParams?.get("selectedPresetId");
        if (presetParam) {
          const match = list.find((p) => p.id === presetParam);
          if (match) {
            handleSelectPreset(presetParam, list);
          }
        }
      })
      .catch((err) => console.warn("Gagal memuat preset:", err));

    return unsub;
  }, [activeJobId, searchParams]);

  const handleSelectJob = (job: QueueJob) => {
    setActiveJobId(job.id);
  };

  const handleToggleMetadata = () => {
    const newOpts = {
      ...options,
      stripMetadata: !options.stripMetadata,
    };
    applyOptionsToActive(newOpts);
  };

  const handleSelectPreset = (presetId: string, customList?: Preset[]) => {
    setSelectedPresetId(presetId);
    const presetList = customList || presets;

    if (!presetId) {
      const newOpts = { ...options, watermark: undefined };
      applyOptionsToActive(newOpts);
      return;
    }

    const preset = presetList.find((p) => p.id === presetId);
    if (preset) {
      const newOpts = {
        ...options,
        watermark: {
          enabled: true,
          preset: {
            id: preset.id,
            name: preset.name,
            logoUrl: preset.logoUrl,
            settings: preset.settings,
          },
        },
      };
      applyOptionsToActive(newOpts);
    }
  };

  const handleResizePresetChange = (presetKey: ResizePresetId) => {
    const presetConfig = RESIZE_PRESETS[presetKey];
    const newOpts: ProcessingPipelineOptions = {
      ...options,
      resize: {
        ...options.resize,
        presetId: presetKey,
        fitMode: presetConfig?.fitMode || (options.resize.fitMode || "cover"),
      },
    };
    applyOptionsToActive(newOpts);
  };

  const handleCustomDimensionChange = (
    field: "customWidth" | "customHeight",
    value: number
  ) => {
    const newOpts: ProcessingPipelineOptions = {
      ...options,
      resize: {
        ...options.resize,
        presetId: "custom",
        [field]: value > 0 ? value : undefined,
      },
    };
    applyOptionsToActive(newOpts);
  };

  const handleFitModeChange = (fitMode: "cover" | "contain") => {
    const newOpts: ProcessingPipelineOptions = {
      ...options,
      resize: {
        ...options.resize,
        fitMode,
      },
    };
    applyOptionsToActive(newOpts);
  };

  const handleFormatChange = (format: OutputFormat) => {
    const newOpts: ProcessingPipelineOptions = {
      ...options,
      resize: {
        ...options.resize,
        format,
      },
    };
    applyOptionsToActive(newOpts);
  };

  const handleQualityChange = (quality: number) => {
    const newOpts: ProcessingPipelineOptions = {
      ...options,
      resize: {
        ...options.resize,
        quality,
      },
    };
    applyOptionsToActive(newOpts);
  };

  const handleColorToggle = () => {
    const newOpts: ProcessingPipelineOptions = {
      ...options,
      colorAdjustment: {
        enabled: !options.colorAdjustment?.enabled,
        intensityPct: options.colorAdjustment?.intensityPct || 50,
      },
    };
    applyOptionsToActive(newOpts);
  };

  const handleColorIntensityChange = (intensityPct: number) => {
    const newOpts: ProcessingPipelineOptions = {
      ...options,
      colorAdjustment: {
        enabled: true,
        intensityPct,
      },
    };
    applyOptionsToActive(newOpts);
  };

  const handleResetColor = () => {
    const newOpts: ProcessingPipelineOptions = {
      ...options,
      colorAdjustment: {
        enabled: false,
        intensityPct: 50,
      },
    };
    applyOptionsToActive(newOpts);
  };

  const handleStartBatch = () => {
    const queue = getQueueManager();
    queue.updateAllJobOptions(options);
    queue.startBatch();
  };

  // Keyboard Shortcuts: Pro Workflow
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if user is currently typing in input/textarea
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        e.target instanceof HTMLSelectElement
      ) {
        return;
      }

      // Undo: Ctrl+Z / Cmd+Z
      if (
        (e.ctrlKey || e.metaKey) &&
        !e.shiftKey &&
        (e.key === "z" || e.key === "Z")
      ) {
        e.preventDefault();
        handleUndo();
      }
      // Redo: Ctrl+Shift+Z / Cmd+Shift+Z or Ctrl+Y
      else if (
        ((e.ctrlKey || e.metaKey) &&
          e.shiftKey &&
          (e.key === "z" || e.key === "Z")) ||
        ((e.ctrlKey || e.metaKey) && (e.key === "y" || e.key === "Y"))
      ) {
        e.preventDefault();
        handleRedo();
      }
      // Fullscreen Zoom: F
      else if (e.key === "f" || e.key === "F") {
        e.preventDefault();
        setLightboxOpen((prev) => !prev);
      }
      // Esc: Close Lightbox
      else if (e.key === "Escape" && lightboxOpen) {
        e.preventDefault();
        setLightboxOpen(false);
      }
      // Filmstrip 1-9: Select photo index
      else if (/^[1-9]$/.test(e.key)) {
        const idx = parseInt(e.key, 10) - 1;
        if (idx < jobs.length) {
          e.preventDefault();
          setActiveJobId(jobs[idx].id);
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleUndo, handleRedo, jobs, lightboxOpen]);

  if (jobs.length === 0) {
    return (
      <div className="h-[calc(100dvh-3.5rem)] flex items-center justify-center p-6 text-center animate-fade-in">
        <div className="max-w-md flex flex-col items-center gap-4">
          <div className="w-16 h-16 rounded-3xl bg-muted flex items-center justify-center text-muted-foreground shadow-inner">
            <PhotoIcon className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-bold tracking-tight text-foreground">
            Belum Ada Foto di Sesi Aktif
          </h2>
          <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
            Silakan masukkan foto hasil photoshoot di menu Koleksi Foto terlebih dahulu.
          </p>
          <Link
            href="/"
            className="mt-2 min-h-[44px] inline-flex items-center px-6 py-2.5 bg-primary text-primary-foreground font-semibold text-xs rounded-xl hover:bg-primary/90 transition-all shadow-sm active:scale-95"
          >
            Buka Koleksi Foto
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="h-[calc(100dvh-3.5rem)] flex flex-col overflow-hidden bg-background animate-fade-in">
      {/* ----------------------------------------------------------- */}
      {/* TOP SUB-HEADER BAR (WITH CLEAN SPACING, UNDO/REDO & ACTIONS) */}
      {/* ----------------------------------------------------------- */}
      <div className="h-14 border-b border-border/50 bg-card/80 backdrop-blur-md px-3 sm:px-6 flex items-center justify-between shrink-0 z-20">
        {/* Left Side: Back button + Breadcrumb + Undo/Redo */}
        <div className="flex items-center gap-2 sm:gap-3 overflow-hidden min-w-0">
          <Link
            href="/"
            className="min-h-[36px] px-2.5 sm:px-3 py-1.5 flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground font-semibold rounded-xl border border-border/50 hover:bg-muted/60 transition-all active:scale-95 shrink-0"
            title="Kembali ke Koleksi"
          >
            <ArrowLeftIcon className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Koleksi</span>
          </Link>

          <span className="text-xs text-muted-foreground/50 shrink-0 hidden xs:inline">/</span>

          <div className="flex items-center gap-1.5 min-w-0">
            <span className="text-xs sm:text-sm font-bold text-foreground truncate">
              Studio
            </span>
            <span className="text-[10px] sm:text-xs font-mono font-medium px-2 py-0.5 rounded-full bg-muted text-muted-foreground shrink-0">
              {jobs.length} foto
            </span>
          </div>

          {/* Undo / Redo Toolbar Controls */}
          <div className="hidden md:flex items-center gap-1 ml-1.5 pl-2 border-l border-border/60">
            <button
              type="button"
              onClick={handleUndo}
              disabled={historyIndex === 0}
              title="Undo Perubahan (Ctrl+Z)"
              className="p-1.5 rounded-lg border border-border/50 hover:bg-muted text-muted-foreground hover:text-foreground disabled:opacity-30 disabled:pointer-events-none transition-all active:scale-90"
            >
              <ArrowUturnLeftIcon className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={handleRedo}
              disabled={historyIndex >= history.length - 1}
              title="Redo Perubahan (Ctrl+Y)"
              className="p-1.5 rounded-lg border border-border/50 hover:bg-muted text-muted-foreground hover:text-foreground disabled:opacity-30 disabled:pointer-events-none transition-all active:scale-90"
            >
              <ArrowUturnRightIcon className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Right Side: Process & Export Buttons */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          <button
            type="button"
            onClick={handleStartBatch}
            disabled={summary.isProcessing}
            className="min-h-[36px] px-3 sm:px-4 py-1.5 flex items-center gap-1.5 text-xs font-semibold rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 transition-all shadow-sm disabled:opacity-50 active:scale-95 shrink-0"
          >
            {summary.isProcessing ? (
              <ArrowPathIcon className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <PlayIcon className="w-3.5 h-3.5" />
            )}
            <span className="hidden sm:inline">
              {summary.isProcessing ? "Memproses..." : "Proses Semua"}
            </span>
            <span className="sm:hidden">
              {summary.isProcessing ? "..." : "Proses"}
            </span>
          </button>

          <Link
            href="/export"
            className="min-h-[36px] px-3 sm:px-4 py-1.5 flex items-center gap-1.5 text-xs font-semibold rounded-xl border border-border/60 bg-background hover:bg-muted transition-all active:scale-95 shadow-sm shrink-0"
          >
            <ArrowDownTrayIcon className="w-3.5 h-3.5 text-muted-foreground" />
            <span className="hidden sm:inline">Ekspor ({summary.done})</span>
            <span className="sm:hidden">Ekspor ({summary.done})</span>
          </Link>
        </div>
      </div>

      {/* ----------------------------------------------------------- */}
      {/* MAIN LAYOUT: CANVAS & FILMSTRIP (LEFT/TOP) + SIDEBAR (RIGHT) */}
      {/* ----------------------------------------------------------- */}
      <div className="flex-1 flex flex-col lg:flex-row min-h-0 overflow-hidden">
        {/* ----------------------------------------------------------- */}
        {/* CANVAS VIEWPORT & FILMSTRIP (FIT TO SCREEN, NO OUTER SCROLL) */}
        {/* ----------------------------------------------------------- */}
        <div className="flex-1 flex flex-col min-h-0 bg-background/50 overflow-hidden order-1 lg:order-1">
          {/* Main Inspection Canvas Viewport */}
          <div className="flex-1 min-h-0 p-2 sm:p-4 lg:p-6 flex items-center justify-center relative overflow-hidden bg-dot-pattern">
            {activeJob ? (
              <div className="w-full h-full max-h-full max-w-full flex items-center justify-center relative group min-h-0">
                {/* Dedicated Explicit Fullscreen Zoom Button */}
                <button
                  type="button"
                  onClick={() => setLightboxOpen(true)}
                  className="min-h-[36px] absolute top-2.5 right-2.5 z-30 flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-black/75 hover:bg-black/90 backdrop-blur-md text-white text-xs font-semibold shadow-xl transition-all active:scale-95 border border-white/10"
                  title="Lihat Pratinjau Foto Penuh (F)"
                >
                  <MagnifyingGlassPlusIcon className="w-3.5 h-3.5 text-primary-foreground" />
                  <span className="text-[11px] font-medium hidden xs:inline">Zoom Penuh</span>
                  <span className="text-[9px] opacity-70 font-mono hidden md:inline">[F]</span>
                </button>

                {options.colorAdjustment?.enabled ? (
                  // Before / After Split Slider
                  <SplitComparisonSlider
                    originalSrc={activeJob.objectUrl}
                    adjustedSrc={activeJob.resultBlobUrl || activeJob.objectUrl}
                    className="w-full h-full max-h-full max-w-full"
                    alt={activeJob.originalFilename}
                  />
                ) : (
                  // Standard Preview Viewport (Strictly Fit to Container)
                  <div className="relative w-full h-full max-h-full max-w-full rounded-2xl overflow-hidden shadow-2xl border border-black/10 dark:border-white/10 bg-black/5 dark:bg-black/40 flex items-center justify-center min-h-0">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={activeJob.resultBlobUrl || activeJob.objectUrl}
                      alt={activeJob.originalFilename}
                      className="max-w-full max-h-full object-contain block rounded-xl transition-all duration-300"
                    />

                    {/* Output Dimension Tag */}
                    {activeJob.result && (
                      <div className="absolute bottom-2.5 left-2.5 px-2.5 py-1 rounded-lg bg-black/75 backdrop-blur-md text-white text-[10px] font-mono font-medium shadow-md flex items-center gap-1.5">
                        <span>
                          {activeJob.result.width} × {activeJob.result.height} px
                        </span>
                        <span className="opacity-50">•</span>
                        <span className="uppercase text-[9px] text-white/80">
                          {options.resize.presetId.replace("-", " ")}
                        </span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <div className="text-xs text-muted-foreground">
                Pilih foto dari daftar di bawah
              </div>
            )}
          </div>

          {/* Quick Filmstrip Carousel */}
          <div className="h-20 sm:h-24 border-t border-border/50 bg-card/80 backdrop-blur-md px-3 sm:px-6 py-2 flex items-center gap-2.5 sm:gap-3.5 overflow-x-auto shrink-0 scrollbar-thin">
            {jobs.map((job, idx) => {
              const isSelected = job.id === activeJob?.id;
              return (
                <button
                  key={job.id}
                  type="button"
                  onClick={() => handleSelectJob(job)}
                  className={`group relative h-14 sm:h-16 aspect-[4/3] rounded-xl overflow-hidden border-2 shrink-0 transition-all duration-200 active:scale-95 ${
                    isSelected
                      ? "border-primary ring-3 ring-primary/20 scale-105 shadow-md"
                      : "border-border/60 opacity-70 hover:opacity-100 hover:scale-[1.02]"
                  }`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={job.thumbnailUrl || job.objectUrl}
                    alt={job.originalFilename}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                  <div className="absolute bottom-1 left-1 px-1 py-0.2 rounded bg-black/75 text-white text-[8px] sm:text-[9px] font-bold font-mono">
                    #{idx + 1}
                  </div>
                  {job.state === "done" && (
                    <div className="absolute top-1 right-1 p-0.5 rounded-full bg-emerald-600 text-white shadow-sm">
                      <CheckCircleIcon className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* ----------------------------------------------------------- */}
        {/* CONTROLS & OPERATIONS SIDEBAR (ONLY THIS SECTION SCROLLS) */}
        {/* ----------------------------------------------------------- */}
        <div className="w-full lg:w-96 lg:max-w-sm border-t lg:border-t-0 lg:border-l border-border/50 bg-card/60 backdrop-blur-xl p-4 sm:p-5 flex flex-col gap-4 order-2 lg:order-2 shrink-0 overflow-y-auto min-h-0 max-h-[45vh] lg:max-h-full scrollbar-thin">
          {/* Section Header */}
          <div className="flex items-center justify-between pb-1 border-b border-border/40 shrink-0">
            <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Pengaturan Finishing
            </span>
            <span className="text-[11px] text-primary font-semibold">
              Foto #{jobs.findIndex((j) => j.id === activeJob?.id) + 1}
            </span>
          </div>

          {/* Operation 1: EXIF Metadata Stripping */}
          <div className="rounded-2xl border border-border/60 bg-card/80 p-4 flex flex-col gap-2.5 shadow-sm hover:border-primary/40 transition-colors">
            <div className="flex items-center justify-between min-h-[38px]">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-primary/10 text-primary shrink-0">
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
                className="w-5 h-5 accent-primary cursor-pointer rounded transition-transform active:scale-90"
              />
            </div>
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              Menghapus lokasi GPS, model kamera, dan data hardware secara aman demi privasi klien interior.
            </p>
          </div>

          {/* Operation 2: Watermark Preset Selection */}
          <div className="rounded-2xl border border-border/60 bg-card/80 p-4 flex flex-col gap-3 shadow-sm hover:border-primary/40 transition-colors">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-accent/10 text-accent shrink-0">
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

              <div className="flex items-center gap-1.5">
                <Link
                  href="/presets?returnTo=/edit&create=true"
                  className="min-h-[36px] inline-flex items-center gap-1 text-[11px] font-semibold text-primary hover:bg-primary/10 px-2 py-1 rounded-lg transition-colors"
                  title="Buat Preset Baru"
                >
                  <PlusIcon className="w-3.5 h-3.5" />
                  <span>Buat</span>
                </Link>
                <Link
                  href="/presets?returnTo=/edit"
                  className="min-h-[36px] inline-flex items-center text-xs font-semibold text-muted-foreground hover:text-foreground hover:underline px-2"
                >
                  Kelola
                </Link>
              </div>
            </div>

            {/* CustomSelect Dropdown */}
            <CustomSelect
              value={selectedPresetId}
              onChange={handleSelectPreset}
              placeholder="Pilih Preset Watermark..."
              options={[
                {
                  value: "",
                  label: "Tanpa Watermark",
                  sublabel: "Foto bersih tanpa logo",
                },
                ...presets.map((p) => ({
                  value: p.id,
                  label: p.name,
                  sublabel: `Posisi: ${p.settings.position.replace("-", " ")} • Ukuran: ${p.settings.scalePct}%`,
                  logoUrl: p.logoUrl,
                })),
              ]}
            />

            {options.watermark?.preset && (
              <div className="text-[11px] text-muted-foreground bg-muted/50 p-2.5 rounded-xl flex items-center justify-between font-mono animate-in fade-in">
                <span>Transparansi: {options.watermark.preset.settings.opacityPct}%</span>
                <span>Skala: {options.watermark.preset.settings.scalePct}%</span>
                <span className="capitalize font-sans font-medium text-foreground">
                  {options.watermark.preset.settings.position.replace("-", " ")}
                </span>
              </div>
            )}
          </div>

          {/* Operation 3: Resize & Aspect Ratio (Ukuran & Rasio Foto) */}
          <div className="rounded-2xl border border-border/60 bg-card/80 p-4 flex flex-col gap-3.5 shadow-sm hover:border-primary/40 transition-colors">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-brand-500/10 text-brand-600 dark:text-brand-400 shrink-0">
                <ArrowsPointingOutIcon className="w-4 h-4" />
              </div>
              <div className="flex flex-col">
                <span className="text-xs font-bold text-foreground">
                  Ukuran & Rasio Foto
                </span>
                <span className="text-[11px] text-muted-foreground">
                  Pilihan rasio & kompresi siap kirim
                </span>
              </div>
            </div>

            {/* Preset Selector Grid */}
            <div className="grid grid-cols-2 gap-2">
              {(Object.keys(RESIZE_PRESETS) as ResizePresetId[]).map((key) => {
                const isSelected = options.resize.presetId === key;
                const info = PRESET_DISPLAY_DATA[key] || {
                  name: key,
                  tag: "Kustom",
                };
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => handleResizePresetChange(key)}
                    className={`min-h-[50px] p-2.5 rounded-xl border text-left flex flex-col justify-center gap-0.5 transition-all duration-200 active:scale-95 ${
                      isSelected
                        ? "bg-primary text-primary-foreground border-primary font-semibold shadow-sm"
                        : "bg-background text-muted-foreground hover:text-foreground hover:bg-muted border-border/60"
                    }`}
                  >
                    <span className="text-xs font-bold leading-tight">
                      {info.name}
                    </span>
                    <span
                      className={`text-[10px] font-mono leading-tight ${
                        isSelected
                          ? "text-primary-foreground/85"
                          : "text-muted-foreground"
                      }`}
                    >
                      {info.tag}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Custom Dimension Inputs when "custom" is active */}
            {options.resize.presetId === "custom" && (
              <div className="grid grid-cols-2 gap-2.5 p-3 rounded-xl bg-muted/40 border border-border/60 animate-in fade-in">
                <div className="flex flex-col gap-1">
                  <label className="text-[11px] font-semibold text-foreground">
                    Lebar (px)
                  </label>
                  <input
                    type="number"
                    min="100"
                    max="10000"
                    placeholder="Misal: 1920"
                    value={options.resize.customWidth || ""}
                    onChange={(e) =>
                      handleCustomDimensionChange(
                        "customWidth",
                        parseInt(e.target.value, 10) || 0
                      )
                    }
                    className="w-full px-3 py-1.5 rounded-lg border border-border/60 bg-background text-xs font-mono text-foreground focus-visible:ring-2 focus-visible:ring-primary"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[11px] font-semibold text-foreground">
                    Tinggi (px)
                  </label>
                  <input
                    type="number"
                    min="100"
                    max="10000"
                    placeholder="Misal: 1080"
                    value={options.resize.customHeight || ""}
                    onChange={(e) =>
                      handleCustomDimensionChange(
                        "customHeight",
                        parseInt(e.target.value, 10) || 0
                      )
                    }
                    className="w-full px-3 py-1.5 rounded-lg border border-border/60 bg-background text-xs font-mono text-foreground focus-visible:ring-2 focus-visible:ring-primary"
                  />
                </div>
              </div>
            )}

            {/* Fit Mode Selector (Cover vs Contain) */}
            <div className="flex flex-col gap-1.5 pt-2 border-t border-border/50">
              <span className="text-xs font-semibold text-foreground">
                Metode Penyesuaian Rasio
              </span>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => handleFitModeChange("cover")}
                  className={`min-h-[40px] py-2 px-2.5 rounded-xl text-xs font-medium border text-center transition-all active:scale-95 ${
                    options.resize.fitMode === "cover"
                      ? "bg-primary text-primary-foreground border-primary font-semibold shadow-sm"
                      : "bg-background text-muted-foreground hover:text-foreground hover:bg-muted border-border/60"
                  }`}
                >
                  Potong Pas (Cover)
                </button>
                <button
                  type="button"
                  onClick={() => handleFitModeChange("contain")}
                  className={`min-h-[40px] py-2 px-2.5 rounded-xl text-xs font-medium border text-center transition-all active:scale-95 ${
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
              <span className="text-xs font-semibold text-foreground">
                Format File Output
              </span>
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
                      onClick={() => handleFormatChange(fmt.id)}
                      className={`min-h-[40px] py-2 px-2 rounded-xl text-xs font-medium border text-center transition-all active:scale-95 ${
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

            {/* Quality Compression */}
            <div className="flex flex-col gap-2 pt-2 border-t border-border/50">
              {options.resize.format === "image/png" ? (
                <div className="p-2.5 rounded-xl bg-muted/60 border border-border/50 text-[11px] text-muted-foreground leading-relaxed">
                  <span className="font-semibold text-foreground block mb-0.5">
                    PNG Lossless
                  </span>
                  Format PNG dikompresi murni tanpa penurunan kualitas piksel foto asli.
                </div>
              ) : (
                <>
                  <div className="flex items-center justify-between text-xs min-h-[26px]">
                    <span className="font-semibold text-foreground">
                      Kualitas Kompresi (
                      {options.resize.format === "image/webp" ? "WebP" : "JPG"})
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
                      handleQualityChange(parseFloat(e.target.value))
                    }
                    className="w-full accent-primary mt-1 min-h-[36px]"
                  />
                </>
              )}
            </div>
          </div>

          {/* Operation 4: Non-Destructive Auto-Color Preview */}
          <div className="rounded-2xl border border-border/60 bg-card/80 p-4 flex flex-col gap-3.5 shadow-sm hover:border-primary/40 transition-colors">
            <div className="flex items-center justify-between min-h-[38px]">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 shrink-0">
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
                className="w-5 h-5 accent-primary cursor-pointer rounded transition-transform active:scale-90"
              />
            </div>

            {options.colorAdjustment?.enabled && (
              <div className="flex flex-col gap-3 pt-3 border-t border-border/50 animate-in fade-in">
                <div className="flex items-center justify-between text-xs min-h-[26px]">
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
                  className="w-full accent-primary mt-1 min-h-[36px]"
                />

                <button
                  type="button"
                  onClick={handleResetColor}
                  className="min-h-[40px] flex items-center justify-center gap-1.5 text-xs text-muted-foreground hover:text-foreground py-2 rounded-xl border border-border/60 hover:bg-muted/50 transition-all active:scale-95"
                >
                  <ArrowPathIcon className="w-3.5 h-3.5" />
                  <span>Kembalikan ke Warna Asli</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ----------------------------------------------------------- */}
      {/* FULL-SCREEN HIGH-RESOLUTION LIGHTBOX MODAL (z-[100]) */}
      {/* ----------------------------------------------------------- */}
      {lightboxOpen && activeJob && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`Pratinjau ${activeJob.originalFilename}`}
          onClick={() => setLightboxOpen(false)}
          className="fixed inset-0 z-[100] bg-black/95 backdrop-blur-2xl flex flex-col justify-between p-4 sm:p-6 overflow-y-auto animate-fade-in"
        >
          {/* Top Bar Header */}
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-6xl mx-auto flex items-center justify-between text-white shrink-0 mb-4"
          >
            <div className="flex items-center gap-2 overflow-hidden">
              <span className="text-xs sm:text-sm font-semibold truncate max-w-[200px] sm:max-w-md">
                {activeJob.originalFilename}
              </span>
              {activeJob.result ? (
                <span className="text-[10px] sm:text-xs text-white/70 font-mono shrink-0">
                  ({activeJob.result.width} × {activeJob.result.height} px)
                </span>
              ) : activeJob.originalDimensions ? (
                <span className="text-[10px] sm:text-xs text-white/70 font-mono shrink-0">
                  ({activeJob.originalDimensions.width} ×{" "}
                  {activeJob.originalDimensions.height} px)
                </span>
              ) : null}
            </div>

            <button
              type="button"
              onClick={() => setLightboxOpen(false)}
              className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-full bg-white/15 hover:bg-white/25 text-white transition-all active:scale-90"
              aria-label="Tutup Pratinjau"
            >
              <XMarkIcon className="w-5 h-5" />
            </button>
          </div>

          {/* Main Zoomable Photo Canvas */}
          <div
            onClick={(e) => e.stopPropagation()}
            className="flex-1 w-full max-w-6xl mx-auto flex items-center justify-center p-2 sm:p-4 min-h-0 my-auto"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={
                activeJob.resultBlobUrl ||
                (activeJob.result?.blob
                  ? URL.createObjectURL(activeJob.result.blob)
                  : undefined) ||
                activeJob.objectUrl ||
                activeJob.thumbnailUrl
              }
              alt={activeJob.originalFilename}
              className="max-w-full max-h-[78vh] object-contain rounded-xl shadow-2xl"
            />
          </div>

          {/* Bottom Caption */}
          <div
            onClick={(e) => e.stopPropagation()}
            className="text-[11px] sm:text-xs text-white/70 font-medium text-center shrink-0 mt-4 mx-auto"
          >
            Ketuk di luar foto atau tekan [ESC] untuk menutup
          </div>
        </div>
      )}
    </div>
  );
}
