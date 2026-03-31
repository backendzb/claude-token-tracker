# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Git Commit Rules

- Do NOT add `Co-Authored-By` lines to commit messages.

## Project Overview

Claude Token Tracker is an Electron desktop app that monitors Claude Code token usage and API-equivalent costs in real-time. It reads JSONL transcripts from `~/.claude/projects/*/` and usage logs from `~/.claude/usage-logs/`. The UI is entirely in Chinese.

## Commands

```bash
npm start          # Run the app in development mode (launches Electron)
npm run build      # Build Windows NSIS installer to dist/
npm run publish    # Build and publish to GitHub Releases
node install.js    # Install the track-usage hook into ~/.claude/settings.json
```

There is no test suite or linter configured.

## Architecture

**Electron app with vanilla JS (no framework, no build step for source code).**

- **main.js** — Electron main process. Window lifecycle, system tray, IPC handlers, file watching (debounced 2s), budget alerts, global hotkey (Ctrl+Shift+T), auto-updater. All renderer requests go through `ipcMain.handle()`.
- **preload.js** — Context isolation bridge. Exposes `window.api.*` methods to renderer via `contextBridge`.
- **index.html** — Single-file SPA (HTML + CSS + JS). Multi-tab UI: Overview, Comparison, Ranking, Sessions, Conversations, Settings. Uses CSS variables for dark/light theming.
- **data-loader.js** — Core data processing. Reads JSONL files, deduplicates by `messageId:requestId` hash, calculates costs with tiered pricing (MODEL_PRICING), 10-second TTL cache. Exports CSV/JSON. Key functions: `loadAllUsageData()`, `loadBucketData()` (5-hour window analysis), `loadSessionList()`, `loadConversation()`.
- **track-usage.js** — Hook script run on Claude Code session stop. Reads transcript, deduplicates against per-session state files in `~/.claude/usage-logs/.state/`, appends to daily JSONL logs.
- **install.js** — One-time setup: injects `track-usage.js` as a `hooks.Stop` entry in `~/.claude/settings.json`.
- **view-usage.js** — CLI tool (`node view-usage.js [--days N] [--summary] [--session ID]`) for terminal-based usage viewing.
- **dashboard.js** — Legacy standalone HTTP dashboard (port 3456), not used by the Electron app.

## Key Design Decisions

- **CommonJS modules** (`"type": "commonjs"` in package.json). No TypeScript.
- **Zero runtime dependencies** except `electron-updater`. All UI is vanilla DOM manipulation.
- **Cost calculation** uses tiered pricing with a 200K token threshold, separate rates for cache_write/cache_read, and a 6x multiplier for "fast" mode on Opus.
- **Deduplication** uses `messageId:requestId` composite keys plus per-session state files to prevent double-counting.
- **Data paths**: Settings in `~/.config/electron/claude-token-tracker/`, usage logs in `~/.claude/usage-logs/`, transcripts in `~/.claude/projects/*/`.
- **Auto-update** via electron-updater with GitHub Releases as the provider. Falls back to opening the browser for manual download.
