package api

import (
	"fmt"

	"github.com/viamrobotics/visualization/client/server"
	"github.com/viamrobotics/visualization/draw"
	"go.viam.com/rdk/referenceframe"
)

// DrawFrameSystemOptions configures a DrawFrameSystem call.
type DrawFrameSystemOptions struct {
	// ID is an optional identifier prefix for this batch. When non-empty,
	// each emitted transform's identity is derived from
	// "ID:geometryLabel:parent" rather than the default "geometryLabel:parent",
	// which prevents collisions between frame systems that share geometry
	// labels (e.g., two robots in the same scene). Calling DrawFrameSystem
	// again with the same ID and matching geometries updates the previous
	// batch in place.
	ID string
	// FrameSystem is the reference frame system to render. Required.
	FrameSystem *referenceframe.FrameSystem
	// Inputs are the frame system inputs (joint positions, etc.) used to
	// resolve each frame's pose.
	Inputs referenceframe.FrameSystemInputs
	// Colors maps frame names to render colors. Frames not present in the
	// map inherit their color from their parent frame, falling back to
	// magenta at the root.
	Colors map[string]draw.Color
}

// DrawFrameSystem renders every geometry in a reference frame system as a
// transform, evaluated at the given inputs. Identities are namespaced by ID
// when set, so calling DrawFrameSystem again with the same ID and matching
// geometries updates the previous batch in place. Returns one UUID per
// emitted transform.
//
// Returns ErrVisualizerNotRunning if no visualizer is reachable, the
// underlying error if frame system geometry resolution fails, or a wrapped
// RPC error if the AddEntities call fails.
func DrawFrameSystem(options DrawFrameSystemOptions) ([][]byte, error) {
	client := server.GetClient()
	if client == nil {
		return nil, ErrVisualizerNotRunning
	}

	if options.Colors == nil {
		options.Colors = make(map[string]draw.Color)
	}

	drawnFrameSystem := draw.NewDrawnFrameSystem(options.FrameSystem, options.Inputs, draw.WithFrameSystemColors(options.Colors))
	drawnFrameSystem.ID = options.ID
	transforms, err := drawnFrameSystem.ToTransforms()
	if err != nil {
		return nil, fmt.Errorf("failed to create frame system geometries: %w", err)
	}

	return addTransforms(client, transforms)
}
