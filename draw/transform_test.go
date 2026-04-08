package draw

import (
	"testing"

	"github.com/golang/geo/r3"
	fixtures "github.com/viam-labs/motion-tools/draw/fixtures"
	commonv1 "go.viam.com/api/common/v1"
	"go.viam.com/rdk/spatialmath"
	"go.viam.com/test"
)

func TestTransform(t *testing.T) {
	t.Run("NewTransform", func(t *testing.T) {
		geometry, err := spatialmath.NewBox(spatialmath.NewZeroPose(), r3.Vector{X: 100, Y: 100, Z: 100}, "box")
		test.That(t, err, test.ShouldBeNil)

		config := NewDrawConfig("test", WithPose(spatialmath.NewPose(r3.Vector{X: 0, Y: 0, Z: 0}, &spatialmath.OrientationVectorDegrees{OX: 0, OY: 0, OZ: 1, Theta: 0})))
		transform := NewTransform(config, geometry, WithMetadataColors(NewColor(WithName("red"))))
		test.That(t, transform, test.ShouldNotBeNil)
		test.That(t, transform.Uuid, test.ShouldNotBeEmpty)
		test.That(t, transform.ReferenceFrame, test.ShouldEqual, "test")
		test.That(t, transform.PoseInObserverFrame.GetPose(), test.ShouldResemble, &commonv1.Pose{
			X:     0,
			Y:     0,
			Z:     0,
			OX:    0,
			OY:    0,
			OZ:    1,
			Theta: 0,
		})
		test.That(t, transform.PhysicalObject.Label, test.ShouldEqual, "box")
		test.That(t, transform.PhysicalObject.GetBox(), test.ShouldResemble, &commonv1.RectangularPrism{
			DimsMm: &commonv1.Vector3{
				X: 100,
				Y: 100,
				Z: 100,
			},
		})
		test.That(t, transform.Metadata, test.ShouldNotBeNil)
		test.That(t, fixtures.Byte64EncodedToString(transform.Metadata.Fields["colors"].GetStringValue()), test.ShouldResemble, "\xff\x00\x00")
		test.That(t, transform.Metadata.Fields["color_format"].GetNumberValue(), test.ShouldEqual, 1)
		test.That(t, fixtures.Byte64EncodedToString(transform.Metadata.Fields["opacities"].GetStringValue()), test.ShouldResemble, "\xff")
	})

	t.Run("RoundtripMetadata", func(t *testing.T) {
		metadata := NewMetadata(WithMetadataColors(NewColor(WithName("red")), NewColor(WithName("blue"))))
		metadataStruct := MetadataToStruct(metadata)
		roundtripMetadata, err := StructToMetadata(metadataStruct)
		test.That(t, err, test.ShouldBeNil)
		test.That(t, roundtripMetadata.Colors, test.ShouldResemble, metadata.Colors)
	})
}
