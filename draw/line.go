package draw

import (
	"fmt"

	"github.com/golang/geo/r3"
)

var (
	// DefaultLineWidth is the default line width in millimeters.
	DefaultLineWidth float32 = 5.0
	// DefaultLineDotSize is the default dot size for Line vertices in millimeters.
	DefaultLineDotSize float32 = 10.0
)

// Line represents a polyline (connected line segments) in 3D space, with optional visible
// dots at each vertex. Useful for drawing paths, trajectories, or connected geometric shapes.
type Line struct {
	// Positions defines the vertices of the line in sequence.
	Positions []r3.Vector

	// LineWidth specifies the thickness of the line segments in millimeters (default: 5mm).
	LineWidth float32

	// DotSize specifies the size of dots rendered at each vertex in millimeters (default: 10mm).
	DotSize float32

	// Colors specifies the colors used for rendering the line segments (default: [blue]).
	// Can be a single color (applied to all segments) or one color per vertex.
	Colors []Color

	// DotColors specifies the colors used for rendering the vertex dots (default: [dark blue]).
	// Can be a single color (applied to all dots) or one color per dot.
	DotColors []Color
}

type drawLineConfig struct {
	lineWidth float32
	dotSize   float32
	dotColors []Color
	drawColorsConfig
}

func newDrawLineConfig(lineWidth float32, dotSize float32, lineColor Color, dotColor Color) *drawLineConfig {
	return &drawLineConfig{
		lineWidth:        lineWidth,
		dotSize:          dotSize,
		dotColors:        []Color{dotColor},
		drawColorsConfig: newDrawColorsConfig(lineColor),
	}
}

// DrawLineOption is a functional option for configuring a Line
type DrawLineOption func(*drawLineConfig)

// WithLineWidth creates a line option that sets the line segment width in millimeters.
func WithLineWidth(width float32) DrawLineOption {
	return func(config *drawLineConfig) {
		config.lineWidth = width
	}
}

// WithDotSize creates a line option that sets the size of vertex dots in millimeters.
func WithDotSize(size float32) DrawLineOption {
	return func(config *drawLineConfig) {
		config.dotSize = size
	}
}

// WithSingleLineColor creates a line option that sets a single color for all line segments.
func WithSingleLineColor(color Color) DrawLineOption {
	return withColors[*drawLineConfig]([]Color{color})
}

// WithPerLineColors creates a line option that sets one color per vertex for line segments.
func WithPerLineColors(colors ...Color) DrawLineOption {
	return withColors[*drawLineConfig](colors)
}

// WithLineColorPalette creates a line option that sets colors for line segments by cycling
// through a palette. The palette is repeated to fill numPositions colors.
func WithLineColorPalette(palette []Color, numPositions int) DrawLineOption {
	return withColorPalette[*drawLineConfig](palette, numPositions)
}

// WithSingleDotColor creates a line option that sets a single color for all vertex dots.
func WithSingleDotColor(color Color) DrawLineOption {
	return func(config *drawLineConfig) {
		config.dotColors = []Color{color}
	}
}

// WithPerDotColors creates a line option that sets one color per vertex dot.
func WithPerDotColors(colors ...Color) DrawLineOption {
	return func(config *drawLineConfig) {
		config.dotColors = colors
	}
}

// WithDotColorPalette creates a line option that sets colors for vertex dots by cycling
// through a palette. The palette is repeated to fill numPositions colors.
func WithDotColorPalette(palette []Color, numPositions int) DrawLineOption {
	return func(config *drawLineConfig) {
		colors := make([]Color, numPositions)
		for i := range numPositions {
			colors[i] = palette[i%len(palette)]
		}
		config.dotColors = colors
	}
}

// NewLine creates a new Line from the given vertex positions and optional configuration.
// Returns an error if there are fewer than 2 positions, if the dot size is non-positive,
// if the line width is non-positive, or if color slice lengths are invalid (must be 1 or
// equal to number of positions).
func NewLine(positions []r3.Vector, options ...DrawLineOption) (*Line, error) {
	config := newDrawLineConfig(DefaultLineWidth, DefaultLineDotSize, DefaultLineColor, DefaultLineDotColor)
	for _, option := range options {
		option(config)
	}

	if len(positions) < 2 {
		return nil, fmt.Errorf("line must have at least 2 positions, got %d", len(positions))
	}

	if config.dotSize <= 0 {
		return nil, fmt.Errorf("dot size must be greater than 0, got %f", config.dotSize)
	}

	if config.lineWidth <= 0 {
		return nil, fmt.Errorf("line width must be greater than 0, got %f", config.lineWidth)
	}

	if len(config.colors) != 1 && len(config.colors) != len(positions) {
		return nil, fmt.Errorf("line colors must have length 1 (single color) or %d (per-vertex colors), got %d", len(positions), len(config.colors))
	}

	if len(config.dotColors) != 1 && len(config.dotColors) != len(positions) {
		return nil, fmt.Errorf("dot colors must have length 1 (single color) or %d (per-dot colors), got %d", len(positions), len(config.dotColors))
	}

	return &Line{
		Positions: positions,
		LineWidth: config.lineWidth,
		DotSize:   config.dotSize,
		Colors:    config.colors,
		DotColors: config.dotColors,
	}, nil
}

// Draw creates a Drawing from this Line object.
func (line Line) Draw(name string, options ...DrawableOption) *Drawing {
	config := NewDrawConfig(name, options...)
	shape := NewShape(config.Center, config.Name, WithLine(line))
	return NewDrawing(config.UUID, config.Name, config.Parent, config.Pose, shape, NewMetadata(WithMetadataColors(line.Colors...)))
}
