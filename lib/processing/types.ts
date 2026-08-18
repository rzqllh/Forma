import { PresetSettings } from "@/db/schema";

export type OutputFormat = "image/jpeg" | "image/png" | "image/webp";

export type ResizePresetId =
  | "original"
  | "instagram-portrait"
  | "instagram-square"
  | "instagram-story"
  | "web-portfolio"
  | "client-delivery-hd"
  | "custom";

export interface ResizePresetConfig {
  id: ResizePresetId;
  label: string;
  description: string;
  width?: number;
  height?: number;
  maxDimension?: number;
  aspectRatio?: number;
  fitMode: "contain" | "cover";
}

export interface ResizeOptions {
  presetId: ResizePresetId;
  customWidth?: number;
  customHeight?: number;
  fitMode?: "contain" | "cover";
  format: OutputFormat;
  quality: number; // 0.1 to 1.0 (e.g. 0.85)
}

export interface ColorAdjustmentOptions {
  enabled: boolean;
  intensityPct: number; // 0 to 100 (e.g. 70)
}

export interface WatermarkOptions {
  enabled: boolean;
  preset?: {
    id: string;
    name: string;
    logoUrl: string;
    settings: PresetSettings;
  };
  customLogoImage?: CanvasImageSource | ImageData | ImageBitmap;
}

export interface ProcessingPipelineOptions {
  stripMetadata: boolean;
  watermark?: WatermarkOptions;
  resize: ResizeOptions;
  colorAdjustment?: ColorAdjustmentOptions;
}

export interface ProcessedResult {
  blob: Blob;
  width: number;
  height: number;
  byteSize: number;
  format: OutputFormat;
  thumbnailDataUrl: string;
  operationsApplied: {
    metadataStripped: boolean;
    watermarked: boolean;
    resized: boolean;
    colorAdjusted: boolean;
    presetName?: string;
  };
}
