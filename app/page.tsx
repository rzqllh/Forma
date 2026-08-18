"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import PhotoIcon from "@heroicons/react/24/outline/PhotoIcon";
import AdjustmentsHorizontalIcon from "@heroicons/react/24/outline/AdjustmentsHorizontalIcon";
import TrashIcon from "@heroicons/react/24/outline/TrashIcon";
import ArrowPathIcon from "@heroicons/react/24/outline/ArrowPathIcon";
import CheckCircleIcon from "@heroicons/react/24/outline/CheckCircleIcon";
import ClockIcon from "@heroicons/react/24/outline/ClockIcon";
import ExclamationCircleIcon from "@heroicons/react/24/outline/ExclamationCircleIcon";
import ArrowRightIcon from "@heroicons/react/24/outline/ArrowRightIcon";
import ArchiveBoxIcon from "@heroicons/react/24/outline/ArchiveBoxIcon";
import SparklesIcon from "@heroicons/react/24/outline/SparklesIcon";

import { Dropzone } from "@/components/Dropzone";
import { ConfirmationModal } from "@/components/ConfirmationModal";
import { getQueueManager } from "@/lib/queue/manager";
import { QueueJob, QueueSummary } from "@/lib/queue/types";
import { ProcessingPipelineOptions } from "@/lib/processing/types";
import {
  fetchBatchHistory,
  softDeleteBatch,
  restoreBatch,
} from "@/lib/api/client";
import { Batch, HistoryItem } from "@/db/schema";

export default function LibraryPage() {
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

  const [activeTab, setActiveTab] = useState<"current" | "history" | "trash">("current");
  const [historyBatches, setHistoryBatches] = useState<(Batch & { items: HistoryItem[] })[]>([]);
  const [trashBatches, setTrashBatches] = useState<(Batch & { items: HistoryItem[] })[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);

  // Soft Delete confirmation modal state
  const [deleteModalState, setDeleteModalState] = useState<{
    isOpen: boolean;
    batchId: string | null;
    batchLabel: string;
  }>({
    isOpen: false,
    batchId: null,
    batchLabel: "",
  });

  useEffect(() => {
    const queue = getQueueManager();
    const unsub = queue.subscribe((currentJobs, currentSummary) => {
      setJobs(currentJobs);
      setSummary(currentSummary);
    });
    // Load history and trash immediately on mount
    loadHistoryData();
    return unsub;
  }, []);

  useEffect(() => {
    if (activeTab === "history" || activeTab === "trash") {
      loadHistoryData();
    }
  }, [activeTab]);

  const loadHistoryData = async () => {
    setIsLoadingHistory(true);
    try {
      const activeBatches = await fetchBatchHistory(false);
      const deletedBatches = await fetchBatchHistory(true);
      setHistoryBatches(activeBatches);
      setTrashBatches(deletedBatches);
    } catch (err) {
      console.warn("Gagal memuat riwayat:", err);
    } finally {
      setIsLoadingHistory(false);
    }
  };

  const handleFilesSelected = (files: File[]) => {
    const queue = getQueueManager();
    const defaultOptions: ProcessingPipelineOptions = {
      stripMetadata: true,
      colorAdjustment: {
        enabled: false,
        intensityPct: 50,
      },
      resize: {
        presetId: "custom",
        fitMode: "contain",
        format: "image/jpeg",
        quality: 0.9,
      },
    };
    queue.addFiles(files, defaultOptions);
  };

  const handleRemoveJob = (id: string) => {
    const queue = getQueueManager();
    queue.removeJob(id);
  };

  const handleClearAllJobs = () => {
    const queue = getQueueManager();
    queue.clearAll();
  };

  const handleSoftDelete = async (batchId: string) => {
    try {
      await softDeleteBatch(batchId);
      await loadHistoryData();
    } catch (err) {
      console.error("Gagal menghapus ke tong sampah:", err);
    } finally {
      setDeleteModalState({ isOpen: false, batchId: null, batchLabel: "" });
    }
  };

  const handleRestore = async (batchId: string) => {
    try {
      await restoreBatch(batchId);
      await loadHistoryData();
    } catch (err) {
      console.error("Gagal memulihkan batch:", err);
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024 * 1024) {
      return `${(bytes / 1024).toFixed(1)} KB`;
    }
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const getRemainingTrashTime = (deletedAt: string | null) => {
    if (!deletedAt) return "24 jam";
    const deletedTime = new Date(deletedAt).getTime();
    const expireTime = deletedTime + 24 * 60 * 60 * 1000;
    const now = Date.now();
    const diffMs = expireTime - now;

    if (diffMs <= 0) return "Kedaluwarsa (akan dibersihkan)";
    const hours = Math.floor(diffMs / (1000 * 60 * 60));
    const mins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
    return `Sisa ${hours} jam ${mins} mnt`;
  };

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10 pb-28 sm:pb-32 flex flex-col gap-8 animate-fade-in">
      {/* Header Section */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-5">
        <div className="flex flex-col gap-1.5">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
            Koleksi Foto Interior
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed max-w-xl">
            Rapikan hasil akhir tanpa mengubah desain aslinya. Bersihkan metadata, pasang watermark, dan siapkan foto untuk dikirim.
          </p>
        </div>

        {/* Apple HIG Segmented View Switcher */}
        <div role="tablist" className="inline-flex items-center gap-1 p-1.5 bg-muted/80 dark:bg-muted/40 rounded-2xl text-xs font-medium self-stretch sm:self-auto border border-border/50 shadow-inner">
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "current"}
            onClick={() => setActiveTab("current")}
            className={`flex-1 sm:flex-none px-4 py-2 rounded-xl transition-all duration-200 active:scale-95 cursor-pointer select-none ${
              activeTab === "current"
                ? "bg-primary text-primary-foreground font-semibold shadow-md ring-1 ring-primary/30"
                : "text-muted-foreground hover:text-foreground hover:bg-background/60"
            }`}
          >
            Sesi Aktif {jobs.length > 0 && `(${jobs.length})`}
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "history"}
            onClick={() => setActiveTab("history")}
            className={`flex-1 sm:flex-none px-4 py-2 rounded-xl transition-all duration-200 active:scale-95 cursor-pointer select-none ${
              activeTab === "history"
                ? "bg-primary text-primary-foreground font-semibold shadow-md ring-1 ring-primary/30"
                : "text-muted-foreground hover:text-foreground hover:bg-background/60"
            }`}
          >
            Riwayat Ekspor {historyBatches.length > 0 && `(${historyBatches.length})`}
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "trash"}
            onClick={() => setActiveTab("trash")}
            className={`flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl transition-all duration-200 active:scale-95 cursor-pointer select-none ${
              activeTab === "trash"
                ? "bg-destructive text-white font-semibold shadow-md ring-1 ring-destructive/30"
                : "text-muted-foreground hover:text-foreground hover:bg-background/60"
            }`}
          >
            <TrashIcon className="w-3.5 h-3.5" />
            <span>Sampah</span>
            {trashBatches.length > 0 && (
              <span className="ml-0.5 px-1.5 py-0.5 rounded-full bg-white/20 text-white text-[10px] font-bold">
                {trashBatches.length}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* TAB 1: ACTIVE INTAKE & SESSION */}
      {/* ------------------------------------------------------------- */}
      {activeTab === "current" && (
        <div className="flex flex-col gap-6">
          {/* File Dropzone */}
          <Dropzone onFilesSelected={handleFilesSelected} />

          {/* Active Batch Queue Section */}
          {jobs.length > 0 && (
            <div className="flex flex-col gap-5 bg-card/80 backdrop-blur-sm rounded-3xl border border-border/60 p-6 sm:p-7 shadow-sm animate-in fade-in duration-300">
              {/* Batch Action Bar */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-border/50">
                <div className="flex items-center gap-3.5">
                  <div className="w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-bold text-sm shadow-inner">
                    {jobs.length}
                  </div>
                  <div className="flex flex-col">
                    <span className="text-sm font-bold text-foreground">
                      Foto Siap Diproses
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {summary.done} dari {summary.total} foto sudah selesai diproses
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={handleClearAllJobs}
                    className="px-3.5 py-2 text-xs font-semibold text-muted-foreground hover:text-destructive transition-all rounded-xl border border-border/60 hover:bg-muted/50 active:scale-95"
                  >
                    Hapus Sesi Ini
                  </button>
                  <Link
                    href="/edit"
                    className="flex items-center gap-2 px-4 py-2 text-xs font-semibold bg-primary text-primary-foreground hover:bg-primary/90 transition-all rounded-xl shadow-sm active:scale-95"
                  >
                    <AdjustmentsHorizontalIcon className="w-4 h-4" />
                    <span>Buka di Editor</span>
                    <ArrowRightIcon className="w-3.5 h-3.5 ml-0.5" />
                  </Link>
                </div>
              </div>

              {/* Progress Bar */}
              {summary.total > 0 && summary.progressPct > 0 && (
                <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
                  <div
                    className="bg-accent h-full transition-all duration-300 rounded-full shadow-sm"
                    style={{ width: `${summary.progressPct}%` }}
                  />
                </div>
              )}

              {/* Photo Thumbnail Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 sm:gap-5">
                {jobs.map((job) => (
                  <div
                    key={job.id}
                    className="group relative rounded-2xl border border-border/60 bg-background overflow-hidden flex flex-col shadow-sm hover:border-primary/50 hover:shadow-md transition-all duration-200"
                  >
                    {/* Thumbnail Image */}
                    <div className="aspect-[4/3] bg-muted relative overflow-hidden">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={job.thumbnailUrl || job.objectUrl}
                        alt={job.originalFilename}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />

                      {/* State Badge */}
                      <div className="absolute top-2 right-2">
                        {job.state === "done" && (
                          <div className="p-1 rounded-full bg-emerald-600 text-white shadow-md">
                            <CheckCircleIcon className="w-3.5 h-3.5" />
                          </div>
                        )}
                        {job.state === "processing" && (
                          <div className="p-1 rounded-full bg-accent text-white shadow-md">
                            <ArrowPathIcon className="w-3.5 h-3.5 animate-spin" />
                          </div>
                        )}
                        {job.state === "error" && (
                          <div className="p-1 rounded-full bg-destructive text-white shadow-md">
                            <ExclamationCircleIcon className="w-3.5 h-3.5" />
                          </div>
                        )}
                      </div>

                      {/* Hover Remove Button */}
                      <button
                        type="button"
                        onClick={() => handleRemoveJob(job.id)}
                        aria-label={`Hapus ${job.originalFilename}`}
                        className="absolute bottom-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity p-1.5 rounded-lg bg-black/70 hover:bg-destructive text-white backdrop-blur-sm active:scale-90"
                      >
                        <TrashIcon className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    {/* Metadata Footer */}
                    <div className="p-3 flex flex-col gap-0.5">
                      <span
                        className="text-xs font-semibold truncate text-foreground"
                        title={job.originalFilename}
                      >
                        {job.originalFilename}
                      </span>
                      <span className="text-[11px] text-muted-foreground font-mono">
                        {formatFileSize(job.originalSize)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Friendly Empty State */}
          {jobs.length === 0 && (
            <div className="p-10 rounded-3xl border border-dashed border-border/70 text-center flex flex-col items-center justify-center gap-3 text-muted-foreground bg-card/20 backdrop-blur-sm">
              <PhotoIcon className="w-10 h-10 opacity-30 text-primary" />
              <div className="flex flex-col gap-1">
                <span className="text-sm font-semibold text-foreground">
                  Belum ada foto yang dimasukkan
                </span>
                <span className="text-xs max-w-sm text-muted-foreground leading-relaxed">
                  Tambahkan foto di atas untuk mulai merapikan dan menyiapkan hasil akhirnya.
                </span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* TAB 2: PAST DELIVERIES (HISTORY) */}
      {/* ------------------------------------------------------------- */}
      {activeTab === "history" && (
        <div className="flex flex-col gap-4">
          {isLoadingHistory ? (
            <div className="p-12 text-center text-xs text-muted-foreground flex items-center justify-center gap-2">
              <ArrowPathIcon className="w-4 h-4 animate-spin text-primary" />
              <span>Memuat data riwayat kirim...</span>
            </div>
          ) : historyBatches.length === 0 ? (
            <div className="p-12 rounded-3xl border border-dashed border-border/70 text-center flex flex-col items-center justify-center gap-3 text-muted-foreground bg-card/20">
              <ArchiveBoxIcon className="w-10 h-10 opacity-30 text-muted-foreground" />
              <div className="flex flex-col gap-1">
                <span className="text-sm font-semibold text-foreground">
                  Belum ada riwayat pengiriman
                </span>
                <span className="text-xs max-w-sm text-muted-foreground leading-relaxed">
                  Foto-foto yang sudah selesai diekspor dan disimpan ke riwayat akan muncul di sini.
                </span>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {historyBatches.map((batch) => (
                <div
                  key={batch.id}
                  className="rounded-3xl border border-border/60 bg-card/80 backdrop-blur-sm p-6 flex flex-col justify-between gap-5 shadow-sm hover:border-primary/40 transition-all"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex flex-col gap-1">
                      <h3 className="text-base font-bold text-foreground leading-tight">
                        {batch.label || "Paket Foto Selesai"}
                      </h3>
                      <span className="text-xs text-muted-foreground font-mono">
                        {new Date(batch.createdAt).toLocaleDateString("id-ID", {
                          year: "numeric",
                          month: "short",
                          day: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={() =>
                        setDeleteModalState({
                          isOpen: true,
                          batchId: batch.id,
                          batchLabel: batch.label || "Paket Foto",
                        })
                      }
                      aria-label="Pindahkan ke tong sampah"
                      className="p-2 text-muted-foreground hover:text-destructive rounded-xl border border-border/60 hover:bg-muted transition-all active:scale-90"
                    >
                      <TrashIcon className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Thumbnail Previews */}
                  <div className="flex items-center gap-2.5 overflow-x-auto py-1">
                    {batch.items.slice(0, 6).map((item) => (
                      <div
                        key={item.id}
                        className="w-14 h-14 rounded-xl bg-muted border border-border/60 shrink-0 overflow-hidden"
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={item.cloudinaryUrl}
                          alt={item.originalFilename}
                          className="w-full h-full object-cover"
                        />
                      </div>
                    ))}
                    {batch.items.length > 6 && (
                      <div className="w-14 h-14 rounded-xl bg-muted flex items-center justify-center text-xs font-bold text-muted-foreground shrink-0 border border-border/60">
                        +{batch.items.length - 6}
                      </div>
                    )}
                  </div>

                  <div className="flex items-center justify-between text-xs text-muted-foreground pt-3 border-t border-border/50">
                    <span className="font-medium">{batch.items.length} foto tersimpan</span>
                    <span className="text-emerald-700 dark:text-emerald-400 font-semibold flex items-center gap-1">
                      <CheckCircleIcon className="w-3.5 h-3.5" /> Metadata Bersih
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* TAB 3: TRASH & 24-HOUR RESTORE */}
      {/* ------------------------------------------------------------- */}
      {activeTab === "trash" && (
        <div className="flex flex-col gap-5">
          <div className="p-4 sm:p-5 rounded-2xl border border-amber-500/30 bg-amber-500/10 text-xs text-amber-950 dark:text-amber-200 leading-relaxed flex items-start gap-3">
            <ClockIcon className="w-4 h-4 shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
            <div>
              <span className="font-bold block mb-0.5">
                Bisa Dipulihkan 24 Jam:
              </span>
              Foto yang kamu hapus masih tersimpan aman di sini selama 24 jam. Setelah 24 jam, sistem akan menghapusnya secara otomatis dan permanen.
            </div>
          </div>

          {trashBatches.length === 0 ? (
            <div className="p-12 rounded-3xl border border-dashed border-border/70 text-center flex flex-col items-center justify-center gap-3 text-muted-foreground bg-card/20">
              <CheckCircleIcon className="w-10 h-10 opacity-30 text-muted-foreground" />
              <div className="flex flex-col gap-1">
                <span className="text-sm font-semibold text-foreground">
                  Tong sampah kosong
                </span>
                <span className="text-xs text-muted-foreground">
                  Tidak ada paket foto yang sedang dihapus.
                </span>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {trashBatches.map((batch) => (
                <div
                  key={batch.id}
                  className="rounded-3xl border border-border/60 bg-card/80 backdrop-blur-sm p-6 flex flex-col justify-between gap-5 shadow-sm opacity-95"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex flex-col gap-1">
                      <h3 className="text-base font-bold leading-tight text-foreground">
                        {batch.label || "Paket Foto Dihapus"}
                      </h3>
                      <span className="text-xs text-destructive font-semibold flex items-center gap-1">
                        <ClockIcon className="w-3.5 h-3.5" />
                        {getRemainingTrashTime(batch.deletedAt)}
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleRestore(batch.id)}
                      className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl border border-border/60 bg-background hover:bg-muted text-xs font-semibold transition-all active:scale-95"
                    >
                      <ArrowPathIcon className="w-3.5 h-3.5 text-primary" />
                      <span>Pulihkan</span>
                    </button>
                  </div>

                  <div className="text-xs text-muted-foreground pt-3 border-t border-border/50">
                    Berisi {batch.items.length} file foto
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Confirmation Modal for Moving to Trash */}
      <ConfirmationModal
        isOpen={deleteModalState.isOpen}
        title="Pindahkan ke Tong Sampah?"
        description={`"${deleteModalState.batchLabel}" akan dipindahkan ke tong sampah. Kamu masih bisa memulihkannya dalam waktu 24 jam ke depan sebelum dihapus permanen.`}
        confirmLabel="Pindahkan ke Tong Sampah"
        cancelLabel="Batal"
        isDestructive={true}
        onConfirm={() =>
          deleteModalState.batchId && handleSoftDelete(deleteModalState.batchId)
        }
        onCancel={() =>
          setDeleteModalState({ isOpen: false, batchId: null, batchLabel: "" })
        }
      />
    </div>
  );
}
