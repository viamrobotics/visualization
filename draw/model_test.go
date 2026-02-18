package draw

import (
	"testing"

	"github.com/golang/geo/r3"
	"go.viam.com/rdk/referenceframe"
	"go.viam.com/rdk/spatialmath"
	"go.viam.com/test"
)

func TestNewModel(t *testing.T) {
	urlAsset, err := NewURLModelAsset("model/gltf-binary", "https://example.com/model.glb")
	test.That(t, err, test.ShouldBeNil)

	t.Run("Defaults", func(t *testing.T) {
		model, err := NewModel(WithModelAssets(urlAsset))
		test.That(t, err, test.ShouldBeNil)
		test.That(t, model.Scale, test.ShouldResemble, DefaultModelScale)
		test.That(t, model.AnimationName, test.ShouldEqual, DefaultModelAnimationName)
	})

	t.Run("WithURLAsset", func(t *testing.T) {
		model, err := NewModel(WithModelAssets(urlAsset))
		test.That(t, err, test.ShouldBeNil)
		test.That(t, model, test.ShouldNotBeNil)
		test.That(t, model.Assets, test.ShouldHaveLength, 1)
		test.That(t, *model.Assets[0].URLContent, test.ShouldEqual, "https://example.com/model.glb")
	})

	t.Run("WithBinaryAsset", func(t *testing.T) {
		dataAsset, err := NewBinaryModelAsset("model/gltf-binary", []byte{0x00, 0x01, 0x02, 0x03})
		test.That(t, err, test.ShouldBeNil)
		model, err := NewModel(WithModelAssets(dataAsset))
		test.That(t, err, test.ShouldBeNil)
		test.That(t, model, test.ShouldNotBeNil)
		test.That(t, *model.Assets[0].DataContent, test.ShouldResemble, []byte{0x00, 0x01, 0x02, 0x03})
	})

	t.Run("WithModelScale", func(t *testing.T) {
		model, err := NewModel(WithModelAssets(urlAsset), WithModelScale(r3.Vector{X: 2.0, Y: 3.0, Z: 0.5}))
		test.That(t, err, test.ShouldBeNil)
		test.That(t, model.Scale, test.ShouldResemble, r3.Vector{X: 2.0, Y: 3.0, Z: 0.5})
	})

	t.Run("WithModelAnimationName", func(t *testing.T) {
		model, err := NewModel(WithModelAssets(urlAsset), WithModelAnimationName("walk"))
		test.That(t, err, test.ShouldBeNil)
		test.That(t, model.AnimationName, test.ShouldEqual, "walk")
	})

	t.Run("WithModelAssetSizeBytes", func(t *testing.T) {
		sizedAsset, err := NewURLModelAsset("model/gltf-binary", "https://example.com/model.glb", WithModelAssetSizeBytes(1024))
		test.That(t, err, test.ShouldBeNil)
		test.That(t, *sizedAsset.SizeBytes, test.ShouldEqual, uint64(1024))
		model, err := NewModel(WithModelAssets(sizedAsset))
		test.That(t, err, test.ShouldBeNil)
		test.That(t, *model.Assets[0].SizeBytes, test.ShouldEqual, uint64(1024))
	})

	t.Run("ErrorNoAssets", func(t *testing.T) {
		model, err := NewModel()
		test.That(t, err, test.ShouldNotBeNil)
		test.That(t, err.Error(), test.ShouldContainSubstring, "model must have at least one asset")
		test.That(t, model, test.ShouldBeNil)
	})

	t.Run("ErrorZeroScale", func(t *testing.T) {
		model, err := NewModel(WithModelAssets(urlAsset), WithModelScale(r3.Vector{X: 0, Y: 1, Z: 1}))
		test.That(t, err, test.ShouldNotBeNil)
		test.That(t, err.Error(), test.ShouldContainSubstring, "scale cannot be zero")
		test.That(t, model, test.ShouldBeNil)
	})

	t.Run("ErrorEmptyURL", func(t *testing.T) {
		_, err := NewURLModelAsset("model/gltf-binary", "")
		test.That(t, err, test.ShouldNotBeNil)
		test.That(t, err.Error(), test.ShouldContainSubstring, "url cannot be empty")
	})

	t.Run("ErrorEmptyBinaryContent", func(t *testing.T) {
		_, err := NewBinaryModelAsset("model/gltf-binary", []byte{})
		test.That(t, err, test.ShouldNotBeNil)
		test.That(t, err.Error(), test.ShouldContainSubstring, "binary content cannot be empty")
	})
}

func TestModel_Draw(t *testing.T) {
	urlAsset, err := NewURLModelAsset("model/gltf-binary", "https://example.com/model.glb")
	test.That(t, err, test.ShouldBeNil)
	model, err := NewModel(WithModelAssets(urlAsset), WithModelScale(r3.Vector{X: 2, Y: 2, Z: 2}))
	test.That(t, err, test.ShouldBeNil)

	t.Run("DrawingDefaults", func(t *testing.T) {
		drawing := model.Draw("test-model")
		test.That(t, drawing.Name, test.ShouldEqual, "test-model")
		test.That(t, drawing.Parent, test.ShouldEqual, referenceframe.World)
		test.That(t, drawing.Pose, test.ShouldResemble, spatialmath.NewZeroPose())
		test.That(t, drawing.Shape.Center, test.ShouldResemble, spatialmath.NewZeroPose())
		test.That(t, drawing.Shape.Label, test.ShouldEqual, "test-model")
		test.That(t, drawing.Shape.Model, test.ShouldNotBeNil)
	})

	t.Run("DrawWithPose", func(t *testing.T) {
		pose := spatialmath.NewPose(r3.Vector{X: 10, Y: 0, Z: 0}, &spatialmath.OrientationVectorDegrees{OX: 0, OY: 0, OZ: 1, Theta: 0})
		drawing := model.Draw("test-model", WithPose(pose))
		test.That(t, drawing.Pose, test.ShouldResemble, pose)
		test.That(t, drawing.Shape.Center, test.ShouldResemble, spatialmath.NewZeroPose())
	})

	t.Run("DrawWithParent", func(t *testing.T) {
		drawing := model.Draw("test-model", WithParent("robot-base"))
		test.That(t, drawing.Parent, test.ShouldEqual, "robot-base")
	})

	t.Run("ProtoOutput", func(t *testing.T) {
		drawing := model.Draw("test-model")
		proto := drawing.ToProto()
		test.That(t, proto.ReferenceFrame, test.ShouldEqual, "test-model")
		test.That(t, proto.PoseInObserverFrame.ReferenceFrame, test.ShouldEqual, referenceframe.World)
		test.That(t, proto.PhysicalObject, test.ShouldNotBeNil)
		test.That(t, proto.PhysicalObject.Label, test.ShouldEqual, "test-model")
		protoModel := proto.PhysicalObject.GetModel()
		test.That(t, protoModel, test.ShouldNotBeNil)
		test.That(t, protoModel.Scale.X, test.ShouldEqual, float64(2))
		test.That(t, protoModel.Scale.Y, test.ShouldEqual, float64(2))
		test.That(t, protoModel.Scale.Z, test.ShouldEqual, float64(2))
		test.That(t, protoModel.Assets, test.ShouldHaveLength, 1)
		test.That(t, protoModel.Assets[0].GetUrl(), test.ShouldEqual, "https://example.com/model.glb")
	})
}
