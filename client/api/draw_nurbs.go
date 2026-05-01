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

// DrawNurbsOptions configures a DrawNurbs call.
type DrawNurbsOptions struct {
	// ID is a stable identifier for the entity. When set, calling DrawNurbs
	// again with the same ID updates the existing entity in place; when empty,
	// each call creates a new entity with a freshly generated UUID.
	ID string
	// Name labels the entity in the visualizer. Must be ASCII printable and at
	// most 100 characters.
	Name string
	// Parent is the reference frame the curve is attached to. Defaults to
	// "world" when empty.
	Parent string
	// ControlPoints defines the poses that influence the curve's shape.
	// Required.
	ControlPoints []spatialmath.Pose
	// Knots is the knot vector that determines parameter values along the
	// curve. Length must equal len(ControlPoints) + Degree + 1.
	Knots []float64
	// Color is the render color for the curve.
	Color draw.Color
	// Degree is the polynomial degree of the curve. Higher degrees produce
	// smoother curves but require more control points and a longer knot
	// vector. 0 (the default) uses draw.DefaultNurbsDegree (3, cubic).
	Degree int32
	// Weights sets the per-control-point influence on the curve; higher
	// weights pull the curve closer to that control point. When non-empty,
	// length must equal len(ControlPoints). Empty (the default) is treated as
	// 1.0 for every control point (uniform weighting).
	Weights []float64
	// LineWidth is the rendered thickness of the curve in millimeters. 0 (the
	// default) uses draw.DefaultLineWidth (5mm).
	LineWidth float32
	// Attrs carries optional shared display attributes (axes helper, default
	// visibility). Nil leaves all attributes at their defaults.
	Attrs *Attrs
}

// DrawNurbs sends a NURBS curve to the visualizer as a drawing. Passing an ID
// that already exists updates the previously drawn entity in place; otherwise
// a new entity is created. Returns the UUID assigned by the server.
//
// Returns an error when Name is not ASCII printable or exceeds 100 characters,
// ErrVisualizerNotRunning if no visualizer is reachable, the underlying
// validation error if the curve cannot be constructed (see draw.NewNurbs —
// empty control points or knots, mismatched lengths, non-positive degree,
// etc.), or a wrapped RPC error if the AddEntity call fails.
func DrawNurbs(options DrawNurbsOptions) ([]byte, error) {
	if err := isASCIIPrintable(options.Name); err != nil {
		return nil, err
	}

	client := server.GetClient()
	if client == nil {
		return nil, ErrVisualizerNotRunning
	}

	nurbsOptions := []draw.DrawNurbsOption{draw.WithNurbsColors(options.Color)}

	if options.Degree > 0 {
		nurbsOptions = append(nurbsOptions, draw.WithNurbsDegree(options.Degree))
	}
	if len(options.Weights) > 0 {
		nurbsOptions = append(nurbsOptions, draw.WithNurbsWeights(options.Weights))
	}
	if options.LineWidth > 0 {
		nurbsOptions = append(nurbsOptions, draw.WithNurbsLineWidth(options.LineWidth))
	}

	nurbs, err := draw.NewNurbs(options.ControlPoints, options.Knots, nurbsOptions...)
	if err != nil {
		return nil, fmt.Errorf("failed to create NURBS curve: %w", err)
	}

	drawing := nurbs.Draw(options.Name, entityAttributes(options.ID, options.Parent, options.Attrs)...)
	req := connect.NewRequest(&drawv1.AddEntityRequest{Entity: &drawv1.AddEntityRequest_Drawing{Drawing: drawing.ToProto()}})
	resp, err := client.AddEntity(context.Background(), req)
	if err != nil {
		return nil, fmt.Errorf("AddEntity RPC failed: %w", err)
	}

	return resp.Msg.Uuid, nil
}
