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
	// A unique identifier for the frame system. Can be empty.
	ID string

	// The frame system to draw.
	FrameSystem *referenceframe.FrameSystem

	// The frame system inputs (joint angles, etc.).
	Inputs referenceframe.FrameSystemInputs

	// Optional color map for specific frames by name.
	// Frames without specified colors inherit their parent's color or default to magenta.
	Colors map[string]draw.Color

	// ShowAxesHelper controls whether the axes helper (RGB XYZ indicator) is shown on each entity.
	// If nil, defaults to DefaultTransformShowAxesHelper.
	ShowAxesHelper *bool
}

// DrawFrameSystem draws a frame system in the visualizer by rendering all geometries to the world frame.
// Returns the UUIDs of all drawn transforms, or an error if the server is not running or the drawing fails.
func DrawFrameSystem(options DrawFrameSystemOptions) ([][]byte, error) {
	client := server.GetClient()
	if client == nil {
		return nil, ErrVisualizerNotRunning
	}

	if options.Colors == nil {
		options.Colors = make(map[string]draw.Color)
	}

	if options.ShowAxesHelper == nil {
		options.ShowAxesHelper = &DefaultTransformShowAxesHelper
	}

	drawnFrameSystem := draw.NewDrawnFrameSystem(options.FrameSystem, options.Inputs, draw.WithFrameSystemColors(options.Colors))
	transforms, err := drawnFrameSystem.ToTransforms(draw.WithAxesHelper(*options.ShowAxesHelper))
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
