package client

import (
	"testing"

	"time"

	"github.com/golang/geo/r3"
	"go.viam.com/rdk/spatialmath"
	"go.viam.com/test"
)

func TestRemoveSpatialObjects(t *testing.T) {
	t.Run("RemoveSpatialObjects", func(t *testing.T) {
		box, err := spatialmath.NewBox(
			spatialmath.NewPose(
				r3.Vector{X: 2000, Y: 2000, Z: 100},
				&spatialmath.OrientationVectorDegrees{Theta: 45, OX: 0, OY: 0, OZ: 1},
			),
			r3.Vector{X: 101, Y: 100, Z: 200},
			"box2delete",
		)
		test.That(t, err, test.ShouldBeNil)
		test.That(t, DrawGeometry(box, "black"), test.ShouldBeNil)

		time.Sleep(1 * time.Second)

		toDelete := []string{"box2delete"}
		test.That(t, RemoveSpatialObjects(toDelete), test.ShouldBeNil)
	})
}
