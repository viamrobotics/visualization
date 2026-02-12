package server

import (
	"context"
	"fmt"

	"connectrpc.com/connect"
	"github.com/golang/geo/r3"
	"github.com/viam-labs/motion-tools/draw"
	drawv1 "github.com/viam-labs/motion-tools/draw/v1"
	"go.viam.com/rdk/spatialmath"
)

type DrawPointsOptions struct {
	// A unique identifier for the points. Can be empty.
	ID string

	// The name of the points.
	Name string

	// The positions of the points.
	Positions []r3.Vector

	// The name of the parent frame. If empty, the points will be parented to the "world" frame.
	Parent string

	// Colors is the list of colors to use for the points.
	// Can be a single color for all points, per-point colors, or a color palette to cycle through.
	Colors []draw.Color

	// PointSize is the size of each point in millimeters. If 0, uses the default.
	PointSize float32
}

// DrawPoints draws a set of points in the visualizer.
// Calling DrawPoints with an ID that already exists will instead update the points in the parent frame.
// Returns the UUID of the drawn points, or an error if the server is not running or the drawing fails
func DrawPoints(options DrawPointsOptions) ([]byte, error) {
	err := isASCIIPrintable(options.Name)
	if err != nil {
		return nil, err
	}

	client := GetClient()
	if client == nil {
		return nil, fmt.Errorf("server is not running; call server.Start() first")
	}

	// Build points with options based on configuration
	var points *draw.Points
	
	// Determine which combination of options to use
	hasSize := options.PointSize > 0
	colorCount := len(options.Colors)
	posCount := len(options.Positions)
	
	switch {
	case colorCount == 1 && hasSize:
		points, err = draw.NewPoints(options.Positions, draw.WithSinglePointColor(options.Colors[0]), draw.WithPointsSize(options.PointSize))
	case colorCount == 1:
		points, err = draw.NewPoints(options.Positions, draw.WithSinglePointColor(options.Colors[0]))
	case colorCount == posCount && hasSize:
		points, err = draw.NewPoints(options.Positions, draw.WithPerPointColors(options.Colors...), draw.WithPointsSize(options.PointSize))
	case colorCount == posCount:
		points, err = draw.NewPoints(options.Positions, draw.WithPerPointColors(options.Colors...))
	case colorCount > 0 && hasSize:
		points, err = draw.NewPoints(options.Positions, draw.WithPointColorPalette(options.Colors, posCount), draw.WithPointsSize(options.PointSize))
	case colorCount > 0:
		points, err = draw.NewPoints(options.Positions, draw.WithPointColorPalette(options.Colors, posCount))
	case hasSize:
		points, err = draw.NewPoints(options.Positions, draw.WithPointsSize(options.PointSize))
	default:
		points, err = draw.NewPoints(options.Positions)
	}
	
	if err != nil {
		return nil, fmt.Errorf("failed to create points: %w", err)
	}

	parent := options.Parent
	if parent == "" {
		parent = "world"
	}

	drawing := points.Draw(options.ID, options.Name, parent, spatialmath.NewZeroPose())
	req := connect.NewRequest(&drawv1.AddDrawingRequest{Drawing: drawing.ToProto()})
	resp, err := client.AddDrawing(context.Background(), req)
	if err != nil {
		return nil, fmt.Errorf("AddDrawing RPC failed: %w", err)
	}

	return resp.Msg.Uuid, nil
}
