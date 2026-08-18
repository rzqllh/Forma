import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import {
  getLocalBatches,
  getAllRawLocalBatches,
  saveLocalBatches,
  saveBatchHistory,
  softDeleteBatch,
  restoreBatch,
} from "@/lib/api/client";
import { Batch, HistoryItem } from "@/db/schema";

describe("Local History Storage: Soft-Delete and Restore Data Loss Fix (F-004)", () => {
  beforeEach(() => {
    localStorage.clear();
    // Default fetch mock simulates offline worker so calls safely fall back locally without ECONNREFUSED
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new Error("Worker offline for test simulation"))
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("preserves active batches when soft-deleting a single batch", async () => {
    // 1. Seed two active batches
    const batch1: Batch & { items: HistoryItem[] } = {
      id: "batch-active-1",
      label: "Batch Active 1",
      presetId: null,
      createdAt: new Date().toISOString(),
      deletedAt: null,
      items: [
        {
          id: "item-1",
          batchId: "batch-active-1",
          originalFilename: "living_room.jpg",
          cloudinaryUrl: "https://res.cloudinary.com/test/image/upload/v1/living_room.jpg",
          operationsApplied: {
            metadataStripped: true,
            watermarked: false,
            resized: true,
            colorAdjusted: false,
          },
          createdAt: new Date().toISOString(),
          deletedAt: null,
        },
      ],
    };

    const batch2: Batch & { items: HistoryItem[] } = {
      id: "batch-active-2",
      label: "Batch Active 2",
      presetId: null,
      createdAt: new Date().toISOString(),
      deletedAt: null,
      items: [
        {
          id: "item-2",
          batchId: "batch-active-2",
          originalFilename: "bedroom.jpg",
          cloudinaryUrl: "https://res.cloudinary.com/test/image/upload/v1/bedroom.jpg",
          operationsApplied: {
            metadataStripped: true,
            watermarked: false,
            resized: true,
            colorAdjusted: false,
          },
          createdAt: new Date().toISOString(),
          deletedAt: null,
        },
      ],
    };

    saveLocalBatches([batch1, batch2]);

    // Verify both are returned as active
    expect(getLocalBatches(false)).toHaveLength(2);
    expect(getLocalBatches(true)).toHaveLength(0);

    // 2. Soft-delete batch 1
    await softDeleteBatch("batch-active-1");

    // 3. Verify that batch 2 is STILL active and NOT discarded!
    const activeBatches = getLocalBatches(false);
    expect(activeBatches).toHaveLength(1);
    expect(activeBatches[0].id).toBe("batch-active-2");

    // Verify batch 1 is in trash
    const deletedBatches = getLocalBatches(true);
    expect(deletedBatches).toHaveLength(1);
    expect(deletedBatches[0].id).toBe("batch-active-1");
    expect(deletedBatches[0].deletedAt).not.toBeNull();
    expect(deletedBatches[0].items[0].deletedAt).not.toBeNull();

    // Verify total raw batches count in storage is 2
    expect(getAllRawLocalBatches()).toHaveLength(2);
  });

  it("preserves active and other deleted batches when restoring a batch", async () => {
    const now = new Date().toISOString();
    const batchActive: Batch & { items: HistoryItem[] } = {
      id: "batch-active",
      label: "Active Batch",
      presetId: null,
      createdAt: now,
      deletedAt: null,
      items: [],
    };

    const batchDeleted1: Batch & { items: HistoryItem[] } = {
      id: "batch-del-1",
      label: "Deleted Batch 1",
      presetId: null,
      createdAt: now,
      deletedAt: now,
      items: [],
    };

    const batchDeleted2: Batch & { items: HistoryItem[] } = {
      id: "batch-del-2",
      label: "Deleted Batch 2",
      presetId: null,
      createdAt: now,
      deletedAt: now,
      items: [],
    };

    saveLocalBatches([batchActive, batchDeleted1, batchDeleted2]);

    // Initial state check
    expect(getLocalBatches(false)).toHaveLength(1);
    expect(getLocalBatches(true)).toHaveLength(2);

    // Restore batchDeleted1
    await restoreBatch("batch-del-1");

    // After restore: Active should have 2 batches, Trash should have 1 batch
    const active = getLocalBatches(false);
    expect(active).toHaveLength(2);
    expect(active.map((b) => b.id).sort()).toEqual(["batch-active", "batch-del-1"].sort());

    const deleted = getLocalBatches(true);
    expect(deleted).toHaveLength(1);
    expect(deleted[0].id).toBe("batch-del-2");

    // Total batches preserved in raw storage
    expect(getAllRawLocalBatches()).toHaveLength(3);
  });

  it("does not wipe out deleted batches when saving a new batch", async () => {
    const now = new Date().toISOString();
    const batchDeleted: Batch & { items: HistoryItem[] } = {
      id: "batch-del-1",
      label: "Deleted Batch 1",
      presetId: null,
      createdAt: now,
      deletedAt: now,
      items: [],
    };

    saveLocalBatches([batchDeleted]);
    expect(getLocalBatches(true)).toHaveLength(1);

    // Save a new batch (fallback path)
    const result = await saveBatchHistory("New Active Batch", null, [
      {
        originalFilename: "kitchen.jpg",
        cloudinaryUrl: "https://res.cloudinary.com/test/image/upload/v1/kitchen.jpg",
        operationsApplied: {
          metadataStripped: true,
          watermarked: false,
          resized: false,
          colorAdjusted: false,
        },
      },
    ]);

    expect(result.status).toBe("local-only");
    // Check that both the new active batch AND the old deleted batch exist
    expect(getLocalBatches(false)).toHaveLength(1);
    expect(getLocalBatches(true)).toHaveLength(1);
    expect(getAllRawLocalBatches()).toHaveLength(2);
  });

  it("returns status 'remote-saved' when server API call succeeds", async () => {
    const mockBatchRecord = {
      id: "batch-server-1",
      label: "Server Batch",
      presetId: null,
      createdAt: new Date().toISOString(),
      deletedAt: null,
    };
    const mockItemRecords = [
      {
        id: "item-server-1",
        batchId: "batch-server-1",
        originalFilename: "living.jpg",
        cloudinaryUrl: "https://res.cloudinary.com/test/image/upload/v1/living.jpg",
        operationsApplied: {
          metadataStripped: true,
          watermarked: false,
          resized: false,
          colorAdjusted: false,
        },
        createdAt: new Date().toISOString(),
        deletedAt: null,
      },
    ];

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ batch: mockBatchRecord, items: mockItemRecords }),
      })
    );

    const result = await saveBatchHistory("Server Batch", null, [
      {
        originalFilename: "living.jpg",
        cloudinaryUrl: "https://res.cloudinary.com/test/image/upload/v1/living.jpg",
        operationsApplied: {
          metadataStripped: true,
          watermarked: false,
          resized: false,
          colorAdjusted: false,
        },
      },
    ]);

    expect(result.status).toBe("remote-saved");
    expect(result.batch.id).toBe("batch-server-1");
    expect(getLocalBatches(false)).toHaveLength(1);
  });
});
