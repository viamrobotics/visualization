package draw

import "golang.org/x/image/colornames"

// ColorChooser cycles through a list of colors, useful for automatically assigning different colors
// to multiple objects. Each call to Next() returns the next color in sequence, wrapping around to the start.
type ColorChooser struct {
	count  int
	colors []Color
}

// NewColorChooser creates a ColorChooser populated with all standard web color names.
func NewColorChooser(colors []Color) ColorChooser {
	if colors == nil || len(colors) == 0 {
		colors = make([]Color, len(colornames.Map))
		for _, rgba := range colornames.Map {
			colors = append(colors, NewColor(WithColorRGBA(rgba)))
		}
	}

	return ColorChooser{colors: colors, count: 0}
}

// Next returns the next color in the sequence, cycling back to the first color after reaching the end.
func (chooser ColorChooser) Next() Color {
	color := chooser.colors[chooser.count%len(chooser.colors)]
	chooser.count++
	return color
}

// Get returns a slice of colors of the given length, cycling back to the first color after reaching the end.
func (chooser ColorChooser) Get(count int) []Color {
	finalColors := make([]Color, count)
	for i := range count {
		finalColors[i] = chooser.Next()
	}
	return finalColors
}
