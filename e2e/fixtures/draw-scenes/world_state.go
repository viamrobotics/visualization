package main

import (
	"fmt"

	"github.com/golang/geo/r3"
	"github.com/viam-labs/motion-tools/client/api"
	"go.viam.com/rdk/referenceframe"
	"go.viam.com/rdk/spatialmath"
)

// worldStateDraw puts two boxes in a named frame and one in the world frame,
// so the spec can see that obstacles resolve through the frame system rather
// than all landing at the origin.
func worldStateDraw(sceneEnv) error {
	dims := r3.Vector{X: 100, Y: 100, Z: 100}

	fs := referenceframe.NewEmptyFrameSystem("test")
	const frameName = "frame0"
	frame0, err := referenceframe.NewStaticFrame(frameName, spatialmath.NewPoseFromPoint(r3.Vector{Z: 300}))
	if err != nil {
		return fmt.Errorf("building %s: %w", frameName, err)
	}
	if err := fs.AddFrame(frame0, fs.World()); err != nil {
		return fmt.Errorf("adding %s: %w", frameName, err)
	}

	box0, err := spatialmath.NewBox(spatialmath.NewZeroPose(), dims, "box0")
	if err != nil {
		return fmt.Errorf("building box0: %w", err)
	}
	box1, err := spatialmath.NewBox(spatialmath.NewPoseFromPoint(r3.Vector{X: 300}), dims, "box1")
	if err != nil {
		return fmt.Errorf("building box1: %w", err)
	}
	box2, err := spatialmath.NewBox(spatialmath.NewPoseFromPoint(r3.Vector{Z: 300}), dims, "box2")
	if err != nil {
		return fmt.Errorf("building box2: %w", err)
	}

	ws, err := referenceframe.NewWorldState([]*referenceframe.GeometriesInFrame{
		referenceframe.NewGeometriesInFrame(frameName, []spatialmath.Geometry{box0, box1}),
		referenceframe.NewGeometriesInFrame(referenceframe.World, []spatialmath.Geometry{box2}),
	}, nil)
	if err != nil {
		return fmt.Errorf("building the world state: %w", err)
	}

	uuids, err := api.DrawWorldState(api.DrawWorldStateOptions{
		WorldState:  ws,
		FrameSystem: fs,
		Inputs:      referenceframe.NewZeroInputs(fs),
	})
	if err != nil {
		return fmt.Errorf("drawing the world state: %w", err)
	}
	if len(uuids) == 0 {
		return fmt.Errorf("the world state drew nothing")
	}

	return nil
}
