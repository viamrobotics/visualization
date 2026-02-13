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

// ColorChooser cycles through a list of colors, useful for automatically assigning different colors
// to multiple objects. Each call to Next() returns the next color in sequence, wrapping around to the start.
type ColorChooser struct {
	count int
}

// Next returns the Next color in the sequence, cycling back to the first color after reaching the end.
func (cc *ColorChooser) Next() draw.Color {
	c := ColorfulNames[cc.count%len(ColorfulNames)]
	cc.count++
	return draw.ColorFromName(c)
}
