package draw

import (
	"testing"

	"github.com/golang/geo/r3"
	fixtures "github.com/viam-labs/motion-tools/draw/fixtures"
	"go.viam.com/rdk/spatialmath"
	"go.viam.com/test"
)

func TestDrawing(t *testing.T) {
	t.Run("Arrows", func(t *testing.T) {
		arrows, _ := NewArrows(
			[]spatialmath.Pose{
				spatialmath.NewPose(r3.Vector{X: 1, Y: 0, Z: 0}, &spatialmath.OrientationVectorDegrees{OX: 0, OY: 0, OZ: 1, Theta: 0}),
			},
			WithSingleArrowColor(NewColor(WithName("red"))),
		)

		drawing := NewDrawing("", "test", "world", spatialmath.NewPose(r3.Vector{X: 0, Y: 0, Z: 0}, &spatialmath.OrientationVectorDegrees{OX: 0, OY: 0, OZ: 1, Theta: 0}), NewShape(spatialmath.NewPose(r3.Vector{X: 0, Y: 0, Z: 0}, &spatialmath.OrientationVectorDegrees{OX: 0, OY: 0, OZ: 1, Theta: 0}), "test", WithArrows(*arrows)), NewMetadata(WithMetadataColors(arrows.Colors...)))
		test.That(t, drawing, test.ShouldNotBeNil)

		proto := drawing.ToProto()
		test.That(t, proto, test.ShouldNotBeNil)
		test.That(t, proto.PhysicalObject, test.ShouldNotBeNil)
		test.That(t, proto.PhysicalObject.GeometryType, test.ShouldNotBeNil)
		test.That(t, proto.PhysicalObject.GetArrows(), test.ShouldNotBeNil)
		test.That(t, proto.PhysicalObject.GetArrows().Poses, test.ShouldResemble, fixtures.Float32SliceToBytes([]float32{1.0, 0.0, 0.0, 0.0, 0.0, 1.0}))
	})

	t.Run("Model", func(t *testing.T) {
		url := "https://example.com/model.glb"
		modelAsset, _ := NewURLModelAsset("model/gltf-binary", url, WithModelAssetSizeBytes(1000))
		model, _ := NewModel(
			WithModelAssets(modelAsset),
			WithModelScale(r3.Vector{X: 10, Y: 10, Z: 10}),
		)
		drawing := NewDrawing("", "test", "world", spatialmath.NewPose(r3.Vector{X: 0, Y: 0, Z: 0}, &spatialmath.OrientationVectorDegrees{OX: 0, OY: 0, OZ: 1, Theta: 0}), NewShape(spatialmath.NewPose(r3.Vector{X: 0, Y: 0, Z: 0}, &spatialmath.OrientationVectorDegrees{OX: 0, OY: 0, OZ: 1, Theta: 0}), "test", WithModel(*model)), NewMetadata())
		test.That(t, drawing, test.ShouldNotBeNil)

		proto := drawing.ToProto()
		test.That(t, proto, test.ShouldNotBeNil)
		test.That(t, proto.PhysicalObject, test.ShouldNotBeNil)
		test.That(t, proto.PhysicalObject.GeometryType, test.ShouldNotBeNil)
		test.That(t, proto.PhysicalObject.GetModel(), test.ShouldNotBeNil)
		test.That(t, proto.PhysicalObject.GetModel().Assets, test.ShouldNotBeNil)
		test.That(t, len(proto.PhysicalObject.GetModel().Assets), test.ShouldEqual, 1)
		test.That(t, proto.PhysicalObject.GetModel().Assets[0].MimeType, test.ShouldEqual, "model/gltf-binary")
		test.That(t, *proto.PhysicalObject.GetModel().Assets[0].SizeBytes, test.ShouldEqual, 1000)
		test.That(t, proto.PhysicalObject.GetModel().Assets[0].GetUrl(), test.ShouldEqual, url)
	})
}
