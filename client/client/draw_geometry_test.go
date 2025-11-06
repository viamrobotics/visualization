package client

import (
	"math"
	"testing"
	"time"

	"github.com/golang/geo/r3"
	"go.viam.com/rdk/spatialmath"
	"go.viam.com/test"
)

var offset = r3.Vector{X: 0, Y: 1000, Z: 0}

func TestDrawGeometry(t *testing.T) {
	t.Run("DrawGeometry box", func(t *testing.T) {
		box, err := spatialmath.NewBox(
			spatialmath.NewPose(
				r3.Vector{X: 1001, Y: 1, Z: 1}.Add(offset),
				&spatialmath.OrientationVectorDegrees{Theta: 45, OX: 0, OY: 0, OZ: 1},
			),
			r3.Vector{X: 101, Y: 100, Z: 200},
			"DrawGeometry box",
		)
		test.That(t, err, test.ShouldBeNil)
		test.That(t, DrawGeometry(box, "purple"), test.ShouldBeNil)
	})

	t.Run("DrawGeometry sphere", func(t *testing.T) {
		box, err := spatialmath.NewSphere(
			spatialmath.NewPose(
				r3.Vector{X: 1, Y: 1000, Z: 0}.Add(offset),
				&spatialmath.OrientationVectorDegrees{Theta: 0, OX: 0, OY: 0, OZ: 1},
			),
			100,
			"DrawGeometry sphere",
		)
		test.That(t, err, test.ShouldBeNil)
		test.That(t, DrawGeometry(box, "red"), test.ShouldBeNil)
	})

	t.Run("DrawGeometry capsule", func(t *testing.T) {
		capsule, err := spatialmath.NewCapsule(
			spatialmath.NewPose(
				r3.Vector{X: -1002, Y: 3, Z: 0}.Add(offset),
				&spatialmath.OrientationVectorDegrees{Theta: 90, OX: 1, OY: 0, OZ: 1},
			),
			102,
			300,
			"DrawGeometry capsule",
		)
		test.That(t, err, test.ShouldBeNil)
		test.That(t, DrawGeometry(capsule, "orange"), test.ShouldBeNil)
	})

	t.Run("DrawGeometry mesh", func(t *testing.T) {
		mesh, err := spatialmath.NewMeshFromPLYFile("../data/lod_500.ply")

		pose := spatialmath.NewPose(
			r3.Vector{X: -343.34, Y: -139.51, Z: 537.44}.Add(offset),
			&spatialmath.OrientationVectorDegrees{Theta: 90, OX: -0.9943171068536344, OY: -0.0046240014351797976, OZ: -0.10635840177882347},
		)
		meshInWorld := mesh.Transform(pose).(*spatialmath.Mesh)
		meshInWorld.SetLabel("DrawGeometry mesh")

		test.That(t, err, test.ShouldBeNil)
		test.That(t, DrawGeometry(meshInWorld, "blue"), test.ShouldBeNil)
	})

	t.Run("DrawGeometry updating", func(t *testing.T) {
		for i := 0; i < 100; i++ {
			box, err := spatialmath.NewBox(
				spatialmath.NewPose(
					r3.Vector{X: math.Sin(float64(i)/16.) * 1000, Y: 1, Z: 1}.Add(offset),
					&spatialmath.OrientationVectorDegrees{Theta: float64(i) / 2, OX: 0, OY: 0, OZ: 0},
				),
				r3.Vector{X: 101, Y: 100, Z: 200},
				"DrawGeometry box updating",
			)

			test.That(t, err, test.ShouldBeNil)
			test.That(t, DrawGeometry(box, "purple"), test.ShouldBeNil)
			time.Sleep(16 * time.Millisecond)
		}
	})
}
