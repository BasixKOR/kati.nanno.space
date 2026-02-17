import type { TaskState, WorkState } from "./types.ts";
import { formatDuration, formatErrorMessage, formatProgress } from "./format.ts";
import { StatusIcon } from "./icons.tsx";
import { Box, Text } from "ink";
import React from "react";

/** Walk down the task tree to find the deepest running work with a description. */
function findActiveWork(
  state: TaskState | undefined,
  states: Map<string, TaskState>,
): WorkState | undefined {
  if (!state) return undefined;

  const own = state.works.findLast((w) => w.status === "running");
  if (own?.description) return own;

  for (const childName of state.children) {
    const childState = states.get(childName);
    if (childState?.status !== "running") continue;
    const found = findActiveWork(childState, states);
    if (found) return found;
  }

  return undefined;
}

function WorkDescription({ work }: { work: WorkState | undefined }) {
  if (!work?.description) return undefined;
  return (
    <Text dimColor>
      {" — "}
      {work.description}
      {work.progress !== undefined ? ` (${formatProgress(work.progress)})` : ""}
    </Text>
  );
}

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
          const activeWork = findActiveWork(state, states);
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
              {activeWork?.description ? (
                <Box marginLeft={4}>
                  <Text dimColor>
                    {activeWork.description}
                    {activeWork.progress !== undefined
                      ? ` (${formatProgress(activeWork.progress)})`
                      : ""}
                  </Text>
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
        const activeWork = findActiveWork(state, states);
        return (
          <Box key={name} gap={1}>
            <StatusIcon status={state?.status ?? "pending"} />
            <Text dimColor>{name}</Text>
            {state?.status === "running" ? <WorkDescription work={activeWork} /> : undefined}
            {state?.status === "error" && state.error ? (
              <Text color="red"> {formatErrorMessage(state.error)}</Text>
            ) : undefined}
          </Box>
        );
      })}
    </Box>
  );
}
