# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Git Commit Rules

- Do NOT add `Co-Authored-By` lines to commit messages.

## Project Overview

Claude Token Tracker is a **Tauri v2 (Rust) + React (Vite + TypeScript)** desktop app that monitors Claude Code token usage and API-equivalent costs in real-time. It reads JSONL transcripts from `~/.claude/projects/*/`. The UI is entirely in Chinese.

**v2 rewrite**: Migrated from Electron to Tauri for smaller binary (~5MB vs 83MB) and lower memory (~30MB vs 200MB).

## Commands

```bash
npm install              # Install frontend dependencies
npm run dev              # Start Vite dev server
npx tauri dev            # Run app in development mode (starts Vite + Rust)
npx tauri build          # Build Windows NSIS installer to src-tauri/target/release/bundle/
node install.js          # Install the track-usage hook into ~/.claude/settings.json
```

There is no test suite or linter configured.

## Architecture

**Tauri v2 app with React frontend (TypeScript) and Rust backend.**

### Rust Backend (`src-tauri/src/`)

- **main.rs** — Tauri app entry point
- **lib.rs** — Plugin registration, command handler setup
- **commands/usage.rs** — Tauri commands: `get_usage`, `get_projects`, `get_sessions`, `get_buckets`, `get_version`
- **data/loader.rs** — JSONL file discovery, parsing, deduplication (messageId:requestId), date filtering, session grouping, 5-hour bucket analysis
- **data/pricing.rs** — 13 Claude model pricing definitions, tiered cost calculation (200K threshold), fast mode multiplier
- **data/models.rs** — Serde structs: UsageRecord, SessionSummary, BucketData, Settings

### React Frontend (`src/`)

- **main.tsx** — React entry point
- **App.tsx** — Layout shell: custom TitleBar + TabNav + page routing
- **api/index.ts** — Typed `invoke()` wrappers for all Tauri commands
- **api/types.ts** — TypeScript interfaces matching Rust structs
- **components/layout/** — TitleBar (Windows-style), TabNav (6 tabs)
- **components/overview/** — OverviewPage, StatsGrid (6 stat cards), BucketCards (5h windows)
- **styles/theme.css** — CSS custom properties (dark/light themes from design spec)
- **styles/global.css** — Inter font, scrollbar, reset

### CLI Tools (Node.js, standalone)

- **track-usage.js** — Hook script run on Claude Code session stop. Reads transcript, deduplicates, appends to daily JSONL logs.
- **install.js** — One-time setup: injects `track-usage.js` as a `hooks.Stop` entry in `~/.claude/settings.json`.

## Key Design Decisions

- **Tauri v2 + Rust** backend replaces Electron's Node.js main process
- **React + TypeScript + Vite** replaces vanilla JS single-file SPA
- **Design theme** from `new-theme.pen`: navy/purple palette (#1a1a2e), Inter font, 14px corner radius cards
- **Zero heavy dependencies**: no charting library, CSS-based charts
- **Cost calculation** uses tiered pricing with 200K token threshold, separate rates for cache_write/cache_read, 6x multiplier for "fast" mode on Opus
- **Deduplication** uses `messageId:requestId` composite keys
- **Data paths**: transcripts in `~/.claude/projects/*/`, usage logs in `~/.claude/usage-logs/`

## Migration Status (v2)

- [x] Phase 1: Project scaffolding (Tauri + React + Vite)
- [x] Phase 2: Rust data layer (pricing, loader, buckets, sessions)
- [x] Phase 5: React foundation (TitleBar, TabNav, theme system)
- [x] Phase 6 partial: Overview page (StatsGrid, BucketCards)
- [ ] Phase 3: Remaining Tauri commands (16/21)
- [ ] Phase 4: System features (tray, shortcuts, file watcher, notifications, updater, float window)
- [ ] Phase 6: Remaining pages (Compare, Ranking, Sessions, Chat, Settings)
- [ ] Phase 8: Build, packaging, testing
