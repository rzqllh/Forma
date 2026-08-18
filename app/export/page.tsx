"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import JSZip from "jszip";
import ArrowDownTrayIcon from "@heroicons/react/24/outline/ArrowDownTrayIcon";
import ArchiveBoxIcon from "@heroicons/react/24/outline/ArchiveBoxIcon";
import CloudArrowUpIcon from "@heroicons/react/24/outline/CloudArrowUpIcon";
import CheckCircleIcon from "@heroicons/react/24/outline/CheckCircleIcon";
import ExclamationCircleIcon from "@heroicons/react/24/outline/ExclamationCircleIcon";
import ArrowLeftIcon from "@heroicons/react/24/outline/ArrowLeftIcon";
import ArrowPathIcon from "@heroicons/react/24/outline/ArrowPathIcon";
import XMarkIcon from "@heroicons/react/24/outline/XMarkIcon";

import { getQueueManager } from "@/lib/queue/manager";
import { QueueJob, QueueSummary } from "@/lib/queue/types";
import {
  getSignedUploadParams,
  saveBatchHistory,
} from "@/lib/api/client";

export default function ExportPage() {
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

  const [batchLabel, setBatchLabel] = useState(
    `Paket Foto Interior ${new Date().toLocaleDateString("id-ID")}`
  );
  const [isZipping, setIsZipping] = useState(false);
  const [isCloudSyncing, setIsCloudSyncing] = useState(false);
  const [syncStatusMessage, setSyncStatusMessage] = useState<string | null>(null);
  const [syncErrorMessage, setSyncErrorMessage] = useState<string | null>(null);
  const [previewJob, setPreviewJob] = useState<QueueJob | null>(null);

  useEffect(() => {
    const queue = getQueueManager();
    const unsub = queue.subscribe((currentJobs, currentSummary) => {
      setJobs(currentJobs);
      setSummary(currentSummary);
    });
    return unsub;
  }, []);

  const completedJobs = jobs.filter((j) => j.state === "done" && j.result);

  const totalByteSize = completedJobs.reduce(
    (acc, j) => acc + (j.result?.byteSize || 0),
    0
  );

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024 * 1024) {
      return `${(bytes / 1024).toFixed(1)} KB`;
    }
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const handleDownloadSingle = (job: QueueJob) => {
    if (!job.result || !job.resultBlobUrl) return;
    const a = document.createElement("a");
    a.href = job.resultBlobUrl;
    const ext =
      job.result.format === "image/png"
        ? "png"
        : job.result.format === "image/webp"
        ? "webp"
        : "jpg";
    const baseName = job.originalFilename.replace(/\.[^/.]+$/, "");
    a.download = `${baseName}_finished.${ext}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const handleDownloadZip = async () => {
    if (completedJobs.length === 0) return;
    setIsZipping(true);

    try {
      const zip = new JSZip();
      const folderName = batchLabel.trim().replace(/[^a-zA-Z0-9_-]/g, "_");
      const folder = zip.folder(folderName) || zip;

      for (let i = 0; i < completedJobs.length; i++) {
        const job = completedJobs[i];
        if (!job.result) continue;
        const ext =
          job.result.format === "image/png"
            ? "png"
            : job.result.format === "image/webp"
            ? "webp"
            : "jpg";
        const baseName = job.originalFilename.replace(/\.[^/.]+$/, "");
        const fileName = `${baseName}_finished.${ext}`;
        folder.file(fileName, job.result.blob);
      }

      const zipBlob = await zip.generateAsync({
        type: "blob",
        compression: "DEFLATE",
        compressionOptions: { level: 6 },
      });

      const zipUrl = URL.createObjectURL(zipBlob);
      const a = document.createElement("a");
      a.href = zipUrl;
      a.download = `${folderName}.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(zipUrl);
    } catch (err) {
      console.error("Gagal membuat paket ZIP:", err);
    } finally {
      setIsZipping(false);
    }
  };

  const handleCloudinarySync = async () => {
    if (completedJobs.length === 0) return;
    setIsCloudSyncing(true);
    setSyncStatusMessage("Menyiapkan izin upload cloud...");
    setSyncErrorMessage(null);

    try {
      const signedParams = await getSignedUploadParams("forma_photos").catch((err) => {
        throw new Error(
          `Koneksi cloud upload gagal: ${
            err instanceof Error ? err.message : "Tidak dapat memperoleh izin upload"
          }`
        );
      });

      const historyItemPayloads: Array<{
        originalFilename: string;
        cloudinaryUrl: string;
        operationsApplied: {
          metadataStripped: boolean;
          watermarked: boolean;
          resized: boolean;
          colorAdjusted: boolean;
          presetName?: string;
        };
      }> = [];

      let failedUploads = 0;

      for (let i = 0; i < completedJobs.length; i++) {
        const job = completedJobs[i];
        if (!job.result) continue;

        setSyncStatusMessage(`Mengunggah foto ${i + 1} dari ${completedJobs.length} ke cloud...`);

        try {
          const formData = new FormData();
          formData.append("file", job.result.blob);
          formData.append("api_key", signedParams.apiKey);
          formData.append("timestamp", signedParams.timestamp.toString());
          formData.append("signature", signedParams.signature);
          formData.append("folder", signedParams.folder);

          const uploadRes = await fetch(
            `https://api.cloudinary.com/v1_1/${signedParams.cloudName}/image/upload`,
            {
              method: "POST",
              body: formData,
            }
          );

          if (!uploadRes.ok) {
            throw new Error(`HTTP ${uploadRes.status}`);
          }

          const resData = (await uploadRes.json()) as { secure_url?: string };
          if (!resData.secure_url || !resData.secure_url.startsWith("https://")) {
            throw new Error("URL Cloudinary tidak valid");
          }

          historyItemPayloads.push({
            originalFilename: job.originalFilename,
            cloudinaryUrl: resData.secure_url,
            operationsApplied: job.result.operationsApplied,
          });
        } catch (uploadErr) {
          failedUploads++;
          console.warn("Upload gagal untuk foto:", job.id, uploadErr);
        }
      }

      if (historyItemPayloads.length === 0) {
        throw new Error("Semua file gagal diunggah ke Cloudinary. Riwayat cloud tidak disimpan.");
      }

      setSyncStatusMessage("Mencatat ke riwayat pengiriman...");
      await saveBatchHistory(batchLabel.trim(), null, historyItemPayloads);

      if (failedUploads > 0) {
        setSyncStatusMessage(null);
        setSyncErrorMessage(
          `${historyItemPayloads.length} foto berhasil disimpan ke cloud, tetapi ${failedUploads} foto gagal diunggah.`
        );
      } else {
        setSyncStatusMessage("Semua foto berhasil diunggah dan dicatat di Riwayat!");
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Gagal menyimpan ke cloud";
      setSyncErrorMessage(msg);
      setSyncStatusMessage(null);
    } finally {
      setIsCloudSyncing(false);
    }
  };

  if (jobs.length === 0) {
    return (
      <div className="max-w-xl mx-auto py-20 px-6 text-center flex flex-col items-center justify-center gap-4 animate-fade-in">
        <div className="w-16 h-16 rounded-3xl bg-muted flex items-center justify-center text-muted-foreground shadow-inner">
          <ArchiveBoxIcon className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-bold tracking-tight text-foreground">
          Belum Ada Foto Selesai Diproses
        </h2>
        <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
          Yuk upload dan proses foto-fotomu di menu Koleksi & Editor terlebih dahulu sebelum ekspor.
        </p>
        <Link
          href="/"
          className="mt-3 px-6 py-2.5 bg-primary text-primary-foreground font-semibold text-xs rounded-xl hover:bg-primary/90 transition-all shadow-sm active:scale-95"
        >
          Kembali ke Koleksi Foto
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10 flex flex-col gap-8 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-5">
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center gap-2 text-xs text-muted-foreground font-medium mb-0.5">
            <Link href="/edit" className="hover:text-foreground">
              Editor
            </Link>
            <span>/</span>
            <span>Ekspor</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
            Ekspor & Pengiriman Foto
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed max-w-xl">
            Download hasil foto resolusi tinggi satu per satu atau bungkus sekaligus jadi file ZIP rapi untuk dikirim ke klien.
          </p>
        </div>

        <Link
          href="/edit"
          className="flex items-center gap-2 text-xs font-semibold px-4 py-2 rounded-xl border border-border/60 bg-background hover:bg-muted transition-all shadow-sm active:scale-95"
        >
          <ArrowLeftIcon className="w-3.5 h-3.5" />
          <span>Kembali ke Editor</span>
        </Link>
      </div>

      {/* Summary Banner Card */}
      <div className="rounded-3xl border border-border/60 bg-card/80 backdrop-blur-xl p-6 sm:p-7 shadow-sm flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center font-bold text-lg shrink-0 shadow-inner">
            {completedJobs.length}
          </div>
          <div className="flex flex-col gap-1">
            <h3 className="text-base font-bold text-foreground">
              {completedJobs.length} dari {jobs.length} Foto Siap Dikirim
            </h3>
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <span className="font-mono">Total Ukuran: {formatFileSize(totalByteSize)}</span>
              <span>•</span>
              <span className="text-emerald-700 dark:text-emerald-400 font-semibold flex items-center gap-1">
                <CheckCircleIcon className="w-3.5 h-3.5" /> Metadata Bersih
              </span>
            </div>
          </div>
        </div>

        {/* Batch Actions */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full lg:w-auto">
          <button
            type="button"
            onClick={handleDownloadZip}
            disabled={isZipping || completedJobs.length === 0}
            className="min-h-[44px] flex-1 sm:flex-none flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl bg-primary text-primary-foreground font-semibold text-xs hover:bg-primary/90 transition-all shadow-sm disabled:opacity-50 active:scale-95"
          >
            {isZipping ? (
              <ArrowPathIcon className="w-4 h-4 animate-spin" />
            ) : (
              <ArchiveBoxIcon className="w-4 h-4" />
            )}
            <span>{isZipping ? "Membuat ZIP..." : "Download Semua (ZIP)"}</span>
          </button>

          <button
            type="button"
            onClick={handleCloudinarySync}
            disabled={isCloudSyncing || completedJobs.length === 0}
            className="min-h-[44px] flex-1 sm:flex-none flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl border border-border/60 bg-background hover:bg-muted text-xs font-semibold transition-all shadow-sm disabled:opacity-50 active:scale-95"
          >
            {isCloudSyncing ? (
              <ArrowPathIcon className="w-4 h-4 animate-spin" />
            ) : (
              <CloudArrowUpIcon className="w-4 h-4 text-accent" />
            )}
            <span>Simpan ke Riwayat</span>
          </button>
        </div>
      </div>

      {/* Sync Status Feedback */}
      {syncStatusMessage && (
        <div className="p-4 rounded-2xl bg-primary/10 border border-primary/20 text-xs text-primary font-semibold flex items-center gap-3 animate-in fade-in">
          <CheckCircleIcon className="w-4 h-4 shrink-0" />
          <span>{syncStatusMessage}</span>
        </div>
      )}

      {syncErrorMessage && (
        <div className="p-4 rounded-2xl bg-destructive/10 border border-destructive/20 text-xs text-destructive font-semibold flex items-center gap-3 animate-in fade-in">
          <ExclamationCircleIcon className="w-4 h-4 shrink-0" />
          <span>{syncErrorMessage}</span>
        </div>
      )}

      {/* Batch Name Config */}
      <div className="rounded-2xl border border-border/60 p-5 bg-card/60 backdrop-blur-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-sm">
        <div className="flex flex-col gap-0.5">
          <span className="text-xs font-bold text-foreground">Nama Paket Pengiriman</span>
          <span className="text-[11px] text-muted-foreground">
            Dipakai sebagai nama file ZIP dan label riwayat pengiriman
          </span>
        </div>
        <input
          type="text"
          value={batchLabel}
          onChange={(e) => setBatchLabel(e.target.value)}
          className="px-4 py-2 rounded-xl border border-border/60 bg-background text-xs sm:w-80 font-medium shadow-sm focus-visible:ring-2 focus-visible:ring-primary"
        />
      </div>

      {/* Photos Grid with Individual Download Options */}
      <div className="flex flex-col gap-5">
        <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
          Daftar Foto Selesai ({completedJobs.length})
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {jobs.map((job) => {
            const isDone = job.state === "done" && job.result;
            return (
              <div
                key={job.id}
                className="rounded-2xl border border-border/60 bg-card/80 backdrop-blur-sm p-4 flex items-center justify-between gap-4 shadow-sm hover:border-primary/40 transition-all hover:scale-[1.01]"
              >
                <div
                  onClick={() => setPreviewJob(job)}
                  className="flex items-center gap-3.5 overflow-hidden cursor-pointer flex-1"
                >
                  <div className="w-14 h-14 rounded-xl bg-muted border border-border/60 overflow-hidden shrink-0 shadow-inner group relative">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={job.thumbnailUrl || job.objectUrl}
                      alt={job.originalFilename}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                    />
                  </div>
                  <div className="flex flex-col gap-0.5 overflow-hidden">
                    <span
                      className="text-xs font-bold truncate text-foreground hover:text-primary transition-colors"
                      title={job.originalFilename}
                    >
                      {job.originalFilename}
                    </span>
                    <span className="text-[11px] text-muted-foreground font-mono">
                      {isDone
                        ? `${job.result?.width}x${job.result?.height} • ${formatFileSize(
                            job.result?.byteSize || 0
                          )}`
                        : job.state === "processing"
                        ? "Sedang diproses..."
                        : "Dalam antrean"}
                    </span>
                  </div>
                </div>

                <div>
                  {isDone ? (
                    <button
                      type="button"
                      onClick={() => handleDownloadSingle(job)}
                      aria-label={`Download ${job.originalFilename}`}
                      className="p-2 rounded-xl border border-border/60 bg-background hover:bg-muted text-primary transition-all active:scale-90 shadow-sm"
                    >
                      <ArrowDownTrayIcon className="w-4 h-4" />
                    </button>
                  ) : (
                    <div className="p-2 text-muted-foreground">
                      {job.state === "processing" ? (
                        <ArrowPathIcon className="w-4 h-4 animate-spin text-accent" />
                      ) : (
                        <ExclamationCircleIcon className="w-4 h-4 text-destructive" />
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Lightbox Modal in Export View */}
      {previewJob && (
        <div
          onClick={() => setPreviewJob(null)}
          className="fixed inset-0 z-50 bg-black/90 backdrop-blur-xl flex flex-col items-center justify-between p-4 sm:p-6 animate-fade-in"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-5xl flex items-center justify-between text-white"
          >
            <div className="flex items-center gap-3">
              <span className="text-sm font-semibold truncate">
                {previewJob.originalFilename}
              </span>
              {previewJob.result && (
                <span className="text-xs text-white/60 font-mono">
                  ({previewJob.result.width} × {previewJob.result.height} px •{" "}
                  {formatFileSize(previewJob.result.byteSize)})
                </span>
              )}
            </div>

            <div className="flex items-center gap-2">
              {previewJob.result && (
                <button
                  type="button"
                  onClick={() => handleDownloadSingle(previewJob)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 transition-all active:scale-95 shadow-sm"
                >
                  <ArrowDownTrayIcon className="w-4 h-4" />
                  <span>Download</span>
                </button>
              )}
              <button
                type="button"
                onClick={() => setPreviewJob(null)}
                className="p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-all active:scale-90"
              >
                <XMarkIcon className="w-5 h-5" />
              </button>
            </div>
          </div>

          <div
            onClick={(e) => e.stopPropagation()}
            className="flex-1 w-full max-w-5xl flex items-center justify-center p-2 sm:p-4 overflow-hidden"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={previewJob.resultBlobUrl || previewJob.objectUrl}
              alt={previewJob.originalFilename}
              className="max-w-full max-h-[82vh] object-contain rounded-xl shadow-2xl"
            />
          </div>

          <div
            onClick={(e) => e.stopPropagation()}
            className="text-xs text-white/60 font-medium"
          >
            Klik di luar foto atau tombol silang untuk menutup
          </div>
        </div>
      )}
    </div>
  );
}
