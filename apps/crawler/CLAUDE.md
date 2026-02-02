# Crawler Package

## Layered Architecture

Dependency rule: `app → features → services → shared` (no reverse imports).

| Layer        | Path            | Purpose                                                              |
| ------------ | --------------- | -------------------------------------------------------------------- |
| **shared**   | `src/shared/`   | Generic utilities with no domain knowledge                           |
| **services** | `src/services/` | 3rd-party integrations (DB, Illustar-Fes API, Comic World API, etc.) |
| **features** | `src/features/` | Domain logic — data model and action DSL                             |
| **app**      | `src/app/`      | Concrete action definitions that compose features and services       |
