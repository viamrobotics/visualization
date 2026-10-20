package main

import (
	"fmt"

	"github.com/golang/geo/r3"
	"github.com/viam-labs/motion-tools/client/api"
	"go.viam.com/rdk/referenceframe"
	"go.viam.com/rdk/spatialmath"
)

// frameSystemDraw builds a frame system with a static box, a UR5e model, and a
// box parented to that model, then draws it twice: once at zero inputs and
// once with the arm articulated. The second draw is what proves the visualizer
// moves a kinematic chain in place rather than respawning it.
func frameSystemDraw(env sceneEnv) error {
	fs := referenceframe.NewEmptyFrameSystem("test")
	dims := r3.Vector{X: 100, Y: 100, Z: 100}

	box0, err := spatialmath.NewBox(spatialmath.NewZeroPose(), dims, "frame0")
	if err != nil {
		return fmt.Errorf("building frame0's box: %w", err)
	}
	frame0, err := referenceframe.NewStaticFrameWithGeometry("frame0", spatialmath.NewZeroPose(), box0)
	if err != nil {
		return fmt.Errorf("building frame0: %w", err)
	}
	if err := fs.AddFrame(frame0, fs.World()); err != nil {
		return fmt.Errorf("adding frame0: %w", err)
	}

	const armName = "arm1"
	model, err := referenceframe.ParseModelJSONFile(env.data("ur5e.json"), armName)
	if err != nil {
		return fmt.Errorf("parsing the arm model: %w", err)
	}
	if err := fs.AddFrame(model, fs.World()); err != nil {
		return fmt.Errorf("adding the arm: %w", err)
	}

	box1, err := spatialmath.NewBox(spatialmath.NewZeroPose(), dims, "frame1")
	if err != nil {
		return fmt.Errorf("building frame1's box: %w", err)
	}
	frame1, err := referenceframe.NewStaticFrameWithGeometry("frame1", spatialmath.NewZeroPose(), box1)
	if err != nil {
		return fmt.Errorf("building frame1: %w", err)
	}
	if err := fs.AddFrame(frame1, model); err != nil {
		return fmt.Errorf("adding frame1: %w", err)
	}

	inputs := referenceframe.NewZeroInputs(fs)
	if err := drawFrameSystem(fs, inputs); err != nil {
		return err
	}

	inputs[armName] = []float64{1, 1, 1, 1, 1, 1}
	return drawFrameSystem(fs, inputs)
}

func drawFrameSystem(fs *referenceframe.FrameSystem, inputs referenceframe.FrameSystemInputs) error {
	uuids, err := api.DrawFrameSystem(api.DrawFrameSystemOptions{FrameSystem: fs, Inputs: inputs})
	if err != nil {
		return fmt.Errorf("drawing the frame system: %w", err)
	}
	if len(uuids) == 0 {
		return fmt.Errorf("the frame system drew nothing")
	}
	return nil
}
