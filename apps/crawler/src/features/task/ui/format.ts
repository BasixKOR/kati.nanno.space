import type { ProgressValue, PropertyMismatch } from "./types.ts";
import * as v from "valibot";

export function extractValibotMismatches(error: unknown): PropertyMismatch[] | undefined {
  if (!(error instanceof v.ValiError)) return undefined;

  const flattened = v.flatten(error.issues);
  const mismatches: PropertyMismatch[] = [];

  // Root-level errors
  if (flattened.root && flattened.root.length > 0) {
    mismatches.push({ path: "(root)", messages: flattened.root });
  }

  // Nested property errors
  if (flattened.nested) {
    for (const [path, messages] of Object.entries(flattened.nested)) {
      if (messages && messages.length > 0) {
        mismatches.push({ path, messages });
      }
    }
  }

  return mismatches.length > 0 ? mismatches : undefined;
}

export function formatErrorMessage(error: unknown): string {
  if (error instanceof v.ValiError) {
    return `Validation failed (${error.issues.length} issue${error.issues.length === 1 ? "" : "s"})`;
  }
  if (error instanceof Error) return error.message;
  return String(error);
}

export function formatErrorStack(error: unknown): string | undefined {
  if (error instanceof Error && error.stack) return error.stack;
  return undefined;
}

export function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60_000) return `${Math.round(ms / 1000)}s`;
  const minutes = Math.floor(ms / 60_000);
  const seconds = Math.round((ms % 60_000) / 1000);
  return `${minutes}m ${seconds}s`;
}

export function formatProgress(progress: ProgressValue): string {
  if (progress === "indefinite") return "…";
  if (progress.kind === "count") return `${progress.value}`;
  return `${Math.round(progress.value * 100)}%`;
}
