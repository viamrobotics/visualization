package draw

import (
	"fmt"

	"github.com/golang/geo/r3"
)

var (
	// DefaultPointSize is the default point size in millimeters.
	DefaultPointSize float32 = 10.0
)

// Points represents a point cloud or set of discrete points in 3D space.
// Useful for visualizing sensor data, waypoints, or sparse 3D data.
type Points struct {
	// Positions defines the location of each point.
	Positions []r3.Vector

	// PointSize specifies the size of each point in millimeters (default: 10mm).
	PointSize float32

	// Colors specifies the color for each point. Can be a single color (applied to all points)
	// or one color per point.
	Colors []Color
}

// drawPointsConfig is a configuration for drawing a set of points
type drawPointsConfig struct {
	pointSize float32
	drawColorsConfig
}

// newDrawPointsConfig creates a new draw points configuration
//
// Returns the draw points configuration
func newDrawPointsConfig() *drawPointsConfig {
	return &drawPointsConfig{
		pointSize:        DefaultPointSize,
		drawColorsConfig: newDrawColorsConfig(DefaultPointColor),
	}
}

// DrawPointsOption is a function that configures a draw points configuration
type DrawPointsOption func(*drawPointsConfig)

// WithPointsSize creates a points option that sets the size of each point in millimeters.
func WithPointsSize(size float32) DrawPointsOption {
	return func(config *drawPointsConfig) {
		config.pointSize = size
	}
}

// WithSinglePointColor creates a points option that sets the color for all points.
func WithSinglePointColor(color Color) DrawPointsOption {
	return withColors[*drawPointsConfig]([]Color{color})
}

// WithPerPointColors creates a points option that sets the colors for each point.
func WithPerPointColors(colors ...Color) DrawPointsOption {
	return withColors[*drawPointsConfig](colors)
}

// WithPointColorPalette creates a points option that sets the colors for each point using a color palette.
func WithPointColorPalette(palette []Color, numPoints int) DrawPointsOption {
	return withColorPalette[*drawPointsConfig](palette, numPoints)
}

// NewPoints creates a new Points object from the given positions and optional configuration.
// Returns an error if positions are empty, if the point size is non-positive, or if the number
// of colors doesn't match requirements (must be 1 or equal to number of positions).
func NewPoints(positions []r3.Vector, options ...DrawPointsOption) (*Points, error) {
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

// Draw creates a Drawing from this Points object.
func (points Points) Draw(name string, options ...DrawableOption) *Drawing {
	config := NewDrawConfig(name, options...)
	shape := NewShape(config.Center, config.Name, WithPoints(points))
	return NewDrawing(config, shape, WithMetadataColors(points.Colors...))
}
