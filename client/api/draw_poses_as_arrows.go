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
	// ID is a stable identifier for the entity. When set, calling
	// DrawPosesAsArrows again with the same ID updates the existing entity in
	// place; when empty, each call creates a new entity with a freshly
	// generated UUID.
	ID string
	// Name labels the entity in the visualizer. Must be ASCII printable and at
	// most 100 characters.
	Name string
	// Parent is the reference frame the arrows are attached to. Defaults to
	// "world" when empty.
	Parent string
	// Poses are the positions and orientations rendered as individual arrows.
	// Required.
	Poses []spatialmath.Pose
	// Colors controls how the arrows are colored. With no colors, every arrow
	// uses draw.DefaultArrowColor (green). Pass one color to share it across
	// all arrows; pass exactly len(Poses) colors for per-arrow colors; pass
	// any other count to cycle through the slice as a palette.
	Colors []draw.Color
	// Attrs carries optional shared display attributes (axes helper, default
	// visibility). Nil leaves all attributes at their defaults.
	Attrs *Attrs
}

// DrawPosesAsArrows sends a set of poses to the visualizer as a drawing of
// arrows, one arrow per pose. Passing an ID that already exists updates the
// previously drawn entity in place; otherwise a new entity is created. Returns
// the UUID assigned by the server.
//
// Returns an error when Name is not ASCII printable or exceeds 100 characters,
// ErrVisualizerNotRunning if no visualizer is reachable, the underlying
// validation error if the arrows cannot be constructed (see draw.NewArrows —
// mismatched color count), or a wrapped RPC error if the AddEntity call fails.
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

	drawing := arrows.Draw(options.Name, entityAttributes(options.ID, options.Parent, options.Attrs)...)
	req := connect.NewRequest(&drawv1.AddEntityRequest{Entity: &drawv1.AddEntityRequest_Drawing{Drawing: drawing.ToProto()}})
	resp, err := client.AddEntity(context.Background(), req)
	if err != nil {
		return nil, fmt.Errorf("AddEntity RPC failed: %w", err)
	}

	return resp.Msg.Uuid, nil
}
