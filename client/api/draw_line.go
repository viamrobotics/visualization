package api

import (
	"context"
	"fmt"
	"os"
	"time"

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

	// Colors is the colors to use for the line segments and vertex points.
	// Provide no colors for defaults, one color to use for both segments and points,
	// or two colors for [lineColor, pointColor].
	Colors []draw.Color

	// LineWidth is the width of the line segments in millimeters. If 0, uses the default.
	LineWidth float32

	// PointSize is the size of the vertex points in millimeters. If 0, uses the default.
	PointSize float32
}

// DrawLine draws a line in the visualizer.
// Calling DrawLine with an ID that already exists will instead update the line.
// Returns the UUID of the drawn line, or an error if the server is not running or the drawing fails.
func DrawLine(options DrawLineOptions) ([]byte, error) {
	// #region agent log
	{
		line := fmt.Sprintf("{\"sessionId\":\"23bd9f\",\"location\":\"draw_line.go:DrawLine\",\"message\":\"stage1-draw-line\",\"data\":{\"id\":\"%s\"},\"timestamp\":%d}\n", options.ID, time.Now().UnixMilli())
		if f, err := os.OpenFile("/Users/devin/Projects/motion-tools/.cursor/debug-23bd9f.log", os.O_APPEND|os.O_CREATE|os.O_WRONLY, 0644); err == nil { f.WriteString(line); f.Close() }
	}
	// #endregion
	if err := isASCIIPrintable(options.Name); err != nil {
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

	lineOpts := []draw.DrawLineOption{lineColorOpt}
	if options.LineWidth > 0 {
		lineOpts = append(lineOpts, draw.WithLineWidth(options.LineWidth))
	}
	if options.PointSize > 0 {
		lineOpts = append(lineOpts, draw.WithPointSize(options.PointSize))
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
