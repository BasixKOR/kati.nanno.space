# Key Decisions

- Sorted JSONL files committed to repo = single source of truth (git-diff friendly)
- Parquet generated from JSONL in CI build step, not committed
- No backend database
- DuckDB-WASM in the browser for data querying
- Ink terminal UI is a first-class feature for the crawler
- Pure data tool — no user accounts or social features (for now)
