package server

import (
	"context"
	"fmt"

	"connectrpc.com/connect"
	"github.com/viam-labs/motion-tools/draw"
	drawv1 "github.com/viam-labs/motion-tools/draw/v1"
	"go.viam.com/rdk/spatialmath"
)

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
// Calling DrawGeometry with and ID that already exists in the visualizer will update that geometry.
//
// Returns the UUID of the drawn geometry, or an error if the server is not running or the drawing fails
func DrawGeometry(options DrawGeometryOptions) ([]byte, error) {
	client := GetClient()
	if client == nil {
		return nil, fmt.Errorf("server is not running; call server.Start() first")
	}

	drawnGeometry, err := draw.NewDrawnGeometry(options.Geometry, draw.WithGeometryColor(options.Color))
	if err != nil {
		return nil, fmt.Errorf("failed to create drawn geometry: %w", err)
	}

	if options.Parent == "" {
		options.Parent = "world"
	}

	transform, err := drawnGeometry.Draw(options.ID, options.Geometry.Label(), options.Parent, spatialmath.NewZeroPose())
	if err != nil {
		return nil, fmt.Errorf("failed to create transform: %w", err)
	}

	req := connect.NewRequest(&drawv1.AddTransformRequest{Transform: transform})
	resp, err := client.AddTransform(context.Background(), req)
	if err != nil {
		return nil, fmt.Errorf("AddTransform RPC failed: %w", err)
	}

	return resp.Msg.Uuid, nil
}
