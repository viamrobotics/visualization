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

	// Colors is the colors to use for the line segments.
	// Provide no colors for the default, one color to use for all segments,
	// one color per vertex for per-vertex coloring, or a palette of colors to cycle through.
	Colors []draw.Color

	// DotColors is the colors to use for the vertex dots.
	// Provide no colors for the default, one color to use for all dots,
	// one color per dot for per-dot coloring, or a palette of colors to cycle through.
	DotColors []draw.Color

	// LineWidth is the width of the line segments in millimeters. If 0, uses the default.
	LineWidth float32

	// DotSize is the size of the vertex dots in millimeters. If 0, uses the default.
	DotSize float32
}

// DrawLine draws a line in the visualizer.
// Calling DrawLine with an ID that already exists will instead update the line.
// Returns the UUID of the drawn line, or an error if the server is not running or the drawing fails.
func DrawLine(options DrawLineOptions) ([]byte, error) {
	if err := isASCIIPrintable(options.Name); err != nil {
		return nil, err
	}

	client := server.GetClient()
	if client == nil {
		return nil, ErrVisualizerNotRunning
	}

	lineOpts := []draw.DrawLineOption{}
	posCount := len(options.Positions)

	colorCount := len(options.Colors)
	switch {
	case colorCount == 0:
		// use default
	case colorCount == 1:
		lineOpts = append(lineOpts, draw.WithSingleLineColor(options.Colors[0]))
	case colorCount == posCount:
		lineOpts = append(lineOpts, draw.WithPerLineColors(options.Colors...))
	default:
		lineOpts = append(lineOpts, draw.WithLineColorPalette(options.Colors, posCount))
	}

	dotColorCount := len(options.DotColors)
	switch {
	case dotColorCount == 0:
		// use default
	case dotColorCount == 1:
		lineOpts = append(lineOpts, draw.WithSingleDotColor(options.DotColors[0]))
	case dotColorCount == posCount:
		lineOpts = append(lineOpts, draw.WithPerDotColors(options.DotColors...))
	default:
		lineOpts = append(lineOpts, draw.WithDotColorPalette(options.DotColors, posCount))
	}

	if options.LineWidth > 0 {
		lineOpts = append(lineOpts, draw.WithLineWidth(options.LineWidth))
	}
	if options.DotSize > 0 {
		lineOpts = append(lineOpts, draw.WithDotSize(options.DotSize))
	}

	line, err := draw.NewLine(options.Positions, lineOpts...)
	if err != nil {
		return nil, fmt.Errorf("failed to create line: %w", err)
	}

	parent := options.Parent
	if parent == "" {
		parent = "world"
	}

	drawOpts := []draw.DrawableOption{draw.WithParent(parent)}
	if options.ID != "" {
		drawOpts = append(drawOpts, draw.WithID(options.ID))
	}

	drawing := line.Draw(options.Name, drawOpts...)
	req := connect.NewRequest(&drawv1.AddEntityRequest{Entity: &drawv1.AddEntityRequest_Drawing{Drawing: drawing.ToProto()}})
	resp, err := client.AddEntity(context.Background(), req)
	if err != nil {
		return nil, fmt.Errorf("AddEntity RPC failed: %w", err)
	}

	return resp.Msg.Uuid, nil
}
