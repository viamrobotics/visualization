package api

import (
	"math"
	"testing"

	"github.com/golang/geo/r3"
	"github.com/viam-labs/motion-tools/draw"
	"go.viam.com/rdk/spatialmath"
	"go.viam.com/test"
)

func TestDrawNurbs(t *testing.T) {
	startTestServer(t)

	t.Run("DrawNurbs", func(t *testing.T) {
		// Create deterministic NURBS control points along a helix
		numControlPoints := 20
		degree := 3

		controlPoints := make([]spatialmath.Pose, numControlPoints)
		weights := make([]float64, numControlPoints)
		knots := make([]float64, numControlPoints+degree+1)

		// Initialize knots (first "degree" values as 0)
		for i := 0; i <= degree; i++ {
			knots[i] = 0
		}

		// Generate deterministic control points along a helix
		radius := 500.0
		height := 1000.0
		turns := 2.0

		for i := 0; i < numControlPoints; i++ {
			t := float64(i) / float64(numControlPoints-1)
			angle := 2 * math.Pi * turns * t
			z := height * t

			controlPoints[i] = spatialmath.NewPose(
				r3.Vector{
					X: radius * math.Cos(angle),
					Y: radius * math.Sin(angle),
					Z: z,
				},
				&spatialmath.OrientationVectorDegrees{Theta: 0, OX: 0, OY: 0, OZ: 1},
			)
			weights[i] = 1.0 // Uniform weights

			// Generate remaining knots
			if i < numControlPoints {
				knot := float64(i+1) / float64(numControlPoints-degree)
				if knot > 1.0 {
					knot = 1.0
				}
				if i+degree+1 < len(knots) {
					knots[i+degree+1] = knot
				}
			}
		}

		uuid, err := DrawNurbs(DrawNurbsOptions{
			Name:          "nurbs-1",
			ControlPoints: controlPoints,
			Knots:         knots,
			Degree:        int32(degree),
			Weights:       weights,
			Color:         draw.ColorFromHex("#40E0D0"),
			LineWidth:     20.0, // 20mm for visibility
		})
		test.That(t, err, test.ShouldBeNil)
		test.That(t, uuid, test.ShouldNotBeNil)
	})
}
