package server

import (
	"context"
	"fmt"

	"connectrpc.com/connect"
	"github.com/viam-labs/motion-tools/draw"
	drawv1 "github.com/viam-labs/motion-tools/draw/v1"
	"go.viam.com/rdk/spatialmath"
)

type DrawNurbsOptions struct {
	// A unique identifier for the NURBS curve. Can be empty.
	ID string

	// The name of the NURBS curve.
	Name string

	// Control points that define the curve shape.
	ControlPoints []spatialmath.Pose

	// Knots vector that determines parameter values along the curve.
	Knots []float64

	// The name of the parent frame. If empty, the curve will be parented to the "world" frame.
	Parent string

	// Color of the curve.
	Color draw.Color

	// Degree specifies the polynomial degree of the curve. If 0, uses the default (3).
	Degree int32

	// Weights controls the influence of each control point. If empty, defaults to 1.0 for each point.
	Weights []float64
}

// DrawNurbs draws a NURBS curve in the visualizer.
// Calling DrawNurbs with an ID that already exists will instead update the curve in the parent frame.
// Returns the UUID of the drawn NURBS curve, or an error if the server is not running or the drawing fails
func DrawNurbs(options DrawNurbsOptions) ([]byte, error) {
	err := isASCIIPrintable(options.Name)
	if err != nil {
		return nil, err
	}

	client := GetClient()
	if client == nil {
		return nil, fmt.Errorf("server is not running; call server.Start() first")
	}

	// Build NURBS curve with options
	var nurbs *draw.Nurbs
	
	switch {
	case options.Degree > 0 && len(options.Weights) > 0:
		nurbs, err = draw.NewNurbs(options.ControlPoints, options.Knots, 
			draw.WithNurbsDegree(options.Degree),
			draw.WithNurbsWeights(options.Weights),
			draw.WithNurbsColors(options.Color))
	case options.Degree > 0:
		nurbs, err = draw.NewNurbs(options.ControlPoints, options.Knots,
			draw.WithNurbsDegree(options.Degree),
			draw.WithNurbsColors(options.Color))
	case len(options.Weights) > 0:
		nurbs, err = draw.NewNurbs(options.ControlPoints, options.Knots,
			draw.WithNurbsWeights(options.Weights),
			draw.WithNurbsColors(options.Color))
	default:
		nurbs, err = draw.NewNurbs(options.ControlPoints, options.Knots,
			draw.WithNurbsColors(options.Color))
	}
	
	if err != nil {
		return nil, fmt.Errorf("failed to create NURBS curve: %w", err)
	}

	parent := options.Parent
	if parent == "" {
		parent = "world"
	}

	drawing := nurbs.Draw(options.ID, options.Name, parent, spatialmath.NewZeroPose())
	req := connect.NewRequest(&drawv1.AddDrawingRequest{Drawing: drawing.ToProto()})
	resp, err := client.AddDrawing(context.Background(), req)
	if err != nil {
		return nil, fmt.Errorf("AddDrawing RPC failed: %w", err)
	}

	return resp.Msg.Uuid, nil
}
