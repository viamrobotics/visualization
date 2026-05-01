package draw

import (
	"fmt"

	"go.viam.com/rdk/spatialmath"
)

// Arrows represents a set of directional arrows positioned at specific poses in 3D space.
// Each arrow visualizes orientation and position, useful for showing coordinate frames or directions.
type Arrows struct {
	// Poses defines the position and orientation of each arrow to render.
	Poses []spatialmath.Pose

	// Colors specifies the color for each arrow. Can be a single color (applied to all arrows)
	// or one color per pose.
	Colors []Color
}

type drawArrowsConfig struct {
	drawColorsConfig
}

func newDrawArrowsConfig() *drawArrowsConfig {
	return &drawArrowsConfig{
		drawColorsConfig: newDrawColorsConfig(DefaultArrowColor),
	}
}

// DrawArrowsOption configures color settings for an Arrows constructed via NewArrows.
// When multiple color options are supplied, the last one wins.
type DrawArrowsOption func(*drawArrowsConfig)

// WithSingleArrowColor uses a single color for every arrow.
func WithSingleArrowColor(color Color) DrawArrowsOption {
	return withColors[*drawArrowsConfig]([]Color{color})
}

// WithPerArrowColors assigns one color per arrow. The number of colors must equal
// the number of poses passed to NewArrows.
func WithPerArrowColors(colors ...Color) DrawArrowsOption {
	return withColors[*drawArrowsConfig](colors)
}

// WithArrowColorPalette generates numPoses per-arrow colors by cycling through the
// given palette. Pass numPoses equal to the number of poses passed to NewArrows.
func WithArrowColorPalette(palette []Color, numPoses int) DrawArrowsOption {
	return withColorPalette[*drawArrowsConfig](palette, numPoses)
}

// NewArrows returns an Arrows positioned at the given poses. Without any color
// option, every arrow is rendered with DefaultArrowColor. Returns an error if the
// configured color count is neither 1 (single shared color) nor len(poses) (one
// color per arrow).
func NewArrows(poses []spatialmath.Pose, options ...DrawArrowsOption) (*Arrows, error) {
	config := newDrawArrowsConfig()
	for _, option := range options {
		option(config)
	}

	if len(config.colors) != 1 && len(config.colors) != len(poses) {
		return nil, fmt.Errorf("colors must have length 1 (single color) or %d (per-arrow colors), got %d", len(poses), len(config.colors))
	}

	return &Arrows{Poses: poses, Colors: config.colors}, nil
}

// Draw wraps the Arrows in a Drawing identified by name. The DrawableOptions control
// placement (parent frame, pose, center), identity (UUID), and visibility — see
// DrawableOption for the full set.
func (arrows Arrows) Draw(name string, options ...DrawableOption) *Drawing {
	config := NewDrawConfig(name, options...)
	shape := NewShape(config.Center, config.Name, WithArrows(arrows))
	return NewDrawing(config, shape, WithMetadataColors(arrows.Colors...))
}
