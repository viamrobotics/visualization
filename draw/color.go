package draw

import (
	"image/color"

	"golang.org/x/image/colornames"
)

// DefaultAlpha is the default alpha value (fully opaque).
var DefaultAlpha = uint8(255)

// Color represents an RGBA color with 8-bit channels (0-255 range).
type Color struct {
	// R is the red channel value (0-255).
	R uint8 `json:"r"`
	// G is the green channel value (0-255).
	G uint8 `json:"g"`
	// B is the blue channel value (0-255).
	B uint8 `json:"b"`
	// A is the alpha (transparency) channel value (0-255, where 0 is fully transparent and 255 is fully opaque).
	A uint8 `json:"a"`
}

// Default colors for various drawing primitives, as specified in drawing.proto.
var (
	// DefaultArrowColor is the default color for arrows (green).
	DefaultArrowColor = NewColor(WithName("green"))

	// DefaultLineColor is the default color for lines (blue).
	DefaultLineColor = NewColor(WithName("blue"))

	// DefaultLinePointColor is the default color for points at line vertices (dark blue).
	DefaultLinePointColor = NewColor(WithName("darkblue"))

	// DefaultPointColor is the default color for point clouds (gray).
	DefaultPointColor = NewColor(WithName("gray"))
)

// colorConfig is a configuration for a color
type colorConfig struct {
	r uint8
	g uint8
	b uint8
	a uint8
}

// newColorConfig creates a new color configuration
//
// Returns the color configuration
func newColorConfig() *colorConfig {
	return &colorConfig{
		r: 0,
		g: 0,
		b: 0,
		a: DefaultAlpha,
	}
}

// colorOption is a function that configures a color configuration
type colorOption func(*colorConfig)

// WithRGB creates a color option that sets RGB values with full opacity (alpha=255).
func WithRGB(r, g, b uint8) colorOption {
	return func(config *colorConfig) {
		config.r = r
		config.g = g
		config.b = b
	}
}

// WithRGBA creates a color option that sets RGBA values from a standard library color.RGBA struct.
func WithRGBA(rgba color.RGBA) colorOption {
	return func(config *colorConfig) {
		config.r = rgba.R
		config.g = rgba.G
		config.b = rgba.B
		config.a = rgba.A
	}
}

// WithName creates a color option that sets the color using a standard web color name
// (e.g., "red", "blue", "magenta"). See https://www.w3.org/TR/SVG11/types.html#ColorKeywords
// for the complete list of supported color names.
func WithName(name string) colorOption {
	return func(config *colorConfig) {
		color := colornames.Map[name]
		WithRGBA(color)(config)
	}
}

// WithHSV creates a color option that sets the color from HSV values with full opacity (alpha=255).
// All parameters (h, s, v) should be in the range 0.0-1.0, where h is hue, s is saturation, and v is value/brightness.
func WithHSV(h, s, v float32) colorOption {
	return func(config *colorConfig) {
		i := int(h * 6)
		f := h*6 - float32(i)
		p := v * (1 - s)
		q := v * (1 - f*s)
		t := v * (1 - (1-f)*s)

		var r, g, b float32
		switch i % 6 {
		case 0:
			r, g, b = v, t, p
		case 1:
			r, g, b = q, v, p
		case 2:
			r, g, b = p, v, t
		case 3:
			r, g, b = p, q, v
		case 4:
			r, g, b = t, p, v
		case 5:
			r, g, b = v, p, q
		}

		config.r = uint8(r * 255)
		config.g = uint8(g * 255)
		config.b = uint8(b * 255)
		config.a = 255
	}
}

// NewColor creates a new Color with the given options. If no options are provided,
// returns black with full opacity (0, 0, 0, 255).
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

// SetRGB returns a new Color with the specified RGB values, preserving the original alpha value.
func (color Color) SetRGB(r, g, b uint8) Color {
	color.R = r
	color.G = g
	color.B = b
	return color
}

// SetRGBA returns a new Color with all RGBA values set.
func (color Color) SetRGBA(r, g, b, a uint8) Color {
	color.SetRGB(r, g, b)
	color.A = a
	return color
}

// SetAlpha returns a new Color with the specified alpha value, preserving the RGB values.
func (color Color) SetAlpha(alpha uint8) Color {
	color.A = alpha
	return color
}

// ColorChooser cycles through a list of colors, useful for automatically assigning different colors
// to multiple objects. Each call to Next() returns the next color in sequence, wrapping around to the start.
type ColorChooser struct {
	count  int
	colors []Color
}

// Next returns the next color in the sequence, cycling back to the first color after reaching the end.
func (chooser ColorChooser) Next() Color {
	color := chooser.colors[chooser.count%len(chooser.colors)]
	chooser.count++
	return color
}

// NewDefaultColorChooser creates a ColorChooser populated with all standard web color names.
func NewDefaultColorChooser() ColorChooser {
	colors := make([]Color, len(colornames.Map))
	for _, rgba := range colornames.Map {
		colors = append(colors, NewColor(WithRGBA(rgba)))
	}

	return ColorChooser{colors: colors}
}

// ConfigurableColors is an interface for types that can have their colors configured.
type ConfigurableColors interface {
	// SetColors replaces the current colors with the provided list.
	SetColors([]Color)
}

// DrawColorsConfig stores color configuration for drawable objects.
type DrawColorsConfig struct {
	colors []Color
}

// NewDrawColorsConfig creates a new color configuration with the given colors.
func NewDrawColorsConfig(colors ...Color) DrawColorsConfig {
	return DrawColorsConfig{
		colors: colors,
	}
}

// SetColors replaces the current colors with the provided list.
func (config *DrawColorsConfig) SetColors(colors []Color) {
	config.colors = colors
}

// WithColors creates a configuration option that sets colors for any type implementing ConfigurableColors.
func WithColors[T ConfigurableColors](colors []Color) func(T) {
	return func(config T) {
		config.SetColors(colors)
	}
}
