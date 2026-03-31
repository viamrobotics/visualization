# Motion Tools

Motion Tools is a 3D visualization interface for spatial data built for [Viam](https://viam.com) robotics. Use it to visualize robot frames, geometries, point clouds, and custom drawings for motion-related monitoring, testing, and debugging.

## What You Can Do

- **Connect to a machine** to visualize its frame system, geometries, and sensor data in real time
- **Draw in real time** from Go code using the client SDK, pushing live updates to the visualizer over Connect-RPC
- **Create snapshots** of a scene and export them as files to load into the visualizer later
- **Embed the visualizer** in your own Svelte application with the `<MotionTools>` component
- **Build custom tooling** with the lower-level `draw` package and proto definitions

## Quick Start

### Install and Run

```bash
make setup   # install dependencies (Node.js, pnpm, bun, Go, buf)
make up      # build and start the visualizer
```

Visit [http://localhost:5173](http://localhost:5173) to open the visualizer.

### Connect to a Machine

You can add machine connection configs directly in the visualizer UI, or pre-configure them via a `.env.local` file:

```
VITE_CONFIGS='
{
  "my-robot": {
    "host": "my-robot-main.abc123.viam.cloud",
    "partId": "myPartID",
    "apiKeyId": "myApiKeyId",
    "apiKeyValue": "myApiKeyValue",
    "signalingAddress": "https://app.viam.com:443"
  }
}
'
```

The visualizer connects to Viam machines using the [Viam TypeScript SDK](https://ts.viam.dev) under the hood. See the [Visualizer Guide](visualizer.md) for details on the connection panel and all available UI tools.

### Draw from Go

With the visualizer running, use the Go SDK to draw programmatically:

```bash
go get github.com/viam-labs/motion-tools/draw
go get github.com/viam-labs/motion-tools/client
```

```go
import (
    "github.com/golang/geo/r3"
    "github.com/viam-labs/motion-tools/client/api"
    "github.com/viam-labs/motion-tools/draw"
)

func main() {
    api.DrawLine(api.DrawLineOptions{
        Name:      "my-line",
        Positions: []r3.Vector{{X: 0, Y: 0, Z: 0}, {X: 100, Y: 100, Z: 100}},
        Colors:    []draw.Color{draw.ColorFromName("blue")},
    })
}
```

See the [SDK Guide](sdk.md) for the full drawing API, snapshot creation, and proto definitions.

### Embed in Your App

Install the npm package and use the Svelte components:

```bash
pnpm add @viamrobotics/motion-tools
```

```svelte
<script>
	import { MotionTools } from '@viamrobotics/motion-tools'
	import { Snapshot, SnapshotProto } from '@viamrobotics/motion-tools/lib'
</script>

<MotionTools>
	<Snapshot snapshot={mySnapshot} />
</MotionTools>
```

See the [Embedding Guide](embedding.md) for component props, plugins, and package exports.

## Running Multiple Instances

The `make up` command accepts port overrides:

```bash
make up                    # default: localhost:5173
make up STATIC_PORT=5174   # second instance on port 5174
```

## Guides

| Guide                                       | Description                                                                       |
| ------------------------------------------- | --------------------------------------------------------------------------------- |
| [Visualizer Guide](visualizer.md)           | UI tools: world tree, settings, camera controls, measurement, frame editing, logs |
| [SDK Guide](sdk.md)                         | Go SDK: real-time drawing, snapshots, proto definitions, color API                |
| [Embedding Guide](embedding.md)             | Svelte components: `<MotionTools>`, `<Snapshot>`, plugins, package exports        |
| [Migration v1 to v2](migration-v1-to-v2.md) | Migrating from the legacy `client/client` package to `client/api`                 |

## API Reference

| Document                       | Package                                        | Description                                            |
| ------------------------------ | ---------------------------------------------- | ------------------------------------------------------ |
| [draw-api.md](draw-api.md)     | `github.com/viam-labs/motion-tools/draw`       | Scene primitives, snapshots, colors, and serialization |
| [client-api.md](client-api.md) | `github.com/viam-labs/motion-tools/client/api` | Real-time drawing functions, option types, and removal |
