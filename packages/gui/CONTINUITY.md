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

Windows GUI profile isolation: Electron userData is now dynamically relocated to Documents/Karpuzikov Tools/Deemix/Electron (including cookies, settings, logs and window-state.json), with one-time full legacy profile migration before app initialization. Runtime Windows startup/migration validation remains outstanding.

## Release process and latest checkpoint

On the hardening branch, the Windows packaging workflow now executes the Windows DPAPI credentials test and launches the packaged GUI as a smoke test. When pushed to main and all checks pass, it publishes the asset `Deemix v0.5.1.exe` to the existing `windows-latest` prerelease, with the title `Deemix v0.5.1 - Under construction ⚠️`, verifies the asset, and removes old unversioned assets. `pnpm make` builds the Electron Forge installer. Release status must remain under construction until user testing confirms success. GUI startup uses delayed dynamic import of deemix-webui after setting host/port to prevent accidental default-port startup. Manual Windows validation of login/download/Spotify and paths is still required.

## 2026-10-08 - Hardening merge checkpoint

The Deemix v0.5.1 hardening PR #2 was squash-merged to `main` at a3e5def2284aa10cbb401594d65e8844b4080ad6. Previous `deemix-hardening-2026-10-08` is no longer the active development branch. The Windows release workflow verifies the DPAPI credentials test, starts the packaged GUI and checks localhost HTTP before publishing the physical `Deemix v0.5.1.exe` asset to the existing `windows-latest` prerelease. A verified Windows download and real interactive user test remain release acceptance conditions. Keep v0.5.1 - Under construction ⚠️ until user confirms Done; do not claim live Windows testing based only on CI. Source of truth: `main`. Global rule file remains unchanged and matches canonical userscripts rule.

## Release asset filename verification

Windows GitHub Actions build and packaged-app smoke test passed for v0.5.1. GitHub release uploads normalize the local filename `Deemix v0.5.1.exe` to the published asset name `Deemix.v0.5.1.exe`. The release workflow now validates that normalized name before cleaning the outdated `Deemix.exe` file. Never claim a published asset is ready until release validation finishes successfully. Product and version remain explicit in the physical filename. User acceptance and login/download test still pending.

## Verified Windows distribution checkpoint - 2026-10-08

GitHub Actions Windows run 37842412254 completed successfully on source commit 8b3ea20945d02ed2937795ad2ee9a50d396a364f. Windows DPAPI credential regression test, Electron Forge build, packaged GUI localhost startup smoke test, release asset preparation and publishing all passed. The GitHub prerelease `windows-latest` targets that commit and contains one downloadable asset, `Deemix.v0.5.1.exe`, 112,990,720 bytes. The prior unversioned `Deemix.exe` release asset has been retired. The source installer uses a space, but GitHub normalizes it to a period in the public filename. No actual-user Deezer login/download/Spotify verification has been conducted: **v0.5.1 - Under construction ⚠️** remains the correct status until the user confirms tests complete. The Windows build workflow excludes documentation-only changes.
