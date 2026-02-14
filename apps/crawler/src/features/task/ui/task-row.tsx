import type { TaskState } from "./types.ts";
import {
  extractValibotMismatches,
  formatDuration,
  formatErrorMessage,
  formatErrorStack,
  formatProgress,
} from "./format.ts";
import { StatusIcon } from "./icons.tsx";
import { ProgressDots } from "./progress-dots.tsx";
import { ChildrenRows } from "./children-rows.tsx";
import { PropertyMismatchList, WorkRow } from "./work-row.tsx";
import { Box, Text } from "ink";
import React from "react";

export function TaskRow({
  name,
  state,
  states,
  now,
  focused,
  expanded,
}: {
  name: string;
  state: TaskState;
  states: Map<string, TaskState>;
  now: number;
  focused: boolean;
  expanded: boolean;
}) {
  const stack = expanded && state.error ? formatErrorStack(state.error) : undefined;
  const mismatches = state.error ? extractValibotMismatches(state.error) : undefined;
  const duration =
    state.startedAt !== undefined ? (state.endedAt ?? now) - state.startedAt : undefined;
  const currentWork = state.works.findLast((w) => w.status === "running");

  return (
    <Box flexDirection="column">
      <Box gap={1}>
        <Text>{focused ? "▸" : " "}</Text>
        <StatusIcon status={state.status} />
        <Text bold={focused}>{name}</Text>
        <ProgressDots works={state.works} childNames={state.children} states={states} />
        {duration !== undefined ? <Text dimColor>[{formatDuration(duration)}]</Text> : undefined}
        {state.status === "error" && state.error ? (
          <Text color="red">{formatErrorMessage(state.error)}</Text>
        ) : undefined}
      </Box>
      {currentWork?.description ? (
        <Box marginLeft={4} gap={1}>
          <Text dimColor>{currentWork.description}</Text>
          {currentWork.progress !== undefined ? (
            <Text dimColor>({formatProgress(currentWork.progress)})</Text>
          ) : undefined}
        </Box>
      ) : undefined}
      {mismatches && !expanded ? (
        <Box marginLeft={3}>
          <PropertyMismatchList mismatches={mismatches} />
        </Box>
      ) : undefined}
      {stack ? (
        <Box marginLeft={3}>
          <Text dimColor>{stack}</Text>
        </Box>
      ) : undefined}
      {state.children.length > 0 ? (
        <ChildrenRows childNames={state.children} states={states} now={now} expanded={expanded} />
      ) : undefined}
      {expanded &&
        state.works.map((work, i) => (
          <WorkRow key={`${work.name}-${i}`} work={work} expanded={expanded} />
        ))}
    </Box>
  );
}
