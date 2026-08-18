import {
  JobState,
  QueueJob,
  QueueSubscriber,
  QueueSummary,
} from "./types";
import {
  ProcessingPipelineOptions,
  ProcessedResult,
} from "../processing/types";
import { processImageSource } from "../processing/pipeline";

export class ProcessingQueueManager {
  private jobs: Map<string, QueueJob> = new Map();
  private subscribers: Set<QueueSubscriber> = new Set();
  private maxConcurrency: number;
  private activeWorkers = 0;
  private isDestroyed = false;

  constructor(customConcurrency?: number) {
    if (customConcurrency && customConcurrency > 0) {
      this.maxConcurrency = customConcurrency;
    } else if (
      typeof navigator !== "undefined" &&
      navigator.hardwareConcurrency
    ) {
      this.maxConcurrency = Math.min(
        4,
        Math.max(2, navigator.hardwareConcurrency - 1)
      );
    } else {
      this.maxConcurrency = 2;
    }
  }

  public getConcurrency(): number {
    return this.maxConcurrency;
  }

  public subscribe(subscriber: QueueSubscriber): () => void {
    this.subscribers.add(subscriber);
    subscriber(this.getJobs(), this.getSummary());
    return () => {
      this.subscribers.delete(subscriber);
    };
  }

  private notify(): void {
    if (this.isDestroyed) return;
    const jobsList = this.getJobs();
    const summary = this.getSummary();
    for (const sub of this.subscribers) {
      try {
        sub(jobsList, summary);
      } catch (err) {
        console.error("Queue subscriber error:", err);
      }
    }
  }

  public getJobs(): QueueJob[] {
    return Array.from(this.jobs.values());
  }

  public getJob(id: string): QueueJob | undefined {
    return this.jobs.get(id);
  }

  public getSummary(): QueueSummary {
    const list = this.getJobs();
    let queued = 0;
    let processing = 0;
    let done = 0;
    let error = 0;

    for (const j of list) {
      if (j.state === "queued") queued++;
      else if (j.state === "processing") processing++;
      else if (j.state === "done") done++;
      else if (j.state === "error") error++;
    }

    const total = list.length;
    const completedCount = done + error;
    const progressPct = total > 0 ? Math.round((completedCount / total) * 100) : 0;
    const isProcessing = processing > 0 || queued > 0;

    return {
      total,
      queued,
      processing,
      done,
      error,
      progressPct,
      isProcessing,
    };
  }

  public addFiles(
    files: File[],
    defaultOptions: ProcessingPipelineOptions
  ): string[] {
    const addedIds: string[] = [];

    for (const file of files) {
      const id =
        typeof crypto !== "undefined" && crypto.randomUUID
          ? crypto.randomUUID()
          : `job_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

      const objectUrl = URL.createObjectURL(file);

      const job: QueueJob = {
        id,
        file,
        originalFilename: file.name,
        originalSize: file.size,
        objectUrl,
        thumbnailUrl: objectUrl,
        state: "queued",
        progress: 0,
        options: JSON.parse(JSON.stringify(defaultOptions)),
      };

      this.jobs.set(id, job);
      addedIds.push(id);
    }

    this.notify();
    this.scheduleNext();
    return addedIds;
  }

  public updateJobOptions(
    jobId: string,
    newOptions: Partial<ProcessingPipelineOptions>
  ): void {
    const job = this.jobs.get(jobId);
    if (!job) return;

    job.options = {
      ...job.options,
      ...newOptions,
    };

    // If already done, reset to queued so it can be reprocessed if started
    if (job.state === "done" || job.state === "error") {
      job.state = "queued";
      job.progress = 0;
      if (job.resultBlobUrl) {
        URL.revokeObjectURL(job.resultBlobUrl);
        job.resultBlobUrl = undefined;
      }
      job.result = undefined;
    }

    this.notify();
  }

  public updateAllJobOptions(
    newOptions: Partial<ProcessingPipelineOptions>
  ): void {
    for (const job of this.jobs.values()) {
      job.options = {
        ...job.options,
        ...newOptions,
      };
      if (job.state === "done" || job.state === "error") {
        job.state = "queued";
        job.progress = 0;
        if (job.resultBlobUrl) {
          URL.revokeObjectURL(job.resultBlobUrl);
          job.resultBlobUrl = undefined;
        }
        job.result = undefined;
      }
    }
    this.notify();
  }

  public startBatch(): void {
    // Set any cancelled or pending jobs to queued
    for (const job of this.jobs.values()) {
      if (job.state === "cancelled") {
        job.state = "queued";
        job.progress = 0;
      }
    }
    this.notify();
    this.scheduleNext();
  }

  private scheduleNext(): void {
    if (this.isDestroyed) return;

    while (this.activeWorkers < this.maxConcurrency) {
      const nextJob = this.findNextQueuedJob();
      if (!nextJob) break;

      this.activeWorkers++;
      this.processJob(nextJob)
        .catch((err) => {
          console.error("Unhandled error processing job:", nextJob.id, err);
        })
        .finally(() => {
          this.activeWorkers--;
          this.scheduleNext();
        });
    }
  }

  private findNextQueuedJob(): QueueJob | undefined {
    for (const job of this.jobs.values()) {
      if (job.state === "queued") {
        return job;
      }
    }
    return undefined;
  }

  private async processJob(job: QueueJob): Promise<void> {
    job.state = "processing";
    job.progress = 10;
    job.startedAt = Date.now();
    this.notify();

    try {
      // Load source image
      const imageBitmap = await this.loadImageBitmap(job.file);
      job.originalDimensions = {
        width: imageBitmap.width,
        height: imageBitmap.height,
      };
      job.progress = 35;
      this.notify();

      // Load logo if watermark preset is active
      let logoBitmap: ImageBitmap | undefined = undefined;
      if (
        job.options.watermark?.enabled &&
        job.options.watermark.preset?.logoUrl
      ) {
        try {
          logoBitmap = await this.loadLogoBitmap(
            job.options.watermark.preset.logoUrl
          );
        } catch (logoErr) {
          console.warn("Failed to load watermark logo:", logoErr);
        }
      }

      job.progress = 50;
      this.notify();

      // Execute pipeline
      const result = await processImageSource(
        imageBitmap,
        imageBitmap.width,
        imageBitmap.height,
        job.options,
        logoBitmap,
        logoBitmap ? logoBitmap.width : undefined,
        logoBitmap ? logoBitmap.height : undefined
      );

      // Clean up bitmaps
      if ("close" in imageBitmap) imageBitmap.close();
      if (logoBitmap && "close" in logoBitmap) logoBitmap.close();

      const resultBlobUrl = URL.createObjectURL(result.blob);

      job.result = result;
      job.resultBlobUrl = resultBlobUrl;
      if (result.thumbnailDataUrl) {
        job.thumbnailUrl = result.thumbnailDataUrl;
      }
      job.state = "done";
      job.progress = 100;
      job.finishedAt = Date.now();
      job.errorMessage = undefined;
    } catch (err: unknown) {
      job.state = "error";
      job.progress = 0;
      job.errorMessage =
        err instanceof Error ? err.message : "Image processing failed";
      console.error("Job failed:", job.id, err);
    } finally {
      this.notify();
    }
  }

  private async loadImageBitmap(file: File): Promise<ImageBitmap> {
    if (typeof createImageBitmap !== "undefined") {
      return await createImageBitmap(file, { imageOrientation: "from-image" });
    }

    // Fallback for environments without createImageBitmap (e.g. Node/happy-dom)
    return new Promise((resolve, reject) => {
      if (typeof Image === "undefined") {
        return reject(new Error("Image element not available in environment"));
      }
      const img = new Image();
      const url = URL.createObjectURL(file);
      img.onload = () => {
        URL.revokeObjectURL(url);
        resolve(img as unknown as ImageBitmap);
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error("Failed to decode image file"));
      };
      img.src = url;
    });
  }

  private async loadLogoBitmap(logoUrl: string): Promise<ImageBitmap> {
    if (typeof Image !== "undefined") {
      return new Promise((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = "anonymous";
        img.onload = async () => {
          if (typeof createImageBitmap !== "undefined") {
            try {
              const bmp = await createImageBitmap(img);
              return resolve(bmp);
            } catch {
              // fallback to Image instance
            }
          }
          resolve(img as unknown as ImageBitmap);
        };
        img.onerror = () => {
          fetch(logoUrl)
            .then((res) => res.blob())
            .then(async (blob) => {
              if (typeof createImageBitmap !== "undefined") {
                const bmp = await createImageBitmap(blob);
                resolve(bmp);
              } else {
                reject(new Error("Failed to load watermark logo"));
              }
            })
            .catch((err) => reject(err));
        };
        img.src = logoUrl;
      });
    }

    const res = await fetch(logoUrl);
    if (!res.ok) {
      throw new Error(`Failed to fetch logo: HTTP ${res.status}`);
    }
    const blob = await res.blob();
    if (typeof createImageBitmap !== "undefined") {
      return await createImageBitmap(blob);
    }
    throw new Error("Logo decode not supported in this environment");
  }

  public removeJob(id: string): void {
    const job = this.jobs.get(id);
    if (!job) return;

    if (job.objectUrl) {
      URL.revokeObjectURL(job.objectUrl);
    }
    if (job.resultBlobUrl) {
      URL.revokeObjectURL(job.resultBlobUrl);
    }

    this.jobs.delete(id);
    this.notify();
  }

  public clearAll(): void {
    for (const job of this.jobs.values()) {
      if (job.objectUrl) {
        URL.revokeObjectURL(job.objectUrl);
      }
      if (job.resultBlobUrl) {
        URL.revokeObjectURL(job.resultBlobUrl);
      }
    }
    this.jobs.clear();
    this.notify();
  }

  public destroy(): void {
    this.isDestroyed = true;
    this.clearAll();
    this.subscribers.clear();
  }
}

// Singleton helper for UI convenience
let globalQueueManager: ProcessingQueueManager | null = null;

export function getQueueManager(): ProcessingQueueManager {
  if (!globalQueueManager) {
    globalQueueManager = new ProcessingQueueManager();
  }
  return globalQueueManager;
}
