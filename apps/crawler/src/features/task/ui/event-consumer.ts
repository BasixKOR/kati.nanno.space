import type { TaskEvent } from "../index.ts";
import type { TaskStatus, WorkState } from "./types.ts";

export function consumeEvents(
  events: AsyncIterable<TaskEvent>,
  update: (
    name: string,
    fn: (prev: {
      status: TaskStatus;
      works: WorkState[];
      children: string[];
      dependencies: string[];
      startedAt?: number;
      endedAt?: number;
      error?: unknown;
    }) => {
      status: TaskStatus;
      works: WorkState[];
      children: string[];
      dependencies: string[];
      startedAt?: number;
      endedAt?: number;
      error?: unknown;
    },
  ) => void,
  addDependency: (task: string, dependsOn: string) => void,
): void {
  (async () => {
    for await (const event of events) {
      switch (event.kind) {
        case "taskStart": {
          update(event.name, (prev) => ({
            ...prev,
            status: "running",
            startedAt: event.timestamp,
          }));
          break;
        }
        case "taskEnd": {
          let status: TaskStatus;
          if (event.result.ok === "skipped") {
            status = "skipped";
          } else if (event.result.ok) {
            status = "done";
          } else {
            status = "error";
          }
          update(event.name, (prev) => ({
            ...prev,
            status,
            error: event.result.ok === false ? event.result.error : undefined,
            endedAt: event.timestamp,
          }));
          break;
        }
        case "taskDependency": {
          addDependency(event.task, event.dependsOn);
          break;
        }
        case "workStart": {
          update(event.task, (prev) => {
            const newWork: WorkState = {
              name: event.task,
              status: "running" as const,
            };
            if (event.description !== undefined) {
              newWork.description = event.description;
            }
            return {
              ...prev,
              status: "running",
              works: [...prev.works, newWork],
            };
          });
          break;
        }
        case "workDescription": {
          update(event.task, (prev) => ({
            ...prev,
            works: prev.works.map((w, i) =>
              i === prev.works.length - 1 ? { ...w, description: event.description } : w,
            ),
          }));
          break;
        }
        case "workProgress": {
          update(event.task, (prev) => ({
            ...prev,
            works: prev.works.map((w, i) =>
              i === prev.works.length - 1 ? { ...w, progress: event.value } : w,
            ),
          }));
          break;
        }
        case "workEnd": {
          update(event.task, (prev) => ({
            ...prev,
            works: prev.works.map((w, i) =>
              i === prev.works.length - 1 ? { ...w, status: "done" as const } : w,
            ),
          }));
          break;
        }
        case "spawnStart": {
          update(event.parent, (prev) => ({
            ...prev,
            children: [...new Set([...prev.children, ...(event.children as string[])])],
          }));
          break;
        }
        case "spawnEnd": {
          // Spawn end is informational; children handle their own state
          break;
        }
      }
    }
  })();
}
