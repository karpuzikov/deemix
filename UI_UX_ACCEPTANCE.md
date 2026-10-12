# UI/UX Acceptance Register

**Policy:** [UI_UX_RULES.md](UI_UX_RULES.md) and [SOFTWARE_RULES.md](SOFTWARE_RULES.md) are mandatory for every user-facing screen, panel, modal, widget, context menu, installer, browser toolbar, and interactive console prompt in this repository.

**Status as of 2026-10-12:** **NOT VERIFIED - Under construction ⚠️ for UI acceptance.** This is a documentation and source-inventory checkpoint, NOT a claim that existing applications have been retested or that published stable version labels were changed. No Windows/browser interactive visual run or reference-screenshot comparison has been performed in this audit. Existing stable releases are not silently altered.

Before ANY UI modification, record a control contract for the affected workflows: **control name/ID, unique purpose, click/right-click/hover/keyboard behavior, selection, side effects, persisted data, cancel/error handling, disabled/focus/active states, icon and target geometry**. Eliminate duplicate actions; share design tokens/components.

### Required acceptance process for EACH UI application

1. Run **the actual application**, on its target OS/browser/Picard host, with its real GUI renderer (not mocks).
2. Screenshot each screen and critical state, using at least minimum/default/large viewport and relevant DPI scaling; record image paths and viewport.
3. Compare screenshots to named reference/source UI. Check content hierarchy, alignment, 4px-based spacing, sizing, icon strokes, buttons, image loading, scroll/overlay, accessible labels, and platform expectations.
4. Click/hover/right-click every control; test tab/Enter/Space/Escape, selection/multi-select, focus, resize, scroll, navigation, settings persistence, confirmation/cancel and failure recovery.
5. Include representative end-to-end tasks, empty/large data, missing images/network, interrupted processing, and safe restart. Test any file-changing/destructive action against disposable fixtures.
6. Record **PASS / FAIL / NOT RUN** separately for real rendering, interaction, reference comparison and workflow validation; never equate syntax tests or mocked widgets with a real PASS. Fix all FAIL, complete all NOT RUN before marking UI verified.

| Universal acceptance gate | Status |
| --- | --- |
| UI rules present and required before implementation | PASS - repository-level rule installed |
| Control-by-control inventory and no duplicate actions | NOT RUN |
| Real UI launch with screenshots and reference comparison | NOT RUN |
| Hover, click, keyboard, selection, scroll, resize | NOT RUN |
| Error, cancellation, persistence, restart, recovery | NOT RUN |
| Real host/OS end-to-end workflow and final acceptance | NOT RUN |

## Application: Deemix v0.5.8 Electron/Vue desktop UI

**Production source of truth:** [Deemix v0.5.8 Electron release](https://github.com/karpuzikov/deemix/releases/tag/windows-latest), build commit `04e2dbe89c68abc34f3f5c647081528d869726a3`. Download asset: `Deemix.v0.5.8.exe`. The former v0.5.7 release remains in git history. The only supported development target in the repository is the original Electron/TypeScript Deemix (Vue web UI + Deemix core + Deezer SDK). Do not reintroduce the abandoned Python-native experiment without an explicit new user request.

**UI source:** `packages/webui/src/client/` (search, queue, settings, album, artist, playlist and favorites, previews, context menus, navigation, account/login, errors) and `packages/gui/` (Electron host and window/IPC integration). Keep existing Deezer and Spotify/ListenBrainz behavior, custom fork modifications and all existing settings.

### Required UI control contracts and acceptance

- Queue: every existing action must have one distinct effect; preserve right-click **Copy Deezer link**, open folder, image/link copying, per-item status and error display, progress, retry, cancel, remove, clear finished, cover artwork, bitrate/explicit badges and track count.
- Search, artists, album/playlist and Favorites: source-native search filters/pagination, artwork cards, track previews, browser/context actions, country/release metadata and source behavior.
- Settings/login: restore persisted login, save settings with visible acknowledgement, existing Deezer/Spotify accounts, templates, quality and tag settings; test cancel/error states.
- Real Windows 11 Electron launch, screenshots across normal/narrow/high-DPI window states, hover/right-click/selection, keyboard, scrolling, restart and real Deezer downloads must be tested against the reference application.
- Version is **v0.5.8 - Under construction ⚠️** until actual user acceptance. Build and CI pass do not prove live downloading.

### Restoration record - 2026-10-12

The experimental Python application was abandoned by user instruction. Its source was **never committed** to this GitHub repository. The latest production executable and core code remain exactly those of the v0.5.7 Electron release; project continuity documents were restored from that release commit. This UI acceptance document and mandatory global `SOFTWARE_RULES.md`/`UI_UX_RULES.md` are retained as current compliance policy, not program behavior changes. No executable asset or release workflow has been changed.

## Next action

Verify v0.5.8 in Windows against real Deezer/Spotify usage and document failed or unrun cases. Do not add a replacement desktop implementation without an explicit request.

### v0.5.8 - Strict-quality album transaction test gate (2026-10-12)

- **PASS (Linux CI):** [workflow 38207075413](https://github.com/karpuzikov/deemix/actions/runs/38207075413) - full pnpm lint/test/build including album ID 53346642, geo-blocked track ID 440060362, late stream failure, lower-bitrate fallback rejection, collision safety, staged rollback and abandoned publisher recovery.
- **PASS (Windows packaged smoke):** [workflow 38207199177](https://github.com/karpuzikov/deemix/actions/runs/38207199177) - Electron native dependency rebuild, versioned installer packaging, packaged GUI Windows startup HTTP smoke and verified single release asset `Deemix.v0.5.8.exe` (113005056 bytes).
- **NOT RUN (real Deezer):** authenticated downloading of the specific release/track with country restriction and actual FLAC file verification; Spotify/ListenBrainz unaffected but not tested.
- **NOT RUN (real Windows UI acceptance):** actual screenshots at supported viewports, scroll, hover, click, selection and error-state interactions. App must remain **Under construction ⚠️**. No new UI control was introduced; the queue now clears provisional downloaded counts when a strict album is discarded.
- **Data protection:** no preexisting release file can be deleted or overwritten by strict transaction; a naming collision fails the album. Temporary private owned stage is cleaned after rejection.
