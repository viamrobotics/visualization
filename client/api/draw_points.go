package api

import (
	"context"
	"fmt"

	"connectrpc.com/connect"
	"github.com/golang/geo/r3"
	"github.com/viam-labs/motion-tools/client/server"
	"github.com/viam-labs/motion-tools/draw"
	drawv1 "github.com/viam-labs/motion-tools/draw/v1"
	"go.viam.com/rdk/spatialmath"
)

// DrawPointsOptions configures a DrawPoints call.
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
// Returns the UUID of the drawn points, or an error if the server is not running or the drawing fails.
func DrawPoints(options DrawPointsOptions) ([]byte, error) {
	err := isASCIIPrintable(options.Name)
	if err != nil {
		return nil, err
	}

	client := server.GetClient()
	if client == nil {
		return nil, fmt.Errorf("server is not running; call server.Start() first")
	}

	var points *draw.Points

	hasSize := options.PointSize > 0
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

	if hasSize {
		pointOptions = append(pointOptions, draw.WithPointsSize(options.PointSize))
	}

	points, err = draw.NewPoints(options.Positions, pointOptions...)
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
