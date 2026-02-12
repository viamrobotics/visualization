package server

import (
	"slices"
	"strings"

	"github.com/viam-labs/motion-tools/draw"
	"golang.org/x/image/colornames"
)

var colorfulNames = slices.DeleteFunc(slices.Clone(colornames.Names), func(name string) bool {
	lower := strings.ToLower(name)
	return strings.Contains(lower, "black") ||
		strings.Contains(lower, "white") ||
		strings.Contains(lower, "grey") ||
		strings.Contains(lower, "gray")
})

type colorChooser struct {
	count int
}

func (cc *colorChooser) next() draw.Color {
	c := colorfulNames[cc.count%len(colorfulNames)]
	cc.count++
	return draw.NewColor(draw.WithName(c))
}
