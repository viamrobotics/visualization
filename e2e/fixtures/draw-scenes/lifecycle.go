package main

import (
	"fmt"
	"time"

	"github.com/golang/geo/r3"
	"github.com/viam-labs/motion-tools/client/api"
	"github.com/viam-labs/motion-tools/draw"
	"go.viam.com/rdk/spatialmath"
)

// The three lifecycle scenes reuse these IDs so the update lands on the
// entities the add created rather than spawning a second pair.
const (
	lifecycleBoxID  = "lifecycle-box"
	lifecycleLineID = "lifecycle-line"
)

var lifecycleLinePositions = []r3.Vector{
	{X: 0, Y: 0, Z: 0},
	{X: 1000, Y: 0, Z: 0},
	{X: 1000, Y: 1000, Z: 0},
	{X: 0, Y: 1000, Z: 0},
}

func drawLifecyclePair(height float64, boxColor, lineColor draw.Color) error {
	box, err := spatialmath.NewBox(
		spatialmath.NewPose(
			r3.Vector{X: 0, Y: 0, Z: height},
			&spatialmath.OrientationVectorDegrees{Theta: 0, OX: 0, OY: 0, OZ: 1},
		),
		r3.Vector{X: 400, Y: 400, Z: 400},
		lifecycleBoxID,
	)
	if err != nil {
		return fmt.Errorf("building the box: %w", err)
	}

	if _, err := api.DrawGeometry(api.DrawGeometryOptions{
		ID:       lifecycleBoxID,
		Geometry: box,
		Color:    boxColor,
	}); err != nil {
		return fmt.Errorf("drawing the box: %w", err)
	}

	if _, err := api.DrawLine(api.DrawLineOptions{
		ID:        lifecycleLineID,
		Name:      lifecycleLineID,
		Positions: lifecycleLinePositions,
		Colors:    []draw.Color{lineColor},
		LineWidth: 50.0,
		DotSize:   50.0,
	}); err != nil {
		return fmt.Errorf("drawing the line: %w", err)
	}

	return nil
}

func lifecycleAdd(sceneEnv) error {
	return drawLifecyclePair(300, draw.ColorFromName("red"), draw.ColorFromName("yellow"))
}

// Same IDs at a new height and new colors, so the service publishes updates
// rather than a second pair of entities.
func lifecycleUpdate(sceneEnv) error {
	return drawLifecyclePair(600, draw.ColorFromName("green"), draw.ColorFromName("cyan"))
}

func lifecycleRemoveAll(sceneEnv) error {
	// The update the browser is mid-way through applying has to land before the
	// clear, or the spec cannot tell an entity that was removed from one that
	// never arrived.
	time.Sleep(500 * time.Millisecond)

	count, err := api.RemoveAll()
	if err != nil {
		return fmt.Errorf("removing everything: %w", err)
	}
	if count != 2 {
		return fmt.Errorf("expected to remove only the box and the line, removed %d entities. The scene was not empty before lifecycle/add ran", count)
	}
	return nil
}
