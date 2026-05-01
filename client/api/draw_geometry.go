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
	// ID is a stable identifier for the entity. When set, calling DrawGeometry
	// again with the same ID updates the existing entity in place; when empty,
	// each call creates a new entity with a freshly generated UUID.
	ID string
	// Name labels the entity in the visualizer. When empty, the geometry's own
	// label is used.
	Name string
	// Parent is the reference frame the geometry is attached to. Defaults to
	// "world" when empty.
	Parent string
	// Geometry is the spatial geometry to render. Required.
	Geometry spatialmath.Geometry
	// Color is the render color for the geometry.
	Color draw.Color
	// Attrs carries optional shared display attributes (axes helper, default
	// visibility). Nil leaves all attributes at their defaults.
	Attrs *Attrs
}

// DrawGeometry sends a single geometry to the visualizer as a transform. Passing
// an ID that already exists updates the previously drawn entity in place;
// otherwise a new entity is created. Returns the UUID assigned by the server.
//
// Returns ErrVisualizerNotRunning if no visualizer is reachable, the underlying
// validation error if the geometry cannot be wrapped (see draw.NewDrawnGeometry),
// or a wrapped RPC error if the AddEntity call fails.
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
