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
	DrawColorsConfig
}

func newDrawArrowsConfig() *drawArrowsConfig {
	return &drawArrowsConfig{
		DrawColorsConfig: NewDrawColorsConfig(DefaultArrowColor),
	}
}

type drawArrowsOption func(*drawArrowsConfig)

// WithArrowsColors sets the colors for the arrows. If only defaultColor is provided, it applies
// to all arrows. If perPoseColors are provided, each arrow gets its corresponding color.
func WithArrowsColors(defaultColor Color, perPoseColors ...Color) drawArrowsOption {
	colors := []Color{defaultColor}
	colors = append(colors, perPoseColors...)
	return WithColors[*drawArrowsConfig](colors)
}

// NewArrows creates a new Arrows object from the given poses and optional configuration.
// Returns an error if the number of colors doesn't match the requirements (must be 1 or equal to number of poses).
func NewArrows(poses []spatialmath.Pose, options ...drawArrowsOption) (*Arrows, error) {
	config := newDrawArrowsConfig()
	for _, option := range options {
		option(config)
	}

	if len(config.colors) != 1 && len(config.colors) != len(poses) {
		return nil, fmt.Errorf("colors must have length 1 (single color) or %d (per-arrow colors), got %d", len(poses), len(config.colors))
	}

	return &Arrows{Poses: poses, Colors: config.colors}, nil
}

// Draw creates a Drawing from this Arrows object, positioned at the given pose within the specified
// reference frame. The name identifies this drawing and parent specifies the reference frame it's attached to.
func (arrows Arrows) Draw(name string, parent string, pose spatialmath.Pose) *Drawing {
	shape := NewShape(pose, name, WithArrows(arrows))
	drawing := NewDrawing(name, parent, pose, shape, NewMetadata(WithMetadataColors(arrows.Colors...)))
	return drawing
}
