import { z } from "zod";
import { drizzle } from "drizzle-orm/d1";
import { eq, isNull, isNotNull, lt, desc, asc, sql } from "drizzle-orm";
import {
  presets,
  batches,
  historyItems,
  PresetSettings,
  OperationsApplied,
} from "../../db/schema";

export interface Env {
  DB: D1Database;
  ASSETS?: Fetcher;
  APP_SHARED_SECRET?: string;
  CLOUDINARY_CLOUD_NAME?: string;
  CLOUDINARY_API_KEY?: string;
  CLOUDINARY_API_SECRET?: string;
}

// Zod Validation Schemas
const PresetSettingsSchema = z.object({
  position: z.enum([
    "top-left",
    "top-center",
    "top-right",
    "center-left",
    "center",
    "center-right",
    "bottom-left",
    "bottom-center",
    "bottom-right",
  ]),
  opacityPct: z.number().min(0).max(100),
  scalePct: z.number().min(1).max(100),
  rotationDeg: z.number().min(-180).max(180),
  offsetX: z.number().optional(),
  offsetY: z.number().optional(),
});

const CreatePresetSchema = z.object({
  name: z.string().min(1).max(100),
  logoUrl: z.string().url(),
  settings: PresetSettingsSchema,
});

const UpdatePresetSchema = CreatePresetSchema.partial();

const CreateHistoryItemSchema = z.object({
  id: z.string().optional(),
  originalFilename: z.string().min(1),
  cloudinaryUrl: z.string().url(),
  operationsApplied: z.object({
    metadataStripped: z.boolean(),
    watermarked: z.boolean(),
    resized: z.boolean(),
    colorAdjusted: z.boolean(),
    presetName: z.string().optional(),
    outputFormat: z.enum(["image/jpeg", "image/png", "image/webp"]).optional(),
    dimensions: z
      .object({ width: z.number(), height: z.number() })
      .optional(),
    qualityPct: z.number().optional(),
  }),
});

const CreateBatchSchema = z.object({
  id: z.string().optional(),
  label: z.string().optional(),
  presetId: z.string().optional().nullable(),
  items: z.array(CreateHistoryItemSchema),
});

const SignUploadSchema = z.object({
  folder: z.string().optional(),
  publicId: z.string().optional(),
});

// Helper for SHA-1 / SHA-256 Cloudinary signature generation
async function generateSha1(str: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(str);
  const hashBuffer = await crypto.subtle.digest("SHA-1", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

// CORS & Response Helpers
function corsHeaders(request: Request): HeadersInit {
  const origin = request.headers.get("Origin") || "*";
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, X-App-Secret, Authorization",
    "Access-Control-Max-Age": "86400",
  };
}

function jsonResponse(
  data: unknown,
  status = 200,
  request?: Request
): Response {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (request) {
    Object.assign(headers, corsHeaders(request));
  }
  return new Response(JSON.stringify(data), { status, headers });
}

function errorResponse(
  message: string,
  status = 400,
  request?: Request
): Response {
  return jsonResponse({ error: message }, status, request);
}

// Authentication verification
function verifyAuth(request: Request, env: Env): boolean {
  // If no secret configured in dev, allow
  if (!env.APP_SHARED_SECRET) return true;
  const provided = request.headers.get("X-App-Secret");
  return provided === env.APP_SHARED_SECRET;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;

    // Handle CORS preflight
    if (method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: corsHeaders(request),
      });
    }

    // Delegate non-API routes to Next.js static assets
    if (!path.startsWith("/api/")) {
      if (env.ASSETS) {
        return env.ASSETS.fetch(request);
      }
      return jsonResponse(
        {
          name: "FORMA Visual Finishing API",
          status: "ok",
          version: "1.0.0",
          timestamp: new Date().toISOString(),
        },
        200,
        request
      );
    }

    // Health check endpoint
    if (path === "/api/health") {
      return jsonResponse(
        {
          name: "FORMA Visual Finishing API",
          status: "ok",
          version: "1.0.0",
          timestamp: new Date().toISOString(),
        },
        200,
        request
      );
    }

    // Verify Shared Secret Gate
    if (!verifyAuth(request, env)) {
      return errorResponse("Unauthorized: Missing or invalid X-App-Secret header", 401, request);
    }

    const db = drizzle(env.DB);

    try {
      // -------------------------------------------------------------
      // 1. Presets Endpoints
      // -------------------------------------------------------------
      if (path === "/api/presets" && method === "GET") {
        const list = await db
          .select()
          .from(presets)
          .orderBy(asc(presets.name));
        return jsonResponse({ presets: list }, 200, request);
      }

      if (path === "/api/presets" && method === "POST") {
        const body = await request.json();
        const parsed = CreatePresetSchema.safeParse(body);
        if (!parsed.success) {
          return errorResponse(parsed.error.message, 400, request);
        }

        const id = crypto.randomUUID();
        const now = new Date().toISOString();
        const newPreset = {
          id,
          name: parsed.data.name,
          logoUrl: parsed.data.logoUrl,
          settings: parsed.data.settings as PresetSettings,
          createdAt: now,
          updatedAt: now,
        };

        await db.insert(presets).values(newPreset);
        return jsonResponse({ preset: newPreset }, 201, request);
      }

      const presetIdMatch = path.match(/^\/api\/presets\/([a-zA-Z0-9_-]+)$/);
      if (presetIdMatch) {
        const presetId = presetIdMatch[1];

        if (method === "GET") {
          const found = await db
            .select()
            .from(presets)
            .where(eq(presets.id, presetId))
            .get();
          if (!found) return errorResponse("Preset not found", 404, request);
          return jsonResponse({ preset: found }, 200, request);
        }

        if (method === "PUT") {
          const body = await request.json();
          const parsed = UpdatePresetSchema.safeParse(body);
          if (!parsed.success) {
            return errorResponse(parsed.error.message, 400, request);
          }

          const updateData: Record<string, unknown> = {
            updatedAt: new Date().toISOString(),
          };
          if (parsed.data.name) updateData.name = parsed.data.name;
          if (parsed.data.logoUrl) updateData.logoUrl = parsed.data.logoUrl;
          if (parsed.data.settings) updateData.settings = parsed.data.settings;

          await db
            .update(presets)
            .set(updateData)
            .where(eq(presets.id, presetId));

          const updated = await db
            .select()
            .from(presets)
            .where(eq(presets.id, presetId))
            .get();
          return jsonResponse({ preset: updated }, 200, request);
        }

        if (method === "DELETE") {
          await db.delete(presets).where(eq(presets.id, presetId));
          return jsonResponse({ success: true, id: presetId }, 200, request);
        }
      }

      // -------------------------------------------------------------
      // 2. History & Batch Endpoints
      // -------------------------------------------------------------
      if (path === "/api/history" && method === "GET") {
        const includeDeleted = url.searchParams.get("includeDeleted") === "true";

        if (includeDeleted) {
          // Fetch deleted batches (Trash view)
          const deletedBatches = await db
            .select()
            .from(batches)
            .where(isNotNull(batches.deletedAt))
            .orderBy(desc(batches.deletedAt));

          const batchIds = deletedBatches.map((b) => b.id);
          let itemsList: typeof historyItems.$inferSelect[] = [];
          if (batchIds.length > 0) {
            itemsList = await db.select().from(historyItems);
          }

          const result = deletedBatches.map((b) => ({
            ...b,
            items: itemsList.filter((item) => item.batchId === b.id),
          }));

          return jsonResponse({ batches: result }, 200, request);
        } else {
          // Fetch active batches
          const activeBatches = await db
            .select()
            .from(batches)
            .where(isNull(batches.deletedAt))
            .orderBy(desc(batches.createdAt));

          const activeItems = await db
            .select()
            .from(historyItems)
            .where(isNull(historyItems.deletedAt));

          const result = activeBatches.map((b) => ({
            ...b,
            items: activeItems.filter((item) => item.batchId === b.id),
          }));

          return jsonResponse({ batches: result }, 200, request);
        }
      }

      if (path === "/api/history/batch" && method === "POST") {
        const body = await request.json();
        const parsed = CreateBatchSchema.safeParse(body);
        if (!parsed.success) {
          return errorResponse(parsed.error.message, 400, request);
        }

        const batchId = parsed.data.id || crypto.randomUUID();
        const now = new Date().toISOString();

        const batchRecord = {
          id: batchId,
          label: parsed.data.label || null,
          presetId: parsed.data.presetId || null,
          createdAt: now,
          deletedAt: null,
        };

        await db.insert(batches).values(batchRecord);

        const itemRecords = parsed.data.items.map((item) => ({
          id: item.id || crypto.randomUUID(),
          batchId: batchId,
          originalFilename: item.originalFilename,
          cloudinaryUrl: item.cloudinaryUrl,
          operationsApplied: item.operationsApplied as OperationsApplied,
          createdAt: now,
          deletedAt: null,
        }));

        if (itemRecords.length > 0) {
          await db.insert(historyItems).values(itemRecords);
        }

        return jsonResponse(
          {
            batch: batchRecord,
            items: itemRecords,
          },
          201,
          request
        );
      }

      // Soft-Delete Batch: DELETE /api/history/batch/:id
      const batchDeleteMatch = path.match(
        /^\/api\/history\/batch\/([a-zA-Z0-9_-]+)$/
      );
      if (batchDeleteMatch && method === "DELETE") {
        const batchId = batchDeleteMatch[1];
        const now = new Date().toISOString();

        await db
          .update(batches)
          .set({ deletedAt: now })
          .where(eq(batches.id, batchId));

        await db
          .update(historyItems)
          .set({ deletedAt: now })
          .where(eq(historyItems.batchId, batchId));

        return jsonResponse({ success: true, id: batchId, deletedAt: now }, 200, request);
      }

      // Restore Batch: POST /api/history/batch/:id/restore
      const batchRestoreMatch = path.match(
        /^\/api\/history\/batch\/([a-zA-Z0-9_-]+)\/restore$/
      );
      if (batchRestoreMatch && method === "POST") {
        const batchId = batchRestoreMatch[1];

        await db
          .update(batches)
          .set({ deletedAt: null })
          .where(eq(batches.id, batchId));

        await db
          .update(historyItems)
          .set({ deletedAt: null })
          .where(eq(historyItems.batchId, batchId));

        return jsonResponse({ success: true, id: batchId }, 200, request);
      }

      // -------------------------------------------------------------
      // 3. Signed Cloudinary Upload Issuance
      // -------------------------------------------------------------
      if (path === "/api/upload/sign" && method === "POST") {
        const body = await request.json().catch(() => ({}));
        const parsed = SignUploadSchema.safeParse(body);
        if (!parsed.success) {
          return errorResponse(parsed.error.message, 400, request);
        }

        if (!env.CLOUDINARY_API_KEY || !env.CLOUDINARY_API_SECRET) {
          return errorResponse(
            "Cloudinary credentials are not configured on server",
            500,
            request
          );
        }

        const timestamp = Math.round(Date.now() / 1000);
        const folder = parsed.data?.folder || "forma_photos";

        // Generate Cloudinary signature string (sorted alphabetical params)
        let paramString = "";
        if (parsed.data?.publicId) {
          paramString += `folder=${folder}&public_id=${parsed.data.publicId}&timestamp=${timestamp}`;
        } else {
          paramString += `folder=${folder}&timestamp=${timestamp}`;
        }

        const toSign = `${paramString}${env.CLOUDINARY_API_SECRET}`;
        const signature = await generateSha1(toSign);

        return jsonResponse(
          {
            signature,
            timestamp,
            apiKey: env.CLOUDINARY_API_KEY,
            cloudName: env.CLOUDINARY_CLOUD_NAME || "mawmaw-interior",
            folder,
          },
          200,
          request
        );
      }

      return errorResponse("Route not found", 404, request);
    } catch (err: unknown) {
      console.error("Worker API Exception:", err);
      const msg = err instanceof Error ? err.message : "Internal Server Error";
      return errorResponse(msg, 500, request);
    }
  },

  // -------------------------------------------------------------
  // 4. Daily Scheduled Purge Cron Trigger Handler
  // -------------------------------------------------------------
  async scheduled(
    event: ScheduledEvent,
    env: Env,
    ctx: ExecutionContext
  ): Promise<void> {
    ctx.waitUntil(executeDailyPurge(env));
  },
};

/**
 * Hard-deletes batches and history items older than 24 hours from deleted_at
 */
export async function executeDailyPurge(
  env: Env,
  customNowDate?: Date
): Promise<{ purgedBatches: number; purgedItems: number; purgedAssets: number }> {
  const db = drizzle(env.DB);
  const now = customNowDate || new Date();
  const cutoffTime = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();

  // 1. Find all history items with deleted_at < cutoffTime
  const expiredItems = await db
    .select()
    .from(historyItems)
    .where(lt(historyItems.deletedAt, cutoffTime));

  // 2. Find all batches with deleted_at < cutoffTime
  const expiredBatches = await db
    .select()
    .from(batches)
    .where(lt(batches.deletedAt, cutoffTime));

  let purgedAssets = 0;

  // 3. Purge Cloudinary assets if configured
  if (
    env.CLOUDINARY_CLOUD_NAME &&
    env.CLOUDINARY_API_KEY &&
    env.CLOUDINARY_API_SECRET &&
    expiredItems.length > 0
  ) {
    for (const item of expiredItems) {
      try {
        // Extract publicId from cloudinary url
        const match = item.cloudinaryUrl.match(/\/upload\/(?:v\d+\/)?(.+?)(?:\.[a-zA-Z0-9]+)?$/);
        if (match && match[1]) {
          const publicId = match[1];
          const timestamp = Math.round(Date.now() / 1000);
          const toSign = `public_id=${publicId}&timestamp=${timestamp}${env.CLOUDINARY_API_SECRET}`;
          const signature = await generateSha1(toSign);

          const formData = new FormData();
          formData.append("public_id", publicId);
          formData.append("timestamp", timestamp.toString());
          formData.append("api_key", env.CLOUDINARY_API_KEY);
          formData.append("signature", signature);

          await fetch(
            `https://api.cloudinary.com/v1_1/${env.CLOUDINARY_CLOUD_NAME}/image/destroy`,
            {
              method: "POST",
              body: formData,
            }
          );
          purgedAssets++;
        }
      } catch (assetErr) {
        console.warn("Failed to delete Cloudinary asset for item:", item.id, assetErr);
      }
    }
  }

  // 4. Hard-delete history items and batches from D1
  if (expiredItems.length > 0) {
    await db.delete(historyItems).where(lt(historyItems.deletedAt, cutoffTime));
  }

  if (expiredBatches.length > 0) {
    await db.delete(batches).where(lt(batches.deletedAt, cutoffTime));
  }

  console.log(
    `[Purge Cron] Successfully purged ${expiredBatches.length} batches, ${expiredItems.length} history items, ${purgedAssets} Cloudinary assets.`
  );

  return {
    purgedBatches: expiredBatches.length,
    purgedItems: expiredItems.length,
    purgedAssets,
  };
}
