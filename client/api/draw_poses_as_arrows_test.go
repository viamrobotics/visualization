package api

import (
	"math"
	"math/rand"
	"testing"

	"github.com/golang/geo/r3"
	"github.com/viam-labs/motion-tools/draw"
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

		x += centerX
		y += centerY
		z += centerZ

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

// runDrawPosesAsArrowsTest generates sphere poses, draws them with the given colors, and draws a reference sphere.
func runDrawPosesAsArrowsTest(t *testing.T, numPoints int, colors *[]draw.Color) {
	t.Helper()

	const radius = 1000.0
	centerX, centerY, centerZ := 1500.0, 1500.0, -300.0

	poses := generateSpherePoses(numPoints, radius, centerX, centerY, centerZ)

	options := DrawPosesAsArrowsOptions{Name: "mySpherePoses", Poses: poses}
	if colors != nil {
		options.Colors = *colors
	}
	uuid, err := DrawPosesAsArrows(options)
	test.That(t, err, test.ShouldBeNil)
	test.That(t, uuid, test.ShouldNotBeNil)

	sphere, err := spatialmath.NewSphere(
		spatialmath.NewPose(
			r3.Vector{X: centerX, Y: centerY, Z: centerZ},
			&spatialmath.OrientationVectorDegrees{Theta: 0, OX: 0, OY: 0, OZ: 1},
		),
		radius,
		"mySphere",
	)
	test.That(t, err, test.ShouldBeNil)

	uuid, err = DrawGeometry(DrawGeometryOptions{Geometry: sphere, Color: draw.ColorFromName("aqua")})
	test.That(t, err, test.ShouldBeNil)
	test.That(t, uuid, test.ShouldNotBeNil)
}

func TestDrawPosesAsArrows(t *testing.T) {
	startTestServer(t)

	t.Run("DrawPosesAsArrows", func(t *testing.T) {
		runDrawPosesAsArrowsTest(t, 100_000, nil)
	})

	t.Run("DrawPosesAsArrowsWithSingleColor", func(t *testing.T) {
		runDrawPosesAsArrowsTest(t, 10_000, &[]draw.Color{draw.ColorFromName("yellow")})
	})

	t.Run("DrawPosesAsArrowsWithColorPalette", func(t *testing.T) {
		runDrawPosesAsArrowsTest(t, 10_000, &[]draw.Color{draw.ColorFromName("yellow"), draw.ColorFromName("red")})
	})

	t.Run("DrawPosesAsArrowsWithPerPointColors", func(t *testing.T) {
		cc := NewColorfulColorChooser()
		colors := make([]draw.Color, 10_000)
		for i := range 10_000 {
			colors[i] = cc.Next()
		}

		runDrawPosesAsArrowsTest(t, 10_000, &colors)
	})
}

func TestPosesAsArrowStress(t *testing.T) {
	t.Skip("Run only if you want to punish your computer.")

	startTestServer(t)

	t.Run("TestArrowStress", func(t *testing.T) {
		const (
			numPoints = 4_000_000
			width     = 50_000
		)

		var poses []spatialmath.Pose
		var colors []draw.Color
		pallet := []draw.Color{
			draw.ColorFromHex("#6200EA"),
			draw.ColorFromHex("#EF5350"),
			draw.ColorFromHex("#0091EA"),
			draw.ColorFromHex("#E53935"),
			draw.ColorFromHex("#D32F2F"),
			draw.ColorFromName("blue"),
		}

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

		uuid, err := DrawPosesAsArrows(DrawPosesAsArrowsOptions{Poses: poses, Colors: colors})
		test.That(t, err, test.ShouldBeNil)
		test.That(t, uuid, test.ShouldNotBeNil)
	})
}
