# Draw

The `draw` package provides a Go API for creating and managing 3D visualizations with Viam's motion tools and visualization systems. Along with rendering Viam geometries, it allows you to define scenes, cameras, and various 3D shapes like arrows, lines, points, and models, which can then be serialized to Protobuf for rendering.

## Features

- **Scene Configuration**: Define camera properties (position, look-at, perspective/orthographic) and global scene settings (grid, point sizes, etc.).
- **Shapes**: Support for various geometric primitives and complex objects:
  - Viam Geometries (spheres, capsules, boxes, meshes, point clouds, etc...)
  - Arrows (multiple arrows at specified poses)
  - Lines (polylines with optional points at vertices)
  - Points (point clouds or sets of points)
  - 3D Models (GLB, PLY, PCD, etc.)
  - NURBS curves
- **Frame System Integration**: Helpers to visualize Viam RDK `referenceframe.FrameSystem` structures.
- **Color Management**: Flexible color definition using RGB, RGBA, HSV, or standard web color names.

## Usage

### Scene Configuration

Configure the scene camera and metadata to control how the visualization is rendered.

```go
import "github.com/viam-labs/motion-tools/draw"
import "github.com/golang/geo/r3"

// Create a camera looking at the origin from (3000, 3000, 3000)
camera := draw.NewSceneCamera(
    r3.Vector{X: 3000, Y: 3000, Z: 3000}, // Position
    r3.Vector{X: 0, Y: 0, Z: 0},          // LookAt
    draw.WithAnimated(true),
)

// Create scene metadata with custom grid settings
metadata := draw.NewSceneMetadata(
    draw.WithSceneCamera(camera),
    draw.WithGrid(true),
    draw.WithGridCellSize(500),
    draw.WithScenePointSize(2.0),
    draw.WithScenePointColor(draw.NewColor(draw.WithName("red"))),
)
```

### Creating Shapes and Drawings

You can create individual shapes and wrap them in a `Drawing` object, which places the shape in a specific reference frame.

#### Arrows

```go
import (
    "github.com/viam-labs/motion-tools/draw"
    "go.viam.com/rdk/spatialmath"
)

// Define poses for arrows
poses := []spatialmath.Pose{
    spatialmath.NewZeroPose(),
    spatialmath.NewPoseFromPoint(r3.Vector{X: 100, Y: 0, Z: 0}),
}

// Create arrows object
arrows, _ := draw.NewArrows(
    poses,
    draw.WithArrowsColors(draw.NewColor(draw.WithName("cyan"))),
)

// Create a drawing in the "world" frame
drawing := arrows.Draw("arrow-drawing", "world", spatialmath.NewZeroPose())
```

#### Lines

```go
// Define points for the line
points := []r3.Vector{
    {X: 0, Y: 0, Z: 0},
    {X: 100, Y: 100, Z: 100},
}

// Create line with custom width and colors
line, _ := draw.NewLine(
    points,
    draw.WithLineWidth(5.0),
    draw.WithLineColors(
        draw.NewColor(draw.WithName("blue")),
        nil, // use same color for points
    ),
)

// Draw the line
lineDrawing := line.Draw("line-drawing", "world", spatialmath.NewZeroPose())
```

### Working with Models

Load and display 3D models from URLs or binary data.

```go
// Load a model from a URL
asset, _ := draw.NewURLModelAsset("model/gltf-binary", "https://example.com/robot.glb")

model, _ := draw.NewModel(
    draw.WithModelAssets(asset),
    draw.WithModelScale(r3.Vector{X: 0.1, Y: 0.1, Z: 0.1}),
)

// Draw the model
modelDrawing := model.Draw("robot-model", "world", spatialmath.NewZeroPose())
```

### Visualizing Frame Systems

Easily visualize an entire `referenceframe.FrameSystem`.

```go
import (
    "github.com/viam-labs/motion-tools/draw"
    "go.viam.com/rdk/referenceframe"
)

// Assuming you have a populated FrameSystem and Inputs
var fs *referenceframe.FrameSystem
var inputs referenceframe.FrameSystemInputs

// Define colors for specific frames (optional)
colors := map[string]draw.Color{
    "arm_link_1": draw.NewColor(draw.WithName("red")),
}

// Generate transforms for visualization
transforms, err := draw.DrawFrameSystemGeometries(fs, inputs, colors)
```

## Colors

The package provides a fluent API for defining colors.

```go
// RGB
c1 := draw.NewColor(draw.WithRGB(255, 0, 0))

// RGBA
c2 := draw.NewColor(draw.WithRGBA(color.RGBA{R: 0, G: 255, B: 0, A: 128}))

// Named color (SVG 1.1 keywords)
c3 := draw.NewColor(draw.WithName("magenta"))

// HSV
c4 := draw.NewColor(draw.WithHSV(0.5, 1.0, 1.0))
```
