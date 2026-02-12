package draw

import (
	"testing"

	"github.com/golang/geo/r3"
	"go.viam.com/rdk/spatialmath"
	"go.viam.com/test"
)

func TestLine(t *testing.T) {
	t.Run("DrawLine", func(t *testing.T) {
		positions := []r3.Vector{
			{X: 0, Y: 0, Z: 0},
			{X: 1, Y: 0, Z: 0},
			{X: 0, Y: 1, Z: 0},
		}
		line, err := NewLine(positions, WithLineColors(NewColor(WithName("red")), nil), WithLineWidth(10), WithPointSize(10))
		test.That(t, err, test.ShouldBeNil)
		test.That(t, line, test.ShouldNotBeNil)

		test.That(t, line.LineColor, test.ShouldResemble, NewColor(WithName("red")))
		test.That(t, line.PointColor, test.ShouldResemble, NewColor(WithName("red")))
		test.That(t, line.LineWidth, test.ShouldEqual, 10)
		test.That(t, line.PointSize, test.ShouldEqual, 10)

		drawing := line.Draw("", "test", "world", spatialmath.NewPose(r3.Vector{X: 0, Y: 0, Z: 0}, &spatialmath.OrientationVectorDegrees{OX: 0, OY: 0, OZ: 1, Theta: 0}))
		test.That(t, drawing, test.ShouldNotBeNil)

		proto := drawing.ToProto()
		test.That(t, proto, test.ShouldNotBeNil)
		test.That(t, proto.PhysicalObject, test.ShouldNotBeNil)
		test.That(t, proto.PhysicalObject.GeometryType, test.ShouldNotBeNil)
		test.That(t, proto.PhysicalObject.GetLine(), test.ShouldNotBeNil)
	})

	t.Run("DrawLineWithPointColor", func(t *testing.T) {
		positions := []r3.Vector{
			{X: 0, Y: 0, Z: 0},
			{X: 1, Y: 0, Z: 0},
			{X: 0, Y: 1, Z: 0},
		}
		pointColor := NewColor(WithName("blue"))
		line, err := NewLine(positions, WithLineColors(NewColor(WithName("red")), &pointColor))
		test.That(t, err, test.ShouldBeNil)
		test.That(t, line, test.ShouldNotBeNil)

		test.That(t, line.LineColor, test.ShouldResemble, NewColor(WithName("red")))
		test.That(t, line.PointColor, test.ShouldResemble, pointColor)
	})
}
