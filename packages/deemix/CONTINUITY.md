# Deemix core continuity

Purpose: TypeScript Deezer download engine, queue/download behavior, track metadata, MusicBrainz / LRCLIB fallbacks, Spotify and ListenBrainz plugins.
Version: 3.14.0. Source: packages/deemix/src; tests: packages/deemix/src/**/*.test.ts. Data: OS config folder (APPDATA/deemix on Windows unless DEEMIX_DATA_DIR set), persisted queues/settings/caches and login. Music output getMusicFolder or DEEMIX_MUSIC_DIR.

Critical behavior: keep requested release UPC/title/track listing when Deezer gateway redirects playback; only main-artist albums in full discography; preserve distinct UPC editions; use ISRC exact matching before substituting tracks; respect bitrate license and download fallback settings. MusicBrainz 503 retries must continue until non-503, with Retry-After and throttling. Avoid metadata guessing across unrelated releases.

Development checkpoint: 2026-10-08. Branch: `deemix-hardening-2026-10-08` (not released). Status: Under construction ⚠️. The entire monorepo must follow root SOFTWARE_RULES.md (mirrored exactly from karpuzikov/userscripts); refer to that file for security, UI/UX, artifact naming, version, state retention, and release gates. Do not publish until lint, typecheck, tests, build, smoke test and UXDT review pass on supported platforms.

Preserve existing functionality: Deezer downloading, FLAC/MP3, tagged tracks and art, artist discography, UPC and ISRC lookup, release metadata, MusicBrainz fallback, Spotify and ListenBrainz integrations, lyrics, queue persistence, CLI, web interface, and desktop GUI. Changes should be in-place patches, not rewrites.

Known pre-review risks: remote HTTP/WebSocket operations exposed without proper authentication, tokens persisted in plaintext, Electron external-link validation, TLS verification disabled in selected requests, retry recursion, UPC lookup races, metadata release mismatch, stale release asset and status/version mismatch. Previous source audit did not run tests. Local runtime does not have access to GitHub/node dependencies; do not claim tests pass without actual test runs.

No project-specific RULES.md was found in the 2026-10-08 tree; root SOFTWARE_RULES.md applies. UXDT reference: https://www.uxdt.nic.in/guidelines/, specifically accessibility / forms / technical checklists. Releases are blocked until verified. Release action workflow is governed by GitHub Actions policy; do not modify .github/workflows without an explicit workflow change request.

## Latest hardening checkpoint

Current implementation: v3.14.1 - Under construction ⚠️. Deemix SDK TLS bypasses removed; bitrate probe timeouts and max three attempts; UPC lookup sequential to avoid concurrent overwrite; MusicBrainz transport shared 503 unlimited retry with 1100 ms throttling / Retry-After; strict release-title and artist match for fallback; main-artist discography restrictions; oauthState required; shell command hooks disabled except when DEEMIX_ALLOW_POST_DOWNLOAD_COMMANDS=true. Per-package tests exist for MB retry and baseline features. Credential file mode 0600 on POSIX; plaintext Windows/Browser storage remains an important hardening blocker. Do not claim all quality/fallback edge cases tested without reproducible Deezer account integration tests.

Next action: inspect PR #2 lint, type-check and build checks, fix all failures, then run Windows desktop/Docker manual smoke tests. Keep draft and do not merge until all release blockers in root SOFTWARE_RULES.md are met.
