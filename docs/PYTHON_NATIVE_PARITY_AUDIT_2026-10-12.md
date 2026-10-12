# Deemix upstream + customized fork -> Python native source audit (2026-10-12)

**State:** v0.4.8 - Under construction ⚠️, **NOT parity-complete**, Windows/PySide6/live Deezer tests **NOT RUN**.

A fuller **179-row Markdown report** was created as the conversation artifact `Deemix Full Feature Parity Audit 2026-10-12.md`. This GitHub file is an independently useful checkpoint with exact source provenance, priorities and actionable missing-feature inventory; the detailed attachment also contains a per-key analysis of **all 54 main settings and 33 tag settings**. **Do not interpret a displayed setting or a syntax test as behavior parity.**

## Actual codebases compared

- [Original upstream](https://github.com/bambanah/deemix/tree/main), tree `61858706d6db1a6152d55add5029cec89c773360` - 387 blobs.
- [User's fork](https://github.com/karpuzikov/deemix/tree/main), tree `0255a3e6b3ac56dd66bb51eeb38a9170dc4614be` - 428 blobs.
- Current fork vs upstream: **320 same-blob files, 66 modified, 42 added and one deleted**. Previously documented merge-base/three-dot compare reported upstream-only commits; they still require merge review.
- Current native source `Deemix Python v0.4.7.pyw` (conversation artifact, not committed); patched `Deemix Python v0.4.8.pyw`, 162025 bytes, SHA-256 `9be6d8641b20531d929497b2defd8365144b5a33eaa9509de03761ed93ab3aa6`.
- The audit inspected **all 12 original views**, major UI components, all API route sources, original/fork core downloader, release generators, plugins, metadata/artwork/tagger/templates, Deezer SDK, settings, Electron integration, and the native .pyw AST/source. The *entire repository file inventory* was hash-compared. **This is not a claim that every line of all 294 fork source-code files has individually passed a semantic review or that runtime parity is proven.**

## P0 missing or not equivalent - functional engine

| Area | Missing or incomplete in native | Fork source |
|---|---|---|
| Spotify | Plugin for tracks, albums, playlists, OAuth token refresh, web playlist pagination, Spotify favorites | [spotify.ts](../packages/deemix/src/plugins/spotify.ts) |
| ListenBrainz | Playlist conversion plugin | [listenbrainz.ts](../packages/deemix/src/plugins/listenbrainz.ts) |
| Artist catalog | Deezer gateway grouped discography, main artist filtering and MusicBrainz barcode release discovery; naive flat public-API list instead | [generatePlaylistItem.ts](../packages/deemix/src/download-objects/generatePlaylistItem.ts), [musicbrainzReleaseDiscovery.ts](../packages/deemix/src/download-objects/musicbrainzReleaseDiscovery.ts) |
| Editions | Strict clean/explicit edition identity, preserve alternative/deluxe track lists; cross-queue exact variant comparisons | [releaseVariants.ts](../packages/deemix/src/download-objects/releaseVariants.ts) |
| Fallbacks | Bounded ISRC fallback/cache, MusicBrainz metadata/cache, complete LRCLIB normalized exact/search, controlled retry handling | [isrcCache.ts](../packages/deemix/src/utils/isrcCache.ts), [musicbrainzFallback.ts](../packages/deemix/src/utils/musicbrainzFallback.ts), [lyricsFallback.ts](../packages/deemix/src/utils/lyricsFallback.ts) |
| Formats | 360 Reality Audio HQ/MQ/LQ (codes 15,14,13), all alternate bitrate/fallback rules | [qualities.ts](../packages/webui/src/client/data/qualities.ts), [downloader.ts](../packages/deemix/src/downloader.ts) |
| Concurrency | `queueConcurrency` ignored by native single downloader worker | [downloader.ts](../packages/deemix/src/downloader.ts) |
| File templates | Native has 15 formatter names vs 25 original track token names, with only 13 in common. Missing: `%album_id%`, `%allartists%`, `%artist_id%`, `%artists%`, `%bpm%`, `%disctotal%`, `%featartists%`, `%genre%`, `%label%`, `%mainartists%`, `%playlist_id%`, `%position%`. Original specialized album/artist/playlist/M3U templates also missing tokens. | [file-templates.ts](../packages/webui/src/client/data/file-templates.ts), [pathtemplates.ts](../packages/deemix/src/utils/pathtemplates.ts) |
| Existing-file behavior | Original six overwrite modes y/n/e/b/t/l not implemented; no `createM3U8File`/playlist file name processing | [settings.ts](../packages/deemix/src/settings.ts) |
| Tagger | All-artists, track/disc totals, composer, artist credits, copyright, ReplayGain, ID3v1, rating, ID3 synced lyrics and other options unimplemented. Embedded artwork size/PNG separate controls ignored. | [tagger.ts](../packages/deemix/src/tagger.ts) |
| Credentials | Deezer child-account switching and full original Electron persisted queue/settings/login migration absent | [deemixApp.ts](../packages/webui/src/server/deemixApp.ts), [changeAccount.ts](../packages/webui/src/server/routes/api/post/changeAccount.ts) |
| Interrupted downloads | Native has staged album rollback and pause/stop/retry; no verified live-stream, Windows crash/ACL/disk-full tests. Artist batch queues children only *after* album enumeration; interruption can lose the new batch. | [deemixApp.ts](../packages/webui/src/server/deemixApp.ts), [downloader.ts](../packages/deemix/src/downloader.ts) |

## P1 missing or not equivalent - UI, navigation and queue

- **Right-click:** upstream/fork [TheContextMenu.vue](../packages/webui/src/client/components/globals/TheContextMenu.vue) provides `Copy Deezer link`, copy image URL, copy generic link, open folder and quality choices, based on queue [QueueItem.vue](../packages/webui/src/client/components/downloads/QueueItem.vue) link generation. Python v0.4.7 omitted Copy Deezer link. **v0.4.8 adds it**, including artist, album, playlist, track and artist-top links, and a Spotify legacy playlist link when identified. Static tests passed; actual Qt context/clipboard **NOT RUN**.
- **Download queue presentation:** original 75px cover artwork, explicit badge, per-item format tag, failed-track count and detailed error view, progress phases, collapsible/resizable/small download panel, slim layout, Ctrl+B panel shortcut absent or incomplete in native.
- **Search:** original gateway TOP_RESULT, paginated scrolling, album-specific search, play/pause preview, duration/details, link analyzer and multi-URL import not fully present. Native search is public Deezer API limited to 35 results per category; no original full search/paging.
- **Favorites/artist:** original Loved Tracks, Spotify playlists, download-all-for-type, grouped discography with tabs, sort and release-type filtering absent or partial; native flat artist album gallery is not equivalent.
- **Album/playlist:** track previews, Spotify playlists, album/artist detail fields, selective download and tab navigation partially ported.
- **Settings:** theme picker, locales, preview volume, slim/download sidebar preferences, Spotify OAuth settings, child accounts, template-variable helper absent; all 54 main and 33 tags are persisted as values, but many controls have no runtime effect.
- **About/ARL/Spotify help and error screens:** no feature-equivalent native views; original [router](../packages/webui/src/client/router/index.ts) and [12 views](../packages/webui/src/client/views/) are authoritative.
- **Original transport:** 20 GET + 9 POST endpoints; fork adds Spotify OAuth routes. A native desktop implementation need not expose an HTTP server, but must preserve underlying behaviors before being called equivalent.

## Explicit user-ordered differences (do not restore without request)

**Remove Discover and Charts UI**, do not expose a global Download Path in Settings, **remove Download top tracks as...**, and make every download use the mandatory **Download to...** folder chooser. Checkmark is SELECTION, not a second download action. These exceptions do not remove any other feature requirement.

## Settings-level audit: key omissions

Main keys with no corresponding operative functionality: `executeCommand`, `fallbackISRC`, `musicBrainzMetadataFallback`, `clearQueueOnExit`, `autoCheckForUpdates`, `feelingLucky`, `createStructurePlaylist`, `createSingleFolder`, `padTracks`, `paddingSize`, `illegalCharacterReplacer`, `queueConcurrency`, `fallbackBitrate`, `fallbackSearch`, `logErrors`, `logSearched`, `createM3U8File`, `playlistFilenameTemplate`, `embeddedArtworkSize`, `embeddedArtworkPNG`, `saveArtworkArtist`, `artistImageTemplate`, `albumVariousArtists`, `removeAlbumVersion`, `removeDuplicateArtists`, `tagsLanguage`, `featuredToTitle`, `titleCasing`, `artistCasing`. Other keys are partial or unverified; previous native implementation contains only a subset of effects.

Tag keys with no writing implementation: `artists`, `trackTotal`, `discTotal`, `year`, `explicit`, `length`, `replayGain`, `copyright`, `composer`, `involvedPeople`, `source`, `savePlaylistAsCompilation`, `useNullSeparator`, `saveID3v1`, `multiArtistSeparator`, `singleAlbumArtist`, `coverDescriptionUTF8`, `rating`. Remaining tag keys require per-field MP3/FLAC tests.

## Verification and gate

**Passed static/offline:** v0.4.8 syntax, eight link-generation cases, unchanged DeezerClient/QueueManager/NativeDownloader AST relative to v0.4.7; v0.4.7 synthetic FLAC album/tag/cover publication, rollback, safe cancel, incomplete stage recovery, MP3 cover tests and mock download-to flow.

**NOT RUN / blocks release:** PySide6 real Windows launch and screenshots, right-click on every queue column (including custom destination widget), clipboard, user-select hover, keyboard, spacing/padding/responsive/error-state QA; real authenticated Deezer streaming in all formats; Spotify/ListenBrainz; exact-quality/clean-vs-explicit behavior; permission/disk-full/crash and rollback safety; full settings/metadata QA; original CLI/API and cross-app queue migration.

**Repair order:** (1) safety/real streaming, (2) original/fork downloader+plugins and all settings/tags, (3) missing search/queue/artist UI behavior, (4) real Windows screenshot and interaction QA, (5) only then user acceptance. **Do not claim feature parity or a complete application until every blocker is closed.**
