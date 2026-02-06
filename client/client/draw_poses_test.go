package client

import (
	"testing"

	"math"
	"math/rand"

	"github.com/golang/geo/r3"
	"go.viam.com/rdk/spatialmath"
	"go.viam.com/test"
)

// generateSpherePoses generates poses distributed on a sphere surface, with orientations pointing toward the center.
func generateSpherePoses(numPoints int, radius, centerX, centerY, centerZ float64) []spatialmath.Pose {
	var poses []spatialmath.Pose

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
	}

	return poses
}

// runDrawPosesTest is a helper that generates sphere poses, draws them with the given colors, and draws a reference sphere.
func runDrawPosesTest(t *testing.T, numPoints int, colors []string) {
	t.Helper()

	const radius = 1000.0
	centerX, centerY, centerZ := 1500.0, 1500.0, -300.0

	poses := generateSpherePoses(numPoints, radius, centerX, centerY, centerZ)

	test.That(t, DrawPoses(poses, colors, true), test.ShouldBeNil)

	sphere, err := spatialmath.NewSphere(
		spatialmath.NewPose(
			r3.Vector{X: centerX, Y: centerY, Z: centerZ},
			&spatialmath.OrientationVectorDegrees{Theta: 0, OX: 0, OY: 0, OZ: 1},
		),
		radius,
		"mySpherePose",
	)
	test.That(t, err, test.ShouldBeNil)
	test.That(t, DrawGeometry(sphere, "aqua"), test.ShouldBeNil)
}

func TestDrawPoses(t *testing.T) {

	t.Run("DrawAlternatingColorsPoses", func(t *testing.T) {
		runDrawPosesTest(t, 10_000, []string{"yellow", "red"})
	})

	t.Run("DrawSingleColorPoses", func(t *testing.T) {
		runDrawPosesTest(t, 10_000, []string{"yellow"})
	})

	t.Run("DrawPoses", func(t *testing.T) {
		numPoints := 100_000
		palette := []string{"#6200EA", "#EF5350", "#0091EA", "#E53935", "#D32F2F", "blue"}

		colors := make([]string, numPoints)
		for i := range numPoints {
			colors[i] = palette[i%len(palette)]
		}

		runDrawPosesTest(t, numPoints, colors)
	})
}
func TestArrowStress(t *testing.T) {
	t.Skip("Run only if you want to punish your computer.")

	t.Run("TestArrowStress", func(t *testing.T) {
		const (
			numPoints = 4_000_000
			width     = 50_000
		)

		var poses []spatialmath.Pose
		var colors []string
		pallet := []string{"#6200EA", "#EF5350", "#0091EA", "#E53935", "#D32F2F", "blue"}

		for i := range numPoints {
			pose := spatialmath.NewPose(
				r3.Vector{
					X: rand.Float64()*width - width/2,
					Y: rand.Float64()*width - width/2,
					Z: rand.Float64()*width - width/2,
				},
				&spatialmath.OrientationVectorDegrees{
					OX:    rand.Float64()*2 - 1,
					OY:    rand.Float64()*2 - 1,
					OZ:    rand.Float64()*2 - 1,
					Theta: 0,
				},
			)

			poses = append(poses, pose)
			colors = append(colors, pallet[i%len(pallet)])
		}

		test.That(t, DrawPoses(poses, colors, true), test.ShouldBeNil)
	})
}
