package draw

import (
	"testing"

	"github.com/golang/geo/r3"
	fixtures "github.com/viam-labs/motion-tools/draw/fixtures"
	commonv1 "go.viam.com/api/common/v1"
	"go.viam.com/rdk/referenceframe"
	"go.viam.com/rdk/spatialmath"
	"go.viam.com/test"
)

func TestNewDrawnGeometry(t *testing.T) {
	box, err := spatialmath.NewBox(spatialmath.NewZeroPose(), r3.Vector{X: 100, Y: 100, Z: 100}, "box")
	test.That(t, err, test.ShouldBeNil)

	t.Run("DefaultColor", func(t *testing.T) {
		drawn, err := NewDrawnGeometry(box)
		test.That(t, err, test.ShouldBeNil)
		test.That(t, drawn, test.ShouldNotBeNil)
		test.That(t, drawn.Colors, test.ShouldHaveLength, 1)
		test.That(t, drawn.Colors[0], test.ShouldResemble, ColorFromName("red"))
	})

	t.Run("WithGeometryColor", func(t *testing.T) {
		green := NewColor(WithRGB(0, 255, 0))
		drawn, err := NewDrawnGeometry(box, WithGeometryColor(green))
		test.That(t, err, test.ShouldBeNil)
		test.That(t, drawn.Colors, test.ShouldHaveLength, 1)
		test.That(t, drawn.Colors[0], test.ShouldResemble, green)
	})

	t.Run("WithGeometryColors", func(t *testing.T) {
		red := ColorFromName("red")
		green := NewColor(WithRGB(0, 255, 0))
		blue := ColorFromName("blue")
		drawn, err := NewDrawnGeometry(box, WithGeometryColors(red, green, blue))
		test.That(t, err, test.ShouldBeNil)
		test.That(t, drawn.Colors, test.ShouldHaveLength, 3)
		test.That(t, drawn.Colors[0], test.ShouldResemble, red)
		test.That(t, drawn.Colors[1], test.ShouldResemble, green)
		test.That(t, drawn.Colors[2], test.ShouldResemble, blue)
	})
}

func TestDrawnGeometry_Draw(t *testing.T) {
	box, err := spatialmath.NewBox(spatialmath.NewZeroPose(), r3.Vector{X: 100, Y: 100, Z: 100}, "box")
	test.That(t, err, test.ShouldBeNil)

	t.Run("ProducesTransformWithCorrectStructure", func(t *testing.T) {
		blue := ColorFromName("blue")
		drawn, err := NewDrawnGeometry(box, WithGeometryColor(blue))
		test.That(t, err, test.ShouldBeNil)

		transform, err := drawn.Draw("box")
		test.That(t, err, test.ShouldBeNil)
		test.That(t, transform.ReferenceFrame, test.ShouldEqual, "box")
		test.That(t, transform.PoseInObserverFrame.ReferenceFrame, test.ShouldEqual, referenceframe.World)
		test.That(t, transform.PhysicalObject.Label, test.ShouldEqual, "box")
		test.That(t, transform.PhysicalObject.GetBox(), test.ShouldResemble, &commonv1.RectangularPrism{
			DimsMm: &commonv1.Vector3{X: 100, Y: 100, Z: 100},
		})
		// blue = \x00\x00\xff (R=0, G=0, B=255), RGB-only
		test.That(t, fixtures.Byte64EncodedToString(transform.Metadata.Fields["colors"].GetStringValue()), test.ShouldResemble, "\x00\x00\xff")
	})

	t.Run("ProducesTransformWithMultipleColors", func(t *testing.T) {
		red := ColorFromName("red")
		green := NewColor(WithRGB(0, 255, 0))
		drawn, err := NewDrawnGeometry(box, WithGeometryColors(red, green))
		test.That(t, err, test.ShouldBeNil)

		transform, err := drawn.Draw("box")
		test.That(t, err, test.ShouldBeNil)
		// red = \xff\x00\x00, green = \x00\xff\x00, both packed as RGB
		test.That(t, fixtures.Byte64EncodedToString(transform.Metadata.Fields["colors"].GetStringValue()), test.ShouldResemble, "\xff\x00\x00\x00\xff\x00")
	})

	t.Run("DrawWithPose", func(t *testing.T) {
		drawn, err := NewDrawnGeometry(box)
		test.That(t, err, test.ShouldBeNil)

		pose := spatialmath.NewPose(r3.Vector{X: 100, Y: 0, Z: 0}, &spatialmath.OrientationVectorDegrees{OX: 0, OY: 0, OZ: 1, Theta: 45})
		transform, err := drawn.Draw("box", WithPose(pose))
		test.That(t, err, test.ShouldBeNil)
		test.That(t, transform.PoseInObserverFrame.Pose.X, test.ShouldEqual, 100)
		test.That(t, transform.PoseInObserverFrame.ReferenceFrame, test.ShouldEqual, referenceframe.World)
	})

	t.Run("DrawWithParent", func(t *testing.T) {
		drawn, err := NewDrawnGeometry(box)
		test.That(t, err, test.ShouldBeNil)

		transform, err := drawn.Draw("box", WithParent("robot-base"))
		test.That(t, err, test.ShouldBeNil)
		test.That(t, transform.PoseInObserverFrame.ReferenceFrame, test.ShouldEqual, "robot-base")
	})

	t.Run("EmptyNameFallsBackToGeometryLabel", func(t *testing.T) {
		drawn, err := NewDrawnGeometry(box)
		test.That(t, err, test.ShouldBeNil)

		transform, err := drawn.Draw("")
		test.That(t, err, test.ShouldBeNil)
		test.That(t, transform.ReferenceFrame, test.ShouldEqual, "box")
		test.That(t, transform.PhysicalObject.Label, test.ShouldEqual, "box")
	})
}
