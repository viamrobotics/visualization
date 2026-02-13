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

// DrawLineOptions configures a DrawLine call.
type DrawLineOptions struct {
	// A unique identifier for the line. Can be empty.
	ID string

	// The name of the line.
	Name string

	// The positions defining the polyline vertices.
	Positions []r3.Vector

	// The name of the parent frame. If empty, the line will be parented to the "world" frame.
	Parent string

	// Colors is the colors to use for the line segments and vertex points.
	// Can be a single color for lines and points, or a different color for each.
	Colors []draw.Color

	// LineWidth is the width of the line segments in millimeters. If 0, uses the default.
	LineWidth float32

	// PointSize is the size of the vertex points in millimeters. If 0, uses the default.
	PointSize float32
}

// DrawLine draws a line in the visualizer.
// Calling DrawLine with an ID that already exists will instead update the line in the parent frame.
// Returns the UUID of the drawn line, or an error if the server is not running or the drawing fails.
func DrawLine(options DrawLineOptions) ([]byte, error) {
	err := isASCIIPrintable(options.Name)
	if err != nil {
		return nil, err
	}

	client := server.GetClient()
	if client == nil {
		return nil, ErrVisualizerNotRunning
	}

	if len(options.Colors) == 0 {
		options.Colors = []draw.Color{draw.DefaultLineColor, draw.DefaultLinePointColor}
	} else if len(options.Colors) == 1 {
		options.Colors = []draw.Color{options.Colors[0], options.Colors[0]}
	} else if len(options.Colors) == 2 {
		options.Colors = []draw.Color{options.Colors[0], options.Colors[1]}
	} else {
		return nil, fmt.Errorf("invalid number of colors: %d", len(options.Colors))
	}

	lineColorOpt := draw.WithLineColors(options.Colors[0], &options.Colors[1])

	var line *draw.Line
	if options.LineWidth > 0 && options.PointSize > 0 {
		line, err = draw.NewLine(options.Positions, lineColorOpt, draw.WithLineWidth(options.LineWidth), draw.WithPointSize(options.PointSize))
	} else if options.LineWidth > 0 {
		line, err = draw.NewLine(options.Positions, lineColorOpt, draw.WithLineWidth(options.LineWidth))
	} else if options.PointSize > 0 {
		line, err = draw.NewLine(options.Positions, lineColorOpt, draw.WithPointSize(options.PointSize))
	} else {
		line, err = draw.NewLine(options.Positions, lineColorOpt)
	}
	if err != nil {
		return nil, fmt.Errorf("failed to create line: %w", err)
	}

	parent := options.Parent
	if parent == "" {
		parent = "world"
	}

	drawing := line.Draw(options.ID, options.Name, parent, spatialmath.NewZeroPose())
	req := connect.NewRequest(&drawv1.AddDrawingRequest{Drawing: drawing.ToProto()})
	resp, err := client.AddDrawing(context.Background(), req)
	if err != nil {
		return nil, fmt.Errorf("AddDrawing RPC failed: %w", err)
	}

	return resp.Msg.Uuid, nil
}
