import type { RunResult, ProgressValue } from "../index.ts";

export type { TaskEvent, ProgressValue } from "../index.ts";

export interface TaskEntry {
  readonly name: string;
  readonly result: RunResult<unknown>;
}

export type TaskStatus = "pending" | "running" | "done" | "skipped" | "error";

export interface WorkState {
  name: string;
  status: TaskStatus;
  description?: string;
  progress?: ProgressValue;
  error?: unknown;
}

export interface TaskState {
  status: TaskStatus;
  works: WorkState[];
  children: string[];
  dependencies: string[];
  startedAt?: number;
  endedAt?: number;
  error?: unknown;
}

export interface PropertyMismatch {
  path: string;
  messages: string[];
}

export interface DotItem {
  status: TaskStatus | undefined;
  /** Completion timestamp for ordering; undefined = still active */
  endedAt: number | undefined;
}
