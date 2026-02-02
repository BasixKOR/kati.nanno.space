# Conventions

- Use pnpm (never npm)
- All packages use `"type": "module"` (ESM by default)
- Shared dependencies use pnpm catalog (in `pnpm-workspace.yaml`) for version pinning
- TypeScript throughout
- Server-side TS runs via Node 24+ native support (no tsx/ts-node). Only website is bundled.
- Data sources start with Illustar Fest and Comic World, expanding over time
- Script naming: use `check:<tool>` pattern (e.g. `check:lint`, `check:type`, `check:fmt`). Root `check` runs all via turbo. Keep turbo task names and package.json script names in sync.
