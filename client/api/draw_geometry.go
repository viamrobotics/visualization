package api

import (
	"context"
	"fmt"
	"os"
	"time"

	"connectrpc.com/connect"
	"github.com/viam-labs/motion-tools/client/server"
	"github.com/viam-labs/motion-tools/draw"
	drawv1 "github.com/viam-labs/motion-tools/draw/v1"
	"go.viam.com/rdk/spatialmath"
)

// DrawGeometryOptions configures a DrawGeometry call.
type DrawGeometryOptions struct {
	// A unique identifier for the geometry. Can be empty.
	ID string

	// The name of the parent frame. If empty, the geometry will be parented to the "world" frame.
	Parent string

	// The geometry to draw.
	Geometry spatialmath.Geometry

	// The color to draw the geometry with.
	Color draw.Color
}

// DrawGeometry draws a geometry in the visualizer.
// Calling DrawGeometry with an ID that already exists in the visualizer will update that geometry.
//
// Returns the UUID of the drawn geometry, or an error if the server is not running or the drawing fails.
func DrawGeometry(options DrawGeometryOptions) ([]byte, error) {
	// #region agent log
	{
		line := fmt.Sprintf("{\"sessionId\":\"23bd9f\",\"location\":\"draw_geometry.go:DrawGeometry\",\"message\":\"stage1-draw-geometry\",\"data\":{\"id\":\"%s\"},\"timestamp\":%d}\n", options.ID, time.Now().UnixMilli())
		if f, err := os.OpenFile("/Users/devin/Projects/motion-tools/.cursor/debug-23bd9f.log", os.O_APPEND|os.O_CREATE|os.O_WRONLY, 0644); err == nil { f.WriteString(line); f.Close() }
	}
	// #endregion
	client := server.GetClient()
	if client == nil {
		return nil, ErrVisualizerNotRunning
	}

	drawnGeometry, err := draw.NewDrawnGeometry(options.Geometry, draw.WithGeometryColor(options.Color))
	if err != nil {
		return nil, fmt.Errorf("failed to create drawn geometry: %w", err)
	}

	if options.Parent == "" {
		options.Parent = "world"
	}

	drawOpts := []draw.DrawableOption{draw.WithParent(options.Parent)}
	if options.ID != "" {
		drawOpts = append(drawOpts, draw.WithID(options.ID))
	}

	transform, err := drawnGeometry.Draw("", drawOpts...)
	if err != nil {
		return nil, fmt.Errorf("failed to create transform: %w", err)
	}

	req := connect.NewRequest(&drawv1.AddEntityRequest{Entity: &drawv1.AddEntityRequest_Transform{Transform: transform}})
	resp, err := client.AddEntity(context.Background(), req)
	if err != nil {
		return nil, fmt.Errorf("AddEntity RPC failed: %w", err)
	}

	return resp.Msg.Uuid, nil
}
