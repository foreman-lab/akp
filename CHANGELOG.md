# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.1.0-alpha.2] - 2026-04-28

### Fixed

- `CLAUDE.md` no longer claims `kysely` is part of the storage stack (it was removed in `0.1.0-alpha.1` but the architecture section was not updated).

### Added

- `npm run format` / `npm run format:check` and `npm run lint` (with `--max-warnings=0`) documented in `CLAUDE.md`.

## [0.1.0-alpha.1] - 2026-04-28

### Added

- Prettier configuration (`.prettierrc.json`, `.prettierignore`).
- ESLint flat config (`eslint.config.js`) with type-checked TypeScript rules and import-order enforcement.
- `format` and `format:check` npm scripts.
- CI now runs `lint`, `format:check`, and `test` in addition to `check` and `build`.

### Removed

- Unused `kysely` dependency.
- Unused `pino` dependency and dead `src/core/logging/logger.ts`.

## [0.1.0-alpha.0] - 2026-04-27

- Initial v0.1-alpha scaffold of the Artifact Knowledge Protocol.
- Typed knowledge envelope (`fact` / `convention` / `procedure`) with classification, exposure, provenance, and freshness.
- CLI verbs: `init`, `check`, `build`, `describe`, `lookup`, `get`, `neighbors`, `brief`, `freshness`.
- Read-only MCP server exposing the same read verbs.
- SQLite + FTS5 query store with a JSONL canonical store split.
