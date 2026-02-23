package api

import (
	"testing"

	"github.com/golang/geo/r3"
	"github.com/viam-labs/motion-tools/draw"
	"go.viam.com/rdk/spatialmath"
	"go.viam.com/test"
)

func TestRemoveDrawings(t *testing.T) {
	t.Run("RemoveDrawings", func(t *testing.T) {
		startTestServer(t)

		box, err := spatialmath.NewBox(
			spatialmath.NewPose(
				r3.Vector{X: 2000, Y: 2000, Z: 100},
				&spatialmath.OrientationVectorDegrees{Theta: 45, OX: 0, OY: 0, OZ: 1},
			),
			r3.Vector{X: 101, Y: 100, Z: 200},
			"box2delete",
		)
		test.That(t, err, test.ShouldBeNil)

		boxUUID, err := DrawGeometry(DrawGeometryOptions{Geometry: box, Color: draw.ColorFromName("black")})
		test.That(t, err, test.ShouldBeNil)
		test.That(t, boxUUID, test.ShouldNotBeNil)

		pointsUUID, err := DrawPoints(DrawPointsOptions{
			Positions: []r3.Vector{
				{X: 2000, Y: 2000, Z: 100},
				{X: 101, Y: 100, Z: 200},
			},
			PointSize: 10,
			Colors:    []draw.Color{draw.ColorFromName("black")},
		})
		test.That(t, err, test.ShouldBeNil)
		test.That(t, pointsUUID, test.ShouldNotBeNil)

		count, err := RemoveDrawings()
		test.That(t, err, test.ShouldBeNil)
		test.That(t, count, test.ShouldEqual, 1)
	})
}
