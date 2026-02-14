import type { TaskEntry, TaskState } from "./types.ts";
import { formatDuration } from "./format.ts";
import { Box, Text } from "ink";
import React from "react";

export function CompletedSummary({
  doneEntries,
  skippedEntries,
  states,
  focused,
  expanded,
}: {
  doneEntries: TaskEntry[];
  skippedEntries: TaskEntry[];
  states: Map<string, TaskState>;
  focused: boolean;
  expanded: boolean;
}) {
  const parts: string[] = [];
  if (doneEntries.length > 0) parts.push(`${doneEntries.length} done`);
  if (skippedEntries.length > 0) parts.push(`${skippedEntries.length} skipped`);

  return (
    <Box flexDirection="column">
      <Box gap={1}>
        <Text>{focused ? "▸" : " "}</Text>
        <Text color="green">✓</Text>
        <Text bold={focused}>{parts.join(", ")}</Text>
      </Box>
      {expanded &&
        [...doneEntries, ...skippedEntries].map((entry) => {
          const state = states.get(entry.name);
          const isSkipped = state?.status === "skipped";
          const duration =
            state?.startedAt !== undefined && state?.endedAt !== undefined
              ? state.endedAt - state.startedAt
              : undefined;
          return (
            <Box key={entry.name} gap={1} marginLeft={2}>
              {isSkipped ? <Text dimColor>–</Text> : <Text color="green">✓</Text>}
              <Text dimColor>{entry.name}</Text>
              {duration !== undefined ? (
                <Text dimColor>[{formatDuration(duration)}]</Text>
              ) : undefined}
            </Box>
          );
        })}
    </Box>
  );
}
