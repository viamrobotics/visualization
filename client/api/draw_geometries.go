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
	// A unique identifier for the geometries in the parent frame. Can be empty.
	ID string

	// The geometries to draw.
	Geometries *referenceframe.GeometriesInFrame

	// The colors to draw the geometries with.
	Colors []draw.Color

	// The downscaling threshold for point clouds in millimeters.
	DownscalingThreshold float64
}

// DrawGeometriesInFrame draws a list of geometries in the visualizer.
// Calling DrawGeometriesInFrame with an ID that already exists will instead update the geometries in the parent frame.
// Returns the UUIDs of the drawn geometries, or an error if the server is not running or the drawing fails.
func DrawGeometriesInFrame(options DrawGeometriesInFrameOptions) ([][]byte, error) {
	client := server.GetClient()
	if client == nil {
		return nil, ErrVisualizerNotRunning
	}

	var uuids [][]byte
	geometries := options.Geometries.Geometries()
	if len(geometries) == 0 {
		return nil, fmt.Errorf("no geometries to draw")
	}

	// Select the appropriate color option based on the number of colors provided
	var colorOption draw.DrawGeometriesInFrameOption
	if len(options.Colors) == 1 {
		// Single color for all geometries
		colorOption = draw.WithSingleGeometriesColor(options.Colors[0])
	} else if len(options.Colors) == len(geometries) {
		// Per-geometry colors
		colorOption = draw.WithPerGeometriesColors(options.Colors...)
	} else {
		colorOption = draw.WithGeometriesColorPalette(options.Colors, len(geometries))
	}

	drawnGeometries, err := draw.NewDrawnGeometriesInFrame(options.Geometries, colorOption, draw.WithGeometriesDownscalingThreshold(options.DownscalingThreshold))
	if err != nil {
		return nil, fmt.Errorf("failed to create drawn geometries: %w", err)
	}

	transforms, err := drawnGeometries.Draw(options.ID)
	if err != nil {
		return nil, fmt.Errorf("failed to create transforms: %w", err)
	}

	for _, transform := range transforms {
		req := connect.NewRequest(&drawv1.AddTransformRequest{Transform: transform})
		resp, err := client.AddTransform(context.Background(), req)
		if err != nil {
			return nil, fmt.Errorf("AddTransform RPC failed: %w", err)
		}

		uuids = append(uuids, resp.Msg.Uuid)
	}

	return uuids, nil
}
