package api

import (
	"testing"

	"github.com/golang/geo/r3"
	"github.com/viam-labs/motion-tools/draw"
	"go.viam.com/rdk/spatialmath"
	"go.viam.com/test"
)

func TestRemoveTransforms(t *testing.T) {
	t.Run("RemoveTransformsSetup", func(t *testing.T) {
		startTestServer(t)

		box, err := spatialmath.NewBox(
			spatialmath.NewPose(
				r3.Vector{X: 0, Y: 0, Z: 100},
				&spatialmath.OrientationVectorDegrees{Theta: 45, OX: 0, OY: 0, OZ: 1},
			),
			r3.Vector{X: 101, Y: 100, Z: 200},
			"box2delete",
		)
		test.That(t, err, test.ShouldBeNil)

		boxUUID, err := DrawGeometry(DrawGeometryOptions{Geometry: box, Color: draw.ColorFromName("green")})
		test.That(t, err, test.ShouldBeNil)
		test.That(t, boxUUID, test.ShouldNotBeNil)

		lineUUID, err := DrawLine(DrawLineOptions{
			Positions: []r3.Vector{
				{X: 2000, Y: 2000, Z: 100},
				{X: 101, Y: 100, Z: 200},
			},
			Name:      "line2delete",
			LineWidth: 50.0,
			PointSize: 50.0,
		})
		test.That(t, err, test.ShouldBeNil)
		test.That(t, lineUUID, test.ShouldNotBeNil)
	})

	t.Run("RemoveTransforms", func(t *testing.T) {
		startTestServer(t)

		count, err := RemoveTransforms()
		test.That(t, err, test.ShouldBeNil)
		test.That(t, count, test.ShouldEqual, 1)
	})
}
