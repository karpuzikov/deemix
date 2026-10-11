# Deemix upstream-to-fork audit (file-level inventory)

**Baseline:** `bambanah/deemix@main` vs `karpuzikov/deemix@main`, audited 2026-10-11 via GitHub compare API.

- Upstream base: `61858706d6db1a6152d55add5029cec89c773360`; common ancestor: `bb1110bfccac52277aff21626965a23cff86a6f5`.
- Branch status: **diverged; 76 commits ahead, 3 behind**. This is a fork delta, not a verified patch-by-patch code review of each changed function.
- **104 changed paths**, 5936 additions, 653 deletions compared with current upstream.
- For full content changes use `git fetch upstream` then `git diff --find-renames upstream/main...main` for fork-specific changes, or `git diff upstream/main main` for current tree differences. Preserve all upstream-only commits before claiming full parity. 

## Functionality requiring parity

1. Native Deezer authentication, protected Windows credential persistence and legacy migration; Express HTTP/session security and safe GUI navigation.
2. Full Deemix URL types (tracks, albums, playlists, artist/discography, UPC/ISRC, Deezer and convertible Spotify/ListenBrainz workflows where provided), metadata/lyrics, cover/tagging, MP3/FLAC and settings.
3. Explicit-first filtering across added batches and queued items; user-selected settings acknowledged and saved; bounded ISRC/native alternate lookups; exact-format all-track album preflight.
4. Native replacement must add durable Pause, Stop, Resume and remove errored queue entries; stopping mid-release must stage or provenance-track new files so existing media survives and incomplete attempts are cleaned, while completed releases persist.
5. Preserve web API, Electron, CLI, Docker and all existing upstream/fork paths. Any unimplemented native parity must be explicitly blocked from stable release.

## Every changed path

| Subsystem | Change | + | - | File |
|---|---|---:|---:|---|
| root | added | 6 | 0 | `.changeset/funny-pillows-rush.md` |
| root | added | 9 | 0 | `.changeset/nine-lions-enjoy.md` |
| root | added | 8 | 0 | `.changeset/quiet-codebase-hardening.md` |
| github | added | 146 | 0 | `.github/workflows/build-windows-gui.yml` |
| github | removed | 0 | 40 | `.github/workflows/create-release-or-publish.yml` |
| root | modified | 3 | 0 | `.gitignore` |
| root | modified | 1 | 1 | `Dockerfile` |
| root | modified | 32 | 9 | `README.md` |
| root | added | 339 | 0 | `SOFTWARE_RULES.md` |
| root | modified | 3 | 1 | `docker-compose.yml` |
| root | modified | 1 | 1 | `package.json` |
| cli | added | 21 | 0 | `packages/cli/CONTINUITY.md` |
| cli | modified | 1 | 1 | `packages/cli/package.json` |
| deemix | added | 104 | 0 | `packages/deemix/CONTINUITY.md` |
| deemix | modified | 1 | 1 | `packages/deemix/package.json` |
| deemix | modified | 8 | 0 | `packages/deemix/src/credentials.test.ts` |
| deemix | modified | 12 | 2 | `packages/deemix/src/credentials.ts` |
| deemix | modified | 2 | 3 | `packages/deemix/src/download-objects/Collection.ts` |
| deemix | modified | 8 | 2 | `packages/deemix/src/download-objects/DownloadObject.ts` |
| deemix | added | 37 | 0 | `packages/deemix/src/download-objects/generateAlbumItem.test.ts` |
| deemix | modified | 150 | 33 | `packages/deemix/src/download-objects/generateAlbumItem.ts` |
| deemix | modified | 184 | 31 | `packages/deemix/src/download-objects/generatePlaylistItem.ts` |
| deemix | added | 36 | 0 | `packages/deemix/src/download-objects/musicbrainzReleaseDiscovery.test.ts` |
| deemix | added | 189 | 0 | `packages/deemix/src/download-objects/musicbrainzReleaseDiscovery.ts` |
| deemix | added | 363 | 0 | `packages/deemix/src/download-objects/releaseVariants.test.ts` |
| deemix | added | 314 | 0 | `packages/deemix/src/download-objects/releaseVariants.ts` |
| deemix | modified | 58 | 0 | `packages/deemix/src/downloader.test.ts` |
| deemix | modified | 559 | 54 | `packages/deemix/src/downloader.ts` |
| deemix | modified | 3 | 2 | `packages/deemix/src/index.ts` |
| deemix | modified | 4 | 0 | `packages/deemix/src/plugins/index.ts` |
| deemix | added | 253 | 0 | `packages/deemix/src/plugins/listenbrainz.ts` |
| deemix | modified | 354 | 62 | `packages/deemix/src/plugins/spotify.ts` |
| deemix | added | 17 | 0 | `packages/deemix/src/plugins/types.test.ts` |
| deemix | added | 26 | 0 | `packages/deemix/src/plugins/types.ts` |
| deemix | modified | 3 | 0 | `packages/deemix/src/settings.ts` |
| deemix | modified | 3 | 0 | `packages/deemix/src/types/Settings.ts` |
| deemix | modified | 1 | 1 | `packages/deemix/src/utils/core.ts` |
| deemix | added | 39 | 0 | `packages/deemix/src/utils/fallbackTimeout.test.ts` |
| deemix | added | 23 | 0 | `packages/deemix/src/utils/fallbackTimeout.ts` |
| deemix | modified | 29 | 18 | `packages/deemix/src/utils/getPreferredBitrate.ts` |
| deemix | added | 28 | 0 | `packages/deemix/src/utils/isrcCache.test.ts` |
| deemix | added | 113 | 0 | `packages/deemix/src/utils/isrcCache.ts` |
| deemix | modified | 41 | 6 | `packages/deemix/src/utils/localpaths.ts` |
| deemix | added | 8 | 0 | `packages/deemix/src/utils/lyricsFallback.test.ts` |
| deemix | added | 133 | 0 | `packages/deemix/src/utils/lyricsFallback.ts` |
| deemix | added | 10 | 0 | `packages/deemix/src/utils/musicbrainzFallback.test.ts` |
| deemix | added | 183 | 0 | `packages/deemix/src/utils/musicbrainzFallback.ts` |
| deemix | added | 12 | 0 | `packages/deemix/src/utils/musicbrainzHttp.test.ts` |
| deemix | added | 48 | 0 | `packages/deemix/src/utils/musicbrainzHttp.ts` |
| deemix | added | 28 | 0 | `packages/deemix/src/utils/protectedStorage.ts` |
| deezer-sdk | added | 22 | 0 | `packages/deezer-sdk/CONTINUITY.md` |
| deezer-sdk | modified | 130 | 21 | `packages/deezer-sdk/src/api.ts` |
| deezer-sdk | modified | 69 | 30 | `packages/deezer-sdk/src/gw.ts` |
| deezer-sdk | added | 40 | 0 | `packages/deezer-sdk/src/retry.test.ts` |
| deezer-sdk | added | 52 | 0 | `packages/deezer-sdk/src/retry.ts` |
| deezer-sdk | modified | 54 | 0 | `packages/deezer-sdk/src/utils.ts` |
| gui | added | 130 | 0 | `packages/gui/CONTINUITY.md` |
| gui | modified | 27 | 1 | `packages/gui/forge.config.js` |
| gui | modified | 2 | 2 | `packages/gui/package.json` |
| gui | modified | 4 | 1 | `packages/gui/scripts/build.js` |
| gui | modified | 76 | 9 | `packages/gui/src/main.ts` |
| gui | modified | 12 | 1 | `packages/gui/src/preload.ts` |
| webui | added | 120 | 0 | `packages/webui/CONTINUITY.md` |
| webui | modified | 1 | 1 | `packages/webui/package.json` |
| webui | modified | 5 | 3 | `packages/webui/src/client/components/ThemePicker.vue` |
| webui | modified | 7 | 1 | `packages/webui/src/client/components/downloads/QueueItem.vue` |
| webui | modified | 15 | 0 | `packages/webui/src/client/components/downloads/TheDownloadBar.vue` |
| webui | modified | 42 | 19 | `packages/webui/src/client/components/globals/CoverContainer.vue` |
| webui | modified | 36 | 3 | `packages/webui/src/client/components/globals/TheContextMenu.vue` |
| webui | modified | 1 | 1 | `packages/webui/src/client/components/search/ResultsArtists.vue` |
| webui | modified | 22 | 12 | `packages/webui/src/client/components/search/ResultsTracks.vue` |
| webui | modified | 5 | 1 | `packages/webui/src/client/components/search/TopResult.vue` |
| webui | modified | 10 | 1 | `packages/webui/src/client/data/settings.ts` |
| webui | modified | 1 | 0 | `packages/webui/src/client/electron-window.d.ts` |
| webui | modified | 9 | 0 | `packages/webui/src/client/lang/en.mjs` |
| webui | modified | 5 | 0 | `packages/webui/src/client/lang/ru.mjs` |
| webui | modified | 5 | 1 | `packages/webui/src/client/main.ts` |
| webui | modified | 9 | 4 | `packages/webui/src/client/stores/login.ts` |
| webui | added | 28 | 0 | `packages/webui/src/client/tests/unit/data/settings.test.ts` |
| webui | modified | 0 | 24 | `packages/webui/src/client/use/theme.ts` |
| webui | modified | 14 | 0 | `packages/webui/src/client/utils/downloads.ts` |
| webui | modified | 2 | 1 | `packages/webui/src/client/utils/utils.ts` |
| webui | modified | 51 | 33 | `packages/webui/src/client/views/ArtistView.vue` |
| webui | modified | 22 | 14 | `packages/webui/src/client/views/ChartsView.vue` |
| webui | modified | 20 | 12 | `packages/webui/src/client/views/FavoritesView.vue` |
| webui | modified | 160 | 41 | `packages/webui/src/client/views/SettingsPage.vue` |
| webui | modified | 21 | 1 | `packages/webui/src/client/views/TracklistView.vue` |
| webui | modified | 291 | 121 | `packages/webui/src/server/deemixApp.ts` |
| webui | added | 18 | 0 | `packages/webui/src/server/helpers/spotifyRedirectUri.ts` |
| webui | modified | 43 | 5 | `packages/webui/src/server/main.ts` |
| webui | modified | 4 | 0 | `packages/webui/src/server/routes/api/get/index.ts` |
| webui | added | 28 | 0 | `packages/webui/src/server/routes/api/get/spotifyCallback.ts` |
| webui | added | 24 | 0 | `packages/webui/src/server/routes/api/get/spotifyLogin.ts` |
| webui | modified | 2 | 0 | `packages/webui/src/server/routes/api/post/index.ts` |
| webui | modified | 5 | 0 | `packages/webui/src/server/routes/api/post/loginArl.ts` |
| webui | added | 150 | 0 | `packages/webui/src/server/routes/api/post/loginSession.test.ts` |
| webui | added | 31 | 0 | `packages/webui/src/server/routes/api/post/saveSettings.test.ts` |
| webui | modified | 16 | 9 | `packages/webui/src/server/routes/api/post/saveSettings.ts` |
| webui | added | 15 | 0 | `packages/webui/src/server/routes/api/post/spotifyLogout.ts` |
| webui | added | 31 | 0 | `packages/webui/src/server/security.test.ts` |
| webui | added | 68 | 0 | `packages/webui/src/server/security.ts` |
| webui | modified | 8 | 1 | `packages/webui/src/server/websocket/index.ts` |
| webui | modified | 18 | 10 | `packages/webui/src/server/websocket/modules/saveSettings.ts` |
| root | modified | 1 | 1 | `pnpm-lock.yaml` |

## Source-validation status

- The complete **file-level** comparison was retrieved from GitHub; the major behavioral changes above are substantiated by the current three continuity files and selected source review. This document does **not** imply that every changed function has been semantically verified.
- Existing v0.5.7 Electron build remains the reference. The Python-native port is a separate **under-construction** implementation; core behavior must be exercised with a real authenticated Windows environment before parity can be declared.
- Before release: perform both two-dot and three-dot diffs with the original repository, inspect upstream-only commits, feature-by-feature pass/fail tests, Windows real Deezer streaming, restart and interrupted-write cleanup, UI accessibility and persistent settings migration.
- No `.github/workflows/` modifications are authorized.
