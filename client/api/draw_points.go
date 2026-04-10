package api

import (
	"context"
	"fmt"

	"connectrpc.com/connect"
	"github.com/golang/geo/r3"
	"github.com/viam-labs/motion-tools/client/server"
	"github.com/viam-labs/motion-tools/draw"
	drawv1 "github.com/viam-labs/motion-tools/draw/v1"
)

// DrawPointsOptions configures a DrawPoints call.
type DrawPointsOptions struct {
	// A unique identifier for the entity. If set, drawing with the same ID updates the existing entity.
	ID string

	// The name of the entity.
	Name string

	// The parent frame name. If empty, defaults to "world".
	Parent string

	// The positions of the points.
	Positions []r3.Vector

	// Colors is the list of colors to use for the points.
	// Can be a single color for all points, per-point colors, or a color palette to cycle through.
	Colors []draw.Color

	// PointSize is the size of each point in millimeters. If 0, uses the default.
	PointSize float32

	// ShowAxesHelper controls whether the axes helper is shown.
	// If nil, defaults to true.
	ShowAxesHelper *bool
}

// DrawPoints draws a set of points in the visualizer.
// Calling DrawPoints with an ID that already exists will instead update the points.
// Returns the UUID of the drawn points, or an error if the server is not running or the drawing fails.
func DrawPoints(options DrawPointsOptions) ([]byte, error) {
	if err := isASCIIPrintable(options.Name); err != nil {
		return nil, err
	}

	client := server.GetClient()
	if client == nil {
		return nil, ErrVisualizerNotRunning
	}

	colorCount := len(options.Colors)
	posCount := len(options.Positions)

	pointOptions := make([]draw.DrawPointsOption, 0)
	if colorCount == 0 {
		pointOptions = append(pointOptions, draw.WithSinglePointColor(draw.DefaultPointColor))
	} else if colorCount == 1 {
		pointOptions = append(pointOptions, draw.WithSinglePointColor(options.Colors[0]))
	} else if colorCount == posCount {
		pointOptions = append(pointOptions, draw.WithPerPointColors(options.Colors...))
	} else {
		pointOptions = append(pointOptions, draw.WithPointColorPalette(options.Colors, posCount))
	}

	if options.PointSize > 0 {
		pointOptions = append(pointOptions, draw.WithPointsSize(options.PointSize))
	}

	points, err := draw.NewPoints(options.Positions, pointOptions...)
	if err != nil {
		return nil, fmt.Errorf("failed to create points: %w", err)
	}

	drawing := points.Draw(options.Name, entityOptions(options.ID, options.Parent, options.ShowAxesHelper)...)
	req := connect.NewRequest(&drawv1.AddEntityRequest{Entity: &drawv1.AddEntityRequest_Drawing{Drawing: drawing.ToProto()}})
	resp, err := client.AddEntity(context.Background(), req)
	if err != nil {
		return nil, fmt.Errorf("AddEntity RPC failed: %w", err)
	}

	return resp.Msg.Uuid, nil
}
