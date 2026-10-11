# Deemix upstream-to-fork change inventory

Source: [upstream](https://github.com/bambanah/deemix) `main` (61858706d6db1a6152d55add5029cec89c773360) vs [user fork](https://github.com/karpuzikov/deemix) `main` (59e3e4867aff385759ddd499de530e0b4f064845). Snapshot: 2026-10-11.

**GitHub compare:** https://github.com/bambanah/deemix/compare/main...karpuzikov:main

Commits ahead: **75**; behind: **3**; changed files: **104**; additions: **5894**, deletions: **653**. This is a net code-diff, not an accounting of every previous implementation or abandoned experiment. Upstream contains three newer independent commits. No upstream updates merged in this inventory.

## User-facing changes

- Windows packaging: standalone versioned builds, Electron startup and persistent DPAPI-protected authentication, Windows-safe paths and startup checks.
- Download generation: strict whole-album selected-quality preflight; alternative edition/track deduplication and explicit-over-clean preference across queued requests; extended artist discography, album metadata, UPC and MusicBrainz release discovery.
- ISRC/bitrate: per-track ISRC cache, exact ISRC validation, bounded fallback search, request timeouts and cycle protection; album strict preflight.
- Metadata: LRCLIB fallback lyrics, MusicBrainz genres/label fallback, shared cache and strengthened HTTP retry handling.
- Integrations: Spotify auth / playlist import improvements, ListenBrainz, multi-account and queued release support.
- Interface: dark visual fixes, search results and artist/release browser changes, richer settings, runtime feedback and version.
- Security: loopback binding by default, remote access protection, session cookie/security protections, persistence and credentials.

## Explicitly not implemented yet in the fork at this snapshot

- A user-visible queue Pause / Stop and Resume lifecycle, including atomic deletion of files newly created during an interrupted release.
- A dedicated Remove downloads with errors bulk action.
- A lightweight native .pyw frontend; upstream and fork currently ship TS/WebUI/Electron.

## Complete changed-file list (generated from GitHub compare)

### .changeset (3 files)

| Path | Change | + | - |
|---|---|---:|---:|
| `.changeset/funny-pillows-rush.md` | added | 6 | 0 |
| `.changeset/nine-lions-enjoy.md` | added | 9 | 0 |
| `.changeset/quiet-codebase-hardening.md` | added | 8 | 0 |

### .github (2 files)

| Path | Change | + | - |
|---|---|---:|---:|
| `.github/workflows/build-windows-gui.yml` | added | 146 | 0 |
| `.github/workflows/create-release-or-publish.yml` | removed | 0 | 40 |

### .gitignore (1 files)

| Path | Change | + | - |
|---|---|---:|---:|
| `.gitignore` | modified | 3 | 0 |

### Dockerfile (1 files)

| Path | Change | + | - |
|---|---|---:|---:|
| `Dockerfile` | modified | 1 | 1 |

### README.md (1 files)

| Path | Change | + | - |
|---|---|---:|---:|
| `README.md` | modified | 32 | 9 |

### SOFTWARE_RULES.md (1 files)

| Path | Change | + | - |
|---|---|---:|---:|
| `SOFTWARE_RULES.md` | added | 339 | 0 |

### docker-compose.yml (1 files)

| Path | Change | + | - |
|---|---|---:|---:|
| `docker-compose.yml` | modified | 3 | 1 |

### package.json (1 files)

| Path | Change | + | - |
|---|---|---:|---:|
| `package.json` | modified | 1 | 1 |

### packages/cli (2 files)

| Path | Change | + | - |
|---|---|---:|---:|
| `packages/cli/CONTINUITY.md` | added | 21 | 0 |
| `packages/cli/package.json` | modified | 1 | 1 |

### packages/deemix (37 files)

| Path | Change | + | - |
|---|---|---:|---:|
| `packages/deemix/CONTINUITY.md` | added | 90 | 0 |
| `packages/deemix/package.json` | modified | 1 | 1 |
| `packages/deemix/src/credentials.test.ts` | modified | 8 | 0 |
| `packages/deemix/src/credentials.ts` | modified | 12 | 2 |
| `packages/deemix/src/download-objects/Collection.ts` | modified | 2 | 3 |
| `packages/deemix/src/download-objects/DownloadObject.ts` | modified | 8 | 2 |
| `packages/deemix/src/download-objects/generateAlbumItem.test.ts` | added | 37 | 0 |
| `packages/deemix/src/download-objects/generateAlbumItem.ts` | modified | 150 | 33 |
| `packages/deemix/src/download-objects/generatePlaylistItem.ts` | modified | 184 | 31 |
| `packages/deemix/src/download-objects/musicbrainzReleaseDiscovery.test.ts` | added | 36 | 0 |
| `packages/deemix/src/download-objects/musicbrainzReleaseDiscovery.ts` | added | 189 | 0 |
| `packages/deemix/src/download-objects/releaseVariants.test.ts` | added | 363 | 0 |
| `packages/deemix/src/download-objects/releaseVariants.ts` | added | 314 | 0 |
| `packages/deemix/src/downloader.test.ts` | modified | 58 | 0 |
| `packages/deemix/src/downloader.ts` | modified | 559 | 54 |
| `packages/deemix/src/index.ts` | modified | 3 | 2 |
| `packages/deemix/src/plugins/index.ts` | modified | 4 | 0 |
| `packages/deemix/src/plugins/listenbrainz.ts` | added | 253 | 0 |
| `packages/deemix/src/plugins/spotify.ts` | modified | 354 | 62 |
| `packages/deemix/src/plugins/types.test.ts` | added | 17 | 0 |
| `packages/deemix/src/plugins/types.ts` | added | 26 | 0 |
| `packages/deemix/src/settings.ts` | modified | 3 | 0 |
| `packages/deemix/src/types/Settings.ts` | modified | 3 | 0 |
| `packages/deemix/src/utils/core.ts` | modified | 1 | 1 |
| `packages/deemix/src/utils/fallbackTimeout.test.ts` | added | 39 | 0 |
| `packages/deemix/src/utils/fallbackTimeout.ts` | added | 23 | 0 |
| `packages/deemix/src/utils/getPreferredBitrate.ts` | modified | 29 | 18 |
| `packages/deemix/src/utils/isrcCache.test.ts` | added | 28 | 0 |
| `packages/deemix/src/utils/isrcCache.ts` | added | 113 | 0 |
| `packages/deemix/src/utils/localpaths.ts` | modified | 41 | 6 |
| `packages/deemix/src/utils/lyricsFallback.test.ts` | added | 8 | 0 |
| `packages/deemix/src/utils/lyricsFallback.ts` | added | 133 | 0 |
| `packages/deemix/src/utils/musicbrainzFallback.test.ts` | added | 10 | 0 |
| `packages/deemix/src/utils/musicbrainzFallback.ts` | added | 183 | 0 |
| `packages/deemix/src/utils/musicbrainzHttp.test.ts` | added | 12 | 0 |
| `packages/deemix/src/utils/musicbrainzHttp.ts` | added | 48 | 0 |
| `packages/deemix/src/utils/protectedStorage.ts` | added | 28 | 0 |

### packages/deezer-sdk (6 files)

| Path | Change | + | - |
|---|---|---:|---:|
| `packages/deezer-sdk/CONTINUITY.md` | added | 22 | 0 |
| `packages/deezer-sdk/src/api.ts` | modified | 130 | 21 |
| `packages/deezer-sdk/src/gw.ts` | modified | 69 | 30 |
| `packages/deezer-sdk/src/retry.test.ts` | added | 40 | 0 |
| `packages/deezer-sdk/src/retry.ts` | added | 52 | 0 |
| `packages/deezer-sdk/src/utils.ts` | modified | 54 | 0 |

### packages/gui (6 files)

| Path | Change | + | - |
|---|---|---:|---:|
| `packages/gui/CONTINUITY.md` | added | 116 | 0 |
| `packages/gui/forge.config.js` | modified | 27 | 1 |
| `packages/gui/package.json` | modified | 2 | 2 |
| `packages/gui/scripts/build.js` | modified | 4 | 1 |
| `packages/gui/src/main.ts` | modified | 76 | 9 |
| `packages/gui/src/preload.ts` | modified | 12 | 1 |

### packages/webui (41 files)

| Path | Change | + | - |
|---|---|---:|---:|
| `packages/webui/CONTINUITY.md` | added | 106 | 0 |
| `packages/webui/package.json` | modified | 1 | 1 |
| `packages/webui/src/client/components/ThemePicker.vue` | modified | 5 | 3 |
| `packages/webui/src/client/components/downloads/QueueItem.vue` | modified | 7 | 1 |
| `packages/webui/src/client/components/downloads/TheDownloadBar.vue` | modified | 15 | 0 |
| `packages/webui/src/client/components/globals/CoverContainer.vue` | modified | 42 | 19 |
| `packages/webui/src/client/components/globals/TheContextMenu.vue` | modified | 36 | 3 |
| `packages/webui/src/client/components/search/ResultsArtists.vue` | modified | 1 | 1 |
| `packages/webui/src/client/components/search/ResultsTracks.vue` | modified | 22 | 12 |
| `packages/webui/src/client/components/search/TopResult.vue` | modified | 5 | 1 |
| `packages/webui/src/client/data/settings.ts` | modified | 10 | 1 |
| `packages/webui/src/client/electron-window.d.ts` | modified | 1 | 0 |
| `packages/webui/src/client/lang/en.mjs` | modified | 9 | 0 |
| `packages/webui/src/client/lang/ru.mjs` | modified | 5 | 0 |
| `packages/webui/src/client/main.ts` | modified | 5 | 1 |
| `packages/webui/src/client/stores/login.ts` | modified | 9 | 4 |
| `packages/webui/src/client/tests/unit/data/settings.test.ts` | added | 28 | 0 |
| `packages/webui/src/client/use/theme.ts` | modified | 0 | 24 |
| `packages/webui/src/client/utils/downloads.ts` | modified | 14 | 0 |
| `packages/webui/src/client/utils/utils.ts` | modified | 2 | 1 |
| `packages/webui/src/client/views/ArtistView.vue` | modified | 51 | 33 |
| `packages/webui/src/client/views/ChartsView.vue` | modified | 22 | 14 |
| `packages/webui/src/client/views/FavoritesView.vue` | modified | 20 | 12 |
| `packages/webui/src/client/views/SettingsPage.vue` | modified | 160 | 41 |
| `packages/webui/src/client/views/TracklistView.vue` | modified | 21 | 1 |
| `packages/webui/src/server/deemixApp.ts` | modified | 291 | 121 |
| `packages/webui/src/server/helpers/spotifyRedirectUri.ts` | added | 18 | 0 |
| `packages/webui/src/server/main.ts` | modified | 43 | 5 |
| `packages/webui/src/server/routes/api/get/index.ts` | modified | 4 | 0 |
| `packages/webui/src/server/routes/api/get/spotifyCallback.ts` | added | 28 | 0 |
| `packages/webui/src/server/routes/api/get/spotifyLogin.ts` | added | 24 | 0 |
| `packages/webui/src/server/routes/api/post/index.ts` | modified | 2 | 0 |
| `packages/webui/src/server/routes/api/post/loginArl.ts` | modified | 5 | 0 |
| `packages/webui/src/server/routes/api/post/loginSession.test.ts` | added | 150 | 0 |
| `packages/webui/src/server/routes/api/post/saveSettings.test.ts` | added | 31 | 0 |
| `packages/webui/src/server/routes/api/post/saveSettings.ts` | modified | 16 | 9 |
| `packages/webui/src/server/routes/api/post/spotifyLogout.ts` | added | 15 | 0 |
| `packages/webui/src/server/security.test.ts` | added | 31 | 0 |
| `packages/webui/src/server/security.ts` | added | 68 | 0 |
| `packages/webui/src/server/websocket/index.ts` | modified | 8 | 1 |
| `packages/webui/src/server/websocket/modules/saveSettings.ts` | modified | 18 | 10 |

### pnpm-lock.yaml (1 files)

| Path | Change | + | - |
|---|---|---:|---:|
| `pnpm-lock.yaml` | modified | 1 | 1 |


### Relationship to original

The upstream code is TypeScript/Node, Express/Vue, and Electron. A native Python controller can avoid the Electron UI and call its existing backend. That preserves the original engine, but it **does not** make the entire downloaded runtime pure Python or zero-dependency. Python reimplementation of the complete decoder, tagging, auth, Deezer SDK and plugin UI has not been completed or verified. See README in lightweight subdirectory for backend requirements and feature boundaries.
