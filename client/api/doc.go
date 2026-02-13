// Package api provides high-level drawing functions for the motion-tools visualizer.
//
// This package contains the drawing API for creating and managing 3D visualizations in a live
// motion-tools visualizer instance. All functions communicate with the DrawService via Connect-RPC,
// allowing real-time updates to geometric primitives, 3D models, reference frames, and robot states.
//
// # Getting Started
//
// Before using any drawing functions, start the visualizer:
//
//	make up
//
// The visualizer will be available at http://localhost:5173.
//
// # Drawing API
//
// The package provides high-level drawing functions organized into three categories:
//
//   - Drawings: Visual primitives like lines, points, NURBS curves, and 3D models
//   - Transforms: Spatial objects like geometries, frames, and robot states
//   - Removal: Clear all or subsets of drawn objects
//
// Each Draw* function accepts an options struct and returns a UUID identifying the drawn object.
// Calling a Draw* function with an existing ID updates that object in place.
//
// # Example
//
//	package main
//
//	import (
//	    "github.com/golang/geo/r3"
//	    "github.com/viam-labs/motion-tools/client/api"
//	    "github.com/viam-labs/motion-tools/draw"
//	)
//
//	func main() {
//	    // The visualizer must be running: make up
//
//	    // Draw a line
//	    positions := []r3.Vector{{X: 0, Y: 0, Z: 0}, {X: 100, Y: 100, Z: 100}}
//	    api.DrawLine(api.DrawLineOptions{
//	        Name:      "my-line",
//	        Positions: positions,
//	    })
//	}
package api
