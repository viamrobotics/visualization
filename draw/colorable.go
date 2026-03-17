package draw

type colorable interface {
	SetColors([]Color)
}

type drawColorsConfig struct {
	colors []Color
}

func newDrawColorsConfig(colors ...Color) drawColorsConfig {
	return drawColorsConfig{
		colors: colors,
	}
}

func (config *drawColorsConfig) SetColors(colors []Color) {
	config.colors = colors
}

func withColors[T colorable](colors []Color) func(T) {
	return func(config T) {
		config.SetColors(colors)
	}
}

func withColorPalette[T colorable](palette []Color, numColors int) func(T) {
	return func(config T) {
		finalColors := make([]Color, numColors)
		for i := range numColors {
			finalColors[i] = palette[i%len(palette)]
		}
		config.SetColors(finalColors)
	}
}
