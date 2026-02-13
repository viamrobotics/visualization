// Package draw provides a Go API for creating and managing 3D visualizations with Viam's motion tools.
//
// This package supports two primary workflows for visualization:
//
//  1. Real-time: Use with the client SDK for live updates to a running visualizer
//  2. Snapshot-based: Create static scenes that can be exported to files or embedded in applications
//
// All drawn objects can be serialized to Protobuf for rendering.
//
// # Drawing Client Workflow
//
// For real-time drawing during development or integration testing, use the client SDK:
//
//	import "github.com/viam-labs/motion-tools/client/api"
//	import "github.com/viam-labs/motion-tools/client/server"
//
//	server.Start(3030, false)
//	defer server.Stop()
//
//	api.DrawLine(api.DrawLineOptions{
//	    Name:      "my-line",
//	    Positions: []r3.Vector{{X: 0, Y: 0, Z: 0}, {X: 100, Y: 100, Z: 100}},
//	})
//
// See the client package documentation for the complete drawing client API.
//
// # Snapshot Workflow
//
// Create a Snapshot to build a complete 3D scene, then serialize it for rendering:
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
//	// Draw a box
//	box, _ := spatialmath.NewBox(
//	    spatialmath.NewZeroPose(),
//	    r3.Vector{X: 100, Y: 100, Z: 100},
//	    "my-box",
//	)
//	snapshot.DrawGeometry(box, spatialmath.NewZeroPose(), "world", draw.NewColor(draw.WithName("red")))
//
//	// Draw points
//	positions := []r3.Vector{{X: 200, Y: 0, Z: 0}, {X: 200, Y: 100, Z: 100}}
//	snapshot.DrawPoints("my-points", "world", spatialmath.NewZeroPose(), positions,
//	    draw.WithPointsColors(draw.NewColor(draw.WithName("blue"))))
//
//	// Export to file
//	jsonData, _ := snapshot.MarshalJSON()
//	os.WriteFile("scene.json", jsonData, 0644)
//
// Snapshots can be serialized in JSON, Binary (Protobuf), or Gzip-compressed binary formats.
//
// # Color Management
//
// Colors can be created from names, hex codes, or RGB values:
//
//	colorByName := draw.NewColor(draw.WithName("red"))
//	colorByHex := draw.NewColor(draw.WithHex("#FF5733"))
//	colorByRGB := draw.NewColor(draw.WithRGB(255, 87, 51))
//	colorByRGBA := draw.NewColor(draw.WithRGBA(255, 87, 51, 180))
//
// Many drawing functions support flexible color options:
//   - Single color for all elements
//   - Per-element colors
//   - Color palettes that cycle through provided colors
package draw
