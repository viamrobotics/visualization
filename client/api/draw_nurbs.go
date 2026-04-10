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
	// A unique identifier for the entity. If set, drawing with the same ID updates the existing entity.
	ID string

	// The name of the entity.
	Name string

	// The parent frame name. If empty, defaults to "world".
	Parent string

	// Control points that define the curve shape.
	ControlPoints []spatialmath.Pose

	// Knots vector that determines parameter values along the curve.
	Knots []float64

	// Color of the curve.
	Color draw.Color

	// Degree specifies the polynomial degree of the curve. If 0, uses the default (3).
	Degree int32

	// Weights controls the influence of each control point. If empty, defaults to 1.0 for each point.
	Weights []float64

	// LineWidth is the width of the line segments in millimeters. If 0, uses the default.
	LineWidth float32

	// Metadata holds optional metadata overrides (e.g. visibility).
	Metadata *MetadataOptions
}

// DrawNurbs draws a NURBS curve in the visualizer.
// Calling DrawNurbs with an ID that already exists will instead update the curve.
// Returns the UUID of the drawn NURBS curve, or an error if the server is not running or the drawing fails.
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

	drawing := nurbs.Draw(options.Name, entityOptions(options.ID, options.Parent, options.Metadata)...)
	req := connect.NewRequest(&drawv1.AddEntityRequest{Entity: &drawv1.AddEntityRequest_Drawing{Drawing: drawing.ToProto()}})
	resp, err := client.AddEntity(context.Background(), req)
	if err != nil {
		return nil, fmt.Errorf("AddEntity RPC failed: %w", err)
	}

	return resp.Msg.Uuid, nil
}
