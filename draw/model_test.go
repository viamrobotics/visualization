package draw

import (
	"testing"

	"go.viam.com/test"
)

func TestModel(t *testing.T) {
	t.Run("model url asset", func(t *testing.T) {
		urlAsset, err := NewURLModelAsset("model/gltf-binary", "https://example.com/model.glb")
		test.That(t, err, test.ShouldBeNil)
		test.That(t, urlAsset, test.ShouldNotBeNil)
		model, err := NewModel(WithModelAssets(urlAsset))
		test.That(t, err, test.ShouldBeNil)
		test.That(t, model, test.ShouldNotBeNil)
	})

	t.Run("model data asset", func(t *testing.T) {
		dataAsset, err := NewBinaryModelAsset("model/gltf-binary", []byte{0x00, 0x00, 0x00, 0x00})
		test.That(t, err, test.ShouldBeNil)
		test.That(t, dataAsset, test.ShouldNotBeNil)
		model, err := NewModel(WithModelAssets(dataAsset))
		test.That(t, err, test.ShouldBeNil)
		test.That(t, model, test.ShouldNotBeNil)
	})

	t.Run("no assets", func(t *testing.T) {
		model, err := NewModel()
		test.That(t, err, test.ShouldBeError, "model must have at least one asset")
		test.That(t, model, test.ShouldBeNil)
	})
}
