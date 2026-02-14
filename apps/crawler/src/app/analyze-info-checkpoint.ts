import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

export interface ImageAnalysisResult {
  is_booth_info: boolean;
  confidence: number;
  reason: string;
}

export interface PendingBatch {
  batch_name: string;
  created_at: string;
  /** Maps request key → image metadata for correlating batch results */
  request_keys: Record<string, { media_url: string; username: string }>;
}

export interface AnalyzeInfoCheckpoint {
  /** username → fetchedAt ISO string; skip user if unchanged */
  users_processed: Map<string, string>;
  /** Media URL → classification result (granular resume within a user) */
  classified_images: Map<string, ImageAnalysisResult>;
  /** Batches submitted but not yet completed */
  pending_batches: PendingBatch[];
}

interface CheckpointJson {
  users_processed: Record<string, string>;
  classified_images: Record<string, ImageAnalysisResult>;
  pending_batches?: PendingBatch[];
}

export function emptyAnalyzeCheckpoint(): AnalyzeInfoCheckpoint {
  return {
    users_processed: new Map(),
    classified_images: new Map(),
    pending_batches: [],
  };
}

export async function loadAnalyzeCheckpoint(path: string): Promise<AnalyzeInfoCheckpoint> {
  let raw: string;
  try {
    raw = await readFile(path, "utf8");
  } catch {
    return emptyAnalyzeCheckpoint();
  }

  const json = JSON.parse(raw) as CheckpointJson;
  return {
    users_processed: new Map(Object.entries(json.users_processed)),
    classified_images: json.classified_images
      ? new Map(Object.entries(json.classified_images))
      : new Map(),
    pending_batches: json.pending_batches ?? [],
  };
}

export async function saveAnalyzeCheckpoint(
  path: string,
  checkpoint: AnalyzeInfoCheckpoint,
): Promise<void> {
  const json: CheckpointJson = {
    users_processed: Object.fromEntries(
      [...checkpoint.users_processed.entries()].toSorted(([a], [b]) => a.localeCompare(b)),
    ),
    classified_images: Object.fromEntries(
      [...checkpoint.classified_images.entries()].toSorted(([a], [b]) => a.localeCompare(b)),
    ),
    pending_batches: checkpoint.pending_batches,
  };

  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify(json, undefined, 2)}\n`, "utf8");
}
