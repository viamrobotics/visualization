package draw

import (
	"fmt"

	"github.com/golang/geo/r3"
	"go.viam.com/rdk/spatialmath"
)

var (
	// DefaultLineWidth is the default width of a line in millimeters
	DefaultLineWidth float32 = 5.0
)

// Line represents a Line in 3D space
type Line struct {
	// The positions of the line points to render
	Positions []r3.Vector

	// The width of the line, defaults to 5mm
	LineWidth float32

	// The size of the points, defaults to 10mm
	PointSize float32

	// The color of the line, defaults to blue
	LineColor Color

	// The color of the points, defaults to darker blue
	PointColor Color
}

// drawLineConfig holds configuration options for creating a Line.
type drawLineConfig struct {
	lineWidth float32
	pointSize float32
	DrawColorsConfig
}

func newDrawLineConfig(lineWidth float32, pointSize float32, colors ...Color) *drawLineConfig {
	return &drawLineConfig{
		lineWidth:        lineWidth,
		pointSize:        pointSize,
		DrawColorsConfig: NewDrawColorsConfig(colors...),
	}
}

// drawLineOption is a functional option for configuring a Line
type drawLineOption func(*drawLineConfig)

// WithLineWidth sets the width of the line in millimeters
func WithLineWidth(width float32) drawLineOption {
	return func(config *drawLineConfig) {
		config.lineWidth = width
	}
}

// WithPointSize sets the size of the points/dots at line vertices
func WithPointSize(size float32) drawLineOption {
	return func(config *drawLineConfig) {
		config.pointSize = size
	}
}

// WithLineColors sets the color of the line and points
// If pointColor is nil, uses the line color for points
func WithLineColors(lineColor Color, pointColor *Color) drawLineOption {
	colors := []Color{lineColor, lineColor}
	if pointColor != nil {
		colors[1] = *pointColor
	}

	return WithColors[*drawLineConfig](colors)
}

// NewLine creates a new Line object
func NewLine(positions []r3.Vector, options ...drawLineOption) (*Line, error) {
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

	return &Line{
		Positions:  positions,
		LineWidth:  config.lineWidth,
		PointSize:  config.pointSize,
		LineColor:  config.colors[0],
		PointColor: config.colors[1],
	}, nil
}

// Draw draws a line from a list of points, colors, and optional styling
// If colors is nil or empty, uses DefaultLineColor (blue) for both line and points
// If colors has 1 element, uses that color for both line and points
// If colors has 2 elements, first is for line, second is for points
func (line Line) Draw(
	name string,
	parent string,
	pose spatialmath.Pose,
) *Drawing {
	shape := NewShape(pose, name, WithLine(line))
	drawing := NewDrawing(name, parent, pose, shape, NewMetadata(WithMetadataColors(line.LineColor, line.PointColor)))
	return drawing
}
