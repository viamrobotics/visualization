package server

import (
	"context"
	"fmt"

	"connectrpc.com/connect"
	"github.com/viam-labs/motion-tools/draw"
	drawv1 "github.com/viam-labs/motion-tools/draw/v1"
	"go.viam.com/rdk/spatialmath"
)

type DrawPosesAsArrowsOptions struct {
	// A unique identifier for the arrows. Can be empty.
	ID string

	// The name of the arrow group.
	Name string

	// The poses to draw.
	Poses []spatialmath.Pose

	// The name of the parent frame. If empty, the arrows will be parented to the "world" frame.
	Parent string

	// Colors is the list of colors to use for the arrows.
	// Can be a single color for all arrows, per-arrow colors, or a color palette to cycle through.
	Colors []draw.Color
}

// DrawPosesAsArrows draws a list of poses in the visualizer as arrows.
// Calling DrawPosesAsArrows with an ID that already exists will instead update the arrows in the parent frame.
// Returns the UUID of the drawn poses, or an error if the server is not running or the drawing fails
func DrawPosesAsArrows(options DrawPosesAsArrowsOptions) ([]byte, error) {
	err := isASCIIPrintable(options.Name)
	if err != nil {
		return nil, err
	}

	client := GetClient()
	if client == nil {
		return nil, fmt.Errorf("server is not running; call server.Start() first")
	}

	var arrowOptions []draw.DrawArrowsOption
	if len(options.Colors) == 1 {
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

	drawing := arrows.Draw(options.ID, options.Name, options.Parent, spatialmath.NewZeroPose())
	req := connect.NewRequest(&drawv1.AddDrawingRequest{Drawing: drawing.ToProto()})
	resp, err := client.AddDrawing(context.Background(), req)
	if err != nil {
		return nil, fmt.Errorf("AddDrawing RPC failed: %w", err)
	}

	return resp.Msg.Uuid, nil
}
