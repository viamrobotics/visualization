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

func makeTestGeometriesInFrame(t *testing.T) *referenceframe.GeometriesInFrame {
	t.Helper()
	box, err := spatialmath.NewBox(spatialmath.NewZeroPose(), r3.Vector{X: 100, Y: 100, Z: 100}, "box")
	test.That(t, err, test.ShouldBeNil)
	sphere, err := spatialmath.NewSphere(spatialmath.NewZeroPose(), 100, "sphere")
	test.That(t, err, test.ShouldBeNil)
	capsule, err := spatialmath.NewCapsule(spatialmath.NewZeroPose(), 100, 300, "capsule")
	test.That(t, err, test.ShouldBeNil)
	return referenceframe.NewGeometriesInFrame("world", []spatialmath.Geometry{box, sphere, capsule})
}

func TestNewDrawnGeometriesInFrame(t *testing.T) {
	geometriesInFrame := makeTestGeometriesInFrame(t)

	t.Run("WithSingleGeometriesColor", func(t *testing.T) {
		green := NewColor(WithRGB(0, 255, 0))
		drawing, err := NewDrawnGeometriesInFrame(geometriesInFrame, WithSingleGeometriesColor(green))
		test.That(t, err, test.ShouldBeNil)
		test.That(t, drawing, test.ShouldNotBeNil)
		test.That(t, len(drawing.DrawnGeometries), test.ShouldEqual, 3)
		for _, dg := range drawing.DrawnGeometries {
			test.That(t, dg.Colors, test.ShouldHaveLength, 1)
			test.That(t, dg.Colors[0], test.ShouldResemble, green)
		}
	})

	t.Run("WithPerGeometriesColors", func(t *testing.T) {
		red := NewColor(WithName("red"))
		green := NewColor(WithRGB(0, 255, 0))
		blue := NewColor(WithName("blue"))
		drawing, err := NewDrawnGeometriesInFrame(geometriesInFrame, WithPerGeometriesColors(red, green, blue))
		test.That(t, err, test.ShouldBeNil)
		test.That(t, len(drawing.DrawnGeometries), test.ShouldEqual, 3)
		test.That(t, drawing.DrawnGeometries[0].Colors[0], test.ShouldResemble, red)
		test.That(t, drawing.DrawnGeometries[1].Colors[0], test.ShouldResemble, green)
		test.That(t, drawing.DrawnGeometries[2].Colors[0], test.ShouldResemble, blue)
	})

	t.Run("WithGeometriesColorPalette", func(t *testing.T) {
		red := ColorFromName("red")
		blue := ColorFromName("blue")
		drawing, err := NewDrawnGeometriesInFrame(geometriesInFrame, WithGeometriesColorPalette([]Color{red, blue}, 3))
		test.That(t, err, test.ShouldBeNil)
		test.That(t, drawing.DrawnGeometries[0].Colors[0], test.ShouldResemble, red)
		test.That(t, drawing.DrawnGeometries[1].Colors[0], test.ShouldResemble, blue)
		test.That(t, drawing.DrawnGeometries[2].Colors[0], test.ShouldResemble, red) // wraps around
	})

	t.Run("MismatchedColorCountReturnsError", func(t *testing.T) {
		// 2 colors for 3 geometries should fail
		_, err := NewDrawnGeometriesInFrame(geometriesInFrame, WithPerGeometriesColors(ColorFromName("red"), ColorFromName("blue")))
		test.That(t, err, test.ShouldNotBeNil)
	})
}

func TestDrawnGeometriesInFrame_Draw(t *testing.T) {
	geometriesInFrame := makeTestGeometriesInFrame(t)

	colors := []Color{NewColor(WithName("red")), NewColor(WithRGB(0, 255, 0)), NewColor(WithName("blue"))}
	drawing, err := NewDrawnGeometriesInFrame(geometriesInFrame, WithPerGeometriesColors(colors...))
	test.That(t, err, test.ShouldBeNil)

	transforms, err := drawing.Draw("")
	test.That(t, err, test.ShouldBeNil)
	test.That(t, len(transforms), test.ShouldEqual, 3)

	t.Run("BoxTransform", func(t *testing.T) {
		test.That(t, transforms[0].PhysicalObject.Label, test.ShouldEqual, "box")
		test.That(t, transforms[0].ReferenceFrame, test.ShouldEqual, "box")
		test.That(t, transforms[0].PoseInObserverFrame.GetPose(), test.ShouldResemble, &commonv1.Pose{
			X: 0, Y: 0, Z: 0, OX: 0, OY: 0, OZ: 1, Theta: 0,
		})
		test.That(t, transforms[0].PhysicalObject.GetBox(), test.ShouldResemble, &commonv1.RectangularPrism{
			DimsMm: &commonv1.Vector3{X: 100, Y: 100, Z: 100},
		})
		// red = \xff\x00\x00\xff
		test.That(t, fixtures.Byte64EncodedToString(transforms[0].Metadata.Fields["colors"].GetStringValue()), test.ShouldResemble, "\xff\x00\x00\xff")
	})

	t.Run("SphereTransform", func(t *testing.T) {
		test.That(t, transforms[1].PhysicalObject.Label, test.ShouldEqual, "sphere")
		test.That(t, transforms[1].ReferenceFrame, test.ShouldEqual, "sphere")
		test.That(t, transforms[1].PhysicalObject.GetSphere(), test.ShouldResemble, &commonv1.Sphere{RadiusMm: 100})
		// green = \x00\xff\x00\xff
		test.That(t, fixtures.Byte64EncodedToString(transforms[1].Metadata.Fields["colors"].GetStringValue()), test.ShouldResemble, "\x00\xff\x00\xff")
	})

	t.Run("CapsuleTransform", func(t *testing.T) {
		test.That(t, transforms[2].PhysicalObject.Label, test.ShouldEqual, "capsule")
		test.That(t, transforms[2].ReferenceFrame, test.ShouldEqual, "capsule")
		test.That(t, transforms[2].PhysicalObject.GetCapsule(), test.ShouldResemble, &commonv1.Capsule{RadiusMm: 100, LengthMm: 300})
		// blue = \x00\x00\xff\xff
		test.That(t, fixtures.Byte64EncodedToString(transforms[2].Metadata.Fields["colors"].GetStringValue()), test.ShouldResemble, "\x00\x00\xff\xff")
	})

	t.Run("WithName_PrefixesReferenceFrame", func(t *testing.T) {
		named, err := drawing.Draw("test")
		test.That(t, err, test.ShouldBeNil)
		test.That(t, len(named), test.ShouldEqual, 3)
		test.That(t, named[0].ReferenceFrame, test.ShouldEqual, "test:box")
		test.That(t, named[1].ReferenceFrame, test.ShouldEqual, "test:sphere")
		test.That(t, named[2].ReferenceFrame, test.ShouldEqual, "test:capsule")
	})

	t.Run("WithName_PhysicalObjectLabelRemainsRawGeometryLabel", func(t *testing.T) {
		named, err := drawing.Draw("test")
		test.That(t, err, test.ShouldBeNil)
		// ReferenceFrame is prefixed, but PhysicalObject.Label stays as the raw geometry label
		test.That(t, named[0].ReferenceFrame, test.ShouldEqual, "test:box")
		test.That(t, named[0].PhysicalObject.Label, test.ShouldEqual, "box")
		test.That(t, named[1].ReferenceFrame, test.ShouldEqual, "test:sphere")
		test.That(t, named[1].PhysicalObject.Label, test.ShouldEqual, "sphere")
	})

	t.Run("WithParent_PropagatesParentToAllTransforms", func(t *testing.T) {
		transforms, err := drawing.Draw("test", WithParent("robot-base"))
		test.That(t, err, test.ShouldBeNil)
		for _, transform := range transforms {
			test.That(t, transform.PoseInObserverFrame.ReferenceFrame, test.ShouldEqual, "robot-base")
		}
	})
}
