package draw

import (
	"fmt"

	"go.viam.com/rdk/spatialmath"
)

var (
	// DefaultNurbsDegree is the default degree of a NURBS curve
	DefaultNurbsDegree int = 3

	// DefaultNurbsColor is the default color of a NURBS curve, defaults to [0, 1, 1, 0.7] (cyan)
	DefaultNurbsColor = NewColor().ByName("cyan")
)

// Nurbs represents a NURBS curve in 3D space
// Metadata:
// - colors: []float32 of a single color: [r, g, b, a], defaults to [0, 1, 1, 0.7] (cyan)
type Nurbs struct {
	// The control points of the NURBS
	ControlPoints []spatialmath.Pose

	// The Degree of the NURBS, defaults to 3
	Degree int32

	// The Weights of the NURBS, defaults to [1, ...]
	Weights []float64

	// The Knots of the NURBS
	Knots []float64

	// Either a single color or a color per control point
	Colors []*Color
}

func NewNurbs(controlPoints []spatialmath.Pose, degree int32, weights []float64, knots []float64, colors []*Color) (*Nurbs, error) {
	if len(controlPoints) == 0 {
		return nil, fmt.Errorf("control points cannot be empty")
	}

	if degree <= 0 {
		return nil, fmt.Errorf("degree must be greater than 0, got %d", degree)
	}

	if len(weights) == 0 {
		weights = make([]float64, len(controlPoints))
		for i := range weights {
			weights[i] = 1.0
		}
	} else if len(weights) != len(controlPoints) {
		return nil, fmt.Errorf("weights must have length %d, got %d", len(controlPoints), len(weights))
	}

	if len(knots) == 0 {
		knots = make([]float64, int(degree)+1)
		for i := range knots {
			knots[i] = float64(i)
		}
	}

	if len(knots) != int(degree)+1 {
		return nil, fmt.Errorf("knots must have length %d, got %d", int(degree)+1, len(knots))
	}

	if len(colors) == 0 {
		colors = []*Color{DefaultNurbsColor}
	}

	if len(colors) != 1 && len(colors) != len(controlPoints) {
		return nil, fmt.Errorf("colors must have length 1 (single color) or %d (per-control-point colors), got %d", len(controlPoints), len(colors))
	}

	return &Nurbs{ControlPoints: controlPoints, Degree: degree, Weights: weights, Knots: knots, Colors: colors}, nil
}

// Draw draws a NURBS curve from a list of control points, weights, knots, and colors
// If colors is nil or empty, uses DefaultNurbsColor (cyan)
func (nurbs *Nurbs) Draw(
	name string,
	parent string,
	pose spatialmath.Pose,
	units Units,
) *Drawing {
	shape := NewShape(pose, name, units).WithNurbs(nurbs)
	drawing := NewDrawing(name, parent, pose, shape, NewMetadata(nurbs.Colors))
	return drawing
}
