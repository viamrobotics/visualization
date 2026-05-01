package api

import (
	"context"
	"fmt"

	"connectrpc.com/connect"
	"github.com/viam-labs/motion-tools/client/server"
	"github.com/viam-labs/motion-tools/draw"
	drawv1 "github.com/viam-labs/motion-tools/draw/v1"
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
// RPC error if any AddEntity call fails.
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

	uuids := make([][]byte, 0, len(transforms))
	for _, transform := range transforms {
		req := connect.NewRequest(&drawv1.AddEntityRequest{Entity: &drawv1.AddEntityRequest_Transform{Transform: transform}})
		resp, err := client.AddEntity(context.Background(), req)
		if err != nil {
			return nil, fmt.Errorf("AddTransform RPC failed: %w", err)
		}
		uuids = append(uuids, resp.Msg.Uuid)
	}

	return uuids, nil
}
