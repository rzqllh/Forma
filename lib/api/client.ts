import { Preset, Batch, HistoryItem, PresetSettings, OperationsApplied } from "@/db/schema";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8787";
const SHARED_SECRET =
  process.env.NEXT_PUBLIC_APP_SHARED_SECRET ||
  "development-shared-secret-change-in-prod";

// Local storage fallback keys when backend worker is not running locally
const LOCAL_PRESETS_KEY = "forma_local_presets";
const LOCAL_BATCHES_KEY = "forma_local_batches";

export function getLocalPresets(): Preset[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(LOCAL_PRESETS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveLocalPresets(presets: Preset[]): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(LOCAL_PRESETS_KEY, JSON.stringify(presets));
}

const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;

export function getLocalBatches(includeDeleted = false): (Batch & { items: HistoryItem[] })[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(LOCAL_BATCHES_KEY);
    const list: (Batch & { items: HistoryItem[] })[] = raw ? JSON.parse(raw) : [];
    const now = Date.now();

    // Auto-prune deleted batches older than 24 hours
    const unexpiredList = list.filter((b) => {
      if (b.deletedAt === null) return true;
      const deletedTimestamp = new Date(b.deletedAt).getTime();
      return !isNaN(deletedTimestamp) && now - deletedTimestamp < TWENTY_FOUR_HOURS_MS;
    });

    if (unexpiredList.length !== list.length) {
      saveLocalBatches(unexpiredList);
    }

    if (includeDeleted) {
      return unexpiredList.filter((b) => b.deletedAt !== null);
    }
    return unexpiredList.filter((b) => b.deletedAt === null);
  } catch {
    return [];
  }
}

export function saveLocalBatches(batches: (Batch & { items: HistoryItem[] })[]): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(LOCAL_BATCHES_KEY, JSON.stringify(batches));
}

async function apiFetch<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const headers = new Headers(options.headers || {});
  headers.set("X-App-Secret", SHARED_SECRET);
  if (!headers.has("Content-Type") && options.body && typeof options.body === "string") {
    headers.set("Content-Type", "application/json");
  }

  // Fast 1.5s timeout controller to avoid freezing UI when worker is offline
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 1500);

  try {
    const res = await fetch(`${API_BASE_URL}${path}`, {
      ...options,
      headers,
      signal: options.signal || controller.signal,
    });

    clearTimeout(timeoutId);

    if (!res.ok) {
      const errBody = (await res.json().catch(() => ({ error: `HTTP ${res.status}` }))) as { error?: string };
      throw new Error(errBody.error || `Request failed with status ${res.status}`);
    }

    return (await res.json()) as T;
  } catch (err) {
    clearTimeout(timeoutId);
    throw err;
  }
}

// Preset API functions with offline/local fallback
export async function fetchPresets(): Promise<Preset[]> {
  try {
    const data = await apiFetch<{ presets: Preset[] }>("/api/presets");
    saveLocalPresets(data.presets);
    return data.presets;
  } catch (err) {
    return getLocalPresets();
  }
}

export async function createPreset(
  name: string,
  logoUrl: string,
  settings: PresetSettings
): Promise<Preset> {
  try {
    const data = await apiFetch<{ preset: Preset }>("/api/presets", {
      method: "POST",
      body: JSON.stringify({ name, logoUrl, settings }),
    });
    const local = getLocalPresets().filter((p) => p.id !== data.preset.id);
    local.push(data.preset);
    saveLocalPresets(local);
    return data.preset;
  } catch (err) {
    const newPreset: Preset = {
      id: typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `preset_${Date.now()}`,
      name,
      logoUrl,
      settings,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    const local = getLocalPresets().filter((p) => p.name !== name);
    local.push(newPreset);
    saveLocalPresets(local);
    return newPreset;
  }
}

export async function updatePreset(
  id: string,
  data: Partial<{ name: string; logoUrl: string; settings: PresetSettings }>
): Promise<Preset> {
  try {
    const res = await apiFetch<{ preset: Preset }>(`/api/presets/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    });
    const local = getLocalPresets().map((p) => (p.id === id ? res.preset : p));
    saveLocalPresets(local);
    return res.preset;
  } catch (err) {
    const local = getLocalPresets();
    const existing = local.find((p) => p.id === id);
    if (!existing) throw new Error("Preset not found");
    const updated: Preset = {
      ...existing,
      ...data,
      updatedAt: new Date().toISOString(),
    };
    saveLocalPresets(local.map((p) => (p.id === id ? updated : p)));
    return updated;
  }
}

export async function deletePreset(id: string): Promise<void> {
  try {
    await apiFetch(`/api/presets/${id}`, { method: "DELETE" });
  } catch (err) {
    // ignore
  }
  const local = getLocalPresets().filter((p) => p.id !== id);
  saveLocalPresets(local);
}

// History API functions with local fallback
export async function fetchBatchHistory(
  includeDeleted = false
): Promise<(Batch & { items: HistoryItem[] })[]> {
  try {
    const data = await apiFetch<{
      batches: (Batch & { items: HistoryItem[] })[];
    }>(`/api/history?includeDeleted=${includeDeleted}`);
    return data.batches;
  } catch (err) {
    return getLocalBatches(includeDeleted);
  }
}

export async function saveBatchHistory(
  label: string,
  presetId: string | null,
  items: Array<{
    originalFilename: string;
    cloudinaryUrl: string;
    operationsApplied: OperationsApplied;
  }>
): Promise<Batch & { items: HistoryItem[] }> {
  try {
    const data = await apiFetch<{
      batch: Batch;
      items: HistoryItem[];
    }>("/api/history/batch", {
      method: "POST",
      body: JSON.stringify({ label, presetId, items }),
    });
    const full = { ...data.batch, items: data.items };
    const local = getLocalBatches(false);
    local.unshift(full);
    saveLocalBatches(local);
    return full;
  } catch (err) {
    const batchId = typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `batch_${Date.now()}`;
    const now = new Date().toISOString();
    const batch: Batch = {
      id: batchId,
      label,
      presetId,
      createdAt: now,
      deletedAt: null,
    };
    const historyItemsList: HistoryItem[] = items.map((it) => ({
      id: typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `item_${Date.now()}_${Math.random()}`,
      batchId,
      originalFilename: it.originalFilename,
      cloudinaryUrl: it.cloudinaryUrl,
      operationsApplied: it.operationsApplied,
      createdAt: now,
      deletedAt: null,
    }));
    const full = { ...batch, items: historyItemsList };
    const local = getLocalBatches(false);
    local.unshift(full);
    saveLocalBatches(local);
    return full;
  }
}

export async function softDeleteBatch(batchId: string): Promise<void> {
  try {
    await apiFetch(`/api/history/batch/${batchId}`, { method: "DELETE" });
  } catch (err) {
    // ignore
  }
  const now = new Date().toISOString();
  const local = getLocalBatches(true);
  const updated = local.map((b) => {
    if (b.id === batchId) {
      return {
        ...b,
        deletedAt: now,
        items: b.items.map((i) => ({ ...i, deletedAt: now })),
      };
    }
    return b;
  });
  saveLocalBatches(updated);
}

export async function restoreBatch(batchId: string): Promise<void> {
  try {
    await apiFetch(`/api/history/batch/${batchId}/restore`, { method: "POST" });
  } catch (err) {
    // ignore
  }
  const local = getLocalBatches(true);
  const updated = local.map((b) => {
    if (b.id === batchId) {
      return {
        ...b,
        deletedAt: null,
        items: b.items.map((i) => ({ ...i, deletedAt: null })),
      };
    }
    return b;
  });
  saveLocalBatches(updated);
}

// Signed Cloudinary upload helper
export async function getSignedUploadParams(
  folder = "forma_photos",
  publicId?: string
): Promise<{
  signature: string;
  timestamp: number;
  apiKey: string;
  cloudName: string;
  folder: string;
}> {
  return await apiFetch("/api/upload/sign", {
    method: "POST",
    body: JSON.stringify({ folder, publicId }),
  });
}
