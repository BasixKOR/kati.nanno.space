import type { TaskEntry, TaskState, WorkState } from "./types.ts";
import { consumeEvents } from "./event-consumer.ts";
import { sortTasksByDependencies } from "./sort.ts";
import { CompletedSummary } from "./completed-summary.tsx";
import { TaskRow } from "./task-row.tsx";
import { Box, Text, render, useInput, useStdin } from "ink";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";

function App({ entries, onExit }: { entries: readonly TaskEntry[]; onExit: () => void }) {
  const { isRawModeSupported } = useStdin();

  const [states, setStates] = useState<Map<string, TaskState>>(() => {
    const map = new Map<string, TaskState>();
    for (const entry of entries) {
      map.set(entry.name, { status: "pending", works: [], children: [], dependencies: [] });
    }
    return map;
  });

  const [focusedIndex, setFocusedIndex] = useState(0);
  // Expanded index: -1 means none expanded, otherwise the index of expanded task
  const [expandedIndex, setExpandedIndex] = useState(-1);

  // Sort entries by dependencies and start time
  const sortedEntries = useMemo(() => sortTasksByDependencies(entries, states), [entries, states]);

  const { displayLength, doneEntries, skippedEntries, otherEntries, collapseCompleted } =
    useMemo(() => {
      const done: TaskEntry[] = [];
      const skipped: TaskEntry[] = [];
      const other: TaskEntry[] = [];
      for (const entry of sortedEntries) {
        const status = states.get(entry.name)?.status;
        if (status === "done") {
          done.push(entry);
        } else if (status === "skipped") {
          skipped.push(entry);
        } else {
          other.push(entry);
        }
      }
      const completedCount = done.length + skipped.length;
      const collapse = completedCount >= 10;
      return {
        displayLength: collapse ? 1 + other.length : sortedEntries.length,
        doneEntries: done,
        skippedEntries: skipped,
        otherEntries: other,
        collapseCompleted: collapse,
      };
    }, [sortedEntries, states]);

  const [now, setNow] = useState(Date.now());

  const allDone = [...states.values()].every(
    (s) => s.status === "done" || s.status === "skipped" || s.status === "error",
  );
  const hasErrors = [...states.values()].some((s) => s.status === "error");

  useEffect(() => {
    if (allDone) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [allDone]);

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
          setFocusedIndex((prev) => Math.min(displayLength - 1, prev + 1));
        }
        if (input === "e" || key.return) {
          // Toggle expand: if already expanded, collapse; otherwise expand focused
          setExpandedIndex((prev) => (prev === focusedIndex ? -1 : focusedIndex));
        }
        if (input === "q" || key.escape) {
          onExit();
        }
      },
      [onExit, focusedIndex, displayLength],
    ),
    { isActive: isRawModeSupported },
  );

  useEffect(() => {
    setFocusedIndex((prev) => Math.min(prev, Math.max(0, displayLength - 1)));
  }, [displayLength]);

  useEffect(() => {
    if (allDone && !hasErrors) {
      onExit();
    }
    if (allDone && hasErrors && !isRawModeSupported) {
      onExit();
    }
  }, [allDone, hasErrors, isRawModeSupported, onExit]);

  const subscribedRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    for (const entry of entries) {
      // Skip if already subscribed to this entry's events
      if (subscribedRef.current.has(entry.name)) continue;
      subscribedRef.current.add(entry.name);

      consumeEvents(
        entry.result.events,
        (name, fn) => {
          setStates((prev) => {
            const current = prev.get(name) ?? {
              status: "pending" as const,
              works: [] as WorkState[],
              children: [] as string[],
              dependencies: [] as string[],
            };
            const next = new Map(prev);
            next.set(name, fn(current));
            return next;
          });
        },
        (task, dependsOn) => {
          setStates((prev) => {
            const current = prev.get(task);
            if (!current) return prev;
            if (current.dependencies.includes(dependsOn)) return prev;
            const next = new Map(prev);
            next.set(task, {
              ...current,
              dependencies: [...current.dependencies, dependsOn],
            });
            return next;
          });
        },
      );
    }
  }, [entries]);

  return (
    <Box flexDirection="column">
      {collapseCompleted ? (
        <>
          <CompletedSummary
            doneEntries={doneEntries}
            skippedEntries={skippedEntries}
            states={states}
            focused={focusedIndex === 0}
            expanded={expandedIndex === 0}
          />
          {otherEntries.map((entry, index) => {
            const displayIndex = index + 1;
            return (
              <TaskRow
                key={entry.name}
                name={entry.name}
                state={
                  states.get(entry.name) ?? {
                    status: "pending",
                    works: [],
                    children: [],
                    dependencies: [],
                  }
                }
                states={states}
                now={now}
                focused={displayIndex === focusedIndex}
                expanded={displayIndex === expandedIndex}
              />
            );
          })}
        </>
      ) : (
        sortedEntries.map((entry, index) => (
          <TaskRow
            key={entry.name}
            name={entry.name}
            state={
              states.get(entry.name) ?? {
                status: "pending",
                works: [],
                children: [],
                dependencies: [],
              }
            }
            states={states}
            now={now}
            focused={index === focusedIndex}
            expanded={index === expandedIndex}
          />
        ))
      )}
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
