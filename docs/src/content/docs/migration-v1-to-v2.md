---
title: 'Migration v1 to v2'
---

This guide covers migrating from the legacy draw client (`client/client`) to the new draw client API (`client/api`). Every changed function is documented with before/after examples.

## Quick Reference

| v1 (`client/client`)               | v2 (`client/api`)                  | Change Type                           |
| ---------------------------------- | ---------------------------------- | ------------------------------------- |
| `DrawLine`                         | `DrawLine`                         | Signature changed                     |
| `DrawPoints`                       | `DrawPoints`                       | Signature changed                     |
| `DrawPoses`                        | `DrawPosesAsArrows`                | Renamed + signature changed           |
| `DrawPointCloud`                   | `DrawPointCloud`                   | Signature changed                     |
| `DrawGeometry`                     | `DrawGeometry`                     | Signature changed                     |
| `DrawGeometries`                   | `DrawGeometriesInFrame`            | Renamed + signature changed           |
| `DrawFrames`                       | `DrawFrames`                       | Signature changed                     |
| `DrawFrameSystem`                  | `DrawFrameSystem`                  | Signature changed                     |
| `DrawGLTF`                         | `DrawGLTF`                         | Signature changed                     |
| `DrawNurbs`                        | `DrawNurbs`                        | Signature changed                     |
| `DrawRobot`                        | `DrawRobot`                        | Signature changed                     |
| `DrawWorldState`                   | `DrawWorldState`                   | Signature changed                     |
| `SetCameraPose`                    | `SetCamera`                        | Renamed + signature changed           |
| --                                 | `ResetCamera`                      | New                                   |
| `RemoveAllSpatialObjects`          | `RemoveAll`                        | Renamed + returns count               |
| `RemoveSpatialObjects`             | --                                 | Removed                               |
| `SetURL`                           | --                                 | Removed                               |
| --                                 | `RemoveDrawings`                   | New                                   |
| --                                 | `RemoveTransforms`                 | New                                   |
| `Record` / `StopRecord` / `Replay` | `Record` / `StopRecord` / `Replay` | Same signatures, new recording format |

---

## Import Path

```go
// v1
import "github.com/viam-labs/motion-tools/client/client"

// v2
import "github.com/viam-labs/motion-tools/client/api"
```

---

## Cross-Cutting Changes

Before diving into individual functions, there are three changes that affect almost every API call.

### 1. Options Structs Replace Positional Arguments

Every draw function now takes a single options struct instead of positional arguments. This makes calls self-documenting and allows adding new fields without breaking existing callers.

```go
// v1 -- positional arguments
client.DrawLine("my-line", points, &[3]uint8{255, 0, 0}, nil)

// v2 -- options struct
api.DrawLine(api.DrawLineOptions{
    Name:      "my-line",
    Positions: positions,
    Colors:    []draw.Color{draw.ColorFromRGB(255, 0, 0)},
})
```

### 2. Unified Color System (`draw.Color`)

v1 used a mix of color representations depending on the function: `string` names (`"red"`), `*[3]uint8` RGB tuples, and `[][3]uint8` per-element arrays. v2 standardizes on `draw.Color` everywhere. Convenience helpers make this concise:

```go
// v1 -- string color name
client.DrawGeometry(geo, "red")

// v1 -- RGB tuple
client.DrawLine("line", points, &[3]uint8{255, 0, 0}, nil)

// v2 -- draw.Color (all functions use this)
draw.ColorFromName("red")
draw.ColorFromRGB(255, 0, 0)
draw.ColorFromHex("#FF0000")
draw.ColorFromHSV(0.0, 1.0, 1.0)
```

For advanced use cases (e.g., setting alpha, combining options), the functional options constructor is available:

```go
draw.NewColor(draw.WithRGBA(255, 0, 0, 128))
```

### 3. Return Values: UUIDs

v1 functions returned only `error`. v2 functions return a UUID identifying the drawn object, which can be used to update it in-place later by passing the same value as the `ID` field.

```go
// v1
err := client.DrawLine("my-line", points, nil, nil)

// v2 -- returns a UUID
uuid, err := api.DrawLine(api.DrawLineOptions{
    Name:      "my-line",
    Positions: positions,
})

// Later, update the same object by passing its ID
_, err = api.DrawLine(api.DrawLineOptions{
    ID:        "my-line",
    Name:      "my-line",
    Positions: newPositions,
})
```

Functions that draw multiple objects (like `DrawFrameSystem`) return `[][]byte` (a slice of UUIDs).

---

## Per-Function Migration

### DrawLine

Positions changed from `[]spatialmath.Pose` to `[]r3.Vector`. Colors changed from `*[3]uint8` to `[]draw.Color`. New optional fields: `LineWidth`, `PointSize`, `Parent`, `ID`.

```go
// v1
client.DrawLine(
    "my-line",
    []spatialmath.Pose{pose1, pose2, pose3},
    &[3]uint8{255, 0, 0},  // line color
    &[3]uint8{0, 0, 255},  // point color
)

// v2
api.DrawLine(api.DrawLineOptions{
    Name:      "my-line",
    Positions: []r3.Vector{pos1, pos2, pos3},
    Colors: []draw.Color{
        draw.ColorFromRGB(255, 0, 0), // line color
        draw.ColorFromRGB(0, 0, 255), // point color
    },
    LineWidth: 3.0,  // optional, in mm
    DotSize:   8.0,  // optional, in mm
})
```

### DrawPoints

Positions changed from `[]spatialmath.Pose` to `[]r3.Vector`. The separate `colors [][3]uint8` and `color *[3]uint8` fallback arguments are replaced by a single `Colors []draw.Color` field. New optional fields: `PointSize`, `Parent`, `ID`.

```go
// v1
client.DrawPoints(
    "my-points",
    []spatialmath.Pose{pose1, pose2},
    [][3]uint8{{255, 0, 0}, {0, 255, 0}},  // per-point colors
    &[3]uint8{128, 128, 128},              // fallback color
)

// v2 -- per-point colors
api.DrawPoints(api.DrawPointsOptions{
    Name:      "my-points",
    Positions: []r3.Vector{pos1, pos2},
    Colors: []draw.Color{
        draw.ColorFromRGB(255, 0, 0),
        draw.ColorFromRGB(0, 255, 0),
    },
    PointSize: 10.0, // optional, in mm
})

// v2 -- single color for all points
api.DrawPoints(api.DrawPointsOptions{
    Name:      "my-points",
    Positions: []r3.Vector{pos1, pos2},
    Colors:    []draw.Color{draw.ColorFromRGB(128, 128, 128)},
})
```

### DrawPoses -> DrawPosesAsArrows

Renamed. Color strings replaced by `[]draw.Color`. New fields: `Name`, `Parent`, `ID`.

```go
// v1
client.DrawPoses(
    []spatialmath.Pose{pose1, pose2},
    []string{"red", "blue"},
    true, // arrowHeadAtPose
)

// v2
api.DrawPosesAsArrows(api.DrawPosesAsArrowsOptions{
    Name:  "my-arrows",
    Poses: []spatialmath.Pose{pose1, pose2},
    Colors: []draw.Color{
        draw.ColorFromName("red"),
        draw.ColorFromName("blue"),
    },
})
```

### DrawPointCloud

Override color changed from `*[3]uint8` to `[]draw.Color`. New optional fields: `DownscalingThreshold`, `ID`.

```go
// v1
client.DrawPointCloud("my-cloud", pc, &[3]uint8{200, 0, 0})

// v2
api.DrawPointCloud(api.DrawPointCloudOptions{
    Label:                "my-cloud",
    PointCloud:           pc,
    Colors:               []draw.Color{draw.ColorFromRGB(200, 0, 0)},
    DownscalingThreshold: 25.0, // optional, in mm
})
```

### DrawGeometry

Color changed from a `string` name to `draw.Color`. New optional fields: `Parent`, `ID`.

```go
// v1
client.DrawGeometry(geometry, "red")

// v2
api.DrawGeometry(api.DrawGeometryOptions{
    Geometry: geometry,
    Color:    draw.ColorFromName("red"),
    Parent:   "my-frame", // optional, defaults to "world"
})
```

### DrawGeometries -> DrawGeometriesInFrame

Renamed. Colors changed from `[]string` to `[]draw.Color`. New optional fields: `DownscalingThreshold`, `ID`.

```go
// v1
client.DrawGeometries(geometriesInFrame, []string{"red", "blue", "green"})

// v2
api.DrawGeometriesInFrame(api.DrawGeometriesInFrameOptions{
    Geometries: geometriesInFrame,
    Colors: []draw.Color{
        draw.ColorFromName("red"),
        draw.ColorFromName("blue"),
        draw.ColorFromName("green"),
    },
    DownscalingThreshold: 25.0, // optional, in mm
})
```

### DrawFrames

Wrapped in options struct. New optional field: `ID`.

```go
// v1
client.DrawFrames(frames)

// v2
api.DrawFrames(api.DrawFramesOptions{
    Frames: frames,
})
```

### DrawFrameSystem

Wrapped in options struct. New optional fields: `Colors` (per-frame color map), `ID`.

```go
// v1
client.DrawFrameSystem(fs, inputs)

// v2
api.DrawFrameSystem(api.DrawFrameSystemOptions{
    FrameSystem: fs,
    Inputs:      inputs,
    Colors: map[string]draw.Color{ // optional per-frame colors
        "arm":  draw.ColorFromName("red"),
        "base": draw.ColorFromName("blue"),
    },
})
```

### DrawGLTF

Wrapped in options struct. New optional fields: `Name`, `Parent`, `Scale`, `ID`.

```go
// v1
client.DrawGLTF("/path/to/model.glb")

// v2
api.DrawGLTF(api.DrawGLTFOptions{
    Name:     "my-model",
    FilePath: "/path/to/model.glb",
    Scale:    r3.Vector{X: 1, Y: 1, Z: 1}, // optional, defaults to (1,1,1)
})
```

### DrawNurbs

Color changed from a `string` name to `draw.Color`. New optional fields: `LineWidth`, `Parent`, `ID`.

```go
// v1
client.DrawNurbs(shapes.Nurbs{
    ControlPts: controlPts,
    Degree:     3,
    Weights:    weights,
    Knots:      knots,
}, "cyan", "my-curve")

// v2
api.DrawNurbs(api.DrawNurbsOptions{
    Name:          "my-curve",
    ControlPoints: controlPts,
    Knots:         knots,
    Degree:        3,
    Weights:       weights,
    Color:         draw.ColorFromName("cyan"),
    LineWidth:     5.0, // optional, in mm
})
```

### DrawRobot

Wrapped in options struct. New optional fields: `Colors`, `ID`.

```go
// v1
client.DrawRobot(ctx, myRobot, worldState)

// v2
api.DrawRobot(api.DrawRobotOptions{
    Ctx:        ctx,
    Robot:      myRobot,
    WorldState: worldState,
    Colors: []draw.Color{ // optional
        draw.ColorFromName("red"),
        draw.ColorFromName("blue"),
    },
})
```

### DrawWorldState

Wrapped in options struct. New optional fields: `Colors`, `ID`.

```go
// v1
client.DrawWorldState(worldState, fs, inputs)

// v2
api.DrawWorldState(api.DrawWorldStateOptions{
    WorldState:  worldState,
    FrameSystem: fs,
    Inputs:      inputs,
    Colors: []draw.Color{ // optional
        draw.ColorFromName("orange"),
    },
})
```

### SetCameraPose -> SetCamera

Renamed. Wrapped in options struct.

```go
// v1
client.SetCameraPose(
    r3.Vector{X: 3000, Y: 3000, Z: 3000},
    r3.Vector{X: 0, Y: 0, Z: 0},
    true,
)

// v2
api.SetCamera(api.SetCameraPoseOptions{
    Position: r3.Vector{X: 3000, Y: 3000, Z: 3000},
    LookAt:   r3.Vector{X: 0, Y: 0, Z: 0},
    Animate:  true,
})
```

### ResetCamera (new)

Resets the camera to the default position. No v1 equivalent.

```go
api.ResetCamera()
```

---

## Removal Functions

### RemoveAllSpatialObjects -> RemoveAll

Renamed. Now returns the count of removed items.

```go
// v1
err := client.RemoveAllSpatialObjects()

// v2
count, err := api.RemoveAll()
```

### RemoveSpatialObjects (removed)

`RemoveSpatialObjects(names []string)` has been removed. v2 separates removal into two category-specific functions:

```go
// v2 -- remove all visual primitives (lines, points, arrows, NURBS, GLTF models)
count, err := api.RemoveDrawings()

// v2 -- remove all spatial objects (geometries, frames, frame systems, point clouds)
count, err := api.RemoveTransforms()
```

---

## Recording and Replay

The function signatures for `Record`, `StopRecord`, and `Replay` are unchanged:

```go
api.Record("recording.bin")
// ... draw operations ...
api.StopRecord()

api.Replay("recording.bin", 1.0) // 1.0 = normal speed, 2.0 = 2x, 0.5 = half
```

**Breaking change:** The recording file format has changed. v1 recordings are not compatible with v2. If you have existing v1 recordings, they must be re-recorded using the v2 API.

---

## `draw` Package: Color API

If you use the `draw` package directly (e.g., for snapshots), the `Color` type and its constructors are the primary change.

### Creating Colors

The convenience helpers cover the most common cases:

```go
draw.ColorFromName("red")           // CSS/web color name
draw.ColorFromRGB(128, 64, 200)     // RGB (0-255)
draw.ColorFromRGBA(128, 64, 200, 180) // RGBA (0-255)
draw.ColorFromHex("#FF5733")        // hex string
draw.ColorFromHSV(0.5, 0.8, 1.0)   // HSV (0.0-1.0)
```

### Modifying Colors

```go
c := draw.ColorFromName("blue")
transparent := c.SetAlpha(128)
recolored := c.SetRGB(255, 0, 0)
```

### Color Chooser

v1 had `DefaultColorMap` (a `[]string` of hex values). v2 replaces this with `draw.ColorChooser`:

```go
// v1
color := client.DefaultColorMap[i % len(client.DefaultColorMap)]

// v2
color := draw.ChromaticColorChooser.Next() // returns draw.Color, cycles automatically
```

### Default Colors

The `draw` package exports default colors for each primitive type:

```go
draw.DefaultArrowColor     // green
draw.DefaultLineColor      // blue
draw.DefaultLineDotColor   // dark blue
draw.DefaultPointColor     // gray
```
