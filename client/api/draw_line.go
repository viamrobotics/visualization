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
	// ID is a stable identifier for the entity. When set, calling DrawLine
	// again with the same ID updates the existing entity in place; when empty,
	// each call creates a new entity with a freshly generated UUID.
	ID string
	// Name labels the entity in the visualizer. Must be ASCII printable and at
	// most 100 characters.
	Name string
	// Parent is the reference frame the line is attached to. Defaults to
	// "world" when empty.
	Parent string
	// Positions defines the polyline vertices in order. Must contain at least
	// two positions.
	Positions []r3.Vector
	// Colors controls how line segments are colored. With no colors, segments
	// use draw.DefaultLineColor (blue). Pass one color to share it across all
	// segments; pass exactly len(Positions) colors for per-vertex colors; pass
	// any other count to cycle through the slice as a palette.
	Colors []draw.Color
	// DotColors controls how the vertex dots are colored, following the same
	// count rules as Colors. When DotColors is empty, the dots fall back to
	// Colors (so dots and segments share their palette by default); if both
	// are empty, dots use draw.DefaultLineDotColor (dark blue).
	DotColors []draw.Color
	// LineWidth is the rendered thickness of segments in millimeters. 0 (the
	// default) uses draw.DefaultLineWidth (5mm).
	LineWidth float32
	// DotSize is the rendered diameter of vertex dots in millimeters. 0 (the
	// default) uses draw.DefaultLineDotSize (10mm).
	DotSize float32
	// Attrs carries optional shared display attributes (axes helper, default
	// visibility). Nil leaves all attributes at their defaults.
	Attrs *Attrs
}

// DrawLine sends a polyline to the visualizer as a drawing. Passing an ID that
// already exists updates the previously drawn entity in place; otherwise a new
// entity is created. Returns the UUID assigned by the server.
//
// Returns an error when Name is not ASCII printable or exceeds 100 characters,
// ErrVisualizerNotRunning if no visualizer is reachable, the underlying
// validation error if the line cannot be constructed (see draw.NewLine — fewer
// than two positions, mismatched color count, etc.), or a wrapped RPC error if
// the AddEntity call fails.
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

	dotColors := options.DotColors
	if len(dotColors) == 0 {
		dotColors = options.Colors
	}

	dotColorCount := len(dotColors)
	switch dotColorCount {
	case 0:
		// use default
	case 1:
		lineOpts = append(lineOpts, draw.WithSingleDotColor(dotColors[0]))
	case posCount:
		lineOpts = append(lineOpts, draw.WithPerDotColors(dotColors...))
	default:
		lineOpts = append(lineOpts, draw.WithDotColorPalette(dotColors, posCount))
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

	drawing := line.Draw(options.Name, entityAttributes(options.ID, options.Parent, options.Attrs)...)
	req := connect.NewRequest(&drawv1.AddEntityRequest{Entity: &drawv1.AddEntityRequest_Drawing{Drawing: drawing.ToProto()}})
	resp, err := client.AddEntity(context.Background(), req)
	if err != nil {
		return nil, fmt.Errorf("AddEntity RPC failed: %w", err)
	}

	return resp.Msg.Uuid, nil
}
