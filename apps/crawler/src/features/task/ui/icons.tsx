import type { TaskStatus } from "./types.ts";
import { Text } from "ink";
import React from "react";

import Spinner from "ink-spinner";

export function StatusIcon({ status }: { status: TaskStatus }) {
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
    case "skipped": {
      return <Text dimColor>–</Text>;
    }
    case "error": {
      return <Text color="red">✗</Text>;
    }
  }
}

export function statusDot(status: TaskStatus | undefined): React.ReactNode {
  switch (status) {
    case "done": {
      return <Text color="green">●</Text>;
    }
    case "running": {
      return <Text color="yellow">○</Text>;
    }
    case "error": {
      return <Text color="red">●</Text>;
    }
    case "skipped": {
      return <Text dimColor>–</Text>;
    }
    default: {
      return <Text dimColor>○</Text>;
    }
  }
}
