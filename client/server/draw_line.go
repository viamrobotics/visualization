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

type DrawLineOptions struct {
	// A unique identifier for the line. Can be empty.
	ID string

	// The name of the line.
	Name string

	// The positions defining the polyline vertices.
	Positions []r3.Vector

	// The name of the parent frame. If empty, the line will be parented to the "world" frame.
	Parent string

	// LineColor is the color for the line segments.
	LineColor draw.Color

	// PointColor is the optional color for the vertex points. If nil, the line color is used.
	PointColor *draw.Color

	// LineWidth is the width of the line segments in millimeters. If 0, uses the default.
	LineWidth float32

	// PointSize is the size of the vertex points in millimeters. If 0, uses the default.
	PointSize float32
}

// DrawLine draws a line in the visualizer.
// Calling DrawLine with an ID that already exists will instead update the line in the parent frame.
// Returns the UUID of the drawn line, or an error if the server is not running or the drawing fails
func DrawLine(options DrawLineOptions) ([]byte, error) {
	err := isASCIIPrintable(options.Name)
	if err != nil {
		return nil, err
	}

	client := GetClient()
	if client == nil {
		return nil, fmt.Errorf("server is not running; call server.Start() first")
	}

	// Build line with options - call WithLineColors first, then optionally add width and size
	lineColorOpt := draw.WithLineColors(options.LineColor, options.PointColor)
	
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
