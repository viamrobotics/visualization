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
	// ChromaticColorChooser is a package-level ColorChooser that cycles through all SVG
	// named colors with a perceptible hue. Like all ColorChoosers, it is not safe for
	// concurrent use; create your own instance with NewColorChooser if you need isolated
	// state or a different palette.
	ChromaticColorChooser ColorChooser

	// AchromaticColorChooser is a package-level ColorChooser that cycles through SVG
	// named colors that are achromatic or near-achromatic (whites, grays, and similar
	// low-chroma hues). Like all ColorChoosers, it is not safe for concurrent use.
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

// ColorChooser cycles through a list of colors, useful for automatically assigning
// distinct colors to multiple objects. Each call to Next advances an internal counter
// and wraps around to the start of the palette once the end is reached.
//
// ColorChooser is not safe for concurrent use; callers that share an instance across
// goroutines must provide their own synchronization.
type ColorChooser struct {
	count  int
	colors []Color
}

// Next returns the next color in the palette and advances the internal counter,
// wrapping back to the first color after the end of the palette.
func (chooser *ColorChooser) Next() Color {
	color := chooser.colors[chooser.count%len(chooser.colors)]
	chooser.count++
	return color
}

// Get returns a slice of the next count colors from the palette, advancing the
// internal counter by count. A subsequent call to Next or Get continues from where
// this call left off rather than restarting at the beginning of the palette.
func (chooser *ColorChooser) Get(count int) []Color {
	finalColors := make([]Color, count)
	for i := range count {
		finalColors[i] = chooser.Next()
	}
	return finalColors
}

// NewColorChooser returns a ColorChooser that cycles through the given palette in
// order. If colors is empty, the chooser falls back to a palette built from all SVG
// named colors.
func NewColorChooser(colors []Color) ColorChooser {
	if len(colors) == 0 {
		colors = make([]Color, 0, len(colornames.Map))
		for _, rgba := range colornames.Map {
			colors = append(colors, NewColor(WithColorRGBA(rgba)))
		}
	}

	return ColorChooser{colors: colors, count: 0}
}
