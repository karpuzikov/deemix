# Deemix

This is the monorepo for the revived Deemix project, originally created by the very talented [RemixDev](https://gitlab.com/RemixDev).

The docker image was heavily inspired by the fantastic work of [Bockiii](https://gitlab.com/Bockiii/deemix-docker).

### Packages in this Repo

- **deezer-sdk**: Wrapper for Deezer's [API](https://developers.deezer.com/api)
- **deemix**: The brains of the operation
- **webui**: [Vue.js](https://vuejs.org/) + [Express](https://expressjs.com/) web interface
- **gui**: Packaged [Electron](https://www.electronjs.org/) app

<a href='https://ko-fi.com/L3L71IQN1F' target='_blank'><img height='36' style='border:0px;height:36px;' src='https://storage.ko-fi.com/cdn/kofi6.png?v=6' border='0' alt='Buy Me a Coffee at ko-fi.com' /></a>

## Downloads

### Standalone Electron App

[Fork release page](https://github.com/karpuzikov/deemix/releases) - v0.5.2 is **Under construction ⚠️**. Do not use the old unversioned Windows release asset as a v0.5.2 build.

Note: The app is not signed (because it's crazy expensive), so you'll need to disable the security warnings when running it.

#### For MacOS

```bash
xattr -d com.apple.quarantine /Applications/deemix.app
```

Modify path if installed to a different locaiton

### Network access and post-download commands

Deemix now binds to `127.0.0.1:6595` by default. For LAN/Docker access, explicitly set `DEEMIX_HOST=0.0.0.0` and set a random `DEEMIX_ACCESS_TOKEN` of at least 24 characters. The browser asks for username `deemix` and that token as its password; HTTP and WebSocket traffic require authentication. Use an HTTPS reverse proxy for remote access and set `DEEMIX_COOKIE_SECURE=true` when serving over HTTPS. Do not expose unauthenticated ports publicly.

Optional post-download shell commands are disabled unless `DEEMIX_ALLOW_POST_DOWNLOAD_COMMANDS=true` is set by the operator. Do not enable this for untrusted users. The Docker compose configuration requires the access token environment variable.

### Docker Image

To run this fork's patched server, **build the image from this repository**. The upstream `bambanah/deemix` image does not contain these fixes.

#### Example Usage

```bash
docker build -t deemix-karpuzikov .
docker run -d --name Deemix \
  -v /path/to/music:/downloads \
  -v /path/to/config:/config \
  -p 127.0.0.1:6595:6595 \
  -e DEEMIX_ACCESS_TOKEN="<24+-character-random-secret>" \
  deemix-karpuzikov
```

#### Parameters

Most parameters are optional; `DEEMIX_ACCESS_TOKEN` is required when the server is bound to a non-loopback host, including inside Docker.

You'll probably want to at least map the download and config folders, as well as the port.

| Parameter                               | Description                                               | Default      |
| --------------------------------------- | --------------------------------------------------------- | ------------ |
| `-v /path/to/music:/downloads`          | Path to the music folder                                  |              |
| `-v /path/to/config:/config`            | Path to the config folder                                 |              |
| `-p 127.0.0.1:6595:6595`                          | Port mapped to the host                                   |              |
| `-e DEEMIX_SERVER_PORT=6595`            | Port to expose the server on                              | `6595`       |
| `-e DEEMIX_DATA_DIR=/config`            | Path to the config folder                                 | `/config`    |
| `-e DEEMIX_MUSIC_DIR=/downloads`        | Path to the music folder                                  | `/downloads` |
| `-e DEEMIX_HOST=0.0.0.0`                | Host to bind the server to (Docker only)                  | `0.0.0.0`    |
| `-e DEEMIX_ACCESS_TOKEN=...`            | Required 24+-character secret when bound beyond loopback  | *required*   |
| `-e DEEMIX_SINGLE_USER=true`            | Enables single user mode                                  | `true`       |
| `-e PUID=1000`                          | User ID to use for downloaded files                       | `1000`       |
| `-e PGID=1000`                          | Group ID to use for downloaded files                      | `1000`       |
| `-e UMASK_SET=022`                      | Set umask                                                 | `022`        |
| `-e DISABLE_OWNERSHIP_CHECK=true`       | Disable ownership fix on container start globally         |              |
| `-e DISABLE_OWNERSHIP_CHECK_MUSIC=true` | Disable ownership fix on container start for music files  |              |
| `-e DISABLE_OWNERSHIP_CHECK_DATA=true`  | Disable ownership fix on container start for config files |              |

#### CLI

The `deemix` CLI is available inside the running container, so downloads can be triggered from
the host (from a cron job, for example):

```bash
docker exec Deemix deemix https://www.deezer.com/track/3135556
docker exec Deemix deemix -b flac -p /downloads/singles https://www.deezer.com/track/3135556
```

| Flag                | Description                                             |
| ------------------- | ------------------------------------------------------- |
| `-p, --path <path>` | Downloads into the given folder instead of `/downloads` |
| `-b, --bitrate <t>` | Overrides the configured bitrate - `128`, `320`, `flac` |

You must be logged in first. Logging in through the web UI is enough - the CLI reads the same
credentials. Alternatively, run it interactively once to be prompted for an ARL:

```bash
docker exec -it Deemix deemix https://www.deezer.com/track/3135556
```

Without a valid ARL and without a TTY, the command exits 1 rather than waiting for input.
Downloads are performed as `PUID:PGID`, so files are owned the same way as web UI downloads.

### Nix Flake

Build and run the webui server or cli reproducibly with [Nix](https://nixos.org) (flakes enabled):

```bash
nix run github:bambanah/deemix#webui      # start the webui server on 0.0.0.0:6595
nix run github:bambanah/deemix#cli -- <url>  # download a track/playlist

nix build github:bambanah/deemix#webui    # build only, result in ./result
```

A dev shell with the pinned node + pnpm is available via `nix develop`.

## Feature requests

Before asking for a feature make sure there isn't already an [open issue](https://github.com/bambanah/deemix/issues).

## Developing

This repo uses [pnpm](https://pnpm.io/) for package management and [Turborepo](https://turbo.build/repo/docs) for monorepo management.

### Dependencies

- Install Node.js 24.x
- Enable pnpm:
  ```bash
  corepack enable
  ```

### Local Development

1. Clone the repository
   ```bash
   git clone https://github.com/karpuzikov/deemix.git
   # - OR -
   gh repo clone karpuzikov/deemix
   ```
2. Install dependencies
   ```bash
   pnpm i
   ```
3. Start development server

   ```bash
   pnpm dev
   ```

   - This will start the development server on port 6595
   - It will also watch for changes in dependencies and hot reload the app

### Building the Docker Image

A docker image can be built with the provided Dockerfile.

```bash
docker build -t deemix .
```

### Packaging the Electron GUI

A distributable GUI app can be built with the following command:

```bash
pnpm make
```

**Windows release status:** GUI v0.5.6 - Under construction ⚠️. The versioned Windows installer is published from `main` to the [fork's prerelease page](https://github.com/karpuzikov/deemix/releases/tag/windows-latest) only when Windows smoke tests succeed. On authenticated LAN use `DEEMIX_ACCESS_TOKEN` (24+ characters); when behind a TLS proxy also configure `DEEMIX_PUBLIC_URL=https://YOUR-HOST` and `DEEMIX_COOKIE_SECURE=true` for correct Spotify callback and cookies. The installed Windows app stores its configuration in Documents/Karpuzikov Tools/Deemix with automatic migration of legacy profile data.

**Windows executable:** [Deemix.v0.5.6.exe](https://github.com/karpuzikov/deemix/releases/download/windows-latest/Deemix.v0.5.6.exe) - v0.5.6 - Under construction ⚠️. GitHub replaces spaces in the uploaded asset filename with periods; the version is retained.

**Desktop persistent login (v0.5.3):** The local Windows GUI restores the saved login using the OS-encrypted credentials, not browser localStorage. Enter login once after upgrading if necessary, then close and reopen to confirm it reconnects. Logging out clears the stored login. Network-facing multi-user WebUI behavior is unchanged.

**v0.5.4 (Under construction ⚠️):** Settings > Downloads > Skip clean version if explicit is available (default off). In a generated artist-discography or multi-release batch, omit a clean release only when a matching explicit release with the same artist, edition and full ordered tracklist is in that same batch; do not remove deluxe editions or clean-only requested albums. The setting is saved in the per-app configuration.

**v0.5.5 - Under construction ⚠️:** When Settings > Downloads > Skip clean version if explicit is available is enabled and saved, compare clean and explicit releases across the current download request and previously waiting queue entries. Respect co-main artists, censor labels inside track titles, and modest title variations; preserve different track counts, deluxe/live editions and user playlists. Only not-yet-started clean queue entries are canceled. No previously downloaded files are deleted.

**v0.5.6 - Under construction ⚠️:** Fixes the clean/explicit preference using actual public Deezer metadata for the reported Metro Boomin and Future albums, and changes Settings > Save to an acknowledged HTTP request so an offline WebSocket cannot silently discard the checkbox change. Check for a visible 'Settings saved!' message before downloading.
