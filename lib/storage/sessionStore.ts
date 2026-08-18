import { ProcessingPipelineOptions } from "../processing/types";

const DB_NAME = "forma_session_db";
const DB_VERSION = 1;
const STORE_NAME = "active_jobs";
const META_STORE = "session_meta";

interface StoredJobRecord {
  id: string;
  file: Blob;
  filename: string;
  fileType: string;
  options: ProcessingPipelineOptions;
  order: number;
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === "undefined" || !window.indexedDB) {
      return reject(new Error("IndexedDB is not supported"));
    }
    const request = window.indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (e) => {
      const db = (e.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains(META_STORE)) {
        db.createObjectStore(META_STORE, { keyPath: "key" });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Persists the active session (all raw files and options) to IndexedDB
 */
export async function persistActiveSession(
  jobs: Array<{ id: string; file: File; options: ProcessingPipelineOptions }>,
  options: ProcessingPipelineOptions,
  activeJobId?: string | null
): Promise<void> {
  try {
    const db = await openDB();
    const tx = db.transaction([STORE_NAME, META_STORE], "readwrite");
    const jobStore = tx.objectStore(STORE_NAME);
    const metaStore = tx.objectStore(META_STORE);

    // Clear previous jobs in active store
    jobStore.clear();

    // Save all jobs with raw Blobs
    jobs.forEach((job, index) => {
      const record: StoredJobRecord = {
        id: job.id,
        file: job.file,
        filename: job.file.name,
        fileType: job.file.type,
        options: job.options,
        order: index,
      };
      jobStore.put(record);
    });

    // Save session metadata
    metaStore.put({
      key: "current_session",
      options,
      activeJobId,
      updatedAt: Date.now(),
    });

    return new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (err) {
    console.warn("Could not persist session to IndexedDB:", err);
  }
}

/**
 * Loads the active session from IndexedDB on page reload
 */
export async function loadActiveSession(): Promise<{
  files: Array<{ file: File; id: string; options: ProcessingPipelineOptions }>;
  options: ProcessingPipelineOptions | null;
  activeJobId: string | null;
} | null> {
  try {
    const db = await openDB();
    const tx = db.transaction([STORE_NAME, META_STORE], "readonly");
    const jobStore = tx.objectStore(STORE_NAME);
    const metaStore = tx.objectStore(META_STORE);

    const getAllReq = jobStore.getAll();
    const getMetaReq = metaStore.get("current_session");

    return new Promise((resolve) => {
      tx.oncomplete = () => {
        const records: StoredJobRecord[] = getAllReq.result || [];
        const meta = getMetaReq.result;

        if (records.length === 0) {
          return resolve(null);
        }

        // Sort by initial order
        records.sort((a, b) => a.order - b.order);

        const files = records.map((rec) => {
          const fileObj = new File([rec.file], rec.filename, {
            type: rec.fileType || "image/jpeg",
          });
          return {
            id: rec.id,
            file: fileObj,
            options: rec.options,
          };
        });

        resolve({
          files,
          options: meta ? meta.options : null,
          activeJobId: meta ? meta.activeJobId : null,
        });
      };

      tx.onerror = () => resolve(null);
    });
  } catch (err) {
    console.warn("Could not load session from IndexedDB:", err);
    return null;
  }
}

/**
 * Clears the active session from IndexedDB
 */
export async function clearActiveSession(): Promise<void> {
  try {
    const db = await openDB();
    const tx = db.transaction([STORE_NAME, META_STORE], "readwrite");
    tx.objectStore(STORE_NAME).clear();
    tx.objectStore(META_STORE).clear();
  } catch (err) {
    console.warn("Could not clear session in IndexedDB:", err);
  }
}
