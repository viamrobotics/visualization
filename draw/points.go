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

// DrawPointsOption configures sizing and color settings for a Points constructed
// via NewPoints. When multiple options touch the same field, the last option in the
// argument list wins.
type DrawPointsOption func(*drawPointsConfig)

// WithPointsSize sets the rendered diameter of every point in millimeters.
func WithPointsSize(size float32) DrawPointsOption {
	return func(config *drawPointsConfig) {
		config.pointSize = size
	}
}

// WithSinglePointColor uses a single color for every point.
func WithSinglePointColor(color Color) DrawPointsOption {
	return withColors[*drawPointsConfig]([]Color{color})
}

// WithPerPointColors assigns one color per point. The number of colors must equal
// the number of positions passed to NewPoints.
func WithPerPointColors(colors ...Color) DrawPointsOption {
	return withColors[*drawPointsConfig](colors)
}

// WithPointColorPalette generates numPoints per-point colors by cycling through the
// given palette. Pass numPoints equal to the number of positions passed to NewPoints.
func WithPointColorPalette(palette []Color, numPoints int) DrawPointsOption {
	return withColorPalette[*drawPointsConfig](palette, numPoints)
}

// NewPoints returns a Points at the given positions. Without any color option, every
// point is rendered with DefaultPointColor at DefaultPointSize. Returns an error if
// positions is empty, if the configured point size is non-positive, or if the
// configured color count is neither 1 (shared color) nor len(positions) (per-point
// colors).
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

// Draw wraps the Points in a Drawing identified by name. The DrawableOptions
// control placement (parent frame, pose, center), identity (UUID), and visibility —
// see DrawableOption for the full set.
func (points Points) Draw(name string, options ...DrawableOption) *Drawing {
	config := NewDrawConfig(name, options...)
	shape := NewShape(config.Center, config.Name, WithPoints(points))
	return NewDrawing(config, shape, WithMetadataColors(points.Colors...))
}
