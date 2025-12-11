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

func TestGeometry(t *testing.T) {
	t.Run("DrawGeometries", func(t *testing.T) {
		box, err := spatialmath.NewBox(spatialmath.NewZeroPose(), r3.Vector{X: 100, Y: 100, Z: 100}, "box")
		test.That(t, err, test.ShouldBeNil)
		sphere, err := spatialmath.NewSphere(spatialmath.NewZeroPose(), 100, "sphere")
		test.That(t, err, test.ShouldBeNil)
		capsule, err := spatialmath.NewCapsule(spatialmath.NewZeroPose(), 100, 300, "capsule")
		test.That(t, err, test.ShouldBeNil)
		geometries := []spatialmath.Geometry{box, sphere, capsule}
		geometriesInFrame := referenceframe.NewGeometriesInFrame("world", geometries)
		colors := []Color{NewColor(WithName("red")), NewColor(WithRGB(0, 255, 0)), NewColor(WithName("blue"))}
		transforms, err := DrawGeometries(geometriesInFrame, colors)
		test.That(t, err, test.ShouldBeNil)
		test.That(t, transforms, test.ShouldNotBeNil)
		test.That(t, len(transforms.Transforms), test.ShouldEqual, 3)

		test.That(t, transforms.Transforms[0].PhysicalObject.Label, test.ShouldEqual, "box")
		test.That(t, transforms.Transforms[0].ReferenceFrame, test.ShouldEqual, "box")
		test.That(t, transforms.Transforms[0].PoseInObserverFrame.GetPose(), test.ShouldResemble, &commonv1.Pose{
			X:     0,
			Y:     0,
			Z:     0,
			OX:    0,
			OY:    0,
			OZ:    1,
			Theta: 0,
		})
		test.That(t, transforms.Transforms[0].PhysicalObject.GetBox(), test.ShouldResemble, &commonv1.RectangularPrism{
			DimsMm: &commonv1.Vector3{
				X: 100,
				Y: 100,
				Z: 100,
			},
		})
		test.That(t, fixtures.Byte64EncodedToString(transforms.Transforms[0].Metadata.Fields["colors"].GetStringValue()), test.ShouldResemble, "\xff\x00\x00\xff")

		test.That(t, transforms.Transforms[1].PhysicalObject.Label, test.ShouldEqual, "sphere")
		test.That(t, transforms.Transforms[1].ReferenceFrame, test.ShouldEqual, "sphere")
		test.That(t, transforms.Transforms[1].PhysicalObject.GetSphere(), test.ShouldResemble, &commonv1.Sphere{
			RadiusMm: 100,
		})
		test.That(t, fixtures.Byte64EncodedToString(transforms.Transforms[1].Metadata.Fields["colors"].GetStringValue()), test.ShouldResemble, "\x00\xff\x00\xff")

		test.That(t, transforms.Transforms[2].PhysicalObject.Label, test.ShouldEqual, "capsule")
		test.That(t, transforms.Transforms[2].ReferenceFrame, test.ShouldEqual, "capsule")
		test.That(t, transforms.Transforms[2].PhysicalObject.GetCapsule(), test.ShouldResemble, &commonv1.Capsule{
			RadiusMm: 100,
			LengthMm: 300,
		})
		test.That(t, fixtures.Byte64EncodedToString(transforms.Transforms[2].Metadata.Fields["colors"].GetStringValue()), test.ShouldResemble, "\x00\x00\xff\xff")
	})
}
