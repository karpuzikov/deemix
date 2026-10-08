# Deemix GUI continuity

Purpose: Electron desktop wrapper for Deemix WebUI.
Version: 0.5.0 initially; planned hardening version 0.5.1, status under construction. Entry: packages/gui/src/main.ts, src/preload.ts, scripts/build.js; Electron Forge packaging in forge.config.js. Web UI and server embed into GUI from workspace dependency. Data: Electron userData window-state; downloads/config loaded by Deemix engine.

Architecture: Electron opens localhost server; only whitelisted IPC bridge methods; cross-platform packaging via pnpm make. Current Windows Release asset is unversioned and points at prior main; fix only with authorized workflow changes and verifiable build.

Development checkpoint: 2026-10-08. Branch: `deemix-hardening-2026-10-08` (not released). Status: Under construction ⚠️. The entire monorepo must follow root SOFTWARE_RULES.md (mirrored exactly from karpuzikov/userscripts); refer to that file for security, UI/UX, artifact naming, version, state retention, and release gates. Do not publish until lint, typecheck, tests, build, smoke test and UXDT review pass on supported platforms.

Preserve existing functionality: Deezer downloading, FLAC/MP3, tagged tracks and art, artist discography, UPC and ISRC lookup, release metadata, MusicBrainz fallback, Spotify and ListenBrainz integrations, lyrics, queue persistence, CLI, web interface, and desktop GUI. Changes should be in-place patches, not rewrites.

Known pre-review risks: remote HTTP/WebSocket operations exposed without proper authentication, tokens persisted in plaintext, Electron external-link validation, TLS verification disabled in selected requests, retry recursion, UPC lookup races, metadata release mismatch, stale release asset and status/version mismatch. Previous source audit did not run tests. Local runtime does not have access to GitHub/node dependencies; do not claim tests pass without actual test runs.

No project-specific RULES.md was found in the 2026-10-08 tree; root SOFTWARE_RULES.md applies. UXDT reference: https://www.uxdt.nic.in/guidelines/, specifically accessibility / forms / technical checklists. Releases are blocked until verified. Release action workflow is governed by GitHub Actions policy; do not modify .github/workflows without an explicit workflow change request.

## Latest hardening checkpoint

Current implementation: v0.5.1 - Under construction ⚠️. Electron IPC validates sender; external navigation limited to HTTPS and the own localhost origin; sandbox/context isolation/nodeIntegration explicit, folder opening constrained to current downloads root, window picker preserved. OAuth localhost popup remains allowed. Source branch deemix-hardening-2026-10-08; draft PR #2. Existing Windows build workflow still publishes unversioned Deemix.exe and must not be edited without the user's explicit GitHub workflow instruction. No new Windows v0.5.1 installer has been released. Windows DPAPI persistence and migration from APPDATA/deemix to Documents/Karpuzikov Tools/Deemix require runtime smoke tests; packaging and versioned installer asset remain release blockers.

Next action: inspect PR #2 lint, type-check and build checks, fix all failures, then run Windows desktop/Docker manual smoke tests. Keep draft and do not merge until all release blockers in root SOFTWARE_RULES.md are met.
