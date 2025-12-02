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
// Metadata:
// - colors: []float32 of a single color: [r, g, b, a] or a color per point: [r, g, b, a, ...], defaults to [0.2, 0.2, 0.2, 1] (gray)
type Points struct {
	// The Positions to render
	Positions []r3.Vector

	// The size of the points, defaults to 10mm
	PointSize float32

	// Either a single color or a color per point
	Colors []*Color
}

func NewPoints(positions []r3.Vector, pointSize *float32, colors []*Color) (*Points, error) {
	if len(positions) == 0 {
		return nil, fmt.Errorf("positions cannot be empty")
	}

	if pointSize == nil {
		pointSize = &DefaultPointSize
	} else if *pointSize <= 0 {
		return nil, fmt.Errorf("point size must be greater than 0, got %f", *pointSize)
	}

	if len(colors) == 0 {
		colors = []*Color{DefaultPointColor}
	}

	if len(colors) != 1 && len(colors) != len(positions) {
		return nil, fmt.Errorf("colors must have length 1 (single color) or %d (per-point colors), got %d", len(positions), len(colors))
	}

	return &Points{Positions: positions, PointSize: *pointSize, Colors: colors}, nil
}

// Draw draws a set of points from a list of positions and colors
// If colors is nil or empty, uses DefaultPointColor (gray)
func (points *Points) Draw(
	name string,
	parent string,
	pose spatialmath.Pose,
	units Units,
) *Drawing {
	shape := NewShape(pose, name, units).WithPoints(points)
	drawing := NewDrawing(name, parent, pose, shape, NewMetadata(points.Colors))
	return drawing
}
