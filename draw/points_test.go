package draw

import (
	"testing"

	"github.com/golang/geo/r3"
	"go.viam.com/rdk/spatialmath"
	"go.viam.com/test"
)

func TestPoints(t *testing.T) {
	t.Run("DrawPoints", func(t *testing.T) {
		positions := []r3.Vector{
			{X: 0, Y: 0, Z: 0},
			{X: 1, Y: 0, Z: 0},
			{X: 0, Y: 1, Z: 0},
		}
		points, err := NewPoints(positions, WithPointsSize(10), WithPointsColors(NewColor(WithName("red"))))
		test.That(t, err, test.ShouldBeNil)
		test.That(t, points, test.ShouldNotBeNil)

		test.That(t, points.PointSize, test.ShouldEqual, 10)
		test.That(t, points.Colors, test.ShouldResemble, []Color{NewColor(WithName("red"))})

		drawing := points.Draw("test", "world", spatialmath.NewPose(r3.Vector{X: 0, Y: 0, Z: 0}, &spatialmath.OrientationVectorDegrees{OX: 0, OY: 0, OZ: 1, Theta: 0}))
		test.That(t, drawing, test.ShouldNotBeNil)

		proto := drawing.ToProto()
		test.That(t, proto, test.ShouldNotBeNil)
		test.That(t, proto.PhysicalObject, test.ShouldNotBeNil)
		test.That(t, proto.PhysicalObject.GeometryType, test.ShouldNotBeNil)
		test.That(t, proto.PhysicalObject.GetPoints(), test.ShouldNotBeNil)
	})

	t.Run("DrawPointsWithPerPointColors", func(t *testing.T) {
		positions := []r3.Vector{
			{X: 0, Y: 0, Z: 0},
			{X: 1, Y: 0, Z: 0},
			{X: 0, Y: 1, Z: 0},
		}
		points, err := NewPoints(positions, WithPointsSize(10), WithPointsColors(NewColor(WithName("red")), NewColor(WithName("blue")), NewColor(WithName("green"))))
		test.That(t, err, test.ShouldBeNil)
		test.That(t, points, test.ShouldNotBeNil)

		test.That(t, points.PointSize, test.ShouldEqual, 10)
		test.That(t, points.Colors, test.ShouldResemble, []Color{NewColor(WithName("red")), NewColor(WithName("blue")), NewColor(WithName("green"))})

		drawing := points.Draw("test", "world", spatialmath.NewPose(r3.Vector{X: 0, Y: 0, Z: 0}, &spatialmath.OrientationVectorDegrees{OX: 0, OY: 0, OZ: 1, Theta: 0}))
		test.That(t, drawing, test.ShouldNotBeNil)
	})

	t.Run("DrawPointsWithInvalidColors", func(t *testing.T) {
		positions := []r3.Vector{
			{X: 0, Y: 0, Z: 0},
			{X: 1, Y: 0, Z: 0},
			{X: 0, Y: 1, Z: 0},
		}
		points, err := NewPoints(positions, WithPointsSize(10), WithPointsColors(NewColor(WithName("red")), NewColor(WithName("blue")), NewColor(WithName("green")), NewColor(WithName("yellow"))))
		test.That(t, err, test.ShouldBeError, "colors must have length 1 (single color) or 3 (per-point colors), got 4")
		test.That(t, points, test.ShouldBeNil)
	})
}
