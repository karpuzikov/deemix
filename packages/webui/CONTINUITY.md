# Deemix WebUI continuity

Purpose: Express + WebSocket server, Vue/Vite UI; network-facing and embedded in Electron.
Version: 4.7.0; status Under construction ⚠️. Source server at packages/webui/src/server, client at packages/webui/src/client, tests adjacent to routes. Persistent config via deemix getConfigFolder(), sessions via express-session memory store, queued downloads in config/queue. Runs Node 24+; start pnpm --filter deemix-webui start; build via pnpm build.

Security contract: default localhost only. Any remote access must be authenticated and protected by HTTPS (reverse proxy); WebSocket and HTTP operations require equivalent access protection. Keep auto-login and existing browser flows functional. Release prerequisites: tests, server startup smoke tests, LAN authentication tests, WebSocket origin checks, keyboard and responsive UI verification.

Development checkpoint: 2026-10-08. Branch: `deemix-hardening-2026-10-08` (not released). Status: Under construction ⚠️. The entire monorepo must follow root SOFTWARE_RULES.md (mirrored exactly from karpuzikov/userscripts); refer to that file for security, UI/UX, artifact naming, version, state retention, and release gates. Do not publish until lint, typecheck, tests, build, smoke test and UXDT review pass on supported platforms.

Preserve existing functionality: Deezer downloading, FLAC/MP3, tagged tracks and art, artist discography, UPC and ISRC lookup, release metadata, MusicBrainz fallback, Spotify and ListenBrainz integrations, lyrics, queue persistence, CLI, web interface, and desktop GUI. Changes should be in-place patches, not rewrites.

Known pre-review risks: remote HTTP/WebSocket operations exposed without proper authentication, tokens persisted in plaintext, Electron external-link validation, TLS verification disabled in selected requests, retry recursion, UPC lookup races, metadata release mismatch, stale release asset and status/version mismatch. Previous source audit did not run tests. Local runtime does not have access to GitHub/node dependencies; do not claim tests pass without actual test runs.

No project-specific RULES.md was found in the 2026-10-08 tree; root SOFTWARE_RULES.md applies. UXDT reference: https://www.uxdt.nic.in/guidelines/, specifically accessibility / forms / technical checklists. Releases are blocked until verified. Release action workflow is governed by GitHub Actions policy; do not modify .github/workflows without an explicit workflow change request.
