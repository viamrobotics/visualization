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

	// ShowAxesHelper controls whether the axes helper (RGB XYZ indicator) is shown on the entity.
	// If nil, defaults to true.
	ShowAxesHelper *bool

	// Invisible controls whether the entity is hidden from the 3D scene by default.
	// If nil, defaults to false (visible).
	Invisible *bool
}

// DrawGeometry draws a geometry in the visualizer.
// Calling DrawGeometry with an ID that already exists in the visualizer will update that geometry.
//
// Returns the UUID of the drawn geometry, or an error if the server is not running or the drawing fails.
func DrawGeometry(options DrawGeometryOptions) ([]byte, error) {
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
	if options.ShowAxesHelper != nil {
		drawOpts = append(drawOpts, draw.WithAxesHelper(*options.ShowAxesHelper))
	}
	if options.Invisible != nil && *options.Invisible {
		drawOpts = append(drawOpts, draw.WithInvisible(true))
	}
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
