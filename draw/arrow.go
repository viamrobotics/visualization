package draw

import (
	"fmt"

	"go.viam.com/rdk/spatialmath"
)

// Arrows represents a set of poses in 3D space
type Arrows struct {
	// The Poses to render
	Poses []spatialmath.Pose

	// Either a single color or a color per pose
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

// WithArrowsColors sets the colors for the arrows
//   - defaultColor is the default color for all arrows, or the first color if perPoseColors is provided
//   - perPoseColors are the colors for each pose
func WithArrowsColors(defaultColor Color, perPoseColors ...Color) drawArrowsOption {
	colors := []Color{defaultColor}
	colors = append(colors, perPoseColors...)
	return WithColors[*drawArrowsConfig](colors)
}

// NewArrows creates a new Arrows object
//   - Returns an error if the colors are not valid
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

// Draw draws an arrow from a list of poses and colors
// - Defaults to green arrows if no colors are provided
func (arrows Arrows) Draw(name string, parent string, pose spatialmath.Pose) *Drawing {
	shape := NewShape(pose, name, WithArrows(arrows))
	drawing := NewDrawing(name, parent, pose, shape, NewMetadata(WithMetadataColors(arrows.Colors...)))
	return drawing
}
