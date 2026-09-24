package main

import (
	"fmt"

	"github.com/golang/geo/r3"
	"github.com/viam-labs/motion-tools/client/api"
	"github.com/viam-labs/motion-tools/draw"
	"go.viam.com/rdk/spatialmath"
)

// hierarchyDraw draws the tree below. The parentheticals are the sibling sort
// order the visualizer has to apply, which is what the spec asserts on.
//
//	world
//	+-- zulu
//	|   +-- tango
//	|   |   +-- sierra
//	|   |   +-- foxtrot  (sorts before sierra)
//	|   +-- delta        (sorts before tango)
//	+-- bravo            (sorts before zulu)
func hierarchyDraw(sceneEnv) error {
	dims := r3.Vector{X: 50, Y: 50, Z: 50}

	nodes := []struct {
		name     string
		position r3.Vector
		parent   string
		color    string
	}{
		{name: "zulu", position: r3.Vector{X: 200}, color: "red"},
		{name: "bravo", position: r3.Vector{X: -200}, color: "orange"},
		{name: "tango", position: r3.Vector{X: 200, Y: 200}, parent: "zulu", color: "yellow"},
		{name: "delta", position: r3.Vector{X: 200, Y: -200}, parent: "zulu", color: "green"},
		{name: "sierra", position: r3.Vector{X: 200, Y: 200, Z: 200}, parent: "tango", color: "blue"},
		{name: "foxtrot", position: r3.Vector{X: 200, Y: 200, Z: -200}, parent: "tango", color: "purple"},
	}

	// Parents before children: the visualizer holds an unresolved child as an
	// orphan until its parent arrives, and drawing in order skips that state.
	for _, node := range nodes {
		box, err := spatialmath.NewBox(spatialmath.NewPoseFromPoint(node.position), dims, node.name)
		if err != nil {
			return fmt.Errorf("building %s: %w", node.name, err)
		}

		if _, err := api.DrawGeometry(api.DrawGeometryOptions{
			Geometry: box,
			Parent:   node.parent,
			Color:    draw.ColorFromName(node.color),
		}); err != nil {
			return fmt.Errorf("drawing %s: %w", node.name, err)
		}
	}

	return nil
}
