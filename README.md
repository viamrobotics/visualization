# Viam Visualization

3D visualization interface for spatial data using Viam's APIs — frame systems, geometries, point clouds, drawings — for motion-related monitoring, testing, and debugging.

## Documentation

📚 **[viamrobotics.github.io/visualization](https://viamrobotics.github.io/visualization/)** is our guide to a few popular use cases. It covers:

- [Running locally](https://viamrobotics.github.io/visualization/guides/local-usage/) — set up the app and drive it from Go via `client/api`.
- [Embedding `<Visualizer />`](https://viamrobotics.github.io/visualization/guides/embedding/) — drop the visualizer into your own Svelte app.
- [Implementing WorldStateStoreService](https://viamrobotics.github.io/visualization/guides/worldstatestore/) — produce `Transform`s for a Viam WorldStateStoreService module with `draw`.
- A live [playground](https://viamrobotics.github.io/visualization/playground/snapshot) rendering a snapshot.

## Quick start

```bash
make setup     # one-time: install Node 22, pnpm, Go, buf, project deps
make up        # http://localhost:5173
```

For manual setup, machine configs, multiple instances, and troubleshooting see the [local-usage guide](https://viamrobotics.github.io/visualization/guides/local-usage/).

## Contributing

Run the dev server with HMR:

```bash
pnpm dev
```

See [CLAUDE.md](CLAUDE.md) for contributor conventions.

### Desktop app

The visualizer also builds as a desktop app with [Tauri v2](https://v2.tauri.app/). It wraps the same static build the browser gets and bundles the Go draw server as a sidecar. A release build starts the sidecar on a free port and stops it when the app quits, so the draw-service panel is live with nothing else running. You need the [Tauri system dependencies](https://v2.tauri.app/start/prerequisites/), Rust 1.90 or newer, Go, and nlopt with its static library (`etc/setup.sh` installs it).

A debug build (`pnpm tauri:dev`) does not start the sidecar, because `pnpm dev` already runs a draw server on 3030. Set `VIAM_VISUALIZER_SIDECAR=1` to start it in a debug build anyway. `pnpm build:sidecar` builds the sidecar alone, into `src-tauri/binaries/`, and fails if the binary links any non-system library. A platform where nlopt cannot be linked statically can build with `GOFLAGS=-tags=nomotionplan`, which drops IK inspection from the sidecar.

```bash
pnpm tauri:dev     # dev server in a native window, with HMR
pnpm tauri:build   # .app and .dmg under src-tauri/target/release/bundle/
```

The bundle version follows `version` in `package.json`.

The app connects on boot when started with `--launch-file <path>`. The file is JSON, version 1, written by the Viam CLI with `0600` permissions. The app deletes it after reading, unless it is not JSON or has no `version` key:

```json
{
	"version": 1,
	"host": "<part fqdn>",
	"partId": "<part id>",
	"partName": "<part name>",
	"machineName": "<machine name>",
	"signalingAddress": "https://app.viam.com:443",
	"serviceHost": "https://app.viam.com",
	"credentials": { "type": "access-token", "payload": "<jwt>" }
}
```

`credentials` is alternatively `{ "type": "api-key", "authEntity": "<key id>", "payload": "<key>" }`. A second launch with a new file switches the running window to that machine. On macOS, `open -a <app> <path>` works too, and is the only form that reaches an app already running, since `open` drops `--args` then. With no flag the app behaves like the browser build.

Every GitHub release carries desktop bundles built by `tauri-release.yml`, named `viam-visualizer-<version>-<platform>-<arch><suffix>` with `platform` one of `darwin`, `linux`, `windows` and `arch` one of `aarch64`, `x86_64`. The suffixes are `.dmg` and `.app.tar.gz` on macOS, `.AppImage` and `.deb` on Linux, and `.exe` (portable) and `-setup.exe` (installer) on Windows, plus a `checksums.txt` with one `sha256  name` line per asset.

> [!NOTE]
> Currently, the macOS bundles are ad-hoc signed and not notarized. A downloaded bundle is blocked on first launch. Allow it under System Settings → Privacy & Security → Open Anyway, or run `xattr -d com.apple.quarantine` on the `.app`.

## Programmatic camera control

The visualizer exposes a `cameraControls` object on `window`. Open the browser console and call methods on it to move the camera or tweak its settings at runtime. Full API: <https://github.com/yomotsu/camera-controls#properties>.
