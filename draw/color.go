package draw

import (
	"image/color"

	"golang.org/x/image/colornames"
)

// DefaultAlpha is the default alpha value, defaults to 1.0
var DefaultAlpha = float32(1.0)

type Color struct {
	// 0-1, defaults to 0.0
	R float32 `json:"r"`
	// 0-1, defaults to 0.0
	G float32 `json:"g"`
	// 0-1, defaults to 0.0
	B float32 `json:"b"`
	// 0-1, defaults to 1.0
	A float32 `json:"a"`
}

// Default colors as specified in drawing.proto
var (
	// DefaultArrowColor is the default color of an arrow, defaults to green
	DefaultArrowColor = NewColor(WithName("green"))

	// DefaultLineColor is the default color of a line, defaults to blue
	DefaultLineColor = NewColor(WithName("blue"))

	// DefaultLinePointColor is the default color of a line point, defaults to darker blue
	DefaultLinePointColor = NewColor(WithName("darkblue"))

	// DefaultPointColor is the default color of a point, defaults to gray
	DefaultPointColor = NewColor(WithName("gray"))
)

type colorConfig struct {
	r float32
	g float32
	b float32
	a float32
}

func newColorConfig() *colorConfig {
	return &colorConfig{
		r: 0.0,
		g: 0.0,
		b: 0.0,
		a: DefaultAlpha,
	}
}

type colorOption func(*colorConfig)

// WithRGB sets the color from RGB values (with an alpha of 1.0)
func WithRGB(r, g, b float32) colorOption {
	return func(config *colorConfig) {
		config.r = r
		config.g = g
		config.b = b
	}
}

// WithRGBA sets the color from RGBA values
func WithRGBA(rgba color.RGBA) colorOption {
	return func(config *colorConfig) {
		config.r = float32(rgba.R) / 255
		config.g = float32(rgba.G) / 255
		config.b = float32(rgba.B) / 255
		config.a = float32(rgba.A) / 255
	}
}

// WithName sets the color from a named color
//
// See: https://www.w3.org/TR/SVG11/types.html#ColorKeywords
func WithName(name string) colorOption {
	return func(config *colorConfig) {
		color := colornames.Map[name]
		WithRGBA(color)(config)
	}
}

// WithHSV sets the color from HSV values (with an alpha of 1.0)
func WithHSV(h, s, v float32) colorOption {
	return func(config *colorConfig) {
		i := int(h * 6)
		f := h*6 - float32(i)
		p := v * (1 - s)
		q := v * (1 - f*s)
		t := v * (1 - (1-f)*s)

		switch i % 6 {
		case 0:
			config.r, config.g, config.b = v, t, p
		case 1:
			config.r, config.g, config.b = q, v, p
		case 2:
			config.r, config.g, config.b = p, v, t
		case 3:
			config.r, config.g, config.b = p, q, v
		case 4:
			config.r, config.g, config.b = t, p, v
		case 5:
			config.r, config.g, config.b = v, p, q
		}

		config.a = 1.0
	}
}

// NewColor creates a new color, defaults to black with an alpha of 1.0
func NewColor(options ...colorOption) Color {
	config := newColorConfig()
	for _, option := range options {
		option(config)
	}

	return Color{
		R: config.r,
		G: config.g,
		B: config.b,
		A: config.a,
	}
}

// SetRGB sets the color RGB values
func (color Color) SetRGB(r, g, b float32) Color {
	color.R = r
	color.G = g
	color.B = b
	return color
}

// SetRGBA sets the color from RGBA values
func (color Color) SetRGBA(r, g, b, a float32) Color {
	color.SetRGB(r, g, b)
	color.A = a
	return color
}

// SetAlpha sets the alpha value of the color
func (color Color) SetAlpha(alpha float32) Color {
	color.A = alpha
	return color
}

func (from Color) ToNRGBA() color.NRGBA {
	return color.NRGBA{
		R: uint8(from.R * 255),
		G: uint8(from.G * 255),
		B: uint8(from.B * 255),
		A: uint8(from.A * 255),
	}
}

type ColorChooser struct {
	count  int
	colors []Color
}

func (chooser ColorChooser) Next() Color {
	color := chooser.colors[chooser.count%len(chooser.colors)]
	chooser.count++
	return color
}

func NewDefaultColorChooser() ColorChooser {
	colors := make([]Color, len(colornames.Map))
	for _, rgba := range colornames.Map {
		colors = append(colors, NewColor(WithRGBA(rgba)).SetAlpha(0.7))
	}

	return ColorChooser{colors: colors}
}

type ConfigurableColors interface {
	SetColors([]Color)
}

type DrawColorsConfig struct {
	colors []Color
}

func NewDrawColorsConfig(colors ...Color) DrawColorsConfig {
	return DrawColorsConfig{
		colors: colors,
	}
}

func (config *DrawColorsConfig) SetColors(colors []Color) {
	config.colors = colors
}

func WithColors[T ConfigurableColors](colors []Color) func(T) {
	return func(config T) {
		config.SetColors(colors)
	}
}
