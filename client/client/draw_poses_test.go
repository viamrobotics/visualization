package client

import (
	"testing"

	"math"

	"github.com/golang/geo/r3"
	"go.viam.com/rdk/spatialmath"
	"go.viam.com/test"
)

func TestDrawPoses(t *testing.T) {
	t.Run("DrawPoses", func(t *testing.T) {
		const (
			numPoints = 5000
			radius    = 1000.0
		)

		// Define the center of the sphere
		centerX := 1500.0
		centerY := 1500.0
		centerZ := -300.0

		var poses []spatialmath.Pose
		var colors []string
		pallet := []string{"#6200EA", "#EF5350", "#0091EA", "#E53935", "#D32F2F", "blue"}

		for i := range numPoints {
			phi := math.Acos(1 - 2*float64(i)/float64(numPoints))
			theta := math.Pi * (1 + math.Sqrt(5)) * float64(i)

			x := radius * math.Sin(phi) * math.Cos(theta)
			y := radius * math.Sin(phi) * math.Sin(theta)
			z := radius * math.Cos(phi)

			// Apply offset to shift the sphere center
			x += centerX
			y += centerY
			z += centerZ

			// Orientation: point back toward the center
			dx := centerX - x
			dy := centerY - y
			dz := centerZ - z

			length := math.Sqrt(dx*dx + dy*dy + dz*dz)

			pose := spatialmath.NewPose(
				r3.Vector{X: x, Y: y, Z: z},
				&spatialmath.OrientationVectorDegrees{
					OX:    dx / length,
					OY:    dy / length,
					OZ:    dz / length,
					Theta: 0,
				},
			)

			poses = append(poses, pose)
			colors = append(colors, pallet[i%len(pallet)])
		}

		test.That(t, DrawPoses(poses, colors, true), test.ShouldBeNil)

		box, err := spatialmath.NewSphere(
			spatialmath.NewPose(
				r3.Vector{X: centerX, Y: centerY, Z: centerZ},
				&spatialmath.OrientationVectorDegrees{Theta: 0, OX: 0, OY: 0, OZ: 1},
			),
			radius,
			"mySpherePose",
		)
		test.That(t, err, test.ShouldBeNil)
		test.That(t, DrawGeometry(box, "turquoise"), test.ShouldBeNil)
	})
}
