# Task System (Planned)

## Overview
Gulp/Grunt-like task dependency system for the crawler. Per-source pipelines via builder/fluent API.

## Task Types
- **RUN_STEP** — sequential, one after another
- **RUN_PARALLEL** — concurrent siblings, dependent receives `results[]`
- **SOLELY_OWNED** — acquires a hierarchical lock key (string array, like TanStack Query's query key) before running; other tasks with overlapping keys wait

## Design Principles
- Tasks are pure functions (only side effect is network I/O)
- Tasks return values → Model handles merge at the end
- Fail-fast by default, per-task opt-in retries for rate limits

## UI Integration
- Tasks emit lifecycle events: start, progress, done, error
- Ink components consume events to render task status
