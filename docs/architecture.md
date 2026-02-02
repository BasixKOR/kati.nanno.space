# Architecture

## Overview
KATI is an open data platform that crawls Korean subculture event information and serves it for querying.

## Monorepo Structure
- `apps/crawler` — GitHub Actions cron (daily midnight KST), commits sorted JSONL to repo
- `apps/website` — SolidJS SSR app with DuckDB-WASM for in-browser SQL queries

## Data Flow
```
Crawler (pure tasks) → Model (merge) → Sorted JSONL (git) → CI build → Parquet → Website (DuckDB-WASM)
```

## Crawler Stack
- React + ink for terminal UI (first-class, not optional)
- Valibot for data validation, cheerio for HTML parsing, ky for HTTP
- Reliable (retries, partial failure handling), extensible (plugin-style sources), observable (clear logs)

## Website Stack
- SolidJS SSR
- DuckDB-WASM for in-browser SQL against Parquet data
