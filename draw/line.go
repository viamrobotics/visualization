package draw

import (
	"fmt"

	"github.com/golang/geo/r3"
	"go.viam.com/rdk/spatialmath"
)

var (
	// DefaultLineWidth is the default width of a line in millimeters
	DefaultLineWidth float32 = 5.0
)

// Line represents a Line in 3D space
// Metadata:
// - colors: []float32 of a single color: [r, g, b, a] or a color per point: [r, g, b, a, ...], defaults to [0, 0.5, 1, 1] (blue) and [0, 0.3, 0.8, 1] (darker blue)
type Line struct {
	// The points to render
	Points []r3.Vector

	// The width of the line, defaults to 5mm
	LineWidth float32

	// The size of the points, defaults to 10mm
	PointSize float32

	// Either a single color or a color per point
	Colors []*Color
}

// NewLine creates a new Line object
func NewLine(points []r3.Vector, lineWidth *float32, pointSize *float32, colors []*Color) (*Line, error) {
	if len(colors) == 0 {
		colors = []*Color{DefaultLineColor, DefaultLinePointColor}
	} else if len(colors) == 1 {
		// If single color provided, use it for both line and points
		colors = []*Color{colors[0], colors[0]}
	} else if len(colors) != 2 {
		return nil, fmt.Errorf("colors must have length 1 (single color) or 2 (line + dot colors), got %d", len(colors))
	}

	if len(points) < 2 {
		return nil, fmt.Errorf("line must have at least 2 points, got %d", len(points))
	}

	if lineWidth == nil {
		lineWidth = &DefaultLineWidth
	} else if *lineWidth <= 0 {
		return nil, fmt.Errorf("line width must be greater than 0, got %f", *lineWidth)
	}

	if pointSize == nil {
		pointSize = &DefaultPointSize
	} else if *pointSize <= 0 {
		return nil, fmt.Errorf("point size must be greater than 0, got %f", *pointSize)
	}

	return &Line{Points: points, LineWidth: *lineWidth, PointSize: *pointSize, Colors: colors}, nil
}

// Draw draws a line from a list of points, colors, and optional styling
// If colors is nil or empty, uses DefaultLineColor (blue) for both line and points
// If colors has 1 element, uses that color for both line and points
// If colors has 2 elements, first is for line, second is for points
func (line *Line) Draw(
	name string,
	parent string,
	pose spatialmath.Pose,
	units Units,
) *Drawing {
	shape := NewShape(pose, name, units).WithLine(line)
	drawing := NewDrawing(name, parent, pose, shape, NewMetadata(line.Colors))
	return drawing
}
