// Package draw provides a Go API for building 3D scenes for the motion-tools visualizer.
//
// This package contains the in-memory scene builder for assembling snapshots of geometric
// primitives, 3D models, frame systems, and robot states. Snapshots can be serialized to
// JSON or Protobuf and rendered in the visualizer either by drag-and-drop or by passing
// the file as a component prop. For drawing directly to a running visualizer instance
// over Connect-RPC, see the client/api package.
//
// # Drawing API
//
// The package provides high-level methods on Snapshot organized into three categories:
//
//   - Drawings: Visual primitives like arrows, lines, points, NURBS curves, and 3D models
//   - Transforms: Spatial objects like geometries, frames, and frame systems
//   - Serialization: Export a snapshot as JSON, binary protobuf, or gzip-compressed binary
//
// Each Draw* method accepts a name and options, and registers the object on the snapshot.
// Calling a Draw* method with an existing name updates that object in place.
//
// # Example
//
//	package main
//
//	import (
//	    "os"
//
//	    "github.com/golang/geo/r3"
//	    "github.com/viam-labs/motion-tools/draw"
//	    "go.viam.com/rdk/spatialmath"
//	)
//
//	func main() {
//	    // Create a snapshot with a custom camera and grid settings.
//	    camera := draw.NewSceneCamera(
//	        r3.Vector{X: 2000, Y: 2000, Z: 2000},
//	        r3.Vector{X: 0, Y: 0, Z: 0},
//	        draw.WithAnimated(true),
//	    )
//	    snapshot := draw.NewSnapshot(
//	        draw.WithSceneCamera(camera),
//	        draw.WithGrid(true),
//	        draw.WithGridCellSize(250),
//	    )
//
//	    // Draw a box at the origin.
//	    box, _ := spatialmath.NewBox(
//	        spatialmath.NewZeroPose(),
//	        r3.Vector{X: 100, Y: 100, Z: 100},
//	        "my-box",
//	    )
//	    snapshot.DrawGeometry(box, spatialmath.NewZeroPose(), "world", draw.NewColor(draw.WithName("red")))
//
//	    // Export the scene as JSON for the visualizer.
//	    jsonData, _ := snapshot.MarshalJSON()
//	    os.WriteFile("scene.json", jsonData, 0644)
//	}
package draw
