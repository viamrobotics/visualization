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
	// ID is an optional identifier prefix for this batch. When non-empty, each
	// drawn geometry's identity is derived from "ID:label:parent" rather than
	// the default "label:parent", which prevents collisions between batches
	// that share geometry labels and a parent frame (e.g., two robots whose
	// link geometries collide on label). Calling DrawGeometriesInFrame again
	// with the same ID and matching geometries updates the previous batch in
	// place; passing a fresh ID creates a new, independent set of entities.
	ID string
	// Geometries is the set of geometries to render. Required and must contain
	// at least one geometry.
	Geometries *referenceframe.GeometriesInFrame
	// Colors controls how the geometries are colored. When empty, every
	// geometry is rendered red. Pass one color to share it across all
	// geometries; pass exactly len(Geometries) colors for per-geometry colors;
	// pass any other count to cycle through the slice as a palette.
	Colors []draw.Color
	// DownscalingThreshold reduces the rendered point count for any point-cloud
	// geometries by keeping only points whose mutual distance exceeds this
	// threshold (millimeters). 0 (the default) disables downscaling. Has no
	// effect on non-point-cloud geometries.
	DownscalingThreshold float64
}

// DrawGeometriesInFrame sends a batch of geometries to the visualizer as
// transforms, one transform per geometry. Each transform's identity is derived
// from "ID:geometryLabel:parentFrame" (or "geometryLabel:parentFrame" when ID
// is empty), so calling DrawGeometriesInFrame again with the same ID and a
// geometry whose label and parent match a previously drawn one updates that
// entity in place. Returns one UUID per drawn geometry, in input order.
//
// Returns ErrVisualizerNotRunning if no visualizer is reachable, an error if
// Geometries is empty or the underlying construction fails (see
// draw.NewDrawnGeometriesInFrame), or a wrapped RPC error if any AddEntity call
// fails.
func DrawGeometriesInFrame(options DrawGeometriesInFrameOptions) ([][]byte, error) {
	client := server.GetClient()
	if client == nil {
		return nil, ErrVisualizerNotRunning
	}

	geometries := options.Geometries.Geometries()
	if len(geometries) == 0 {
		return nil, fmt.Errorf("no geometries to draw")
	}

	colors := options.Colors
	if len(colors) == 0 {
		colors = []draw.Color{draw.ColorFromName("red")}
	}

	var colorOption draw.DrawGeometriesInFrameOption
	if len(colors) == 1 {
		colorOption = draw.WithSingleGeometriesColor(colors[0])
	} else if len(colors) == len(geometries) {
		colorOption = draw.WithPerGeometriesColors(colors...)
	} else {
		colorOption = draw.WithGeometriesColorPalette(colors, len(geometries))
	}

	drawnGeometries, err := draw.NewDrawnGeometriesInFrame(
		options.Geometries,
		colorOption,
		draw.WithGeometriesDownscalingThreshold(options.DownscalingThreshold),
	)
	if err != nil {
		return nil, fmt.Errorf("failed to create drawn geometries: %w", err)
	}
	drawnGeometries.ID = options.ID

	transforms, err := drawnGeometries.ToTransforms()
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
