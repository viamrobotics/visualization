package client

import (
	"testing"

	"math"

	"github.com/golang/geo/r3"
	"go.viam.com/rdk/spatialmath"
	"go.viam.com/test"
)

func TestDrawLines(t *testing.T) {
	offset := r3.Vector{X: 0, Y: 0, Z: 0}

	t.Run("DrawLine", func(t *testing.T) {
		nTurns := 5.0    // Number of spiral turns
		radius := 1000.0 // Radius of spiral
		height := 4000.0 // Total height of spiral
		nPath := 50      // Number of points along spiral

		points := make([]spatialmath.Pose, 0, nPath)

		maxT := 2 * math.Pi * nTurns

		for i := 0; i < nPath; i++ {
			t := maxT * float64(i) / float64(nPath)

			x := radius*math.Cos(t) + offset.X
			y := radius*math.Sin(t) + offset.Y
			z := height*float64(i)/float64(nPath) + offset.Z // Linear vertical rise

			points = append(points, spatialmath.NewPoseFromPoint(r3.Vector{
				X: x,
				Y: y,
				Z: z,
			}))
		}

		lineColor := [3]uint8{255, 0, 0}
		dotColor := [3]uint8{0, 255, 0}
		test.That(t, DrawLine("upwardSpiral", points, &lineColor, &dotColor), test.ShouldBeNil)
	})
}
