package api

import (
	"context"
	"fmt"

	"connectrpc.com/connect"
	"github.com/viam-labs/motion-tools/client/server"
	"github.com/viam-labs/motion-tools/draw"
	drawv1 "github.com/viam-labs/motion-tools/draw/v1"
	"go.viam.com/rdk/spatialmath"
)

// DrawPosesAsArrowsOptions configures a DrawPosesAsArrows call.
type DrawPosesAsArrowsOptions struct {
	// A unique identifier for the entity. If set, drawing with the same ID updates the existing entity.
	ID string

	// The name of the entity.
	Name string

	// The parent frame name. If empty, defaults to "world".
	Parent string

	// The poses to draw.
	Poses []spatialmath.Pose

	// Colors is the list of colors to use for the arrows.
	// Can be a single color for all arrows, per-arrow colors, or a color palette to cycle through.
	// If empty, defaults to DefaultArrowColor.
	Colors []draw.Color

	// Metadata holds optional metadata overrides (e.g. visibility).
	Metadata *Options
}

// DrawPosesAsArrows draws a list of poses in the visualizer as arrows.
// Calling DrawPosesAsArrows with an ID that already exists will instead update the arrows.
// Returns the UUID of the drawn poses, or an error if the server is not running or the drawing fails.
func DrawPosesAsArrows(options DrawPosesAsArrowsOptions) ([]byte, error) {
	if err := isASCIIPrintable(options.Name); err != nil {
		return nil, err
	}

	client := server.GetClient()
	if client == nil {
		return nil, ErrVisualizerNotRunning
	}

	var arrowOptions []draw.DrawArrowsOption
	if len(options.Colors) == 0 {
		arrowOptions = append(arrowOptions, draw.WithSingleArrowColor(draw.DefaultArrowColor))
	} else if len(options.Colors) == 1 {
		arrowOptions = append(arrowOptions, draw.WithSingleArrowColor(options.Colors[0]))
	} else if len(options.Colors) == len(options.Poses) {
		arrowOptions = append(arrowOptions, draw.WithPerArrowColors(options.Colors...))
	} else {
		arrowOptions = append(arrowOptions, draw.WithArrowColorPalette(options.Colors, len(options.Poses)))
	}

	arrows, err := draw.NewArrows(options.Poses, arrowOptions...)
	if err != nil {
		return nil, fmt.Errorf("failed to create arrows: %w", err)
	}

	drawing := arrows.Draw(options.Name, entityOptions(options.ID, options.Parent, options.Metadata)...)
	req := connect.NewRequest(&drawv1.AddEntityRequest{Entity: &drawv1.AddEntityRequest_Drawing{Drawing: drawing.ToProto()}})
	resp, err := client.AddEntity(context.Background(), req)
	if err != nil {
		return nil, fmt.Errorf("AddEntity RPC failed: %w", err)
	}

	return resp.Msg.Uuid, nil
}
