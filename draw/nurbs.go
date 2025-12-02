package draw

import (
	"fmt"

	"go.viam.com/rdk/spatialmath"
)

var (
	// DefaultNurbsDegree is the default degree of a NURBS curve
	DefaultNurbsDegree int32 = 3

	// DefaultNurbsWeights is the default weights of a NURBS curve, defaults to [1, ...]
	DefaultNurbsWeight = 1.0

	// DefaultNurbsColor is the default color of a NURBS curve, defaults to [0, 1, 1, 0.7] (cyan)
	DefaultNurbsColor = NewColor(WithName("cyan"))
)

// Nurbs represents a NURBS curve in 3D space
type Nurbs struct {
	// The control points of the NURBS
	ControlPoints []spatialmath.Pose

	// The knot vector of the NURBS
	Knots []float64

	// The Degree of the NURBS, defaults to 3
	Degree int32

	// The Weights of the NURBS, defaults to [1, ...]
	Weights []float64

	// Either a single color or a color per control point
	Color Color
}

type drawNurbsConfig struct {
	degree  int32
	weights []float64
	DrawColorsConfig
}

func newDrawNurbsConfig() *drawNurbsConfig {
	return &drawNurbsConfig{
		degree:           DefaultNurbsDegree,
		weights:          []float64{},
		DrawColorsConfig: NewDrawColorsConfig(DefaultNurbsColor),
	}
}

type drawNurbsOption func(*drawNurbsConfig)

// WithNurbsDegree sets the degree of the NURBS curve
func WithNurbsDegree(degree int32) drawNurbsOption {
	return func(config *drawNurbsConfig) {
		config.degree = degree
	}
}

// WithNurbsWeights sets the weights of the NURBS curve control points
func WithNurbsWeights(weights []float64) drawNurbsOption {
	return func(config *drawNurbsConfig) {
		config.weights = weights
	}
}

// WithNurbsColors sets the colors of the NURBS curve
// Can be a single color or a color per control point
func WithNurbsColors(defaultColor Color, perPointColors ...Color) drawNurbsOption {
	colors := []Color{defaultColor}
	colors = append(colors, perPointColors...)
	return WithColors[*drawNurbsConfig](colors)
}

// NewNurbs creates a new Nurbs object with functional options
func NewNurbs(controlPoints []spatialmath.Pose, knots []float64, options ...drawNurbsOption) (*Nurbs, error) {
	if len(controlPoints) == 0 {
		return nil, fmt.Errorf("control points cannot be empty")
	}

	if len(knots) == 0 {
		return nil, fmt.Errorf("knots cannot be empty")
	}

	config := newDrawNurbsConfig()
	for _, option := range options {
		option(config)
	}

	if config.degree <= 0 {
		return nil, fmt.Errorf("degree must be greater than 0, got %d", config.degree)
	}

	// Default weights to 1.0 for each control point if not provided
	weights := config.weights
	if len(weights) == 0 {
		weights = make([]float64, len(controlPoints))
		for i := range weights {
			weights[i] = 1.0
		}
	} else if len(weights) != len(controlPoints) {
		return nil, fmt.Errorf("weights must have length %d, got %d", len(controlPoints), len(weights))
	}

	if len(config.colors) != 1 && len(config.colors) != len(controlPoints) {
		return nil, fmt.Errorf("colors must have length 1 (single color) or %d (per-control-point colors), got %d", len(controlPoints), len(config.colors))
	}

	if len(knots) != len(controlPoints)+int(config.degree)+1 {
		return nil, fmt.Errorf("knots must have length %d, got %d", len(controlPoints)+int(config.degree)+1, len(knots))
	}

	return &Nurbs{
		ControlPoints: controlPoints,
		Degree:        config.degree,
		Weights:       weights,
		Knots:         knots,
		Color:         config.colors[0],
	}, nil
}

// Draw draws a NURBS curve from a list of control points, weights, knots, and colors
// If colors is nil or empty, uses DefaultNurbsColor (cyan)
func (nurbs Nurbs) Draw(
	name string,
	parent string,
	pose spatialmath.Pose,
) *Drawing {
	shape := NewShape(pose, name, WithNurbs(nurbs))
	drawing := NewDrawing(name, parent, pose, shape, NewMetadata(WithMetadataColors(nurbs.Color)))
	return drawing
}
