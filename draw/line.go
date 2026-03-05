package draw

import (
	"fmt"

	"github.com/golang/geo/r3"
)

var (
	// DefaultLineWidth is the default line width in millimeters.
	DefaultLineWidth float32 = 5.0
)

// Line represents a polyline (connected line segments) in 3D space, with optional visible
// points at each vertex. Useful for drawing paths, trajectories, or connected geometric shapes.
type Line struct {
	// Positions defines the vertices of the line in sequence.
	Positions []r3.Vector

	// LineWidth specifies the thickness of the line segments in millimeters (default: 5mm).
	LineWidth float32

	// PointSize specifies the size of points rendered at each vertex in millimeters (default: 10mm).
	PointSize float32

	// LineColor is the color used for rendering the line segments (default: blue).
	LineColor Color

	// PointColor is the color used for rendering the vertex points (default: dark blue).
	PointColor Color
}

type drawLineConfig struct {
	drawColorsConfig

	lineWidth float32
	pointSize float32
}

func newDrawLineConfig(lineWidth float32, pointSize float32, colors ...Color) *drawLineConfig {
	return &drawLineConfig{
		lineWidth:        lineWidth,
		pointSize:        pointSize,
		drawColorsConfig: newDrawColorsConfig(colors...),
	}
}

// DrawLineOption is a functional option for configuring a Line
type DrawLineOption func(*drawLineConfig)

// WithLineWidth creates a line option that sets the line segment width in millimeters.
func WithLineWidth(width float32) DrawLineOption {
	return func(config *drawLineConfig) {
		config.lineWidth = width
	}
}

// WithPointSize creates a line option that sets the size of vertex points in millimeters.
func WithPointSize(size float32) DrawLineOption {
	return func(config *drawLineConfig) {
		config.pointSize = size
	}
}

// WithLineColors creates a line option that sets colors for the line segments and vertex points.
// If pointColor is nil, the line color is used for both.
func WithLineColors(lineColor Color, pointColor *Color) DrawLineOption {
	colors := []Color{lineColor, lineColor}
	if pointColor != nil {
		colors[1] = *pointColor
	}

	return withColors[*drawLineConfig](colors)
}

// NewLine creates a new Line from the given vertex positions and optional configuration.
// Returns an error if there are fewer than 2 positions or if the point size is non-positive.
func NewLine(positions []r3.Vector, options ...DrawLineOption) (*Line, error) {
	config := newDrawLineConfig(DefaultLineWidth, DefaultPointSize, DefaultLineColor, DefaultLinePointColor)
	for _, option := range options {
		option(config)
	}

	if len(positions) < 2 {
		return nil, fmt.Errorf("line must have at least 2 positions, got %d", len(positions))
	}

	if config.pointSize <= 0 {
		return nil, fmt.Errorf("point size must be greater than 0, got %f", config.pointSize)
	}

	if config.lineWidth <= 0 {
		return nil, fmt.Errorf("line width must be greater than 0, got %f", config.lineWidth)
	}

	return &Line{
		Positions:  positions,
		LineWidth:  config.lineWidth,
		PointSize:  config.pointSize,
		LineColor:  config.colors[0],
		PointColor: config.colors[1],
	}, nil
}

// Draw creates a Drawing from this Line object.
func (line Line) Draw(name string, options ...DrawableOption) *Drawing {
	config := NewDrawConfig(name, options...)
	shape := NewShape(config.Center, config.Name, WithLine(line))
	return NewDrawing(config.UUID, config.Name, config.Parent, config.Pose, shape, NewMetadata(WithMetadataColors(line.LineColor, line.PointColor)))
}
