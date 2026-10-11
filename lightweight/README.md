# Deemix Lightweight v0.1.0 - Under construction ⚠️

**Experimental Windows Python controller for the full Deemix backend.** Single native GUI source file: `Deemix Lightweight v0.1.0.pyw` (distributed in the accompanying ChatGPT conversation).

- Upstream application inspected: [bambanah/deemix](https://github.com/bambanah/deemix), TypeScript Node engine + Express/Vue WebUI + Electron.
- [Complete inventory of 104 changes](UPSTREAM_DIFF.md) between upstream and user's fork, current at 2026-10-11.
- **Not a standalone pure-Python port:** the native tkinter interface is ~26 KB and uses standard library only, but first run installs Git, Node.js 24+, pnpm and the fork backend source. Electron is not installed or run. All original features are available via **Full Deemix UI** (localhost only). Code and repo distributions are GPL-3.0-only compatible.
- Setup stores clone under `Documents\\Karpuzikov Tools\\Deemix Lightweight\\dependencies\\deemix-engine` and logs under its own folder. It uses the existing `Documents\\Karpuzikov Tools\\Deemix` backend configuration/queue/DPAPI-protected login so existing downloads remain visible and survive updates.
- The installed fork backend is pinned to branch `lightweight-pyw-v0.1.0` and runs on `127.0.0.1:6597`, separate from the existing Electron desktop app.
- Native controls: Add Deezer URLs, FLAC/320/128 selections; pause (finish current release, stop before next), stop (abort current release, clean its newly created files, put original download item first), resume after app update, selected retry/removal, bulk **Remove errors**, bulk remove completed. Saved settings: explicit preference, ISRC fallback, complete-album exact-bitrate preflight, bitrate fallback, MusicBrainz metadata.
- Backend `pauseQueue`, `stopQueue`, `resumeQueue`, `removeDownloadsWithErrors` endpoints are available only on loopback with the existing host/origin security. Pause/Stop state persists to `queue-control.json` and release queue files in the original Deemix config. Resume requires a logged-in session; saved ARL autologin or Sign in.
- Original advanced user experience/search/Spotify/ListenBrainz/release discovery/plugins remain in the existing full Vue WebUI. The Python Tk client is not a wholesale rewrite of those components.

## Limitations and safety

- **Stop only cleans files known to have been newly created during the current release attempt.** Already-existing downloaded files are deliberately never deleted, and previously overwritten files cannot be recovered. Separate global cache/temp artwork is not removed. For a release that was already interrupted before this new program ran, the old partial files may remain. Do not treat this as a fully transactional release rollback.
- If the program is closed during an active release, it submits Stop first and leaves the backend running until its cleanup finishes; there is no forced kill or silent deletion of unknown paths.
- The Python source is syntactically validated; **the complete GUI install/auth/download/Stop workflow has not been tested on the user's Windows PC.** CI tests are required for the backend branch. Status must remain **Under construction ⚠️** until user acceptance.
- The legacy Electron GUI is left unchanged and is **not** marked stable on this new branch. No .github/workflows changes.
