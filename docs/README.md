# Documentation

This directory contains guides and API reference for the motion-tools Go SDK. The API reference files are auto-generated from source code comments using [gomarkdoc](https://github.com/princjef/gomarkdoc) and kept up to date by CI.

## Installation

```bash
go get github.com/viam-labs/motion-tools
```

## Overview

The Go SDK provides two ways to create 3D visualizations:

1. **Snapshots** -- Build a static scene in memory, export to a file, and load it into the visualizer
2. **Real-time drawing** -- Push live updates to a running visualizer instance over Connect-RPC

## Snapshots (`draw` package)

A `Snapshot` is a container for everything you want to visualize. Create one, add shapes, and export it.

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
    // Custom camera position
    camera := draw.NewSceneCamera(
        r3.Vector{X: 2000, Y: 2000, Z: 2000},
        r3.Vector{X: 0, Y: 0, Z: 0},
        draw.WithAnimated(true),
    )

    // Create snapshot with custom settings
    snapshot := draw.NewSnapshot(
        draw.WithSceneCamera(camera),
        draw.WithGrid(true),
        draw.WithGridCellSize(250),
    )

    // Draw a box at the origin
    box, _ := spatialmath.NewBox(
        spatialmath.NewZeroPose(),
        r3.Vector{X: 100, Y: 100, Z: 100},
        "my-box",
    )
    snapshot.DrawGeometry(box, spatialmath.NewZeroPose(), "world", draw.ColorFromName("red"))

    // Draw some points
    positions := []r3.Vector{
        {X: 200, Y: 0, Z: 0},
        {X: 200, Y: 100, Z: 0},
        {X: 200, Y: 100, Z: 100},
    }
    snapshot.DrawPoints("my-points", "world", spatialmath.NewZeroPose(), positions,
        draw.WithPointsColors(draw.ColorFromName("blue")))

    // Draw a line connecting points
    linePoints := []r3.Vector{
        {X: 0, Y: 0, Z: 200},
        {X: 100, Y: 100, Z: 200},
        {X: 200, Y: 0, Z: 200},
    }
    snapshot.DrawLine("my-line", "world", spatialmath.NewZeroPose(), linePoints,
        draw.WithLineWidth(3.0),
        draw.WithLineColors(draw.ColorFromName("green"), nil))

    // Export to JSON for rendering
    jsonData, _ := snapshot.MarshalJSON()
    os.WriteFile("scene.json", jsonData, 0644)
    fmt.Println("Scene exported to scene.json")
}
```

### Export Formats

Snapshots can be serialized in multiple formats:

```go
// JSON (human-readable, good for debugging)
jsonData, err := snapshot.MarshalJSON()

// Binary protobuf (compact, efficient)
binaryData, err := snapshot.MarshalBinary()

// Gzip-compressed binary (smallest size)
gzipData, err := snapshot.MarshalBinaryGzip()
```

### Render in the Visualizer

Any instance of the visualizer can accept snapshot files via drag-and-drop.

## Real-Time Drawing (`client/api` package)

The client SDK draws directly to a running visualizer over Connect-RPC.

### Quick Start

Start the visualizer:

```bash
make up
```

Then use the `client/api` package to draw:

```go
package main

import (
    "github.com/golang/geo/r3"
    "github.com/viam-labs/motion-tools/client/api"
    "github.com/viam-labs/motion-tools/draw"
)

func main() {
    // Draw a line
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

    // Draw some points
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

The visualizer will be available at http://localhost:5173.

### Drawing Functions

The client SDK organizes drawing operations into three categories. All `Draw*` functions return a UUID that can be reused to update the drawing in place.

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

#### Removal

| Function           | Description                                       |
| ------------------ | ------------------------------------------------- |
| `RemoveAll`        | Clear all drawings and transforms                 |
| `RemoveDrawings`   | Clear only drawings (lines, points, models, etc.) |
| `RemoveTransforms` | Clear only transforms (geometries, frames, etc.)  |

### Updating Drawings

All `Draw*` functions accept an `ID` field in their options struct. Calling a draw function with an ID that already exists will update the object in place:

```go
// Initial draw
api.DrawLine(api.DrawLineOptions{
    ID:        "my-line-id",
    Name:      "my-line",
    Positions: positions1,
})

// Update the same line (same ID, new positions)
api.DrawLine(api.DrawLineOptions{
    ID:        "my-line-id",
    Name:      "my-line",
    Positions: positions2,
})
```

## Color Options

Colors can be created from names, hex codes, or RGB values using the convenience helpers:

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
| [draw-api.md](draw-api.md)     | `github.com/viam-labs/motion-tools/draw`       | Scene primitives, snapshots, colors, and serialization |
| [client-api.md](client-api.md) | `github.com/viam-labs/motion-tools/client/api` | Real-time drawing functions, option types, and removal |

## Regenerating

To regenerate the reference docs after changing Go source files:

```bash
make docs
```

This runs `gomarkdoc` against the `draw` and `client/api` packages and writes the output to this directory. CI runs the same command and opens a PR with any updates automatically.
