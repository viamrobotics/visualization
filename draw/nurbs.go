package draw

import (
	"fmt"

	"go.viam.com/rdk/spatialmath"
)

var (
	// DefaultNurbsDegree is the default polynomial degree for NURBS curves (cubic).
	DefaultNurbsDegree int32 = 3

	// DefaultNurbsWeight is the default weight value for NURBS control points.
	DefaultNurbsWeight = 1.0

	// DefaultNurbsColor is the default color for NURBS curves (cyan).
	DefaultNurbsColor = NewColor(WithName("cyan"))
)

// Nurbs represents a Non-Uniform Rational B-Spline (NURBS) curve in 3D space.
// NURBS curves are defined by control points, weights, a knot vector, and a polynomial degree.
// They are commonly used to represent smooth, curved paths and surfaces.
type Nurbs struct {
	// ControlPoints defines the poses that influence the curve's shape.
	ControlPoints []spatialmath.Pose

	// Knots is the knot vector that determines parameter values along the curve.
	// Length must equal len(ControlPoints) + Degree + 1.
	Knots []float64

	// Degree specifies the polynomial degree of the curve (default: 3 for cubic).
	Degree int32

	// Weights controls the influence of each control point on the curve.
	// Defaults to 1.0 for each control point (uniform weighting).
	Weights []float64

	// Colors specifies the rendering colors for the curve. Can be a single color (applied to all points)
	// No other color options are currently supported.
	Colors []Color

	// LineWidth specifies the thickness of the line segments in millimeters (default: 5mm).
	LineWidth float32
}

// drawNurbsConfig is a configuration for drawing a NURBS curve
type drawNurbsConfig struct {
	degree    int32
	weights   []float64
	lineWidth float32
	drawColorsConfig
}

// newDrawNurbsConfig creates a new draw NURBS curve configuration
//
// Returns the draw NURBS curve configuration
func newDrawNurbsConfig() *drawNurbsConfig {
	return &drawNurbsConfig{
		degree:           DefaultNurbsDegree,
		weights:          []float64{},
		lineWidth:        DefaultLineWidth,
		drawColorsConfig: newDrawColorsConfig(DefaultNurbsColor),
	}
}

// DrawNurbsOption is a function that configures a draw NURBS curve configuration
type DrawNurbsOption func(*drawNurbsConfig)

// WithNurbsDegree creates a NURBS option that sets the polynomial degree of the curve.
// Higher degrees create smoother curves but require more control points.
func WithNurbsDegree(degree int32) DrawNurbsOption {
	return func(config *drawNurbsConfig) {
		config.degree = degree
	}
}

// WithNurbsWeights creates a NURBS option that sets the weight for each control point.
// Weights control the influence of each point on the curve (higher weights pull the curve closer).
func WithNurbsWeights(weights []float64) DrawNurbsOption {
	return func(config *drawNurbsConfig) {
		config.weights = weights
	}
}

// WithNurbsColors creates a NURBS option that sets the color for the curve.
// If only defaultColor is provided, it applies to the entire curve.
// Note: Per-point colors are not currently supported in rendering.
func WithNurbsColors(defaultColor Color, perPointColors ...Color) DrawNurbsOption {
	colors := []Color{defaultColor}
	colors = append(colors, perPointColors...)
	return withColors[*drawNurbsConfig](colors)
}

// WithNurbsLineWidth creates a NURBS option that sets the line width.
func WithNurbsLineWidth(width float32) DrawNurbsOption {
	return func(config *drawNurbsConfig) {
		config.lineWidth = width
	}
}

// NewNurbs creates a new NURBS curve with the given control points, knot vector, and options.
// Returns an error if control points or knots are empty, if the degree is non-positive,
// if the weights don't match the number of control points, or if the knot vector length
// is incorrect (must be len(controlPoints) + degree + 1).
func NewNurbs(controlPoints []spatialmath.Pose, knots []float64, options ...DrawNurbsOption) (*Nurbs, error) {
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
		Colors:        config.colors,
		LineWidth:     config.lineWidth,
	}, nil
}

// Draw creates a Drawing from this Nurbs object.
func (nurbs Nurbs) Draw(name string, options ...DrawableOption) *Drawing {
	config := NewDrawConfig(name, options...)
	shape := NewShape(config.Center, config.Name, WithNurbs(nurbs))
	return NewDrawing(config.UUID, config.Name, config.Parent, config.Pose, shape, NewMetadata(WithMetadataColors(nurbs.Colors...)))
}
