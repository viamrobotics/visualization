package draw

import (
	"testing"

	"github.com/golang/geo/r3"
	"go.viam.com/rdk/referenceframe"
	"go.viam.com/rdk/spatialmath"
	"go.viam.com/test"
)

func TestNewArrows(t *testing.T) {
	poses := []spatialmath.Pose{
		spatialmath.NewPose(r3.Vector{X: 1, Y: 0, Z: 0}, &spatialmath.OrientationVectorDegrees{OX: 0, OY: 0, OZ: 1, Theta: 0}),
		spatialmath.NewPose(r3.Vector{X: 0, Y: 1, Z: 0}, &spatialmath.OrientationVectorDegrees{OX: 0, OY: 0, OZ: 1, Theta: 0}),
		spatialmath.NewPose(r3.Vector{X: 0, Y: 0, Z: 1}, &spatialmath.OrientationVectorDegrees{OX: 0, OY: 0, OZ: 1, Theta: 0}),
	}

	t.Run("DefaultColor", func(t *testing.T) {
		arrows, err := NewArrows(poses)
		test.That(t, err, test.ShouldBeNil)
		test.That(t, arrows.Colors, test.ShouldHaveLength, 1)
		test.That(t, arrows.Colors[0], test.ShouldResemble, DefaultArrowColor)
	})

	t.Run("WithSingleArrowColor", func(t *testing.T) {
		red := NewColor(WithName("red"))
		arrows, err := NewArrows(poses, WithSingleArrowColor(red))
		test.That(t, err, test.ShouldBeNil)
		test.That(t, arrows.Colors, test.ShouldHaveLength, 1)
		test.That(t, arrows.Colors[0], test.ShouldResemble, red)
	})

	t.Run("WithPerArrowColors", func(t *testing.T) {
		red := NewColor(WithName("red"))
		green := NewColor(WithName("green"))
		blue := NewColor(WithName("blue"))
		arrows, err := NewArrows(poses, WithPerArrowColors(red, green, blue))
		test.That(t, err, test.ShouldBeNil)
		test.That(t, arrows.Colors[0], test.ShouldResemble, red)
		test.That(t, arrows.Colors[1], test.ShouldResemble, green)
		test.That(t, arrows.Colors[2], test.ShouldResemble, blue)
	})

	t.Run("WithArrowColorPalette", func(t *testing.T) {
		red := NewColor(WithName("red"))
		blue := NewColor(WithName("blue"))
		// 3 poses, palette of 2 colors: red, blue, red (wraps around)
		arrows, err := NewArrows(poses, WithArrowColorPalette([]Color{red, blue}, 3))
		test.That(t, err, test.ShouldBeNil)
		test.That(t, arrows.Colors[0], test.ShouldResemble, red)
		test.That(t, arrows.Colors[1], test.ShouldResemble, blue)
		test.That(t, arrows.Colors[2], test.ShouldResemble, red)
	})

	t.Run("MismatchedColorCountReturnsError", func(t *testing.T) {
		_, err := NewArrows(poses, WithPerArrowColors(NewColor(WithName("red")), NewColor(WithName("green"))))
		test.That(t, err, test.ShouldNotBeNil)
		test.That(t, err.Error(), test.ShouldContainSubstring, "colors must have length 1 (single color) or 3 (per-arrow colors), got 2")
	})
}

func TestArrows_Draw(t *testing.T) {
	pose := spatialmath.NewPose(r3.Vector{X: 1, Y: 0, Z: 0}, &spatialmath.OrientationVectorDegrees{OX: 0, OY: 0, OZ: 1, Theta: 0})
	red := NewColor(WithName("red"))
	arrows, err := NewArrows([]spatialmath.Pose{pose}, WithSingleArrowColor(red))
	test.That(t, err, test.ShouldBeNil)

	t.Run("DrawingDefaults", func(t *testing.T) {
		drawing := arrows.Draw("test-arrows")
		test.That(t, drawing.Name, test.ShouldEqual, "test-arrows")
		test.That(t, drawing.Parent, test.ShouldEqual, referenceframe.World)
		test.That(t, drawing.Pose, test.ShouldResemble, spatialmath.NewZeroPose())
		test.That(t, drawing.Shape.Center, test.ShouldResemble, spatialmath.NewZeroPose())
		test.That(t, drawing.Shape.Label, test.ShouldEqual, "test-arrows")
		test.That(t, drawing.Shape.Arrows, test.ShouldNotBeNil)
	})

	t.Run("DrawWithPose", func(t *testing.T) {
		drawPose := spatialmath.NewPose(r3.Vector{X: 10, Y: 0, Z: 0}, &spatialmath.OrientationVectorDegrees{OX: 0, OY: 0, OZ: 1, Theta: 0})
		drawing := arrows.Draw("test-arrows", WithPose(drawPose))
		test.That(t, drawing.Pose, test.ShouldResemble, drawPose)
		test.That(t, drawing.Shape.Center, test.ShouldResemble, spatialmath.NewZeroPose())
	})

	t.Run("DrawWithParent", func(t *testing.T) {
		drawing := arrows.Draw("test-arrows", WithParent("robot-base"))
		test.That(t, drawing.Parent, test.ShouldEqual, "robot-base")
	})

	t.Run("ProtoOutput", func(t *testing.T) {
		drawing := arrows.Draw("test-arrows")
		proto := drawing.ToProto()
		test.That(t, proto.ReferenceFrame, test.ShouldEqual, "test-arrows")
		test.That(t, proto.PoseInObserverFrame.ReferenceFrame, test.ShouldEqual, referenceframe.World)
		test.That(t, proto.PhysicalObject, test.ShouldNotBeNil)
		test.That(t, proto.PhysicalObject.GetArrows(), test.ShouldNotBeNil)
		test.That(t, proto.PhysicalObject.Label, test.ShouldEqual, "test-arrows")
		// red (255, 0, 0) packed as [r, g, b]
		test.That(t, proto.Metadata.Colors, test.ShouldResemble, []byte{0xff, 0x00, 0x00})
		// default alpha (255) — opacities omitted
		test.That(t, proto.Metadata.Opacities, test.ShouldBeNil)
	})
}

func TestArrows(t *testing.T) {
	t.Run("One Arrow", func(t *testing.T) {
		arrows, err := NewArrows(
			[]spatialmath.Pose{
				spatialmath.NewPose(r3.Vector{X: 1, Y: 0, Z: 0}, &spatialmath.OrientationVectorDegrees{OX: 0, OY: 0, OZ: 1, Theta: 0}),
			},
			WithSingleArrowColor(NewColor(WithName("red"))),
		)
		test.That(t, err, test.ShouldBeNil)
		test.That(t, arrows, test.ShouldNotBeNil)
		test.That(t, len(arrows.Poses), test.ShouldEqual, 1)
		test.That(t, arrows.Colors[0], test.ShouldResemble, NewColor(WithName("red")))

		drawing := arrows.Draw("test")
		test.That(t, drawing, test.ShouldNotBeNil)
		test.That(t, drawing.Shape.Arrows, test.ShouldNotBeNil)
		test.That(t, drawing.Shape.Arrows.Poses[0], test.ShouldResemble, spatialmath.NewPose(r3.Vector{X: 1, Y: 0, Z: 0}, &spatialmath.OrientationVectorDegrees{OX: 0, OY: 0, OZ: 1, Theta: 0}))
		test.That(t, drawing.Shape.Arrows.Colors[0], test.ShouldResemble, NewColor(WithName("red")))
	})

	t.Run("Multiple Arrows", func(t *testing.T) {

		// GOOD
		arrows, err := NewArrows(
			[]spatialmath.Pose{
				spatialmath.NewPose(r3.Vector{X: 1, Y: 0, Z: 0}, &spatialmath.OrientationVectorDegrees{OX: 0, OY: 0, OZ: 1, Theta: 0}),
				spatialmath.NewPose(r3.Vector{X: 0, Y: 1, Z: 0}, &spatialmath.OrientationVectorDegrees{OX: 0, OY: 0, OZ: 1, Theta: 0}),
				spatialmath.NewPose(r3.Vector{X: 0, Y: 0, Z: 1}, &spatialmath.OrientationVectorDegrees{OX: 0, OY: 0, OZ: 1, Theta: 0}),
			},
			WithPerArrowColors(NewColor(WithName("red")), NewColor(WithName("green")), NewColor(WithName("blue"))),
		)
		test.That(t, err, test.ShouldBeNil)
		test.That(t, arrows, test.ShouldNotBeNil)
		test.That(t, len(arrows.Poses), test.ShouldEqual, 3)
		test.That(t, arrows.Colors[0], test.ShouldResemble, NewColor(WithName("red")))
		test.That(t, arrows.Colors[1], test.ShouldResemble, NewColor(WithName("green")))
		test.That(t, arrows.Colors[2], test.ShouldResemble, NewColor(WithName("blue")))

		drawing := arrows.Draw("test")
		test.That(t, drawing, test.ShouldNotBeNil)
		test.That(t, drawing.Shape.Arrows, test.ShouldNotBeNil)
		test.That(t, len(drawing.Shape.Arrows.Poses), test.ShouldEqual, 3)
		test.That(t, drawing.Shape.Arrows.Poses[0], test.ShouldResemble, spatialmath.NewPose(r3.Vector{X: 1, Y: 0, Z: 0}, &spatialmath.OrientationVectorDegrees{OX: 0, OY: 0, OZ: 1, Theta: 0}))
		test.That(t, drawing.Shape.Arrows.Poses[1], test.ShouldResemble, spatialmath.NewPose(r3.Vector{X: 0, Y: 1, Z: 0}, &spatialmath.OrientationVectorDegrees{OX: 0, OY: 0, OZ: 1, Theta: 0}))
		test.That(t, drawing.Shape.Arrows.Poses[2], test.ShouldResemble, spatialmath.NewPose(r3.Vector{X: 0, Y: 0, Z: 1}, &spatialmath.OrientationVectorDegrees{OX: 0, OY: 0, OZ: 1, Theta: 0}))
		test.That(t, drawing.Shape.Arrows.Colors[0], test.ShouldResemble, NewColor(WithName("red")))
		test.That(t, drawing.Shape.Arrows.Colors[1], test.ShouldResemble, NewColor(WithName("green")))
		test.That(t, drawing.Shape.Arrows.Colors[2], test.ShouldResemble, NewColor(WithName("blue")))

		// BAD NUMBER OF COLORS
		arrows, err = NewArrows(
			[]spatialmath.Pose{
				spatialmath.NewPose(r3.Vector{X: 1, Y: 0, Z: 0}, &spatialmath.OrientationVectorDegrees{OX: 0, OY: 0, OZ: 1, Theta: 0}),
				spatialmath.NewPose(r3.Vector{X: 0, Y: 1, Z: 0}, &spatialmath.OrientationVectorDegrees{OX: 0, OY: 0, OZ: 1, Theta: 0}),
				spatialmath.NewPose(r3.Vector{X: 0, Y: 0, Z: 1}, &spatialmath.OrientationVectorDegrees{OX: 0, OY: 0, OZ: 1, Theta: 0}),
			},
			WithPerArrowColors(NewColor(WithName("red")), NewColor(WithName("green"))),
		)

		test.That(t, err.Error(), test.ShouldContainSubstring, "colors must have length 1 (single color) or 3 (per-arrow colors), got 2")
		test.That(t, arrows, test.ShouldBeNil)
	})

}
