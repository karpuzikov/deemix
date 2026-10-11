# Deemix Native continuity

Date: 2026-10-11. Status: **v0.1.0 - Under construction ⚠️**. This is a separate native Windows Python GUI development track; the verified Electron 0.5.7 is unchanged and remains the reference. Branch: `native-pyw-v0.1.0`.

## Source and development checkpoint

A 548-line experimental, single-file Python/Tk `Deemix Native v0.1.0.pyw` was authored as a **conversation download artifact**, not yet committed as a repository file. Nine local tests passed on Linux, including an end-to-end simulated CLI success and active-process stop for persistence and transactional staging/commit/rollback using temporary filesystem fixtures; **Windows and authenticated download testing have not been performed**. The GitHub branch currently contains documentation only; do not present it as a source release or stable download. Before publishing, add the audited .pyw source to this branch and run release gates.

The original Deemix Node/TypeScript download core is reused by calling its existing CLI subprocess from the Python controller; there is not yet an independently rewritten Python Deezer SDK or backend. A working original CLI and Node installation may be required. Do not claim the .pyw is standalone/complete/parity-ready. A WebView-only wrapper is explicitly rejected, so the new front end uses Tk rather than embedding the Vue interface.

## Native queue implementation - experimental

- Isolated persistence under dynamically resolved `Documents/Karpuzikov Tools/Deemix Native/queue.json`; atomic JSON writes. Saved rows and Pause survive restart; interrupt-in-progress rows change to stopped after recovering staged files. No automatic downloading on startup.
- Controls: add URL, pause after current release, stop/terminate process tree, resume queued and stopped entries, remove errored entries without deleting downloaded music. UI shows status and activity on a compact dark Tkinter window, with a folder-open control immediately before path inputs.
- Each attempted CLI item downloads to a private per-job staging folder. Final output is installed using exclusive hard links from named per-file `.part` ownership witnesses. Rollback deletes only files verified by filesystem identity as owned by the transaction, and preserves unrelated and pre-existing target files; name collisions abort rather than overwrite. Pending transaction state is durably journaled and recovery refuses unauthenticated staging cleanup.
- Staging is per queued URL, **not yet per release when a URL expands to multiple albums**. Artist/discography release granularity, parallel streams, accurate track-count reconciliation, format verification, and native Deezer session reuse are major open blockers.
- A successful CLI return code is **not** enough to prove every album track is present in the selected quality. Current native prototype has **no certified album completeness guarantee**. Users should keep the existing v0.5.7 release for real downloads until these gates pass.

## Required full native parity matrix (currently incomplete)

| Requirement | Current native status |
| --- | --- |
| Original Deezer URL handling (tracks/albums/artist/playlist; UPC/ISRC) | Partial: delegates to original CLI; artist jobs not split into release transactions |
| Deezer login/legacy credential preservation/DPAPI | Not native-ported; relies on working CLI configuration |
| Spotify conversion and ListenBrainz | Original CLI-dependent; native UI not available |
| MP3 128/320, FLAC, metadata/tags, artwork, synced lyrics | Original CLI-dependent; native settings subset only |
| Full settings and template UI | Missing native UI |
| Library search, discovery, charts, favorites, albums, playlists | Missing native UI |
| Clean-vs-explicit opt-in matching (cross batches/queue) | Backend-dependent; not native validated |
| Strict all-track, exact-selected-quality preflight | Not native verified; blocker |
| Bounded ISRC fallback and lookup retries | Backend-dependent; not native validated |
| Persist queue through app exit/updates | Local JSON pass; migration from Electron queue not implemented |
| Pause, stop, resume, remove failed entries | Implemented in experimental controller; no real Windows streaming test |
| Stop cleanup without touching existing files | Local provenance tests pass; Windows crash/process-tree tests pending |
| Release-level atomicity (artist/discography expansion) | Missing; blocker |
| Windows packaging, dependency bootstrap, app icons, UXDT audit | Not completed; blocker |

## Upstream/fork comparison

`docs/UPSTREAM_FORK_AUDIT.md` contains a GitHub compare API inventory of **104 changed paths**, 5,936 additions, 653 deletions, 76 commits ahead and 3 behind relative to current `bambanah/deemix` main. It covers file-level changes, not a claim of semantic review for all code paths; both upstream-only changes and feature-level diffs require audit. Original Electron is not removed and its workflows must not be edited unless explicitly requested.

## Next exact steps

1. Commit experimental native Python source into `packages/native/` and make a source/testable release with a versioned filename; review GPL-3.0 compatibility.
2. Implement release-level artist/playlist expansion with authoritative exact track manifests. Reuse authenticated core preflight and validate stream completion **before** making album visible in final output.
3. Migrate the existing Electron queue/settings/DPAPI credentials without losing active artist submissions; preserve opt-in user preferences. Implement native settings/auth/search/collections/plugin parity.
4. Add Windows staging/stop/restart and race/crash tests, full UXDT UI audit, security and performance tests. Build/publish only after all mandatory rules pass and user accepts.

## Mandatory source parity gate - 2026-10-11

The user explicitly clarified: a different UI is permitted, but **every feature from `bambanah/deemix` plus every change in `karpuzikov/deemix` is mandatory**, with no exceptions. **Do not ship the rejected experimental Tk/CLI program, a simplistic WebView wrapper, or any native UI that omits the original search, all 54 current configuration fields and 33 tag fields, 12 screens, 29 original GET/POST API handlers, library browsing, downloads, plugins, or custom improvements.** See `docs/NATIVE_FULL_PARITY_GATE.md` and complete machine-readable original/fork blob manifests in `docs/PARITY_SOURCE_MANIFEST.json`. These are inventory/acceptance documentation, not implementation of the port.

Working shared-server WIP on this branch: remove errored queue entries without deleting user media; persistent pause after current release; authenticated resume without reconstructing artist queue items. These are **not tested on real Windows**, Stop with ownership-based incomplete album cleanup and full native .pyw remain BLOCKED. User requested full product, not feature checklist alone. Electron v0.5.7 must remain intact.

## 2026-10-11 - Deemix Lightweight v0.2.0 Windows .pyw host checkpoint

A new versioned `Deemix Lightweight v0.2.0.pyw` was created as a conversation download artifact. This is **not** the old rejected Tkinter/CLI prototype. The Python .pyw hosts the **complete compiled original Vue WebUI** through Windows WebView2/pywebview and starts the **existing fork TypeScript Deemix download engine** directly as a local Node.js process. There is no manual backend-CLI picker and search/collections/settings are provided by the original WebUI. The Python host performs first-run source installation from the `native-pyw-v0.1.0` branch, dependency/bootstrap checks, build, native folder dialogs and reuse of the original Deemix Documents config directory. Its own host runtime/webview/logs live under `Documents/Karpuzikov Tools/Deemix Lightweight`. No Electron installation or Electron runtime is used. **It is not a pure Python engine port**, and retains a Node engine dependency; do not claim otherwise.

Python host source was syntax-checked and passed 10 isolated Python mocked/local unit tests. There is no authenticated Windows installation, Node build, WebView2, Spotify OAuth, full feature-parity, or runtime Deezer download acceptance test. Its startup may require internet, WinGet/portable Node, npm packages and Python pywebview installation. The .pyw host source was not yet committed into the GitHub repo or released as a GitHub asset, so the conversation-attached file is the only available draft.

Shared original-fork backend on this branch now includes experimental server-side Pause, Resume, Stop, Remove Downloads with Errors; both desktop/mobile queue buttons and English/Russian translations; a backend session folder-selection route for the Python host; preserved paused/stopped queue entries on restart/update; and an opt-in `DEEMIX_ATOMIC_RELEASES=true` same-volume staged album transaction helper with ownership-verified hard-link publication, rollback and recovery. The Python host sets this flag. Unit test sources were committed for queue state and album ownership cleanup but **have not been executed in the GitHub build or actual Windows**. The existing Electron `main` and v0.5.7 installer are unchanged.

**Release-blocking risks:** Stage-based publication can differ from old `overwriteFile` modes `t` (only tags) and `l` (only lower bitrates); stop of a single/playlist item does not currently use the album transaction path; interrupted metadata/stream work and true Windows crash races are untested; the full frontend WebView2 IPC behavior and Spotify OAuth popups are not verified; compiling the modified TypeScript in the exact project environment has not been verified. These must be fixed before claiming every single original + fork feature is functionally equivalent. Do not mark native v0.2.0 stable, and do not use it as the sole copy for irreplaceable media until those gates are passed. Do not change GitHub workflow files.
