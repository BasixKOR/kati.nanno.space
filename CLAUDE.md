# KATI Project Context

## What is KATI?
An open data platform that crawls Korean subculture event information and serves it as Parquet files. No backend database — Parquet in the repo is the source of truth.

## Architecture
- **Monorepo** with pnpm workspace: `apps/crawler`, `apps/website`
- **Crawler**: Runs via GitHub Actions cron (daily midnight KST), commits Parquet files to the repo
  - Uses React + ink for terminal UI (core feature, not optional)
  - Valibot for data validation, cheerio for HTML parsing, ky for HTTP
  - Must be reliable (retries, partial failure handling), extensible (plugin-style data sources), observable (clear logs)
- **Website**: SolidJS SSR app with DuckDB-WASM for in-browser SQL queries against Parquet data

## Conventions
- Use pnpm (never npm)
- TypeScript throughout
- Data sources start with Illustar Fest and Comic World, expanding over time

## Key Decisions
- Parquet files committed to repo = single source of truth
- No backend database
- DuckDB-WASM in the browser for data querying
- Ink terminal UI is a first-class feature for the crawler
- Pure data tool — no user accounts or social features (for now)
