package api

import (
	"slices"
	"strings"

	"github.com/viam-labs/motion-tools/draw"
	"golang.org/x/image/colornames"
)

// ColorfulNames is a list of color names that are not black, white, or grey/gray.
var ColorfulNames = slices.DeleteFunc(slices.Clone(colornames.Names), func(name string) bool {
	lower := strings.ToLower(name)
	return strings.Contains(lower, "black") ||
		strings.Contains(lower, "white") ||
		strings.Contains(lower, "grey") ||
		strings.Contains(lower, "gray")
})

// NewColorfulColorChooser creates a ColorChooser that cycles through the `ColorfulNames` slice.
func NewColorfulColorChooser() draw.ColorChooser {
	colors := make([]draw.Color, len(ColorfulNames))
	for i, name := range ColorfulNames {
		colors[i] = draw.ColorFromName(name)
	}

	return draw.NewColorChooser(colors)
}
