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
