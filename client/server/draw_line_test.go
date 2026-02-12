package server

import (
	"math"
	"testing"

	"github.com/golang/geo/r3"
	"github.com/viam-labs/motion-tools/draw"
	"go.viam.com/test"
)

func TestDrawLine(t *testing.T) {
	startTestServer(t)

	t.Run("DrawLine", func(t *testing.T) {
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
			z := height*float64(i)/float64(nPath) + offset.Z // Linear vertical rise

			points = append(points, r3.Vector{
				X: x,
				Y: y,
				Z: z,
			})
		}

		lineColor := draw.NewColor(draw.WithRGB(255, 0, 0))
		pointColor := draw.NewColor(draw.WithRGB(0, 255, 0))

		uuid, err := DrawLine(DrawLineOptions{
			Name:       "upwardSpiral",
			Positions:  points,
			LineColor:  lineColor,
			PointColor: &pointColor,
		})
		test.That(t, err, test.ShouldBeNil)
		test.That(t, uuid, test.ShouldNotBeNil)
	})
}
