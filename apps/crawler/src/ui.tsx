import type { TaskEntry, TaskEvent, TaskState, TaskStatus, WorkState } from "./app/types.ts";
import { Box, Text, render, useInput, useStdin } from "ink";
import React, { useCallback, useEffect, useState } from "react";

import Spinner from "ink-spinner";

function formatErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}

function formatErrorStack(error: unknown): string | undefined {
  if (error instanceof Error && error.stack) return error.stack;
  return undefined;
}

function StatusIcon({ status }: { status: TaskStatus }) {
  switch (status) {
    case "pending": {
      return <Text dimColor>○</Text>;
    }
    case "running": {
      return <Spinner type="dots" />;
    }
    case "done": {
      return <Text color="green">✓</Text>;
    }
    case "error": {
      return <Text color="red">✗</Text>;
    }
  }
}

function WorkRow({ work, expanded }: { work: WorkState; expanded: boolean }) {
  const stack = expanded && work.error ? formatErrorStack(work.error) : undefined;

  return (
    <Box flexDirection="column" marginLeft={2}>
      <Box gap={1}>
        <StatusIcon status={work.status} />
        <Text dimColor>{work.description ?? work.name}</Text>
        {work.status === "error" && work.error ? (
          <Text color="red">{formatErrorMessage(work.error)}</Text>
        ) : undefined}
      </Box>
      {stack ? (
        <Box marginLeft={4}>
          <Text dimColor>{stack}</Text>
        </Box>
      ) : undefined}
    </Box>
  );
}

function TaskRow({
  name,
  state,
  focused,
  expanded,
}: {
  name: string;
  state: TaskState;
  focused: boolean;
  expanded: boolean;
}) {
  const stack = expanded && state.error ? formatErrorStack(state.error) : undefined;

  return (
    <Box flexDirection="column">
      <Box gap={1}>
        <Text>{focused ? "▸" : " "}</Text>
        <StatusIcon status={state.status} />
        <Text bold={focused}>{name}</Text>
        {state.status === "error" && state.error ? (
          <Text color="red">{formatErrorMessage(state.error)}</Text>
        ) : undefined}
      </Box>
      {stack ? (
        <Box marginLeft={3}>
          <Text dimColor>{stack}</Text>
        </Box>
      ) : undefined}
      {expanded &&
        state.works.map((work, i) => (
          <WorkRow key={`${work.name}-${i}`} work={work} expanded={expanded} />
        ))}
    </Box>
  );
}

function consumeEvents(
  name: string,
  events: AsyncIterable<TaskEvent>,
  update: (name: string, fn: (prev: TaskState) => TaskState) => void,
): void {
  (async () => {
    for await (const event of events) {
      switch (event.kind) {
        case "taskStart": {
          // Only update if this is our task
          if (event.name === name) {
            update(name, (prev) => ({
              ...prev,
              status: "running",
            }));
          }
          break;
        }
        case "taskEnd": {
          // Only update if this is our task
          if (event.name === name) {
            update(name, (prev) => ({
              ...prev,
              status: event.result.ok ? "done" : "error",
              error: event.result.ok ? undefined : event.result.error,
            }));
          }
          break;
        }
        case "workStart": {
          // Only handle work events for this task
          if (event.task === name) {
            update(name, (prev) => {
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
          }
          break;
        }
        case "workProgress": {
          if (event.task === name) {
            update(name, (prev) => ({
              ...prev,
              works: prev.works.map((w, i) =>
                i === prev.works.length - 1 ? { ...w, progress: event.value } : w,
              ),
            }));
          }
          break;
        }
        case "workEnd": {
          if (event.task === name) {
            update(name, (prev) => ({
              ...prev,
              works: prev.works.map((w, i) =>
                i === prev.works.length - 1 ? { ...w, status: "done" as const } : w,
              ),
            }));
          }
          break;
        }
        case "spawnStart": {
          if (event.parent === name) {
            update(name, (prev) => ({
              ...prev,
              children: event.children as string[],
            }));
          }
          break;
        }
        case "spawnEnd": {
          // Spawn end is informational; children handle their own state
          break;
        }
      }
    }
    // Stream ended without error — mark parent done if not already errored
    update(name, (prev) => (prev.status === "error" ? prev : { ...prev, status: "done" }));
  })();
}

function App({ entries, onExit }: { entries: readonly TaskEntry[]; onExit: () => void }) {
  const { isRawModeSupported } = useStdin();

  const [states, setStates] = useState<Map<string, TaskState>>(() => {
    const map = new Map<string, TaskState>();
    for (const entry of entries) {
      map.set(entry.name, { status: "pending", works: [], children: [] });
    }
    return map;
  });

  const [focusedIndex, setFocusedIndex] = useState(0);
  // Expanded index: -1 means none expanded, otherwise the index of expanded task
  const [expandedIndex, setExpandedIndex] = useState(-1);

  const allDone = [...states.values()].every((s) => s.status === "done" || s.status === "error");
  const hasErrors = [...states.values()].some((s) => s.status === "error");

  useInput(
    useCallback(
      (
        input: string,
        key: { escape: boolean; upArrow: boolean; downArrow: boolean; return: boolean },
      ) => {
        if (key.upArrow) {
          setFocusedIndex((prev) => Math.max(0, prev - 1));
        }
        if (key.downArrow) {
          setFocusedIndex((prev) => Math.min(entries.length - 1, prev + 1));
        }
        if (input === "e" || key.return) {
          // Toggle expand: if already expanded, collapse; otherwise expand focused
          setExpandedIndex((prev) => (prev === focusedIndex ? -1 : focusedIndex));
        }
        if (input === "q" || key.escape) {
          onExit();
        }
      },
      [onExit, focusedIndex, entries.length],
    ),
    { isActive: isRawModeSupported },
  );

  useEffect(() => {
    if (allDone && !hasErrors) {
      onExit();
    }
    if (allDone && hasErrors && !isRawModeSupported) {
      onExit();
    }
  }, [allDone, hasErrors, isRawModeSupported, onExit]);

  useEffect(() => {
    for (const entry of entries) {
      consumeEvents(entry.name, entry.result.events, (name, fn) => {
        setStates((prev) => {
          const current = prev.get(name)!;
          const next = new Map(prev);
          next.set(name, fn(current));
          return next;
        });
      });
    }
  }, [entries]);

  return (
    <Box flexDirection="column">
      {entries.map((entry, index) => (
        <TaskRow
          key={entry.name}
          name={entry.name}
          state={states.get(entry.name) ?? { status: "pending", works: [], children: [] }}
          focused={index === focusedIndex}
          expanded={index === expandedIndex}
        />
      ))}
      {hasErrors && allDone && isRawModeSupported ? (
        <Text dimColor>
          <Text bold>↑↓</Text> navigate, <Text bold>Enter/e</Text> expand/collapse,{" "}
          <Text bold>q</Text> quit
        </Text>
      ) : undefined}
    </Box>
  );
}

export function renderTasks(entries: readonly TaskEntry[]): Promise<boolean> {
  return new Promise((resolve) => {
    let resolved = false;
    const { unmount } = render(
      <App
        entries={entries}
        onExit={() => {
          if (resolved) return;
          resolved = true;
          unmount();
          resolve(true);
        }}
      />,
    );
  });
}
