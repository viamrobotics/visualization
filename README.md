# Viam Visualization

3D visualization interface for spatial data using Viam's APIs — frame systems, geometries, point clouds, drawings — for motion-related monitoring, testing, and debugging.

## Documentation

📚 **[viamrobotics.github.io/visualization](https://viamrobotics.github.io/visualization/)** is the canonical guide. It covers:

- [Running locally](https://viamrobotics.github.io/visualization/guides/local-usage/) — set up the app and drive it from Go via `client/api`.
- [Embedding `<MotionTools />`](https://viamrobotics.github.io/visualization/guides/embedding/) — drop the visualizer into your own Svelte app.
- [Implementing WorldStateStoreService](https://viamrobotics.github.io/visualization/guides/worldstatestore/) — produce `Transform`s for a Viam WorldStateStoreService module with `draw`.
- A live [playground](https://viamrobotics.github.io/visualization/playground/snapshot/) rendering a snapshot.

## Quick start

```bash
make setup     # one-time: install Node 22, pnpm, bun, Go, buf, project deps
make up        # http://localhost:5173
```

For manual setup, machine configs, multiple instances, and troubleshooting see the [local-usage guide](https://viamrobotics.github.io/visualization/guides/local-usage/).

## Contributing

Run the dev server with HMR:

```bash
pnpm dev
```

See [CLAUDE.md](CLAUDE.md) for contributor conventions.

## Programmatic camera control

The visualizer exposes a `cameraControls` object on `window`. Open the browser console and call methods on it to move the camera or tweak its settings at runtime. Full API: <https://github.com/yomotsu/camera-controls#properties>.
