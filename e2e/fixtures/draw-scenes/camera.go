package main

import (
	"fmt"

	"github.com/golang/geo/r3"
	"github.com/viam-labs/motion-tools/client/api"
	"github.com/viam-labs/motion-tools/draw"
	"go.viam.com/rdk/spatialmath"
)

// cameraTopDown draws a wide flat box at the origin and puts the camera five
// metres directly above it. The box gives the spec something to wait for
// before it reads the camera pose back.
func cameraTopDown(sceneEnv) error {
	box, err := spatialmath.NewBox(
		spatialmath.NewPoseFromPoint(r3.Vector{X: 0, Y: 0, Z: 0}),
		r3.Vector{X: 1000, Y: 1000, Z: 200},
		"reference_box",
	)
	if err != nil {
		return fmt.Errorf("building the reference box: %w", err)
	}

	if _, err := api.DrawGeometry(api.DrawGeometryOptions{
		Geometry: box,
		Color:    draw.ColorFromName("blue"),
	}); err != nil {
		return fmt.Errorf("drawing the reference box: %w", err)
	}

	// Not animated: the spec reads the pose back as a number, and an animated
	// move would still be interpolating when it looks.
	if err := api.SetCamera(api.SetCameraPoseOptions{
		Position: r3.Vector{X: 0, Y: 0, Z: 5000},
		LookAt:   r3.Vector{X: 0, Y: 0, Z: 0},
		Animate:  false,
	}); err != nil {
		return fmt.Errorf("setting the camera: %w", err)
	}

	return nil
}

func cameraReset(sceneEnv) error {
	if err := api.ResetCamera(); err != nil {
		return fmt.Errorf("resetting the camera: %w", err)
	}
	return nil
}
