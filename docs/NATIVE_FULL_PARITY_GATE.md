# Mandatory original + fork native feature parity gate

Audited source baseline: 2026-10-11; original `bambanah/deemix`, fork `karpuzikov/deemix`. A **different UI is allowed, but loss of even one original or custom feature is not**. Do not publish a replacement with only partial UI, CLI shelling, missing settings or search. No placeholder controls or cosmetic feature mocks.

## Machine-verifiable source inventory

[PARITY_SOURCE_MANIFEST.json](./PARITY_SOURCE_MANIFEST.json) contains **all 387 original files and all 426 fork files**, with corresponding Git blob SHA. The [change inventory](./UPSTREAM_FORK_AUDIT.md) tracks 104 changed paths (+5,936/-653 lines). Unlike a handwritten recollection, this baseline can be compared mechanically with each new implementation. **Filename preservation alone is not feature-parity testing**; behavioral tests must still pass.

## Original Deemix application screens (12)

- `packages/webui/src/client/views/AboutView.vue`
- `packages/webui/src/client/views/ArtistView.vue`
- `packages/webui/src/client/views/ChartsView.vue`
- `packages/webui/src/client/views/ErrorsView.vue`
- `packages/webui/src/client/views/FavoritesView.vue`
- `packages/webui/src/client/views/HomeView.vue`
- `packages/webui/src/client/views/InfoArl.vue`
- `packages/webui/src/client/views/InfoSpotifyFeatures.vue`
- `packages/webui/src/client/views/LinkAnalyzer.vue`
- `packages/webui/src/client/views/SearchView.vue`
- `packages/webui/src/client/views/SettingsPage.vue`
- `packages/webui/src/client/views/TracklistView.vue`

## Original Deemix web API endpoints (29)

- `packages/webui/src/server/routes/api/get/albumSearch.ts`
- `packages/webui/src/server/routes/api/get/analyzeLink.ts`
- `packages/webui/src/server/routes/api/get/checkForUpdates.ts`
- `packages/webui/src/server/routes/api/get/connect.ts`
- `packages/webui/src/server/routes/api/get/getChartTracks.ts`
- `packages/webui/src/server/routes/api/get/getCharts.ts`
- `packages/webui/src/server/routes/api/get/getHome.ts`
- `packages/webui/src/server/routes/api/get/getQueue.ts`
- `packages/webui/src/server/routes/api/get/getSettings.ts`
- `packages/webui/src/server/routes/api/get/getTracklist.ts`
- `packages/webui/src/server/routes/api/get/getUserAlbums.ts`
- `packages/webui/src/server/routes/api/get/getUserArtists.ts`
- `packages/webui/src/server/routes/api/get/getUserFavorites.ts`
- `packages/webui/src/server/routes/api/get/getUserPlaylists.ts`
- `packages/webui/src/server/routes/api/get/getUserSpotifyPlaylists.ts`
- `packages/webui/src/server/routes/api/get/getUserTracks.ts`
- `packages/webui/src/server/routes/api/get/mainSearch.ts`
- `packages/webui/src/server/routes/api/get/newReleases.ts`
- `packages/webui/src/server/routes/api/get/search.ts`
- `packages/webui/src/server/routes/api/get/spotifyStatus.ts`
- `packages/webui/src/server/routes/api/post/addToQueue.ts`
- `packages/webui/src/server/routes/api/post/cancelAllDownloads.ts`
- `packages/webui/src/server/routes/api/post/changeAccount.ts`
- `packages/webui/src/server/routes/api/post/loginArl.ts`
- `packages/webui/src/server/routes/api/post/logout.ts`
- `packages/webui/src/server/routes/api/post/removeFinishedDownloads.ts`
- `packages/webui/src/server/routes/api/post/removeFromQueue.ts`
- `packages/webui/src/server/routes/api/post/retryDownload.ts`
- `packages/webui/src/server/routes/api/post/saveSettings.ts`

## Original core plugins (3)

- `packages/deemix/src/plugins/base.ts`
- `packages/deemix/src/plugins/index.ts`
- `packages/deemix/src/plugins/spotify.ts`

## Every current fork setting: 54 settings + 33 tag fields

**Main setting keys:** `tags`, `executeCommand`, `downloadLocation`, `padSingleDigit`, `fallbackISRC`, `dontDownloadIncompleteReleases`, `skipCleanIfExplicitAvailable`, `musicBrainzMetadataFallback`, `clearQueueOnExit`, `autoCheckForUpdates`, `feelingLucky`, `tracknameTemplate`, `albumTracknameTemplate`, `playlistTracknameTemplate`, `createPlaylistFolder`, `playlistNameTemplate`, `createArtistFolder`, `artistNameTemplate`, `createAlbumFolder`, `albumNameTemplate`, `createCDFolder`, `createStructurePlaylist`, `createSingleFolder`, `padTracks`, `paddingSize`, `illegalCharacterReplacer`, `queueConcurrency`, `maxBitrate`, `fallbackBitrate`, `fallbackSearch`, `logErrors`, `logSearched`, `saveDownloadQueue`, `overwriteFile`, `createM3U8File`, `playlistFilenameTemplate`, `syncedLyrics`, `embeddedArtworkSize`, `embeddedArtworkPNG`, `localArtworkSize`, `localArtworkFormat`, `saveArtwork`, `coverImageTemplate`, `saveArtworkArtist`, `artistImageTemplate`, `jpegImageQuality`, `dateFormat`, `albumVariousArtists`, `removeAlbumVersion`, `removeDuplicateArtists`, `tagsLanguage`, `featuredToTitle`, `titleCasing`, `artistCasing`.

**Tag setting keys:** `title`, `artist`, `artists`, `album`, `cover`, `trackNumber`, `trackTotal`, `discNumber`, `discTotal`, `albumArtist`, `genre`, `year`, `date`, `explicit`, `isrc`, `length`, `barcode`, `bpm`, `replayGain`, `label`, `lyrics`, `syncedLyrics`, `copyright`, `composer`, `involvedPeople`, `source`, `savePlaylistAsCompilation`, `useNullSeparator`, `saveID3v1`, `multiArtistSeparator`, `singleAlbumArtist`, `coverDescriptionUTF8`, `rating`.

A replacement must map each setting to an operable control and preserve its persisted behavior, accepted values and dependencies; preserving only a settings JSON file is insufficient.

## Custom fork behavior is additive (not a substitute for original behavior)

- Protected DPAPI Windows login and migration of existing credentials/config; compatible desktop session restoration.
- Download-location migration into `Documents/Karpuzikov Tools/Deemix` and per-application data isolation.
- Deezer gateway and UPC/ISRC release identity correctness, MusicBrainz/LRCLIB and additional lyrics/metadata enrichment.
- Spotify and ListenBrainz integration with secure OAuth/session flow.
- Artist-discography main-artist filtering, explicit-first clean duplicate exclusion (opt-in), and distinct editions preserved.
- Bounded ISRC fallback and fail-closed exact-quality album preflight, without changing stream duration limits.
- Original search, navigation, charts, favorites, playlist/album/artist displays, tags, artwork, save templates, MP3/FLAC, advanced options, API/CLI capabilities and error handling remain available.
- NEW request: persistent Pause, Stop, Resume of queue entries across restart/update, preserve artist batches, stop cleans only app-owned incomplete release files, remove downloads with errors (queue entries only), release-level transactional output and crash recovery.

## Acceptance gates

1. Build a testable behavior contract and actual regression test for **each original screen/route/setting/plugin**, not just matching visual labels.
2. Test custom changes against the exact fork behavior and known live Deezer fixtures. Any new behavior must not delete an older feature.
3. Confirm user data compatibility across Electron v0.5.7 -> native, including protected credentials, saved settings and existing queue; keep original application installed and unchanged.
4. Test complete artist discography, album/playlist/track, search and library, metadata/lyrics, Spotify and all output formats on Windows with authenticated session and sample data.
5. Verify Pause/Stop/Resume with active workers, process exit, update, canceled stream, disk full, permission error, duplicate paths, partial album and post-crash state. No existing user music may be deleted by cleanup.
6. Perform UI access/keyboard/responsiveness and performance checks using UXDT guidance.
7. Keep `Under construction ⚠️` until all checks and user acceptance. Do not distribute an experimental prototype as the replacement.

**Current status:** Native replacement NOT implemented to this contract. The earlier Tk prototype is rejected and must not be reused as the architecture. No functionality is waived because the UI is different. Existing Electron v0.5.7 is preserved.
