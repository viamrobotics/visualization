package draw

import (
	"fmt"

	"github.com/golang/geo/r3"
	"go.viam.com/rdk/spatialmath"
)

var (
	// DefaultPointSize is the default size of a point in millimeters
	DefaultPointSize float32 = 10.0
)

// Points represents a set of Points in 3D space
type Points struct {
	// The Positions to render
	Positions []r3.Vector

	// The size of the points, defaults to 10mm
	PointSize float32

	// Either a single color or a color per point
	Colors []Color
}

type drawPointsConfig struct {
	pointSize float32
	DrawColorsConfig
}

func newDrawPointsConfig() *drawPointsConfig {
	return &drawPointsConfig{
		pointSize:        DefaultPointSize,
		DrawColorsConfig: NewDrawColorsConfig(DefaultPointColor),
	}
}

type drawPointsOption func(*drawPointsConfig)

// WithPointsSize sets the size of the points in millimeters
func WithPointsSize(size float32) drawPointsOption {
	return func(config *drawPointsConfig) {
		config.pointSize = size
	}
}

// WithPointsColors sets the colors of the points
// Can be a single color or a color per point
func WithPointsColors(defaultColor Color, perPointColors ...Color) drawPointsOption {
	colors := []Color{defaultColor}
	colors = append(colors, perPointColors...)
	return WithColors[*drawPointsConfig](colors)
}

// NewPoints creates a new Points object with functional options
func NewPoints(positions []r3.Vector, options ...drawPointsOption) (*Points, error) {
	if len(positions) == 0 {
		return nil, fmt.Errorf("positions cannot be empty")
	}

	config := newDrawPointsConfig()
	for _, option := range options {
		option(config)
	}

	if config.pointSize <= 0 {
		return nil, fmt.Errorf("point size must be greater than 0, got %f", config.pointSize)
	}

	if len(config.colors) != 1 && len(config.colors) != len(positions) {
		return nil, fmt.Errorf("colors must have length 1 (single color) or %d (per-point colors), got %d", len(positions), len(config.colors))
	}

	return &Points{
		Positions: positions,
		PointSize: config.pointSize,
		Colors:    config.colors,
	}, nil
}

// Draw draws a set of points from a list of positions and colors
// If colors is nil or empty, uses DefaultPointColor (gray)
func (points Points) Draw(
	name string,
	parent string,
	pose spatialmath.Pose,
) *Drawing {
	shape := NewShape(pose, name, WithPoints(points))
	drawing := NewDrawing(name, parent, pose, shape, NewMetadata(WithMetadataColors(points.Colors...)))
	return drawing
}
