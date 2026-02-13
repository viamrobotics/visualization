package api

import (
	"math"
	"testing"
	"time"

	"github.com/golang/geo/r3"
	"github.com/viam-labs/motion-tools/draw"
	"go.viam.com/rdk/pointcloud"
	"go.viam.com/rdk/referenceframe"
	"go.viam.com/rdk/spatialmath"
	"go.viam.com/test"
)

func TestDrawGeometries(t *testing.T) {
	startTestServer(t)

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

		pc, err := pointcloud.NewFromFile("../data/Zaghetto.pcd", pointcloud.BasicType)
		test.That(t, err, test.ShouldBeNil)
		octree, err := pointcloud.ToBasicOctree(pc, 0)
		test.That(t, err, test.ShouldBeNil)
		octree.SetLabel("DrawGeometries PointCloud")

		geometries := []spatialmath.Geometry{box, sphere, capsule, meshInWorld, octree}
		geometriesInFrame := referenceframe.NewGeometriesInFrame("world", geometries)

		colors := []draw.Color{
			draw.NewColor(draw.WithHex("#EF9A9A")),
			draw.NewColor(draw.WithHex("#EF5350")),
			draw.NewColor(draw.WithHex("#F44336")),
			draw.NewColor(draw.WithName("lime")),
			draw.NewColor(draw.WithName("red")),
		}

		uuids, err := DrawGeometriesInFrame(DrawGeometriesInFrameOptions{Geometries: geometriesInFrame, Colors: colors, DownscalingThreshold: 25})
		test.That(t, err, test.ShouldBeNil)
		test.That(t, len(uuids), test.ShouldEqual, 5)
	})
}

func TestDrawGeometriesUpdating(t *testing.T) {
	startTestServer(t)

	t.Run("DrawGeometriesUpdating", func(t *testing.T) {
		for i := 0; i < 100; i++ {
			box1, err := spatialmath.NewBox(
				spatialmath.NewPose(
					r3.Vector{X: math.Sin(float64(i)/16.) * 500, Y: math.Cos(float64(i)/16.) * 500, Z: 1},
					&spatialmath.OrientationVectorDegrees{Theta: float64(i) / 2, OX: 0, OY: 0, OZ: 0},
				),
				r3.Vector{X: 101, Y: 100, Z: 200},
				"DrawGeometries box1 updating",
			)
			test.That(t, err, test.ShouldBeNil)

			box2, err := spatialmath.NewBox(
				spatialmath.NewPose(
					r3.Vector{X: math.Sin(float64(i+120)/16.) * 500, Y: math.Cos(float64(i+120)/16.) * 500, Z: 1},
					&spatialmath.OrientationVectorDegrees{Theta: float64(i) / 2, OX: 0, OY: 0, OZ: 0},
				),
				r3.Vector{X: 101, Y: 100, Z: 200},
				"DrawGeometries box2 updating",
			)
			test.That(t, err, test.ShouldBeNil)

			box3, err := spatialmath.NewBox(
				spatialmath.NewPose(
					r3.Vector{X: math.Sin(float64(i+240)/16.) * 500, Y: math.Cos(float64(i+240)/16.) * 500, Z: 1},
					&spatialmath.OrientationVectorDegrees{Theta: float64(i) / 2, OX: 0, OY: 0, OZ: 0},
				),
				r3.Vector{X: 101, Y: 100, Z: 200},
				"DrawGeometries box3 updating",
			)
			test.That(t, err, test.ShouldBeNil)

			geometries := []spatialmath.Geometry{box1, box2, box3}
			geometriesInFrame := referenceframe.NewGeometriesInFrame("world", geometries)
			colors := []draw.Color{
				draw.NewColor(draw.WithHex("#EF9A9A")),
				draw.NewColor(draw.WithHex("#EF5350")),
				draw.NewColor(draw.WithHex("#F44336")),
			}

			uuids, err := DrawGeometriesInFrame(DrawGeometriesInFrameOptions{ID: "test", Geometries: geometriesInFrame, Colors: colors})
			test.That(t, err, test.ShouldBeNil)
			test.That(t, len(uuids), test.ShouldEqual, 3)
			time.Sleep(16 * time.Millisecond)
		}
	})
}
