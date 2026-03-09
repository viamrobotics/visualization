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

type DrawArrowsOption func(*drawArrowsConfig)

// WithSingleArrowColor sets the color for all arrows.
func WithSingleArrowColor(color Color) DrawArrowsOption {
	return withColors[*drawArrowsConfig]([]Color{color})
}

// WithPerArrowColors sets the color for each arrow.
func WithPerArrowColors(colors ...Color) DrawArrowsOption {
	return withColors[*drawArrowsConfig](colors)
}

// WithArrowColorPalette sets the color for each arrow using a color palette.
func WithArrowColorPalette(palette []Color, numPoses int) DrawArrowsOption {
	return withColorPalette[*drawArrowsConfig](palette, numPoses)
}

// NewArrows creates a new Arrows object from the given poses and optional configuration.
// Returns an error if the number of colors doesn't match the requirements (must be 1 or equal to number of poses).
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

// Draw creates a Drawing from this Arrows object.
func (arrows Arrows) Draw(name string, options ...DrawableOption) *Drawing {
	config := NewDrawConfig(name, options...)
	shape := NewShape(config.Center, config.Name, WithArrows(arrows))
	drawing := NewDrawing(config.UUID, config.Name, config.Parent, config.Pose, shape, NewMetadata(WithMetadataColors(arrows.Colors...)))
	return drawing
}
