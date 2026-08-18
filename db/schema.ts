import { sqliteTable, text } from "drizzle-orm/sqlite-core";
import { relations, sql } from "drizzle-orm";

export interface PresetSettings {
  position:
    | "top-left"
    | "top-center"
    | "top-right"
    | "center-left"
    | "center"
    | "center-right"
    | "bottom-left"
    | "bottom-center"
    | "bottom-right";
  opacityPct: number; // 0 - 100
  scalePct: number; // 1 - 100
  rotationDeg: number; // -180 to 180
  offsetX?: number; // percentage offset from margin
  offsetY?: number;
}

export interface OperationsApplied {
  metadataStripped: boolean;
  watermarked: boolean;
  resized: boolean;
  colorAdjusted: boolean;
  presetName?: string;
  outputFormat?: "image/jpeg" | "image/png" | "image/webp";
  dimensions?: { width: number; height: number };
  qualityPct?: number;
}

// 1. Preset Table
export const presets = sqliteTable("presets", {
  id: text("id").primaryKey(),
  name: text("name").notNull().unique(),
  logoUrl: text("logo_url").notNull(),
  settings: text("settings", { mode: "json" }).$type<PresetSettings>().notNull(),
  createdAt: text("created_at")
    .notNull()
    .default(sql`(CURRENT_TIMESTAMP)`),
  updatedAt: text("updated_at")
    .notNull()
    .default(sql`(CURRENT_TIMESTAMP)`),
});

// 2. Batch Table
export const batches = sqliteTable("batches", {
  id: text("id").primaryKey(),
  label: text("label"),
  presetId: text("preset_id").references(() => presets.id, {
    onDelete: "set null",
  }),
  createdAt: text("created_at")
    .notNull()
    .default(sql`(CURRENT_TIMESTAMP)`),
  deletedAt: text("deleted_at"),
});

// 3. HistoryItem Table
export const historyItems = sqliteTable("history_items", {
  id: text("id").primaryKey(),
  batchId: text("batch_id")
    .notNull()
    .references(() => batches.id, {
      onDelete: "cascade",
    }),
  originalFilename: text("original_filename").notNull(),
  cloudinaryUrl: text("cloudinary_url").notNull(),
  operationsApplied: text("operations_applied", { mode: "json" })
    .$type<OperationsApplied>()
    .notNull(),
  createdAt: text("created_at")
    .notNull()
    .default(sql`(CURRENT_TIMESTAMP)`),
  deletedAt: text("deleted_at"),
});

// Relations
export const presetsRelations = relations(presets, ({ many }) => ({
  batches: many(batches),
}));

export const batchesRelations = relations(batches, ({ one, many }) => ({
  preset: one(presets, {
    fields: [batches.presetId],
    references: [presets.id],
  }),
  items: many(historyItems),
}));

export const historyItemsRelations = relations(historyItems, ({ one }) => ({
  batch: one(batches, {
    fields: [historyItems.batchId],
    references: [batches.id],
  }),
}));

export type Preset = typeof presets.$inferSelect;
export type InsertPreset = typeof presets.$inferInsert;

export type Batch = typeof batches.$inferSelect;
export type InsertBatch = typeof batches.$inferInsert;

export type HistoryItem = typeof historyItems.$inferSelect;
export type InsertHistoryItem = typeof historyItems.$inferInsert;
