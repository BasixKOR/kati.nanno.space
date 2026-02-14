import type { PropertyMismatch, WorkState } from "./types.ts";
import { extractValibotMismatches, formatErrorMessage, formatErrorStack } from "./format.ts";
import { StatusIcon } from "./icons.tsx";
import { Box, Text } from "ink";
import React from "react";

export function PropertyMismatchList({ mismatches }: { mismatches: PropertyMismatch[] }) {
  return (
    <Box flexDirection="column" marginLeft={4}>
      {mismatches.slice(0, 5).map((m, i) => (
        <Text key={i} dimColor>
          • <Text color="cyan">{m.path}</Text>: {m.messages[0]}
        </Text>
      ))}
      {mismatches.length > 5 ? (
        <Text dimColor> ... and {mismatches.length - 5} more</Text>
      ) : undefined}
    </Box>
  );
}

export function WorkRow({ work, expanded }: { work: WorkState; expanded: boolean }) {
  const stack = expanded && work.error ? formatErrorStack(work.error) : undefined;
  const mismatches = work.error ? extractValibotMismatches(work.error) : undefined;

  return (
    <Box flexDirection="column" marginLeft={2}>
      <Box gap={1}>
        <StatusIcon status={work.status} />
        <Text dimColor>{work.description ?? work.name}</Text>
        {work.status === "error" && work.error ? (
          <Text color="red">{formatErrorMessage(work.error)}</Text>
        ) : undefined}
      </Box>
      {mismatches && !expanded ? <PropertyMismatchList mismatches={mismatches} /> : undefined}
      {stack ? (
        <Box marginLeft={4}>
          <Text dimColor>{stack}</Text>
        </Box>
      ) : undefined}
    </Box>
  );
}
