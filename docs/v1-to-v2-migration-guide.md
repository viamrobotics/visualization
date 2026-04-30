# Migrating from `client/client` (v1) to `client/api` (v2)

The [client/api](../client/api) package is the new public API for drawing to the motion-tools visualizer. It replaces the legacy [client/client](../client/client) package, which will be removed in a future release. This guide walks through the code changes you need to move from v1 to v2 without changing what your visualizations render.

## Prerequisites

Both v1 and v2 assume you run the visualizer locally with `make up`. No extra server-lifecycle code is required in your program.

## Quick Reference

| v1 (`client/client`)               | v2 (`client/api`)                  | Change type                           |
| ---------------------------------- | ---------------------------------- | ------------------------------------- |
| `DrawGeometry`                     | `DrawGeometry`                     | Signature changed                     |
| `DrawGeometries`                   | `DrawGeometriesInFrame`            | Renamed + signature changed           |
| `DrawFrameSystem`                  | `DrawFrameSystem`                  | Signature changed                     |
| `DrawFrames`                       | `DrawFrames`                       | Signature changed                     |
| `DrawPoints`                       | `DrawPoints`                       | Signature changed                     |
| `DrawLine`                         | `DrawLine`                         | Signature changed                     |
| `DrawPoses`                        | `DrawPosesAsArrows`                | Renamed + signature changed           |
| `DrawPointCloud`                   | `DrawPointCloud`                   | Signature changed                     |
| `DrawNurbs`                        | `DrawNurbs`                        | Signature changed                     |
| `DrawGLTF`                         | `DrawGLTF`                         | Signature changed                     |
| `DrawRobot`                        | `DrawRobot`                        | Signature changed                     |
| `DrawWorldState`                   | `DrawWorldState`                   | Signature changed                     |
| `SetCameraPose`                    | `SetCamera`                        | Renamed + signature changed           |
| —                                  | `ResetCamera`                      | New                                   |
| `RemoveAllSpatialObjects`          | `RemoveAll`                        | Renamed + returns count               |
| `RemoveSpatialObjects`             | —                                  | Removed                               |
| —                                  | `RemoveTransforms`                 | New                                   |
| —                                  | `RemoveDrawings`                   | New                                   |
| —                                  | `CreateRelationship`               | New                                   |
| —                                  | `DeleteRelationship`               | New                                   |
| `Record` / `StopRecord` / `Replay` | `Record` / `StopRecord` / `Replay` | Same signatures, new recording format |
| `SetURL`                           | —                                  | Removed                               |
| `DefaultColorMap`                  | —                                  | Removed (see color section)           |
| `colorutil.NamedColorToRGB`        | —                                  | Removed (use `draw.ColorFromName`)    |
| `shapes.Nurbs`                     | —                                  | Removed (fields inlined)              |

## Import path

```go
// v1
import "github.com/viam-labs/motion-tools/client/client"

// v2
import "github.com/viam-labs/motion-tools/client/api"
```

## Cross-cutting changes

Four changes apply to nearly every function, so it's worth understanding them before the per-function migrations below.

### 1. Options structs replace positional arguments

Every draw function now takes a single `DrawXxxOptions` struct instead of positional arguments. This makes calls self-documenting and lets new fields be added without breaking existing callers.

```go
// v1 — positional arguments
client.DrawLine("my-line", points, &[3]uint8{255, 0, 0}, nil)
```

```go
// v2 — options struct
api.DrawLine(api.DrawLineOptions{
    Name:      "my-line",
    Positions: positions,
    Colors:    []draw.Color{draw.ColorFromRGB(255, 0, 0)},
})
```

### 2. Unified color system (`draw.Color`)

v1 used a mix of color representations depending on the function: `string` names (`"red"`), `*[3]uint8` RGB tuples, and `[][3]uint8` per-element arrays. v2 standardizes on a single `draw.Color` type everywhere. The convenience helpers cover the common cases:

```go
// v1 — string color name
client.DrawGeometry(geo, "red")

// v1 — RGB tuple
client.DrawLine("line", points, &[3]uint8{255, 0, 0}, nil)
```

```go
// v2 — draw.Color (all functions use this)
draw.ColorFromName("red")
draw.ColorFromRGB(255, 0, 0)
draw.ColorFromHex("#FF0000")
draw.ColorFromHSV(0.0, 1.0, 1.0)
```

See [draw Package: Color API](#draw-package-color-api) at the bottom of this guide for the full reference, including alpha, hex, HSV, chooser, and default colors.

### 3. Return values: UUIDs

v1 draw functions returned only `error`. v2 functions return a UUID (or slice of UUIDs for functions that draw multiple entities) identifying what they just drew. Pass the same value back in as the `ID` field on a later call to update that entity in place.

```go
// v1
err := client.DrawLine("my-line", points, nil, nil)
```

```go
// v2 — returns a UUID
uuid, err := api.DrawLine(api.DrawLineOptions{
    Name:      "my-line",
    Positions: positions,
})

// Later, update the same line in place by passing its ID.
_, err = api.DrawLine(api.DrawLineOptions{
    ID:        "my-line",
    Name:      "my-line",
    Positions: newPositions,
})
```

Functions that draw multiple entities (for example `DrawFrameSystem`, `DrawGeometriesInFrame`, `DrawRobot`) return `[][]byte`.

### 4. Optional entity fields (`ID`, `Name`, `Parent`, `Attrs`)

Every options struct accepts these optional fields (see [client/api/attrs.go](../client/api/attrs.go)):

- `ID` — stable identifier for in-place updates via subsequent calls.
- `Name` — human-readable label shown in the treeview.
- `Parent` — parent frame name; defaults to `"world"` when empty.
- `Attrs` — pointer struct with `ShowAxesHelper *bool` and `Invisible *bool` toggles.

## Removed helpers

The following v1 helpers have no v2 equivalent and can be deleted from your code:

- `client.SetURL` — transport is no longer user-configurable.
- `client.DefaultColorMap` — see [draw Package: Color API](#draw-package-color-api) for how to rebuild the same palette or swap in `draw.ChromaticColorChooser`.
- `colorutil.NamedColorToRGB` — use `draw.ColorFromName` instead.
- `shapes.Nurbs` — pass `ControlPoints`, `Knots`, `Weights`, and `Degree` directly to `DrawNurbs`.
- `client.RemoveSpatialObjects(names)` — remove-by-name is not supported; see [Removing objects](#removing-objects) below.

## Per-function migration

### DrawGeometry

```go
// v1
client.DrawGeometry(box, "purple")
```

```go
// v2 — see client/api/draw_geometry.go
uuid, err := api.DrawGeometry(api.DrawGeometryOptions{
    ID:       "box",
    Geometry: box,
    Color:    draw.ColorFromName("purple"),
})
```

- Reuse `ID` on subsequent calls to update the geometry in place.
- Omit `Color` to use the default.

### DrawGeometries → DrawGeometriesInFrame (renamed)

```go
// v1
client.DrawGeometries(geometriesInFrame, []string{"red", "blue"})
```

```go
// v2 — see client/api/draw_geometries.go
uuids, err := api.DrawGeometriesInFrame(api.DrawGeometriesInFrameOptions{
    Geometries: geometriesInFrame,
    Colors: []draw.Color{
        draw.ColorFromName("red"),
        draw.ColorFromName("blue"),
    },
})
```

- The length of `Colors` determines behavior: `0` (omitted) defaults to red, `1` color for all geometries, `len(geometries)` for per-geometry, any other length for a cycling palette.
- **Rendering parity:** v1 silently downscaled any `pointcloud.PointCloud` geometry to `minDistance=25 mm` and forced a red override color. v2 does not do this automatically. To preserve v1 rendering of mixed geometry/point-cloud bundles, set `DownscalingThreshold: 25` on the options, and/or call `api.DrawPointCloud` separately with `Colors: []draw.Color{draw.ColorFromRGB(200, 0, 0)}`.

### DrawFrameSystem

```go
// v1
client.DrawFrameSystem(fs, inputs)
```

```go
// v2 — see client/api/draw_frame_system.go
uuids, err := api.DrawFrameSystem(api.DrawFrameSystemOptions{
    FrameSystem: fs,
    Inputs:      inputs,
})
```

- Optional `Colors map[string]draw.Color` sets per-frame colors. Frames not in the map inherit their parent's color, falling back to magenta if no ancestor has a color.

### DrawFrames

```go
// v1
client.DrawFrames([]referenceframe.Frame{frameA, frameB})
```

```go
// v2 — see client/api/draw_frames.go
uuids, err := api.DrawFrames(api.DrawFramesOptions{
    Frames: []referenceframe.Frame{frameA, frameB},
})
```

- v2 produces one transform per frame geometry (named `frameName:geoLabel`, or just `frameName` when the geometry has no label). Frames with no geometry render as an axes helper.
- Optional `Colors map[string]draw.Color` colors frames by name. Frames not in the map default to `draw.DefaultFrameColor`.

### DrawPoints

```go
// v1
client.DrawPoints("my-points", poses, colors, &[3]uint8{0, 0, 0})
```

```go
// v2 — see client/api/draw_points.go
uuid, err := api.DrawPoints(api.DrawPointsOptions{
    Name:      "my-points",
    Positions: positions, // []r3.Vector, not []spatialmath.Pose
    Colors:    []draw.Color{ /* single, per-point, or palette */ },
    PointSize: 10.0, // optional, in mm
})
```

- `points []spatialmath.Pose` becomes `Positions []r3.Vector`. Replace `pose.Point()` calls with the vector directly.
- `colors [][3]uint8` and the fallback `color *[3]uint8` collapse into a single `Colors []draw.Color`. The length decides the semantics: `0` = default, `1` = single color for all points, `len(Positions)` = per-point, anything else = cycling palette.
- New optional `PointSize float32` (mm).
- New optional `ChunkSize int` and `OnProgress func(draw.ChunkProgress)` fields let you stream very large point sets in chunks; leave unset (the default) to send everything in one call.

### DrawLine

```go
// v1
client.DrawLine(
    "my-line",
    poses,
    &[3]uint8{0, 0, 255}, // line color
    &[3]uint8{0, 0, 128}, // dot color
)
```

```go
// v2 — see client/api/draw_line.go
uuid, err := api.DrawLine(api.DrawLineOptions{
    Name:      "my-line",
    Positions: positions, // []r3.Vector
    Colors:    []draw.Color{draw.ColorFromRGB(0, 0, 255)},
    DotColors: []draw.Color{draw.ColorFromRGB(0, 0, 128)},
    LineWidth: 20, // mm; omit for default
    DotSize:   40, // mm; omit for default
})
```

- `points []spatialmath.Pose` becomes `Positions []r3.Vector`.
- `color` / `dotColor` scalars become `Colors` / `DotColors` slices whose length (`0` / `1` / `len(Positions)` / other) selects default / single / per-vertex / palette behavior.
- When `DotColors` is omitted but `Colors` is set, dots inherit the `Colors` values. To use the default dot color while customizing the line, leave both unset or set `DotColors` explicitly.
- New optional `LineWidth` and `DotSize` in millimeters.

### DrawPoses → DrawPosesAsArrows (renamed)

```go
// v1
client.DrawPoses(poses, []string{"red", "green", "blue"}, true)
```

```go
// v2 — see client/api/draw_poses_as_arrows.go
uuid, err := api.DrawPosesAsArrows(api.DrawPosesAsArrowsOptions{
    Name:  "arrows",
    Poses: poses,
    Colors: []draw.Color{
        draw.ColorFromName("red"),
        draw.ColorFromName("green"),
        draw.ColorFromName("blue"),
    },
})
```

- **Breaking change:** the `arrowHeadAtPose bool` parameter is gone. v2 always renders with the arrow tip at the pose (equivalent to v1's `arrowHeadAtPose=true`). If your v1 code used the default (`false`, tail at pose, tip along the orientation vector), flip each pose's orientation before calling `DrawPosesAsArrows` to preserve the previous look.
- Color semantics are length-driven: `0` = `draw.DefaultArrowColor`, `1` = single, `len(Poses)` = per-arrow, other = palette.

### DrawPointCloud

```go
// v1
client.DrawPointCloud("pcd", pc, &[3]uint8{200, 0, 0})
```

```go
// v2 — see client/api/draw_point_cloud.go
uuid, err := api.DrawPointCloud(api.DrawPointCloudOptions{
    Name:                 "pcd",
    PointCloud:           pc,
    Colors:               []draw.Color{draw.ColorFromRGB(200, 0, 0)},
    DownscalingThreshold: 25.0, // optional, in mm
})
```

- `overrideColor *[3]uint8` becomes `Colors []draw.Color`. Length `0` keeps the cloud's own color data; `1` overrides every point; `pc.Size()` is per-point; other = cycling palette.
- New optional `DownscalingThreshold float64` (mm). This replaces the implicit `minDistance=25` downscaling that v1 performed inside `DrawGeometries` for any `pointcloud.PointCloud` geometry.
- New optional `ChunkSize int` and `OnProgress func(draw.ChunkProgress)` fields let you stream very large point clouds in chunks; leave unset (the default) to send everything in one call.

### DrawNurbs

```go
// v1
n := shapes.Nurbs{
    ControlPts: controlPoints,
    Knots:      knots,
    Weights:    weights,
    Degree:     3,
}
client.DrawNurbs(n, "red", "my-curve")
```

```go
// v2 — see client/api/draw_nurbs.go
uuid, err := api.DrawNurbs(api.DrawNurbsOptions{
    Name:          "my-curve",
    ControlPoints: controlPoints,
    Knots:         knots,
    Weights:       weights,
    Degree:        3,
    Color:         draw.ColorFromName("red"),
    LineWidth:     5.0, // optional, in mm
})
```

- The `shapes.Nurbs` wrapper is no longer needed.
- New optional `LineWidth float32` (mm).

### DrawGLTF

```go
// v1
client.DrawGLTF("/path/to/model.glb")
```

```go
// v2 — see client/api/draw_gltf.go
uuid, err := api.DrawGLTF(api.DrawGLTFOptions{
    Name:     "model",
    FilePath: "/path/to/model.glb",
    // Scale defaults to (1, 1, 1) when omitted.
})
```

- `Scale r3.Vector` is optional. Omit it to render at the model's native size (equivalent to `r3.Vector{X: 1, Y: 1, Z: 1}`). If you do set it, all three components must be non-zero — a partial-zero value like `{1, 0, 1}` returns an error.

### DrawRobot

```go
// v1
client.DrawRobot(ctx, myRobot, ws)
```

```go
// v2 — see client/api/draw_robot.go
uuids, err := api.DrawRobot(api.DrawRobotOptions{
    Ctx:        ctx,
    Robot:      myRobot,
    WorldState: ws, // optional
})
```

- The default color palette in v2 matches v1's `DefaultColorMap` exactly, so the render is unchanged.
- Optional `Colors []draw.Color` overrides the palette. Optional `ID` prefix names each drawn element.

### DrawWorldState

```go
// v1
client.DrawWorldState(ws, fs, inputs)
```

```go
// v2 — see client/api/draw_world_state.go
uuids, err := api.DrawWorldState(api.DrawWorldStateOptions{
    WorldState:  ws,
    FrameSystem: fs,
    Inputs:      inputs,
})
```

- **Rendering parity:** when `Colors` is empty, v1 cycled through `DefaultColorMap` (the Matplotlib "Set1" palette) while v2 cycles through `draw.ChromaticColorChooser` (SVG named colors with perceptible hue). To keep the v1 look, pass the v1 palette explicitly:

```go
uuids, err := api.DrawWorldState(api.DrawWorldStateOptions{
    WorldState:  ws,
    FrameSystem: fs,
    Inputs:      inputs,
    Colors: []draw.Color{
        draw.ColorFromHex("#E41A1C"),
        draw.ColorFromHex("#377EB8"),
        draw.ColorFromHex("#4DAF4A"),
        draw.ColorFromHex("#984EA3"),
        draw.ColorFromHex("#FF7F00"),
        draw.ColorFromHex("#FFFF33"),
        draw.ColorFromHex("#A65628"),
        draw.ColorFromHex("#F781BF"),
        draw.ColorFromHex("#999999"),
    },
})
```

### SetCameraPose → SetCamera (renamed)

```go
// v1
client.SetCameraPose(position, lookAt, true)
```

```go
// v2 — see client/api/set_camera.go
err := api.SetCamera(api.SetCameraPoseOptions{
    Position: position,
    LookAt:   lookAt,
    Animate:  true,
})
```

- `Position` and `LookAt` are in millimeters in both versions.

### ResetCamera (new)

No v1 equivalent. Resets the camera to the default pose.

```go
err := api.ResetCamera()
```

### CreateRelationship / DeleteRelationship (new)

No v1 equivalent. Relationships are directed links between two entities (identified by their UUIDs from a `Draw*` call) that the visualizer can use to keep their state in sync — for example, a `"HoverLink"` that ties a label to the geometry it annotates.

```go
// see client/api/create_relationship.go
err := api.CreateRelationship(sourceUUID, targetUUID, "HoverLink", "index")

// see client/api/delete_relationship.go
err := api.DeleteRelationship(sourceUUID, targetUUID)
```

- `relType` is a free-form string identifying the relationship kind.
- `indexMapping` is an optional filtrex expression; pass `""` to use the server default of `"index"`.

## Removing objects

```go
// v1
client.RemoveAllSpatialObjects()
client.RemoveSpatialObjects([]string{"box", "sphere"})
```

```go
// v2
count, err := api.RemoveAll()        // see client/api/remove_all.go
count, err := api.RemoveTransforms() // see client/api/remove_transforms.go
count, err := api.RemoveDrawings()   // see client/api/remove_drawings.go
```

- All three v2 functions return `int32`, the count of removed entities.
- `RemoveTransforms` clears geometries, frames, frame systems, and point clouds.
- `RemoveDrawings` clears lines, points, arrows, NURBS, and GLTF models.
- `RemoveSpatialObjects(names)` has **no direct replacement** — remove-by-name is not supported. Use `RemoveTransforms` / `RemoveDrawings` to clear a category, or prefer the v2 `ID` pattern: keep your entity IDs stable and update them in place via subsequent `Draw*` calls rather than remove-then-redraw.

## Recording and replay

The `Record`, `StopRecord`, and `Replay` signatures are unchanged:

```go
// v2 — see client/api/replay.go
api.Record("session.replay")
// ... draw things ...
api.StopRecord()

err := api.Replay("session.replay", 1.0) // 1.0 = normal, 2.0 = 2x, 0.5 = half
```

**Breaking change:** the recording file format is now protobuf-framed Connect-RPC requests rather than v1's HTTP payloads. v1 recordings will not replay under v2 and vice versa. Re-record any replay files you still need.

## End-to-end example

A fully-runnable v2 script lives at [docs/examples/basic.go](../docs/examples/basic.go). With the visualizer up, run it with:

```bash
go run ./docs/examples/basic.go
```

It clears the scene, sets the camera, draws a box, a square on the ground, a ring of arrows, and two reference frames, then animates the box in place by re-drawing it with the same `ID`.

## `draw` package: Color API

All color inputs in the v2 client API use the `draw.Color` type from [draw/color.go](../draw/color.go). If you use the `draw` package directly (for example, for snapshots), the same type and its constructors apply.

### Creating colors

The convenience helpers cover the most common cases:

```go
draw.ColorFromName("red")                                       // CSS/web color name
draw.ColorFromRGB(128, 64, 200)                                 // RGB (0-255)
draw.ColorFromRGBA(128, 64, 200, 180)                           // RGBA (0-255)
draw.ColorFromHex("#FF5733")                                    // hex string
draw.ColorFromHSV(0.5, 0.8, 1.0)                                // HSV (0.0-1.0)
draw.ColorFromColorRGBA(color.RGBA{R: 255, G: 0, B: 0, A: 255}) // image/color.RGBA
```

For advanced use cases, the functional options constructor is available:

```go
c := draw.NewColor(draw.WithRGBA(255, 0, 0, 128))     // equivalent to draw.ColorFromRGBA(255, 0, 0, 128)
c = draw.NewColor(draw.WithName("red"))               // equivalent to draw.ColorFromName("red")
c = draw.NewColor(draw.WithHSV(0.5, 0.8, 1.0))        // equivalent to draw.ColorFromHSV(0.5, 0.8, 1.0)
```

### Migrating common v1 color inputs

```go
// v1 string (SVG name)       →  v2
"red"                           → draw.ColorFromName("red")

// v1 RGB tuple                →  v2
&[3]uint8{200, 0, 0}            → draw.ColorFromRGB(200, 0, 0)

// v1 per-element RGB list     →  v2
[][3]uint8{ {200, 0, 0}, ... }  → []draw.Color{ draw.ColorFromRGB(200, 0, 0), ... }

// v1 "no override" nil        →  v2: omit the Color / Colors field (sensible defaults apply)
```

### Modifying colors

Each setter returns a new `Color`, so it's safe to chain:

```go
c := draw.ColorFromName("blue")
transparent := c.SetAlpha(128)      // keep RGB, change alpha
recolored   := c.SetRGB(255, 0, 0)  // keep alpha, change RGB
combined    := c.SetRGBA(255, 0, 0, 128)
```

### Default colors

The `draw` package exports default colors for each primitive type (see [draw/color.go](../draw/color.go)):

```go
draw.DefaultArrowColor   // green
draw.DefaultLineColor    // blue
draw.DefaultLineDotColor // dark blue
draw.DefaultPointColor   // gray
draw.DefaultFrameColor   // red (see draw/frames.go)
```

When you omit `Color` / `Colors` on a `Draw*` call, these defaults apply.

### Color choosers (replacement for `DefaultColorMap`)

v1 exposed `client.DefaultColorMap`, a `[]string` of 9 hex values cycled through by a private helper. v2 replaces this with a reusable `draw.ColorChooser` type (see [draw/color_chooser.go](../draw/color_chooser.go)).

To get the same 9-color Matplotlib "Set1" palette v1 used, build it from hex strings:

```go
var set1Palette = []draw.Color{
    draw.ColorFromHex("#E41A1C"),
    draw.ColorFromHex("#377EB8"),
    draw.ColorFromHex("#4DAF4A"),
    draw.ColorFromHex("#984EA3"),
    draw.ColorFromHex("#FF7F00"),
    draw.ColorFromHex("#FFFF33"),
    draw.ColorFromHex("#A65628"),
    draw.ColorFromHex("#F781BF"),
    draw.ColorFromHex("#999999"),
}
chooser := draw.NewColorChooser(set1Palette)

// Use one at a time...
c := chooser.Next()

// ...or grab a whole slice sized to match your entities.
colors := chooser.Get(len(geometries))
```

Two preset choosers are also available:

- `draw.ChromaticColorChooser` — SVG named colors with perceptible hue. This is the v2 default palette for `DrawWorldState`.
- `draw.AchromaticColorChooser` — near-greyscale SVG names (`gray`, `silver`, `ivory`, etc.).
