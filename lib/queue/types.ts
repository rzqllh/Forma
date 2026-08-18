import {
  ProcessedResult,
  ProcessingPipelineOptions,
} from "../processing/types";

export type JobState =
  | "queued"
  | "processing"
  | "done"
  | "error"
  | "cancelled";

export interface QueueJob {
  id: string;
  file: File;
  originalFilename: string;
  originalSize: number;
  originalDimensions?: { width: number; height: number };
  objectUrl: string;
  thumbnailUrl: string;
  state: JobState;
  progress: number; // 0 to 100
  errorMessage?: string;
  options: ProcessingPipelineOptions;
  result?: ProcessedResult;
  resultBlobUrl?: string;
  startedAt?: number;
  finishedAt?: number;
}

export interface QueueSummary {
  total: number;
  queued: number;
  processing: number;
  done: number;
  error: number;
  progressPct: number;
  isProcessing: boolean;
}

export type QueueSubscriber = (jobs: QueueJob[], summary: QueueSummary) => void;
