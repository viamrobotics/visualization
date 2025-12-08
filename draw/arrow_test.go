package draw

import (
	"testing"

	"github.com/golang/geo/r3"
	"go.viam.com/rdk/spatialmath"
	"go.viam.com/test"
)

func TestArrows(t *testing.T) {
	t.Run("One Arrow", func(t *testing.T) {
		arrows, err := NewArrows(
			[]spatialmath.Pose{
				spatialmath.NewPose(r3.Vector{X: 1, Y: 0, Z: 0}, &spatialmath.OrientationVectorDegrees{OX: 0, OY: 0, OZ: 1, Theta: 0}),
			},
			WithArrowColors(NewColor(WithName("red"))),
		)
		test.That(t, err, test.ShouldBeNil)
		test.That(t, arrows, test.ShouldNotBeNil)
		test.That(t, len(arrows.Poses), test.ShouldEqual, 1)
		test.That(t, arrows.Colors[0], test.ShouldResemble, NewColor(WithName("red")))

		drawing := arrows.Draw("test", "world", spatialmath.NewPose(r3.Vector{X: 0, Y: 0, Z: 0}, &spatialmath.OrientationVectorDegrees{OX: 0, OY: 0, OZ: 1, Theta: 0}))
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
			WithArrowColors(NewColor(WithName("red")), NewColor(WithName("green")), NewColor(WithName("blue"))),
		)
		test.That(t, err, test.ShouldBeNil)
		test.That(t, arrows, test.ShouldNotBeNil)
		test.That(t, len(arrows.Poses), test.ShouldEqual, 3)
		test.That(t, arrows.Colors[0], test.ShouldResemble, NewColor(WithName("red")))
		test.That(t, arrows.Colors[1], test.ShouldResemble, NewColor(WithName("green")))
		test.That(t, arrows.Colors[2], test.ShouldResemble, NewColor(WithName("blue")))

		drawing := arrows.Draw("test", "world", spatialmath.NewPose(r3.Vector{X: 0, Y: 0, Z: 0}, &spatialmath.OrientationVectorDegrees{OX: 0, OY: 0, OZ: 1, Theta: 0}))
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
			WithArrowColors(NewColor(WithName("red")), NewColor(WithName("green"))),
		)

		test.That(t, err.Error(), test.ShouldContainSubstring, "colors must have length 1 (single color) or 3 (per-arrow colors), got 2")
		test.That(t, arrows, test.ShouldBeNil)
	})

}
