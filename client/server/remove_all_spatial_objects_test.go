package server

import (
	"testing"

	"github.com/golang/geo/r3"
	"github.com/viam-labs/motion-tools/draw"
	"go.viam.com/rdk/spatialmath"
	"go.viam.com/test"
)

func TestRemoveAllSpatialObjects(t *testing.T) {
	t.Run("RemoveAllSpatialObjects", func(t *testing.T) {
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

		uuid, err := DrawGeometry(DrawGeometryOptions{Geometry: box, Color: draw.NewColor(draw.WithName("black"))})
		test.That(t, err, test.ShouldBeNil)
		test.That(t, uuid, test.ShouldNotBeNil)

		count, err := RemoveAllSpatialObjects()
		test.That(t, err, test.ShouldBeNil)
		test.That(t, count, test.ShouldBeGreaterThanOrEqualTo, 1)
	})

	t.Run("RemoveAllSpatialObjectsHelper", func(t *testing.T) {
		t.Helper()
		startTestServer(t)

		_, err := RemoveAllSpatialObjects()
		test.That(t, err, test.ShouldBeNil)
	})
}
