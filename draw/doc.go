// Package draw provides Go types and APIs for 3D visualization with Viam's motion tools.
//
// The package is organized around three areas:
//
//   - Types for drawable entities: visual primitives (lines, points, arrows, NURBS curves, 3D models)
//     and spatial objects (geometries, frames, point clouds) that can be serialized to Protobuf.
//   - A Connect-RPC [DrawService] that manages the state of transforms and drawings in a scene,
//     supporting add, update, remove, and streaming change events.
//   - [Snapshot] for building a complete static scene of transforms and drawings, with serialization
//     to JSON, binary Protobuf, or gzip-compressed Protobuf.
//
// # Creating Drawings and Transforms
//
// All drawable types follow the same pattern: construct with New*, then call Draw to produce
// a [Drawing] (for visual primitives) or a [*commonv1.Transform] (for spatial objects).
//
//	positions := []r3.Vector{{X: 0, Y: 0, Z: 0}, {X: 100, Y: 100, Z: 100}}
//	line, err := draw.NewLine(positions, draw.WithLineWidth(3.0))
//	if err != nil {
//	    panic(err)
//	}
//
//	drawing := line.Draw("my-line", draw.WithParent("world"))
//	proto := drawing.ToProto() // *drawv1.Drawing ready for the DrawService
//
// # Snapshots
//
// Create a [Snapshot] to build a complete 3D scene, then serialize it for rendering:
//
//	camera := draw.NewSceneCamera(
//	    r3.Vector{X: 2000, Y: 2000, Z: 2000},
//	    r3.Vector{X: 0, Y: 0, Z: 0},
//	    draw.WithAnimated(true),
//	)
//
//	snapshot := draw.NewSnapshot(
//	    draw.WithSceneCamera(camera),
//	    draw.WithGrid(true),
//	    draw.WithGridCellSize(250),
//	)
//
//	box, _ := spatialmath.NewBox(
//	    spatialmath.NewZeroPose(),
//	    r3.Vector{X: 100, Y: 100, Z: 100},
//	    "my-box",
//	)
//	snapshot.DrawGeometry(box, spatialmath.NewZeroPose(), "world", draw.ColorFromName("red"))
//
//	positions := []r3.Vector{{X: 200, Y: 0, Z: 0}, {X: 200, Y: 100, Z: 100}}
//	snapshot.DrawPoints("my-points", "world", spatialmath.NewZeroPose(), positions,
//	    draw.WithSinglePointColor(draw.ColorFromName("blue")))
//
//	jsonData, _ := snapshot.MarshalJSON()
//	os.WriteFile("scene.json", jsonData, 0644)
//
// Snapshots can be serialized in JSON, Binary (Protobuf), or Gzip-compressed binary formats.
//
// # Color Management
//
// Colors can be created from names, hex codes, or RGB values:
//
//	colorByName := draw.ColorFromName("red")
//	colorByHex  := draw.ColorFromHex("#FF5733")
//	colorByRGB  := draw.ColorFromRGB(255, 87, 51)
//	colorByRGBA := draw.ColorFromRGBA(255, 87, 51, 180)
//
// Many drawing functions support flexible color options:
//   - Single color for all elements
//   - Per-element colors
//   - Color palettes that cycle through provided colors
package draw
