package draw

import (
	"golang.org/x/image/colornames"
)

// achromaticNames is the curated set of SVG color names that are achromatic or near-achromatic
var achromaticNames = map[string]bool{
	// Pure achromatic: R == G == B
	"black":      true,
	"dimgray":    true,
	"dimgrey":    true,
	"gray":       true,
	"grey":       true,
	"darkgray":   true,
	"darkgrey":   true,
	"lightgray":  true,
	"lightgrey":  true,
	"silver":     true,
	"gainsboro":  true,
	"whitesmoke": true,
	"white":      true,

	// Near-achromatic: very low chroma, visually near-white or near-gray
	"snow":                 true,
	"ghostwhite":           true,
	"mintcream":            true,
	"ivory":                true,
	"azure":                true,
	"aliceblue":            true,
	"floralwhite":          true,
	"honeydew":             true,
	"lavenderblush":        true,
	"seashell":             true,
	"linen":                true,
	"oldlace":              true,
	"beige":                true,
	"antiquewhite":         true,
	"cornsilk":             true,
	"mistyrose":            true,
	"lavender":             true,
	"lightyellow":          true,
	"lightcyan":            true,
	"lightgoldenrodyellow": true,
}

var (
	// ChromaticColorChooser cycles through all SVG named colors that have perceptible hue
	ChromaticColorChooser ColorChooser

	// AchromaticColorChooser cycles through all SVG named colors that are achromatic or near-achromatic
	AchromaticColorChooser ColorChooser
)

func init() {
	var chromatic, achromatic []Color
	for _, name := range colornames.Names {
		c := ColorFromName(name)
		if achromaticNames[name] {
			achromatic = append(achromatic, c)
		} else {
			chromatic = append(chromatic, c)
		}
	}

	ChromaticColorChooser = NewColorChooser(chromatic)
	AchromaticColorChooser = NewColorChooser(achromatic)
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

// NewColorChooser creates a ColorChooser populated with all standard web color names.
func NewColorChooser(colors []Color) ColorChooser {
	if len(colors) == 0 {
		colors = make([]Color, len(colornames.Map))
		for _, rgba := range colornames.Map {
			colors = append(colors, NewColor(WithColorRGBA(rgba)))
		}
	}

	return ColorChooser{colors: colors, count: 0}
}
