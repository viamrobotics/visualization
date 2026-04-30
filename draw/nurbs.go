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

	// Colors specifies the rendering colors for the curve. Currently the visualizer
	// only honors a single shared color; per-control-point colors are accepted by
	// NewNurbs but not yet rendered as a gradient.
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

// DrawNurbsOption configures degree, weights, line width, and color settings for a
// Nurbs constructed via NewNurbs. When multiple options touch the same field, the
// last option in the argument list wins.
type DrawNurbsOption func(*drawNurbsConfig)

// WithNurbsDegree sets the polynomial degree of the curve. Higher degrees produce
// smoother curves but require more control points and a longer knot vector
// (len(controlPoints) + degree + 1). Defaults to DefaultNurbsDegree (3, cubic).
func WithNurbsDegree(degree int32) DrawNurbsOption {
	return func(config *drawNurbsConfig) {
		config.degree = degree
	}
}

// WithNurbsWeights sets one weight per control point. Higher weights pull the curve
// closer to that control point. The number of weights must equal the number of
// control points passed to NewNurbs. Defaults to 1.0 for every control point
// (uniform weighting).
func WithNurbsWeights(weights []float64) DrawNurbsOption {
	return func(config *drawNurbsConfig) {
		config.weights = weights
	}
}

// WithNurbsColors sets the curve's color. defaultColor is required and serves as the
// curve color when used alone; the variadic perPointColors are appended and stored
// for forward compatibility with per-control-point coloring. Currently only the
// first color is rendered; pass len(controlPoints) values total if you want to
// satisfy the per-control-point validation in NewNurbs. Defaults to DefaultNurbsColor
// (cyan).
func WithNurbsColors(defaultColor Color, perPointColors ...Color) DrawNurbsOption {
	colors := []Color{defaultColor}
	colors = append(colors, perPointColors...)
	return withColors[*drawNurbsConfig](colors)
}

// WithNurbsLineWidth sets the rendered thickness of the curve in millimeters.
// Defaults to DefaultLineWidth (5mm).
func WithNurbsLineWidth(width float32) DrawNurbsOption {
	return func(config *drawNurbsConfig) {
		config.lineWidth = width
	}
}

// NewNurbs returns a Nurbs curve from the given control points, knot vector, and
// options. Returns an error if controlPoints or knots is empty, if the degree is
// non-positive, if the configured weights count is non-zero and does not equal
// len(controlPoints), if the configured colors count is neither 1 nor
// len(controlPoints), or if len(knots) does not equal len(controlPoints) + degree + 1.
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

// Draw wraps the Nurbs in a Drawing identified by name. The DrawableOptions control
// placement (parent frame, pose, center), identity (UUID), and visibility — see
// DrawableOption for the full set.
func (nurbs Nurbs) Draw(name string, options ...DrawableOption) *Drawing {
	config := NewDrawConfig(name, options...)
	shape := NewShape(config.Center, config.Name, WithNurbs(nurbs))
	return NewDrawing(config, shape, WithMetadataColors(nurbs.Colors...))
}
