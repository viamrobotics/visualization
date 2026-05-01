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

// DrawWorldStateOptions configures a DrawWorldState call.
type DrawWorldStateOptions struct {
	// ID is an optional identifier prefix for this batch. When non-empty,
	// each emitted transform's identity is derived from
	// "ID:geometryLabel:parent" rather than the default "geometryLabel:parent",
	// which prevents collisions between world-state batches that share
	// geometry labels. Calling DrawWorldState again with the same ID and
	// matching obstacles updates the previous batch in place.
	ID string
	// WorldState contains the obstacles to render. Required.
	WorldState *referenceframe.WorldState
	// FrameSystem is the reference frame system used to resolve obstacles
	// expressed in non-world frames into the world frame.
	FrameSystem *referenceframe.FrameSystem
	// Inputs are the frame system inputs used to evaluate frame poses during
	// obstacle resolution.
	Inputs referenceframe.FrameSystemInputs
	// Colors controls how the obstacles are colored. With no colors,
	// obstacles are colored by cycling draw.ChromaticColorChooser. Pass one
	// color to share it across all obstacles; pass exactly the obstacle
	// count for per-obstacle colors; pass any other count to cycle through
	// the slice as a palette.
	Colors []draw.Color
}

// DrawWorldState resolves the obstacles in a world state to the world frame
// and renders each as a transform. Identities are namespaced by ID when set,
// so calling DrawWorldState again with the same ID and matching obstacles
// updates the previous batch in place. Returns one UUID per obstacle.
//
// Returns ErrVisualizerNotRunning if no visualizer is reachable, the
// underlying error if obstacle resolution fails or geometry construction
// fails (see draw.NewDrawnGeometriesInFrame), or a wrapped RPC error if any
// AddEntity call fails.
func DrawWorldState(options DrawWorldStateOptions) ([][]byte, error) {
	client := server.GetClient()
	if client == nil {
		return nil, ErrVisualizerNotRunning
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
		colors := draw.ChromaticColorChooser.Get(len(geometries))
		colorOption = draw.WithPerGeometriesColors(colors...)
	}

	drawnGeometries, err := draw.NewDrawnGeometriesInFrame(geoms, colorOption)
	if err != nil {
		return nil, err
	}
	drawnGeometries.ID = options.ID

	transforms, err := drawnGeometries.ToTransforms()
	if err != nil {
		return nil, err
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
