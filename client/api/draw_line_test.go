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
			PointSize: 50.0,
		})
		test.That(t, err, test.ShouldBeNil)
		test.That(t, uuid, test.ShouldNotBeNil)
	})

	t.Run("DrawLineWithPointColor", func(t *testing.T) {
		points := generateSpiralPoints()
		lineColor := draw.ColorFromRGB(255, 0, 0)
		pointColor := draw.ColorFromRGB(0, 255, 0)

		uuid, err := DrawLine(DrawLineOptions{
			Name:      "upwardSpiralPointColor",
			Positions: points,
			Colors:    []draw.Color{lineColor, pointColor},
			LineWidth: 50.0,
			PointSize: 50.0,
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

	t.Run("DrawLineWithPointSize", func(t *testing.T) {
		points := generateSpiralPoints()
		lineColor := draw.ColorFromName("purple")

		uuid, err := DrawLine(DrawLineOptions{
			Name:      "upwardSpiralPointSize",
			Positions: points,
			Colors:    []draw.Color{lineColor},
			PointSize: 200.0,
		})
		test.That(t, err, test.ShouldBeNil)
		test.That(t, uuid, test.ShouldNotBeNil)
	})
}
