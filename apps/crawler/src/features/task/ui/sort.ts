import type { TaskEntry, TaskState } from "./types.ts";

// Topological sort with start time as secondary sort key
export function sortTasksByDependencies(
  entries: readonly TaskEntry[],
  states: Map<string, TaskState>,
): TaskEntry[] {
  const nameToEntry = new Map(entries.map((e) => [e.name, e]));
  const visited = new Set<string>();
  const result: TaskEntry[] = [];

  // Build dependency graph from states
  const dependencyGraph = new Map<string, Set<string>>();
  for (const entry of entries) {
    const state = states.get(entry.name);
    if (state) {
      dependencyGraph.set(entry.name, new Set(state.dependencies));
    } else {
      dependencyGraph.set(entry.name, new Set());
    }
  }

  // Topological sort with DFS
  function visit(name: string): void {
    if (visited.has(name)) return;
    visited.add(name);

    const deps = dependencyGraph.get(name) ?? new Set();
    for (const dep of deps) {
      if (nameToEntry.has(dep)) {
        visit(dep);
      }
    }

    const entry = nameToEntry.get(name);
    if (entry) {
      result.push(entry);
    }
  }

  // Sort entries by start time first, then visit in that order
  const sortedByStartTime = entries.toSorted((a, b) => {
    const stateA = states.get(a.name);
    const stateB = states.get(b.name);
    const startA = stateA?.startedAt ?? Number.MAX_SAFE_INTEGER;
    const startB = stateB?.startedAt ?? Number.MAX_SAFE_INTEGER;
    return startA - startB;
  });

  for (const entry of sortedByStartTime) {
    visit(entry.name);
  }

  return result;
}
