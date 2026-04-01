---
title: SDK Guide
---

The Motion Tools SDK lets you interact with the visualizer programmatically from Go. It is organized into three layers:

| Layer                 | Package           | Purpose                                                                               |
| --------------------- | ----------------- | ------------------------------------------------------------------------------------- |
| **Proto definitions** | `protos/draw/v1/` | Wire format: protobuf messages and the DrawService RPC definition                     |
| **Draw package**      | `draw/`           | Go types for drawable entities, snapshots, colors, and the DrawService implementation |
| **Client API**        | `client/api/`     | High-level drawing functions that communicate with a running visualizer               |

Most users will work with `client/api` for real-time drawing or `draw` for snapshots. The proto layer is relevant if you need to work with the wire format directly or generate code for other languages.

## Installation

The SDK is split into separate Go modules. Install the ones you need:

```bash
go get github.com/viam-labs/motion-tools/draw
go get github.com/viam-labs/motion-tools/client
```

## Real-Time Drawing (`client/api`)

The client API draws directly to a running visualizer over Connect-RPC. Start the visualizer with `make up`, then use the API from your Go code.

### Quick Start

```go
package main

import (
    "github.com/golang/geo/r3"
    "github.com/viam-labs/motion-tools/client/api"
    "github.com/viam-labs/motion-tools/draw"
)

func main() {
    positions := []r3.Vector{
        {X: 0, Y: 0, Z: 0},
        {X: 100, Y: 100, Z: 100},
        {X: 200, Y: 0, Z: 200},
    }
    _, err := api.DrawLine(api.DrawLineOptions{
        Name:      "my-line",
        Positions: positions,
        Colors:    []draw.Color{draw.ColorFromName("blue")},
    })
    if err != nil {
        panic(err)
    }

    points := []r3.Vector{
        {X: 50, Y: 50, Z: 50},
        {X: 150, Y: 50, Z: 50},
    }
    _, err = api.DrawPoints(api.DrawPointsOptions{
        Name:      "my-points",
        Positions: points,
        Colors:    []draw.Color{draw.ColorFromName("red")},
        PointSize: 10.0,
    })
    if err != nil {
        panic(err)
    }
}
```

The visualizer will be available at [http://localhost:5173](http://localhost:5173).

### Drawing Functions

Most `Draw*` functions return a single UUID (`[]byte`) that can be reused to update the drawing in place. Compound functions (`DrawRobot`, `DrawFrameSystem`, `DrawFrames`, `DrawGeometriesInFrame`, `DrawWorldState`) return a slice of UUIDs (`[][]byte`) since they create multiple entities.

#### Drawings

Visual primitives rendered as shapes in the scene.

| Function            | Description                                                    |
| ------------------- | -------------------------------------------------------------- |
| `DrawLine`          | Polylines with configurable line width, point size, and colors |
| `DrawPoints`        | Point sets with per-point or palette colors                    |
| `DrawNurbs`         | NURBS curves with control points and knots                     |
| `DrawPosesAsArrows` | Pose arrays rendered as directional arrows                     |
| `DrawGLTF`          | 3D models from .glb or .gltf files                             |

#### Transforms

Spatial objects like geometries, frames, and robot states.

| Function                | Description                                         |
| ----------------------- | --------------------------------------------------- |
| `DrawGeometry`          | Single spatialmath.Geometry object                  |
| `DrawGeometriesInFrame` | Multiple geometries in a reference frame            |
| `DrawFrames`            | Reference frames as coordinate systems              |
| `DrawFrameSystem`       | Complete frame system with all geometries           |
| `DrawWorldState`        | World state obstacles and transforms                |
| `DrawPointCloud`        | Point cloud data with optional downscaling          |
| `DrawRobot`             | Entire robot including frame system and world state |

#### Scene Control

| Function      | Description                                          |
| ------------- | ---------------------------------------------------- |
| `SetCamera`   | Set the camera position, look-at target, and animate |
| `ResetCamera` | Reset the camera to its default position             |

#### Recording

| Function     | Description                                        |
| ------------ | -------------------------------------------------- |
| `Record`     | Start recording draw operations to a file          |
| `StopRecord` | Stop the current recording                         |
| `Replay`     | Replay a previously recorded file at a given speed |

#### Removal

| Function           | Description                                       |
| ------------------ | ------------------------------------------------- |
| `RemoveAll`        | Clear all drawings and transforms                 |
| `RemoveDrawings`   | Clear only drawings (lines, points, models, etc.) |
| `RemoveTransforms` | Clear only transforms (geometries, frames, etc.)  |

### Updating Drawings

All `Draw*` functions accept an `ID` field in their options struct. Calling a draw function with an ID that already exists will update the object in place:

```go
api.DrawLine(api.DrawLineOptions{
    ID:        "my-line-id",
    Name:      "my-line",
    Positions: positions1,
})

api.DrawLine(api.DrawLineOptions{
    ID:        "my-line-id",
    Name:      "my-line",
    Positions: positions2,
})
```

## Snapshots (`draw` package)

A `Snapshot` is a container for everything you want to visualize. Create one, add shapes, and export it as a file that can be loaded into any visualizer instance.

### Create a Snapshot

```go
package main

import (
    "fmt"
    "os"

    "github.com/golang/geo/r3"
    "github.com/viam-labs/motion-tools/draw"
    "go.viam.com/rdk/spatialmath"
)

func main() {
    camera := draw.NewSceneCamera(
        r3.Vector{X: 2000, Y: 2000, Z: 2000},
        r3.Vector{X: 0, Y: 0, Z: 0},
        draw.WithAnimated(true),
    )

    snapshot := draw.NewSnapshot(
        draw.WithSceneCamera(camera),
        draw.WithGrid(true),
        draw.WithGridCellSize(250),
    )

    box, _ := spatialmath.NewBox(
        spatialmath.NewZeroPose(),
        r3.Vector{X: 100, Y: 100, Z: 100},
        "my-box",
    )
    snapshot.DrawGeometry(box, spatialmath.NewZeroPose(), "world", draw.ColorFromName("red"))

    positions := []r3.Vector{
        {X: 200, Y: 0, Z: 0},
        {X: 200, Y: 100, Z: 0},
        {X: 200, Y: 100, Z: 100},
    }
    snapshot.DrawPoints("my-points", "world", spatialmath.NewZeroPose(), positions,
        draw.WithSinglePointColor(draw.ColorFromName("blue")))

    linePoints := []r3.Vector{
        {X: 0, Y: 0, Z: 200},
        {X: 100, Y: 100, Z: 200},
        {X: 200, Y: 0, Z: 200},
    }
    snapshot.DrawLine("my-line", "world", spatialmath.NewZeroPose(), linePoints,
        draw.WithLineWidth(3.0),
        draw.WithSingleLineColor(draw.ColorFromName("green")))

    jsonData, _ := snapshot.MarshalJSON()
    os.WriteFile("scene.json", jsonData, 0644)
    fmt.Println("Scene exported to scene.json")
}
```

### Export Formats

Snapshots can be serialized in multiple formats:

```go
jsonData, err := snapshot.MarshalJSON()          // JSON (human-readable)
binaryData, err := snapshot.MarshalBinary()      // Binary protobuf (compact)
gzipData, err := snapshot.MarshalBinaryGzip()    // Gzip-compressed binary (smallest)
```

### Loading Snapshots

Any instance of the visualizer can load snapshot files via drag-and-drop. Snapshot files must be named with the `visualization_snapshot` prefix and use a `.json`, `.pb`, or `.pb.gz` extension. Snapshots can also be rendered programmatically when [embedding](../embedding/) the visualizer using the `<Snapshot>` component.

## Proto Definitions (`protos/draw/v1/`)

The proto layer defines the wire format used by the SDK. The `draw/` Go package provides higher-level types on top of these, but you can use the protos directly if you need lower-level control or are generating code for another language.

### Key Messages

| Proto File         | Messages                                                          | Purpose                                                        |
| ------------------ | ----------------------------------------------------------------- | -------------------------------------------------------------- |
| `drawing.proto`    | `Drawing`, `Shape`, `Arrows`, `Line`, `Points`, `Model`, `Nurbs`  | Visual primitives and their container types                    |
| `snapshot.proto`   | `Snapshot`                                                        | Complete scene state: transforms, drawings, and scene metadata |
| `scene.proto`      | `SceneCamera`, `SceneMetadata`, `RenderArmModels`, `RenderShapes` | Camera configuration and rendering settings                    |
| `service.proto`    | `DrawService` (9 RPCs)                                            | Add, update, remove, and stream entities in the scene          |
| `metadata.proto`   | `Metadata`                                                        | Per-entity rendering attributes (colors)                       |
| `transforms.proto` | `Transforms`                                                      | Wrapper for Viam common Transform messages                     |

### DrawService RPCs

The `DrawService` is the Connect-RPC service that the `client/api` package communicates with:

| RPC                   | Description                             |
| --------------------- | --------------------------------------- |
| `AddEntity`           | Add a transform or drawing to the scene |
| `UpdateEntity`        | Update an existing entity by UUID       |
| `RemoveEntity`        | Remove an entity by UUID                |
| `StreamEntityChanges` | Server-stream of entity change events   |
| `SetScene`            | Set the camera and/or scene metadata    |
| `StreamSceneChanges`  | Server-stream of scene metadata changes |
| `RemoveAllTransforms` | Remove all transform entities           |
| `RemoveAllDrawings`   | Remove all drawing entities             |
| `RemoveAll`           | Remove all entities                     |

### Code Generation

Code is generated for both Go and TypeScript using [buf](https://buf.build). See the [protos README](https://github.com/viam-labs/motion-tools/tree/main/protos) for generation commands and dependency management.

## Draw Package (`draw/`)

The `draw` package is the lower-level building block that both `client/api` and snapshot creation are built on. It provides:

- **Go types** for all drawable entities (lines, points, arrows, NURBS, geometries, frames, models)
- **The DrawService** implementation that manages scene state over Connect-RPC
- **Snapshot** creation and serialization (JSON, binary protobuf, gzip)
- **Color management** with convenience constructors

This package is for advanced users who want to work directly with the underlying types, build custom tooling, or implement their own service consumers.

## Color Options

Colors can be created from names, hex codes, or RGB values:

```go
colorByName := draw.ColorFromName("red")
colorByHex  := draw.ColorFromHex("#FF5733")
colorByRGB  := draw.ColorFromRGB(255, 87, 51)
colorByRGBA := draw.ColorFromRGBA(255, 87, 51, 180)
colorByHSV  := draw.ColorFromHSV(0.5, 0.8, 1.0)
```

For advanced use cases, the functional options constructor is also available:

```go
draw.NewColor(draw.WithRGB(255, 87, 51))
```

Most drawing functions accept `[]draw.Color` with flexible semantics:

- **Single color**: `[]draw.Color{color}` -- applies to all elements
- **Per-element colors**: One color per point/line/geometry
- **Color palette**: Cycles through the provided colors

## API Reference

| Document                       | Package                                        | Description                                            |
| ------------------------------ | ---------------------------------------------- | ------------------------------------------------------ |
| [draw API](../draw-api/)       | `github.com/viam-labs/motion-tools/draw`       | Scene primitives, snapshots, colors, and serialization |
| [client API](../client-api/)   | `github.com/viam-labs/motion-tools/client/api` | Real-time drawing functions, option types, and removal |

## Migration

If you are migrating from the legacy `client/client` package to `client/api`, see the [migration guide](../migration-v1-to-v2/).
