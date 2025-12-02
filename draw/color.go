package draw

import (
	"image/color"

	"golang.org/x/image/colornames"
)

type Color struct {
	// 0-1, defaults to 0
	R float32 `json:"r"`
	// 0-1, defaults to 0
	G float32 `json:"g"`
	// 0-1, defaults to 0
	B float32 `json:"b"`
	// 0-1, defaults to 0.7
	A float32 `json:"a"`
}

// Default colors as specified in drawing.proto
var (
	// DefaultArrowColor is the default color of an arrow, defaults to green
	DefaultArrowColor = NewColor().ByName("green")

	// DefaultLineColor is the default color of a line, defaults to blue
	DefaultLineColor = NewColor().ByName("blue")

	// DefaultLinePointColor is the default color of a line point, defaults to darker blue
	DefaultLinePointColor = NewColor().ByName("darkblue")

	// DefaultPointColor is the default color of a point, defaults to gray
	DefaultPointColor = NewColor().ByName("gray").SetAlpha(1)
)

// NewColor creates a new color
func NewColor() *Color {
	return &Color{}
}

// SetRGBA sets the color from RGBA values
func (color *Color) SetRGBA(r, g, b, a float32) *Color {
	color.R = r
	color.G = g
	color.B = b
	color.A = a
	return color
}

// FromRGBA sets the color from a color.RGBA value
func (color *Color) FromRGBA(rgba color.RGBA) *Color {
	color.R = float32(rgba.R) / 255
	color.G = float32(rgba.G) / 255
	color.B = float32(rgba.B) / 255
	color.A = float32(rgba.A) / 255
	return color
}

// ByName sets the color from a named color and sets the alpha to 0.7
//
// See: https://www.w3.org/TR/SVG11/types.html#ColorKeywords
func (color *Color) ByName(name string) *Color {
	return color.FromRGBA(colornames.Map[name]).SetAlpha(0.7)
}

// FromHSV converts HSV to RGB color (H: 0-1, S: 0-1, V: 0-1)
func (color *Color) FromHSV(h, s, v float32) *Color {
	i := int(h * 6)
	f := h*6 - float32(i)
	p := v * (1 - s)
	q := v * (1 - f*s)
	t := v * (1 - (1-f)*s)

	switch i % 6 {
	case 0:
		color.R, color.G, color.B = v, t, p
	case 1:
		color.R, color.G, color.B = q, v, p
	case 2:
		color.R, color.G, color.B = p, v, t
	case 3:
		color.R, color.G, color.B = p, q, v
	case 4:
		color.R, color.G, color.B = t, p, v
	case 5:
		color.R, color.G, color.B = v, p, q
	}
	color.A = 0.7

	return color
}

// SetAlpha sets the alpha value of the color
func (color *Color) SetAlpha(alpha float32) *Color {
	color.A = alpha
	return color
}

type ColorChooser struct {
	count  int
	colors []*Color
}

func (chooser *ColorChooser) Next() *Color {
	color := chooser.colors[chooser.count%len(chooser.colors)]
	chooser.count++
	return color
}

func NewDefaultColorChooser() *ColorChooser {
	colors := make([]*Color, len(colornames.Map))
	for _, rgba := range colornames.Map {
		colors = append(colors, NewColor().FromRGBA(rgba).SetAlpha(0.7))
	}

	return &ColorChooser{colors: colors}
}
