# Deemix Native continuity

Date: 2026-10-11. Status: **v0.1.0 - Under construction ⚠️**. This is a separate native Windows Python GUI development track; the verified Electron 0.5.7 is unchanged and remains the reference. Branch: `native-pyw-v0.1.0`.

## Source and development checkpoint

A 528-line experimental, single-file Python/Tk `Deemix Native v0.1.0.pyw` was authored as a **conversation download artifact**, not yet committed as a repository file. Seven local tests passed on Linux for persistence and transactional staging/commit/rollback using temporary filesystem fixtures; **Windows and authenticated download testing have not been performed**. The GitHub branch currently contains documentation only; do not present it as a source release or stable download. Before publishing, add the audited .pyw source to this branch and run release gates.

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
