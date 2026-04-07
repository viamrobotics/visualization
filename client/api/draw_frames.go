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

// DrawFramesOptions configures a DrawFrames call.
type DrawFramesOptions struct {
	// A unique identifier for the frames group. Can be empty.
	ID string

	// The frames to draw.
	Frames []referenceframe.Frame

	// Optional per-frame geometry colors keyed by frame name.
	// Frames not present in the map default to draw.DefaultFrameColor.
	Colors map[string]draw.Color

	// ShowAxesHelper controls whether the axes helper (RGB XYZ indicator) is shown on each entity.
	// If nil, defaults to DefaultTransformShowAxesHelper.
	ShowAxesHelper *bool
}

// DrawFrames draws multiple frames in the visualizer.
// Frames with no geometry are rendered as axes. Frames with geometry produce one transform per
// geometry, named "frameName:geoLabel", or just "frameName" when the geometry has no distinct label.
// Returns the UUIDs of all drawn transforms, or an error if the server is not running or the drawing fails.
func DrawFrames(options DrawFramesOptions) ([][]byte, error) {
	client := server.GetClient()
	if client == nil {
		return nil, ErrVisualizerNotRunning
	}

	if options.ShowAxesHelper == nil {
		options.ShowAxesHelper = &DefaultTransformShowAxesHelper
	}

	drawnFrames := draw.NewDrawnFrames(options.Frames, draw.WithFramesColors(options.Colors))
	transforms, err := drawnFrames.ToTransforms(draw.WithAxesHelper(*options.ShowAxesHelper))
	if err != nil {
		return nil, fmt.Errorf("failed to create frame transforms: %w", err)
	}

	uuids := make([][]byte, 0, len(transforms))
	for _, transform := range transforms {
		req := connect.NewRequest(&drawv1.AddEntityRequest{Entity: &drawv1.AddEntityRequest_Transform{Transform: transform}})
		resp, err := client.AddEntity(context.Background(), req)
		if err != nil {
			return nil, fmt.Errorf("AddEntity RPC failed: %w", err)
		}
		uuids = append(uuids, resp.Msg.Uuid)
	}

	return uuids, nil
}
