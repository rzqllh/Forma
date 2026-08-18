import { describe, it, expect, vi, beforeEach } from "vitest";
import { ProcessingQueueManager, QueueJob } from "@/lib/queue/manager";
import { ProcessingPipelineOptions } from "@/lib/processing/types";
import * as sessionStore from "@/lib/storage/sessionStore";
import * as pipelineModule from "@/lib/processing/pipeline";

describe("Queue Management, Terminal State & Error Handling (F-028 Remediation)", () => {
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

    // Mock image processing pipeline default success
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

  // Helper to wait until all jobs in the queue reach a terminal state (done or error)
  function waitForQueueTerminal(
    queue: ProcessingQueueManager,
    timeoutMs = 2000
  ): Promise<QueueJob[]> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        unsubscribe();
        reject(
          new Error(
            `Queue did not reach terminal state within ${timeoutMs}ms. Current states: ${JSON.stringify(
              queue.getJobs().map((j) => ({ id: j.id, state: j.state }))
            )}`
          )
        );
      }, timeoutMs);

      const checkTerminal = (jobs: QueueJob[]) => {
        if (jobs.length === 0) return;
        const allTerminal = jobs.every(
          (j) => j.state === "done" || j.state === "error"
        );
        if (allTerminal) {
          clearTimeout(timer);
          unsubscribe();
          resolve(jobs);
        }
      };

      const unsubscribe = queue.subscribe((jobs) => {
        checkTerminal(jobs);
      });

      // Initial check in case it completed synchronously
      checkTerminal(queue.getJobs());
    });
  }

  it("initializes with tuned concurrency", () => {
    const queue = new ProcessingQueueManager(3);
    expect(queue.getConcurrency()).toBe(3);
  });

  it("enqueues files, processes them asynchronously, and achieves terminal state 'done'", async () => {
    const queue = new ProcessingQueueManager(2);
    const mockFile1 = new File(["dummy content 1"], "photo1.jpg", {
      type: "image/jpeg",
    });
    const mockFile2 = new File(["dummy content 2"], "photo2.jpg", {
      type: "image/jpeg",
    });

    const ids = queue.addFiles([mockFile1, mockFile2], defaultOptions);
    expect(ids).toHaveLength(2);

    // Await all jobs reaching terminal state
    const terminalJobs = await waitForQueueTerminal(queue);
    expect(terminalJobs).toHaveLength(2);
    expect(terminalJobs[0].state).toBe("done");
    expect(terminalJobs[0].progress).toBe(100);
    expect(terminalJobs[0].resultBlobUrl).toBeDefined();
    expect(terminalJobs[0].result).toBeDefined();
    expect(terminalJobs[1].state).toBe("done");
    expect(terminalJobs[1].progress).toBe(100);

    const summary = queue.getSummary();
    expect(summary.total).toBe(2);
    expect(summary.done).toBe(2);
    expect(summary.error).toBe(0);
  });

  it("captures errors cleanly when image processing fails and transitions job to 'error' state", async () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(pipelineModule, "processImageSource").mockRejectedValueOnce(
      new Error("Canvas corrupt decoding error")
    );

    const queue = new ProcessingQueueManager(1);
    const mockFile = new File(["corrupt bytes"], "bad_photo.jpg", {
      type: "image/jpeg",
    });

    queue.addFiles([mockFile], defaultOptions);

    const terminalJobs = await waitForQueueTerminal(queue);
    expect(terminalJobs).toHaveLength(1);
    const failedJob = terminalJobs[0];

    expect(failedJob.state).toBe("error");
    expect(failedJob.errorMessage).toBe("Canvas corrupt decoding error");
    expect(failedJob.progress).toBe(0);

    const summary = queue.getSummary();
    expect(summary.error).toBe(1);
    expect(summary.done).toBe(0);
    expect(consoleSpy).toHaveBeenCalled();
    consoleSpy.mockRestore();
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
    expect(notifiedJobCount).toBeGreaterThanOrEqual(1);

    unsubscribe();
  });

  it("revokes object URLs and cleans up when removing jobs", async () => {
    const queue = new ProcessingQueueManager(2);
    const mockFile = new File(["dummy"], "photo.jpg", { type: "image/jpeg" });
    const [id] = queue.addFiles([mockFile], defaultOptions);

    await waitForQueueTerminal(queue);

    queue.removeJob(id);
    expect(global.URL.revokeObjectURL).toHaveBeenCalled();
    expect(queue.getJobs()).toHaveLength(0);
  });

  it("cleans up all memory on clearAll()", async () => {
    const queue = new ProcessingQueueManager(2);
    const mockFile1 = new File(["dummy1"], "photo1.jpg", { type: "image/jpeg" });
    const mockFile2 = new File(["dummy2"], "photo2.jpg", { type: "image/jpeg" });
    queue.addFiles([mockFile1, mockFile2], defaultOptions);

    await waitForQueueTerminal(queue);

    queue.clearAll();
    expect(global.URL.revokeObjectURL).toHaveBeenCalled();
    expect(queue.getJobs()).toHaveLength(0);
    expect(queue.getSummary().total).toBe(0);
  });
});
