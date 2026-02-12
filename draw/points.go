package draw

import (
	"fmt"

	"github.com/golang/geo/r3"
	"go.viam.com/rdk/spatialmath"
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
	DrawColorsConfig
}

// newDrawPointsConfig creates a new draw points configuration
//
// Returns the draw points configuration
func newDrawPointsConfig() *drawPointsConfig {
	return &drawPointsConfig{
		pointSize:        DefaultPointSize,
		DrawColorsConfig: NewDrawColorsConfig(DefaultPointColor),
	}
}

// drawPointsOption is a function that configures a draw points configuration
type drawPointsOption func(*drawPointsConfig)

// WithPointsSize creates a points option that sets the size of each point in millimeters.
func WithPointsSize(size float32) drawPointsOption {
	return func(config *drawPointsConfig) {
		config.pointSize = size
	}
}

// WithSinglePointColor creates a points option that sets the color for all points.
func WithSinglePointColor(color Color) drawPointsOption {
	return withColors[*drawPointsConfig]([]Color{color})
}

// WithPerPointColors creates a points option that sets the colors for each point.
func WithPerPointColors(colors ...Color) drawPointsOption {
	return withColors[*drawPointsConfig](colors)
}

// WithPointColorPalette creates a points option that sets the colors for a points.
func WithPointColorPalette(palette []Color, numPoints int) drawPointsOption {
	finalColors := make([]Color, numPoints)
	for i := range numPoints {
		finalColors[i] = palette[i%len(palette)]
	}
	return withColors[*drawPointsConfig](finalColors)
}

// NewPoints creates a new Points object from the given positions and optional configuration.
// Returns an error if positions are empty, if the point size is non-positive, or if the number
// of colors doesn't match requirements (must be 1 or equal to number of positions).
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

// Draw creates a Drawing from this Points object, positioned at the given pose within the specified
// reference frame. The name identifies this drawing and parent specifies the reference frame it's attached to.
func (points Points) Draw(
	id string,
	name string,
	parent string,
	pose spatialmath.Pose,
) *Drawing {
	shape := NewShape(pose, name, WithPoints(points))
	drawing := NewDrawing(id, name, parent, pose, shape, NewMetadata(WithMetadataColors(points.Colors...)))
	return drawing
}
