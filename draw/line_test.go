package draw

import (
	"testing"

	"github.com/golang/geo/r3"
	"go.viam.com/rdk/referenceframe"
	"go.viam.com/rdk/spatialmath"
	"go.viam.com/test"
)

var twoPositions = []r3.Vector{{X: 0, Y: 0, Z: 0}, {X: 1, Y: 0, Z: 0}}
var threePositions = []r3.Vector{{X: 0, Y: 0, Z: 0}, {X: 1, Y: 0, Z: 0}, {X: 0, Y: 1, Z: 0}}

func TestNewLine(t *testing.T) {
	t.Run("Defaults", func(t *testing.T) {
		line, err := NewLine(twoPositions)
		test.That(t, err, test.ShouldBeNil)
		test.That(t, line.LineWidth, test.ShouldEqual, DefaultLineWidth)
		test.That(t, line.PointSize, test.ShouldEqual, DefaultPointSize)
		test.That(t, line.LineColor, test.ShouldResemble, DefaultLineColor)
		test.That(t, line.PointColor, test.ShouldResemble, DefaultLinePointColor)
	})

	t.Run("WithLineWidth", func(t *testing.T) {
		line, err := NewLine(twoPositions, WithLineWidth(20))
		test.That(t, err, test.ShouldBeNil)
		test.That(t, line.LineWidth, test.ShouldEqual, float32(20))
	})

	t.Run("WithPointSize", func(t *testing.T) {
		line, err := NewLine(twoPositions, WithPointSize(15))
		test.That(t, err, test.ShouldBeNil)
		test.That(t, line.PointSize, test.ShouldEqual, float32(15))
	})

	t.Run("WithLineColors_NilPointColor", func(t *testing.T) {
		red := NewColor(WithName("red"))
		line, err := NewLine(twoPositions, WithLineColors(red, nil))
		test.That(t, err, test.ShouldBeNil)
		test.That(t, line.LineColor, test.ShouldResemble, red)
		test.That(t, line.PointColor, test.ShouldResemble, red)
	})

	t.Run("WithLineColors_ExplicitPointColor", func(t *testing.T) {
		red := NewColor(WithName("red"))
		blue := NewColor(WithName("blue"))
		line, err := NewLine(twoPositions, WithLineColors(red, &blue))
		test.That(t, err, test.ShouldBeNil)
		test.That(t, line.LineColor, test.ShouldResemble, red)
		test.That(t, line.PointColor, test.ShouldResemble, blue)
	})

	t.Run("ErrorFewerThanTwoPositions", func(t *testing.T) {
		_, err := NewLine([]r3.Vector{{X: 0, Y: 0, Z: 0}})
		test.That(t, err, test.ShouldNotBeNil)
		test.That(t, err.Error(), test.ShouldContainSubstring, "line must have at least 2 positions, got 1")
	})

	t.Run("ErrorZeroPositions", func(t *testing.T) {
		_, err := NewLine([]r3.Vector{})
		test.That(t, err, test.ShouldNotBeNil)
		test.That(t, err.Error(), test.ShouldContainSubstring, "line must have at least 2 positions, got 0")
	})

	t.Run("ErrorNonPositivePointSize", func(t *testing.T) {
		_, err := NewLine(twoPositions, WithPointSize(0))
		test.That(t, err, test.ShouldNotBeNil)
		test.That(t, err.Error(), test.ShouldContainSubstring, "point size must be greater than 0")
	})

	t.Run("ErrorNonPositiveLineWidth", func(t *testing.T) {
		_, err := NewLine(twoPositions, WithLineWidth(-1))
		test.That(t, err, test.ShouldNotBeNil)
		test.That(t, err.Error(), test.ShouldContainSubstring, "line width must be greater than 0")
	})
}

func TestLine_Draw(t *testing.T) {
	red := NewColor(WithName("red"))
	blue := NewColor(WithName("blue"))
	line, err := NewLine(threePositions, WithLineColors(red, &blue), WithLineWidth(10), WithPointSize(5))
	test.That(t, err, test.ShouldBeNil)

	t.Run("DrawingDefaults", func(t *testing.T) {
		drawing := line.Draw("test-line")
		test.That(t, drawing.Name, test.ShouldEqual, "test-line")
		test.That(t, drawing.Parent, test.ShouldEqual, referenceframe.World)
		test.That(t, drawing.Pose, test.ShouldResemble, spatialmath.NewZeroPose())
		test.That(t, drawing.Shape.Center, test.ShouldResemble, spatialmath.NewZeroPose())
		test.That(t, drawing.Shape.Label, test.ShouldEqual, "test-line")
		test.That(t, drawing.Shape.Line, test.ShouldNotBeNil)
	})

	t.Run("DrawWithPose", func(t *testing.T) {
		pose := spatialmath.NewPose(r3.Vector{X: 10, Y: 0, Z: 0}, &spatialmath.OrientationVectorDegrees{OX: 0, OY: 0, OZ: 1, Theta: 0})
		drawing := line.Draw("test-line", WithPose(pose))
		test.That(t, drawing.Pose, test.ShouldResemble, pose)
		test.That(t, drawing.Shape.Center, test.ShouldResemble, spatialmath.NewZeroPose())
	})

	t.Run("DrawWithParent", func(t *testing.T) {
		drawing := line.Draw("test-line", WithParent("robot-base"))
		test.That(t, drawing.Parent, test.ShouldEqual, "robot-base")
	})

	t.Run("ProtoOutput", func(t *testing.T) {
		drawing := line.Draw("test-line")
		proto := drawing.ToProto()
		test.That(t, proto.ReferenceFrame, test.ShouldEqual, "test-line")
		test.That(t, proto.PoseInObserverFrame.ReferenceFrame, test.ShouldEqual, referenceframe.World)
		test.That(t, proto.PhysicalObject, test.ShouldNotBeNil)
		test.That(t, proto.PhysicalObject.Label, test.ShouldEqual, "test-line")
		protoLine := proto.PhysicalObject.GetLine()
		test.That(t, protoLine, test.ShouldNotBeNil)
		test.That(t, *protoLine.LineWidth, test.ShouldEqual, float32(10))
		test.That(t, *protoLine.PointSize, test.ShouldEqual, float32(5))
		test.That(t, proto.Metadata.Colors, test.ShouldResemble, []byte{0xff, 0x00, 0x00, 0x00, 0x00, 0xff})
	})
}
