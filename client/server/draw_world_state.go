package server

import (
	"context"
	"fmt"

	"connectrpc.com/connect"
	"github.com/viam-labs/motion-tools/draw"
	drawv1 "github.com/viam-labs/motion-tools/draw/v1"
	"go.viam.com/rdk/referenceframe"
)

type DrawWorldStateOptions struct {
	// A unique identifier for the world state. Can be empty.
	ID string

	// The world state to draw.
	WorldState *referenceframe.WorldState

	// The frame system fpr the world state.
	FrameSystem *referenceframe.FrameSystem

	// The inputs for the frame system.
	Inputs referenceframe.FrameSystemInputs

	// Colors for the geometries in the world state.
	// If not provided, the geometries will be colored using the default color chooser.
	Colors []draw.Color
}

// DrawWorldState will draw a world state in the visualizer.
// Returns the UUIDs of the drawn geometries, or an error if the server is not running or the drawing fails
func DrawWorldState(options DrawWorldStateOptions) ([][]byte, error) {
	client := GetClient()
	if client == nil {
		return nil, fmt.Errorf("server is not running; call server.Start() first")
	}

	geoms, err := options.WorldState.ObstaclesInWorldFrame(options.FrameSystem, options.Inputs)
	if err != nil {
		return nil, err
	}

	geometries := geoms.Geometries()

	var colorOption draw.DrawGeometriesInFrameOption
	if len(options.Colors) == 1 {
		colorOption = draw.WithSingleGeometriesColor(options.Colors[0])
	} else if len(options.Colors) == len(geometries) {
		colorOption = draw.WithPerGeometriesColors(options.Colors...)
	} else if len(options.Colors) > 1 {
		colorOption = draw.WithGeometriesColorPalette(options.Colors, len(geometries))
	} else {
		// Create a new slice with colors for each geometry
		cc := &colorChooser{}
		colors := make([]draw.Color, len(geometries))
		for i := range geometries {
			colors[i] = cc.next()
		}
		colorOption = draw.WithPerGeometriesColors(colors...)
	}

	drawnGeometries, err := draw.NewDrawnGeometriesInFrame(geoms, colorOption)
	if err != nil {
		return nil, err
	}

	transforms, err := drawnGeometries.Draw(options.ID)
	if err != nil {
		return nil, err
	}

	uuids := make([][]byte, 0, len(transforms))
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
