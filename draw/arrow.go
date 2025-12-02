package draw

import (
	"fmt"

	"go.viam.com/rdk/spatialmath"
)

// Arrows represents a set of Arrows in 3D space
// Metadata:
// - colors: []float32 of a single color: [r, g, b, a] or a color per arrow: [r, g, b, a, ...], defaults to [0, 1, 0, 0.7] (green)
type Arrows struct {
	// The Poses to render
	Poses []spatialmath.Pose

	// Either a single color or a color per pose
	Colors []*Color
}

// NewArrows creates a new Arrows object
func NewArrows(poses []spatialmath.Pose, colors []*Color) (*Arrows, error) {
	if len(colors) == 0 {
		colors = []*Color{DefaultArrowColor}
	}

	if len(colors) != 1 && len(colors) != len(poses) {
		return nil, fmt.Errorf("colors must have length 1 (single color) or %d (per-arrow colors), got %d", len(poses), len(colors))
	}

	return &Arrows{Poses: poses, Colors: colors}, nil
}

// Draw draws an arrow from a list of poses and colors
// If colors is nil or empty, uses DefaultArrowColor (green)
func (arrows *Arrows) Draw(name string, parent string, pose spatialmath.Pose, units Units) *Drawing {
	shape := NewShape(pose, name, units).WithArrows(arrows)
	drawing := NewDrawing(name, parent, pose, shape, NewMetadata(arrows.Colors))
	return drawing
}
