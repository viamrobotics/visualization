package draw

import (
	"testing"

	"github.com/golang/geo/r3"
	drawv1 "github.com/viam-labs/motion-tools/draw/v1"
	"go.viam.com/test"
)

func TestScene(t *testing.T) {
	t.Run("NewSceneCamera", func(t *testing.T) {
		scene := NewSceneCamera(r3.Vector{X: 0, Y: 0, Z: 0}, r3.Vector{X: 1, Y: 1, Z: 1})
		test.That(t, scene, test.ShouldNotBeNil)
		test.That(t, scene.Position, test.ShouldResemble, r3.Vector{X: 0, Y: 0, Z: 0})
		test.That(t, scene.LookAt, test.ShouldResemble, r3.Vector{X: 1, Y: 1, Z: 1})
		test.That(t, scene.Animated, test.ShouldBeFalse)
		test.That(t, scene.PerspectiveCamera, test.ShouldNotBeNil)
		test.That(t, scene.OrthographicCamera, test.ShouldBeNil)
	})

	t.Run("NewSceneMetadata", func(t *testing.T) {
		metadata := NewSceneMetadata(WithGridCellSize(1000), WithGridSectionSize(50), WithRenderArmModels(drawv1.RenderArmModels_RENDER_ARM_MODELS_MODEL))
		test.That(t, metadata, test.ShouldNotBeNil)
		test.That(t, metadata.SceneCamera, test.ShouldResemble, DefaultSceneCamera)
		test.That(t, metadata.Grid, test.ShouldBeTrue)
		test.That(t, metadata.GridCellSize, test.ShouldEqual, 1000)
		test.That(t, metadata.GridSectionSize, test.ShouldEqual, 50)
		test.That(t, metadata.RenderArmModels, test.ShouldEqual, drawv1.RenderArmModels_RENDER_ARM_MODELS_MODEL)

		test.That(t, metadata.Validate(), test.ShouldBeNil)
	})
}
