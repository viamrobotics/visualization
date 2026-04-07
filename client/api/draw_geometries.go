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

// DrawGeometriesInFrameOptions configures a DrawGeometriesInFrame call.
type DrawGeometriesInFrameOptions struct {
	// A unique identifier for the geometries group. Can be empty.
	ID string

	// The geometries to draw.
	Geometries *referenceframe.GeometriesInFrame

	// The colors to draw the geometries with. Must contain at least one color.
	// Provide one color to use the same color for all geometries, one per geometry for
	// per-geometry colors, or any other count to cycle through as a palette.
	Colors []draw.Color

	// The downscaling threshold for point clouds in millimeters. Points closer than this
	// distance to one another are culled, reducing the total point count and improving
	// rendering performance. Set to 0 (default) to disable downscaling.
	DownscalingThreshold float64

	// ShowAxesHelper controls whether the axes helper (RGB XYZ indicator) is shown on each entity.
	// If nil, defaults to DefaultTransformShowAxesHelper.
	ShowAxesHelper *bool
}

// DrawGeometriesInFrame draws a list of geometries in the visualizer.
// Calling DrawGeometriesInFrame with geometries that share labels with previously drawn
// geometries will update those geometries in place.
// Returns the UUIDs of the drawn geometries, or an error if the server is not running or the drawing fails.
func DrawGeometriesInFrame(options DrawGeometriesInFrameOptions) ([][]byte, error) {
	client := server.GetClient()
	if client == nil {
		return nil, ErrVisualizerNotRunning
	}

	geometries := options.Geometries.Geometries()
	if len(geometries) == 0 {
		return nil, fmt.Errorf("no geometries to draw")
	}

	if len(options.Colors) == 0 {
		return nil, fmt.Errorf("at least one color must be provided")
	}

	var colorOption draw.DrawGeometriesInFrameOption
	if len(options.Colors) == 1 {
		colorOption = draw.WithSingleGeometriesColor(options.Colors[0])
	} else if len(options.Colors) == len(geometries) {
		colorOption = draw.WithPerGeometriesColors(options.Colors...)
	} else {
		colorOption = draw.WithGeometriesColorPalette(options.Colors, len(geometries))
	}

	drawnGeometries, err := draw.NewDrawnGeometriesInFrame(
		options.Geometries,
		colorOption,
		draw.WithGeometriesDownscalingThreshold(options.DownscalingThreshold),
	)
	if err != nil {
		return nil, fmt.Errorf("failed to create drawn geometries: %w", err)
	}

	if options.ShowAxesHelper == nil {
		options.ShowAxesHelper = &DefaultTransformShowAxesHelper
	}

	transforms, err := drawnGeometries.ToTransforms(draw.WithAxesHelper(*options.ShowAxesHelper))
	if err != nil {
		return nil, fmt.Errorf("failed to create transforms: %w", err)
	}

	var uuids [][]byte
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
