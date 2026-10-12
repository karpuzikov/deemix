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

## Applications: original Deemix Electron/Vue GUI and native Python development

**Original GUI source:** `packages/webui/src/client/` (sidebar, search bar/results, artwork tiles, downloads/queue, settings, album/artist/playlist details, context menus, responsive application shell), `packages/gui/` Electron host.

**Native Python GUI:** versioned `Deemix Python v0.4.6.pyw` from conversation artifact, tracked only in `packages/native/CONTINUITY.md` on `native-pyw-v0.1.0` branch as of 2026-10-12. **Do not claim this source lives in GitHub until actually committed.** The branch must also follow identical UI rules.

### High-priority control contracts

- Artist/album/playlist card hover: **Download to...** opens required folder picker for ONE item; **checkmark** toggles selection only (never downloads).
- Mixed selection: stable selection across tabs, one bulk **Download to... (N)** path picker, enqueue each item with its explicitly selected destination. Cancel queues nothing.
- Search: exactly one primary search input per page, no duplicate actions; artwork grids and artist portraits load asynchronously with fallback.
- Queue: pause, stop, restart, error deletion, path change, legacy no-path recovery, artist-to-album target inheritance, transactional cleanup. No global download path in Settings.
- Settings: controls are unique, keyboard accessible, saved correctly; no repeated import/download action.

**Reference:** SpotiFLAC actual source code and supplied comparison captures plus Fluent 2 for general tokens. The original Deemix feature set must be preserved; no Tkinter.

**Real Windows Electron/PySide6 launch, actual hover/screenshots, download tests:** NOT RUN in this audit. Prior static/mock checks do not satisfy the release gate.

## Next action

Fill the control contract and real-world screenshot/interaction matrix for every UI surface above. Fix all FAIL and NOT RUN before declaring UI verified. Preserve software behavior and target-platform compatibility.
