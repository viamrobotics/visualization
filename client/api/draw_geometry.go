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
	// A unique identifier for the entity. If set, drawing with the same ID updates the existing entity.
	ID string

	// The name of the entity. If empty, falls back to the geometry label.
	Name string

	// The parent frame name. If empty, defaults to "world".
	Parent string

	// The geometry to draw.
	Geometry spatialmath.Geometry

	// The color to draw the geometry with.
	Color draw.Color

	// Attrs holds optional entity attributes (e.g. visibility).
	Attrs *Attrs
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

	transform, err := drawnGeometry.Draw(options.Name, entityAttributes(options.ID, options.Parent, options.Attrs)...)
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
