package client

import (
	"math"
	"testing"
	"time"

	"github.com/golang/geo/r3"
	"go.viam.com/rdk/referenceframe"
	"go.viam.com/rdk/spatialmath"
	"go.viam.com/test"
)

func TestDrawGeometries(t *testing.T) {
	t.Run("DrawGeometries", func(t *testing.T) {
		box, err := spatialmath.NewBox(
			spatialmath.NewPose(
				r3.Vector{X: 1001, Y: 1, Z: 1},
				&spatialmath.OrientationVectorDegrees{Theta: 45, OX: 0, OY: 0, OZ: 1},
			),
			r3.Vector{X: 101, Y: 100, Z: 200},
			"DrawGeometries Box",
		)
		test.That(t, err, test.ShouldBeNil)

		sphere, err := spatialmath.NewSphere(
			spatialmath.NewPose(
				r3.Vector{X: 1501, Y: 0, Z: 0},
				&spatialmath.OrientationVectorDegrees{Theta: 0, OX: 0, OY: 0, OZ: 1},
			),
			100,
			"DrawGeometries Sphere",
		)
		test.That(t, err, test.ShouldBeNil)

		capsule, err := spatialmath.NewCapsule(
			spatialmath.NewPose(
				r3.Vector{X: 2002, Y: 3, Z: 200},
				&spatialmath.OrientationVectorDegrees{Theta: 90, OX: 1, OY: 0, OZ: 1},
			),
			102,
			300,
			"DrawGeometries Capsule",
		)
		test.That(t, err, test.ShouldBeNil)

		mesh, err := spatialmath.NewMeshFromPLYFile("../data/lod_500.ply")

		meshInWorld := mesh.Transform(spatialmath.NewPose(
			r3.Vector{X: 2800, Y: 10, Z: -200},
			&spatialmath.OrientationVectorDegrees{Theta: 180, OX: 0, OY: 0, OZ: 1},
		)).(*spatialmath.Mesh)
		meshInWorld.SetLabel("DrawGeometries Mesh")

		test.That(t, err, test.ShouldBeNil)

		geometries := []spatialmath.Geometry{box, sphere, capsule, meshInWorld}
		geometriesInFrame := referenceframe.NewGeometriesInFrame("world", geometries)

		colors := []string{"#EF9A9A", "#EF5350", "#F44336", "fern"}

		test.That(t, DrawGeometries(geometriesInFrame, colors), test.ShouldBeNil)
	})
}

func TestDrawGeometriesUpdating(t *testing.T) {
	t.Run("DrawGeometriesUpdating", func(t *testing.T) {

		for i := 0; i < 100; i++ {
			box1, err1 := spatialmath.NewBox(
				spatialmath.NewPose(
					r3.Vector{X: math.Sin(float64(i)/16.) * 500, Y: math.Cos(float64(i)/16.) * 500, Z: 1},
					&spatialmath.OrientationVectorDegrees{Theta: float64(i) / 2, OX: 0, OY: 0, OZ: 0},
				),
				r3.Vector{X: 101, Y: 100, Z: 200},
				"DrawGeometries box1 updating",
			)

			box2, err2 := spatialmath.NewBox(
				spatialmath.NewPose(
					r3.Vector{X: math.Sin(float64(i+120)/16.) * 500, Y: math.Cos(float64(i+120)/16.) * 500, Z: 1},
					&spatialmath.OrientationVectorDegrees{Theta: float64(i) / 2, OX: 0, OY: 0, OZ: 0},
				),
				r3.Vector{X: 101, Y: 100, Z: 200},
				"DrawGeometries box2 updating",
			)

			box3, err3 := spatialmath.NewBox(
				spatialmath.NewPose(
					r3.Vector{X: math.Sin(float64(i+240)/16.) * 500, Y: math.Cos(float64(i+240)/16.) * 500, Z: 1},
					&spatialmath.OrientationVectorDegrees{Theta: float64(i) / 2, OX: 0, OY: 0, OZ: 0},
				),
				r3.Vector{X: 101, Y: 100, Z: 200},
				"DrawGeometries box3 updating",
			)

			test.That(t, err1, test.ShouldBeNil)
			test.That(t, err2, test.ShouldBeNil)
			test.That(t, err3, test.ShouldBeNil)

			geometries := []spatialmath.Geometry{box1, box2, box3}
			geometriesInFrame := referenceframe.NewGeometriesInFrame("world", geometries)
			colors := []string{"#EF9A9A", "#EF5350", "#F44336"}

			test.That(t, DrawGeometries(geometriesInFrame, colors), test.ShouldBeNil)
			time.Sleep(16 * time.Millisecond)
		}
	})
}
