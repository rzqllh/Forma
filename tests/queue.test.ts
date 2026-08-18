import { describe, it, expect, vi, beforeEach } from "vitest";
import { ProcessingQueueManager } from "@/lib/queue/manager";
import { ProcessingPipelineOptions } from "@/lib/processing/types";
import * as sessionStore from "@/lib/storage/sessionStore";
import * as pipelineModule from "@/lib/processing/pipeline";

describe("Queue Management & Concurrency", () => {
  const defaultOptions: ProcessingPipelineOptions = {
    stripMetadata: true,
    resize: {
      presetId: "original",
      format: "image/jpeg",
      quality: 0.85,
    },
    colorAdjustment: {
      enabled: false,
      intensityPct: 70,
    },
  };

  beforeEach(() => {
    // Mock URL.createObjectURL and URL.revokeObjectURL
    global.URL.createObjectURL = vi.fn(() => "blob:mock-url-" + Math.random());
    global.URL.revokeObjectURL = vi.fn();

    // Mock sessionStore to prevent unsupported IndexedDB warnings in happy-dom
    vi.spyOn(sessionStore, "persistActiveSession").mockResolvedValue();
    vi.spyOn(sessionStore, "clearActiveSession").mockResolvedValue();

    // Mock createImageBitmap to return a valid mock bitmap
    globalThis.createImageBitmap = vi.fn().mockResolvedValue({
      width: 800,
      height: 600,
      close: vi.fn(),
    } as unknown as ImageBitmap);

    // Mock image processing pipeline
    vi.spyOn(pipelineModule, "processImageSource").mockResolvedValue({
      blob: new Blob(["processed-image-bytes"], { type: "image/jpeg" }),
      thumbnailDataUrl: "data:image/jpeg;base64,mockthumb",
      width: 800,
      height: 600,
      format: "image/jpeg",
      byteSize: 1024,
      operationsApplied: {
        metadataStripped: true,
        watermarked: false,
        resized: false,
        colorAdjusted: false,
      },
    });
  });

  it("initializes with tuned concurrency", () => {
    const queue = new ProcessingQueueManager(3);
    expect(queue.getConcurrency()).toBe(3);
  });

  it("enqueues files and sets state to 'queued'", () => {
    const queue = new ProcessingQueueManager(2);
    const mockFile1 = new File(["dummy content 1"], "photo1.jpg", {
      type: "image/jpeg",
    });
    const mockFile2 = new File(["dummy content 2"], "photo2.jpg", {
      type: "image/jpeg",
    });

    const ids = queue.addFiles([mockFile1, mockFile2], defaultOptions);
    expect(ids).toHaveLength(2);

    const jobs = queue.getJobs();
    expect(jobs).toHaveLength(2);
    expect(jobs[0].originalFilename).toBe("photo1.jpg");
    expect(jobs[1].originalFilename).toBe("photo2.jpg");

    const summary = queue.getSummary();
    expect(summary.total).toBe(2);
    expect(summary.done).toBe(0);
  });

  it("updates job options and notifies subscribers", () => {
    const queue = new ProcessingQueueManager(2);
    const mockFile = new File(["dummy"], "photo.jpg", { type: "image/jpeg" });
    const [id] = queue.addFiles([mockFile], defaultOptions);

    let notifiedJobCount = 0;
    const unsubscribe = queue.subscribe((jobs) => {
      notifiedJobCount = jobs.length;
    });

    queue.updateJobOptions(id, {
      resize: {
        presetId: "instagram-portrait",
        format: "image/jpeg",
        quality: 0.9,
      },
    });

    const updatedJob = queue.getJob(id);
    expect(updatedJob?.options.resize.presetId).toBe("instagram-portrait");
    expect(notifiedJobCount).toBe(1);

    unsubscribe();
  });

  it("revokes object URLs when removing jobs", () => {
    const queue = new ProcessingQueueManager(2);
    const mockFile = new File(["dummy"], "photo.jpg", { type: "image/jpeg" });
    const [id] = queue.addFiles([mockFile], defaultOptions);

    queue.removeJob(id);
    expect(global.URL.revokeObjectURL).toHaveBeenCalled();
    expect(queue.getJobs()).toHaveLength(0);
  });

  it("cleans up all memory on clearAll()", () => {
    const queue = new ProcessingQueueManager(2);
    const mockFile1 = new File(["dummy1"], "photo1.jpg", { type: "image/jpeg" });
    const mockFile2 = new File(["dummy2"], "photo2.jpg", { type: "image/jpeg" });
    queue.addFiles([mockFile1, mockFile2], defaultOptions);

    queue.clearAll();
    expect(global.URL.revokeObjectURL).toHaveBeenCalled();
    expect(queue.getJobs()).toHaveLength(0);
    expect(queue.getSummary().total).toBe(0);
  });
});
