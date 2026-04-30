# Draw

The `draw` package provides a Go API for creating 3D visualizations with Viam's motion tools. Build scenes with geometries, arrows, lines, points, models, and frame systems—then serialize them for rendering in the motion-tools visualizer.

## Documentation

For complete API reference, see the [`draw` package docs](https://viamrobotics.github.io/visualization/api/draw/) (auto-generated from source — `make docs`).

## Quick Start

You can draw to the visualizer through the following methods:

1. Creating a static [snapshot](#rendering-a-snapshot) for a scene.
2. Drawing directly to a local instance of the visualizer with the draw client (documentation coming soon).

### Rendering a snapshot

A snapshot is a static scene that can be rendered by providing it to an instance of the visualizer directly as a prop, or dragging and dropping a generated snapshot file into an instance of the visualizer.

#### 1. Create a Snapshot

A `Snapshot` is a container for everything you want to visualize. Create one and add shapes to it:

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
    snapshot.DrawGeometry(box, spatialmath.NewZeroPose(), "world", draw.NewColor(draw.WithName("red")))

    // Draw some points
    positions := []r3.Vector{
        {X: 200, Y: 0, Z: 0},
        {X: 200, Y: 100, Z: 0},
        {X: 200, Y: 100, Z: 100},
    }
    snapshot.DrawPoints("my-points", "world", spatialmath.NewZeroPose(), positions,
        draw.WithPointsColors(draw.NewColor(draw.WithName("blue"))))

    // Draw a line connecting dots
    lineDots := []r3.Vector{
        {X: 0, Y: 0, Z: 200},
        {X: 100, Y: 100, Z: 200},
        {X: 200, Y: 0, Z: 200},
    }
    snapshot.DrawLine("my-line", "world", spatialmath.NewZeroPose(), lineDots,
        draw.WithLineWidth(3.0),
        draw.WithSingleLineColor(draw.NewColor(draw.WithName("green"))))

    // Export to JSON for rendering
    jsonData, _ := snapshot.MarshalJSON()
    os.WriteFile("scene.json", jsonData, 0644)
    fmt.Println("Scene exported to scene.json")
}
```

#### 2. Export Your Scene

Snapshots can be serialized in multiple formats:

```go
// JSON (human-readable, good for debugging)
jsonData, err := snapshot.MarshalJSON()

// Binary protobuf (compact, efficient)
binaryData, err := snapshot.MarshalBinary()

// Gzip-compressed binary (smallest size)
gzipData, err := snapshot.MarshalBinaryGzip()
```

#### 3. Render in the Visualizer

Any instance of the visualizer can accept snapshot files via drag-and-drop.

<!-- TODO: Adding snapshots to motion tools via component props -->

### Rendering with the draw server

You can draw directly to a local visualizer using the draw client.

See the [draw client docs](../client/README.md)
