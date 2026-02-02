# Action System (Planned)

## Overview
Gulp/Grunt-like action dependency system for the crawler. Per-source actions via builder/fluent API.

## Action Types
- **RUN_STEP** — sequential, one after another
- **RUN_PARALLEL** — concurrent siblings, dependent receives `results[]`
- **SOLELY_OWNED** — acquires a hierarchical lock key (string array, like TanStack Query's query key) before running; other actions with overlapping keys wait

## Design Principles
- Actions are pure functions (only side effect is network I/O)
- Actions return values → Model handles merge at the end
- Fail-fast by default, per-action opt-in retries for rate limits

## UI Integration
- Actions emit lifecycle events: start, progress, done, error
- Ink components consume events to render action status
