import type { TaskState } from "./types.ts";
import { formatDuration, formatErrorMessage } from "./format.ts";
import { StatusIcon } from "./icons.tsx";
import { Box, Text } from "ink";
import React from "react";

export function ChildrenRows({
  childNames,
  states,
  now,
  expanded,
}: {
  childNames: string[];
  states: Map<string, TaskState>;
  now: number;
  expanded: boolean;
}) {
  if (childNames.length === 0) return undefined;

  const children = childNames.map((name) => ({
    name,
    state: states.get(name),
  }));

  if (expanded) {
    return (
      <Box flexDirection="column" marginLeft={2}>
        {children.map(({ name, state }) => {
          const duration =
            state?.startedAt !== undefined ? (state.endedAt ?? now) - state.startedAt : undefined;
          const currentWork = state?.works.findLast((w) => w.status === "running");
          return (
            <Box key={name} flexDirection="column">
              <Box gap={1}>
                <StatusIcon status={state?.status ?? "pending"} />
                <Text dimColor>{name}</Text>
                {duration !== undefined ? (
                  <Text dimColor>[{formatDuration(duration)}]</Text>
                ) : undefined}
                {state?.status === "error" && state.error ? (
                  <Text color="red">{formatErrorMessage(state.error)}</Text>
                ) : undefined}
              </Box>
              {currentWork?.description ? (
                <Box marginLeft={4}>
                  <Text dimColor>{currentWork.description}</Text>
                </Box>
              ) : undefined}
            </Box>
          );
        })}
      </Box>
    );
  }

  // Collapsed: only show running + error children as rows
  const active = children.filter(
    (c) => c.state?.status === "running" || c.state?.status === "error",
  );
  if (active.length === 0) return undefined;

  return (
    <Box flexDirection="column" marginLeft={2}>
      {active.map(({ name, state }) => {
        const currentWork = state?.works.findLast((w) => w.status === "running");
        return (
          <Box key={name} gap={1}>
            <StatusIcon status={state?.status ?? "pending"} />
            <Text dimColor>{name}</Text>
            {state?.status === "running" && currentWork?.description ? (
              <Text dimColor> — {currentWork.description}</Text>
            ) : undefined}
            {state?.status === "error" && state.error ? (
              <Text color="red"> {formatErrorMessage(state.error)}</Text>
            ) : undefined}
          </Box>
        );
      })}
    </Box>
  );
}
