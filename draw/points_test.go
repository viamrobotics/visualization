package draw

import (
	"testing"

	"github.com/golang/geo/r3"
	"go.viam.com/rdk/referenceframe"
	"go.viam.com/rdk/spatialmath"
	"go.viam.com/test"
)

var pointPositions = []r3.Vector{{X: 0, Y: 0, Z: 0}, {X: 1, Y: 0, Z: 0}, {X: 0, Y: 1, Z: 0}}

func TestNewPoints(t *testing.T) {
	t.Run("Defaults", func(t *testing.T) {
		points, err := NewPoints(pointPositions)
		test.That(t, err, test.ShouldBeNil)
		test.That(t, points.PointSize, test.ShouldEqual, DefaultPointSize)
		test.That(t, points.Colors, test.ShouldHaveLength, 1)
		test.That(t, points.Colors[0], test.ShouldResemble, DefaultPointColor)
	})

	t.Run("WithPointsSize", func(t *testing.T) {
		points, err := NewPoints(pointPositions, WithPointsSize(20))
		test.That(t, err, test.ShouldBeNil)
		test.That(t, points.PointSize, test.ShouldEqual, float32(20))
	})

	t.Run("WithSinglePointColor", func(t *testing.T) {
		red := NewColor(WithName("red"))
		points, err := NewPoints(pointPositions, WithSinglePointColor(red))
		test.That(t, err, test.ShouldBeNil)
		test.That(t, points.Colors, test.ShouldHaveLength, 1)
		test.That(t, points.Colors[0], test.ShouldResemble, red)
	})

	t.Run("WithPerPointColors", func(t *testing.T) {
		red := NewColor(WithName("red"))
		blue := NewColor(WithName("blue"))
		green := NewColor(WithName("green"))
		points, err := NewPoints(pointPositions, WithPerPointColors(red, blue, green))
		test.That(t, err, test.ShouldBeNil)
		test.That(t, points.Colors, test.ShouldHaveLength, 3)
		test.That(t, points.Colors[0], test.ShouldResemble, red)
		test.That(t, points.Colors[1], test.ShouldResemble, blue)
		test.That(t, points.Colors[2], test.ShouldResemble, green)
	})

	t.Run("WithPointColorPalette", func(t *testing.T) {
		red := NewColor(WithName("red"))
		blue := NewColor(WithName("blue"))
		palette := []Color{red, blue}
		points, err := NewPoints(pointPositions, WithPointColorPalette(palette, 3))
		test.That(t, err, test.ShouldBeNil)
		test.That(t, points.Colors, test.ShouldHaveLength, 3)
		test.That(t, points.Colors[0], test.ShouldResemble, red)
		test.That(t, points.Colors[1], test.ShouldResemble, blue)
		test.That(t, points.Colors[2], test.ShouldResemble, red)
	})

	t.Run("ErrorEmptyPositions", func(t *testing.T) {
		_, err := NewPoints([]r3.Vector{})
		test.That(t, err, test.ShouldNotBeNil)
		test.That(t, err.Error(), test.ShouldContainSubstring, "positions cannot be empty")
	})

	t.Run("ErrorNonPositivePointSize", func(t *testing.T) {
		_, err := NewPoints(pointPositions, WithPointsSize(0))
		test.That(t, err, test.ShouldNotBeNil)
		test.That(t, err.Error(), test.ShouldContainSubstring, "point size must be greater than 0")
	})

	t.Run("ErrorMismatchedColorCount", func(t *testing.T) {
		_, err := NewPoints(pointPositions, WithPerPointColors(NewColor(WithName("red")), NewColor(WithName("blue")), NewColor(WithName("green")), NewColor(WithName("yellow"))))
		test.That(t, err, test.ShouldNotBeNil)
		test.That(t, err.Error(), test.ShouldContainSubstring, "colors must have length 1 (single color) or 3 (per-point colors), got 4")
	})
}

func TestPoints_Draw(t *testing.T) {
	red := NewColor(WithName("red"))
	points, err := NewPoints(pointPositions, WithPointsSize(7), WithSinglePointColor(red))
	test.That(t, err, test.ShouldBeNil)

	t.Run("DrawingDefaults", func(t *testing.T) {
		drawing := points.Draw("test-points")
		test.That(t, drawing.Name, test.ShouldEqual, "test-points")
		test.That(t, drawing.Parent, test.ShouldEqual, referenceframe.World)
		test.That(t, drawing.Pose, test.ShouldResemble, spatialmath.NewZeroPose())
		test.That(t, drawing.Shape.Center, test.ShouldResemble, spatialmath.NewZeroPose())
		test.That(t, drawing.Shape.Label, test.ShouldEqual, "test-points")
		test.That(t, drawing.Shape.Points, test.ShouldNotBeNil)
	})

	t.Run("DrawWithPose", func(t *testing.T) {
		pose := spatialmath.NewPose(r3.Vector{X: 10, Y: 0, Z: 0}, &spatialmath.OrientationVectorDegrees{OX: 0, OY: 0, OZ: 1, Theta: 0})
		drawing := points.Draw("test-points", WithPose(pose))
		test.That(t, drawing.Pose, test.ShouldResemble, pose)
		test.That(t, drawing.Shape.Center, test.ShouldResemble, spatialmath.NewZeroPose())
	})

	t.Run("DrawWithParent", func(t *testing.T) {
		drawing := points.Draw("test-points", WithParent("robot-base"))
		test.That(t, drawing.Parent, test.ShouldEqual, "robot-base")
	})

	t.Run("ProtoOutput", func(t *testing.T) {
		drawing := points.Draw("test-points")
		proto := drawing.ToProto()
		test.That(t, proto.ReferenceFrame, test.ShouldEqual, "test-points")
		test.That(t, proto.PoseInObserverFrame.ReferenceFrame, test.ShouldEqual, referenceframe.World)
		test.That(t, proto.PhysicalObject, test.ShouldNotBeNil)
		test.That(t, proto.PhysicalObject.Label, test.ShouldEqual, "test-points")
		protoPoints := proto.PhysicalObject.GetPoints()
		test.That(t, protoPoints, test.ShouldNotBeNil)
		test.That(t, *protoPoints.PointSize, test.ShouldEqual, float32(7))
		// red (255, 0, 0) packed as [r, g, b]
		test.That(t, proto.Metadata.Colors, test.ShouldResemble, []byte{0xff, 0x00, 0x00})
		// default alpha (255) — opacities omitted
		test.That(t, proto.Metadata.Opacities, test.ShouldBeNil)
	})
}
