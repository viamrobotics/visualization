package api

import (
	"math"
	"testing"

	"github.com/golang/geo/r3"
	"github.com/viam-labs/motion-tools/draw"
	"go.viam.com/test"
)

// generateSpiralPoints generates points along an upward spiral for testing.
func generateSpiralPoints() []r3.Vector {
	offset := r3.Vector{X: 0, Y: 0, Z: 0}

	nTurns := 5.0    // Number of spiral turns
	radius := 1000.0 // Radius of spiral
	height := 4000.0 // Total height of spiral
	nPath := 50      // Number of points along spiral

	points := make([]r3.Vector, 0, nPath)

	maxT := 2 * math.Pi * nTurns

	for i := 0; i < nPath; i++ {
		t := maxT * float64(i) / float64(nPath)

		x := radius*math.Cos(t) + offset.X
		y := radius*math.Sin(t) + offset.Y
		z := height*float64(i)/float64(nPath) + offset.Z

		points = append(points, r3.Vector{X: x, Y: y, Z: z})
	}

	return points
}

func TestDrawLine(t *testing.T) {
	startTestServer(t)

	t.Run("DrawLine", func(t *testing.T) {
		points := generateSpiralPoints()

		uuid, err := DrawLine(DrawLineOptions{
			Name:      "upwardSpiral",
			Positions: points,
		})
		test.That(t, err, test.ShouldBeNil)
		test.That(t, uuid, test.ShouldNotBeNil)
	})

	t.Run("DrawLineWithLineColor", func(t *testing.T) {
		points := generateSpiralPoints()
		lineColor := draw.ColorFromName("yellow")

		uuid, err := DrawLine(DrawLineOptions{
			Name:      "upwardSpiralLineColor",
			Positions: points,
			Colors:    []draw.Color{lineColor},
			LineWidth: 50.0,
			DotSize:   50.0,
		})
		test.That(t, err, test.ShouldBeNil)
		test.That(t, uuid, test.ShouldNotBeNil)
	})

	t.Run("DrawLineWithDotColor", func(t *testing.T) {
		points := generateSpiralPoints()
		lineColor := draw.ColorFromRGB(255, 0, 0)
		dotColor := draw.ColorFromRGB(0, 255, 0)

		uuid, err := DrawLine(DrawLineOptions{
			Name:      "upwardSpiralDotColor",
			Positions: points,
			LineWidth: 50.0,
			DotSize:   50.0,
			Colors:    []draw.Color{lineColor},
			DotColors: []draw.Color{dotColor},
		})
		test.That(t, err, test.ShouldBeNil)
		test.That(t, uuid, test.ShouldNotBeNil)
	})

	t.Run("DrawLineWithLineColorPalette", func(t *testing.T) {
		points := generateSpiralPoints()

		uuid, err := DrawLine(DrawLineOptions{
			Name:      "upwardSpiralLineColorPalette",
			Positions: points,
			Colors: []draw.Color{
				draw.ColorFromName("red"),
				draw.ColorFromName("green"),
				draw.ColorFromName("blue"),
			},
		})
		test.That(t, err, test.ShouldBeNil)
		test.That(t, uuid, test.ShouldNotBeNil)
	})

	t.Run("DrawLineWithPerLineColors", func(t *testing.T) {
		points := generateSpiralPoints()
		colors := draw.ChromaticColorChooser.Get(len(points))

		uuid, err := DrawLine(DrawLineOptions{
			Name:      "upwardSpiralPerLineColors",
			Positions: points,
			Colors:    colors,
		})
		test.That(t, err, test.ShouldBeNil)
		test.That(t, uuid, test.ShouldNotBeNil)
	})

	t.Run("DrawLineWithDotColorPalette", func(t *testing.T) {
		points := generateSpiralPoints()

		uuid, err := DrawLine(DrawLineOptions{
			Name:      "upwardSpiralDotColorPalette",
			Positions: points,
			DotColors: []draw.Color{
				draw.ColorFromName("cyan"),
				draw.ColorFromName("magenta"),
				draw.ColorFromName("yellow"),
			},
		})
		test.That(t, err, test.ShouldBeNil)
		test.That(t, uuid, test.ShouldNotBeNil)
	})

	t.Run("DrawLineWithPerDotColors", func(t *testing.T) {
		points := generateSpiralPoints()
		colors := draw.ChromaticColorChooser.Get(len(points))

		uuid, err := DrawLine(DrawLineOptions{
			Name:      "upwardSpiralPerDotColors",
			Positions: points,
			DotColors: colors,
		})
		test.That(t, err, test.ShouldBeNil)
		test.That(t, uuid, test.ShouldNotBeNil)
	})

	t.Run("DrawLineWithLineWidth", func(t *testing.T) {
		points := generateSpiralPoints()
		lineColor := draw.ColorFromName("blue")

		uuid, err := DrawLine(DrawLineOptions{
			Name:      "upwardSpiralLineWidth",
			Positions: points,
			Colors:    []draw.Color{lineColor},
			LineWidth: 500.0,
		})
		test.That(t, err, test.ShouldBeNil)
		test.That(t, uuid, test.ShouldNotBeNil)
	})

	t.Run("DrawLineWithDotSize", func(t *testing.T) {
		points := generateSpiralPoints()
		lineColor := draw.ColorFromName("purple")

		uuid, err := DrawLine(DrawLineOptions{
			Name:      "upwardSpiralDotSize",
			Positions: points,
			Colors:    []draw.Color{lineColor},
			DotSize:   200.0,
		})
		test.That(t, err, test.ShouldBeNil)
		test.That(t, uuid, test.ShouldNotBeNil)
	})
}
