package draw

import (
	"testing"

	"github.com/golang/geo/r3"
	"go.viam.com/rdk/referenceframe"
	"go.viam.com/rdk/spatialmath"
	"go.viam.com/test"
)

func TestNewDrawConfig(t *testing.T) {
	t.Run("Defaults", func(t *testing.T) {
		config := NewDrawConfig("my-name")
		test.That(t, config.Name, test.ShouldEqual, "my-name")
		test.That(t, config.Parent, test.ShouldEqual, referenceframe.World)
		test.That(t, config.Pose, test.ShouldResemble, spatialmath.NewZeroPose())
		test.That(t, config.Center, test.ShouldResemble, spatialmath.NewZeroPose())
		test.That(t, config.UUID, test.ShouldNotBeEmpty)
		test.That(t, len(config.UUID), test.ShouldEqual, 16)
	})

	t.Run("WithParent", func(t *testing.T) {
		config := NewDrawConfig("my-name", WithParent("robot-base"))
		test.That(t, config.Parent, test.ShouldEqual, "robot-base")
	})

	t.Run("WithPose", func(t *testing.T) {
		pose := spatialmath.NewPose(r3.Vector{X: 10, Y: 20, Z: 30}, &spatialmath.OrientationVectorDegrees{OX: 0, OY: 0, OZ: 1, Theta: 90})
		config := NewDrawConfig("my-name", WithPose(pose))
		test.That(t, config.Pose, test.ShouldResemble, pose)
		test.That(t, config.Center, test.ShouldResemble, spatialmath.NewZeroPose())
	})

	t.Run("WithCenter", func(t *testing.T) {
		center := spatialmath.NewPose(r3.Vector{X: 5, Y: 0, Z: 0}, &spatialmath.OrientationVectorDegrees{OX: 0, OY: 0, OZ: 1, Theta: 0})
		config := NewDrawConfig("my-name", WithCenter(center))
		test.That(t, config.Center, test.ShouldResemble, center)
		test.That(t, config.Pose, test.ShouldResemble, spatialmath.NewZeroPose())
	})

	t.Run("WithUUID", func(t *testing.T) {
		explicit := []byte{0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15}
		config := NewDrawConfig("my-name", WithUUID(explicit))
		test.That(t, config.UUID, test.ShouldResemble, explicit)
	})

	t.Run("WithID", func(t *testing.T) {
		config1 := NewDrawConfig("my-name", WithID("some-stable-id"))
		config2 := NewDrawConfig("my-name", WithID("some-stable-id"))
		config3 := NewDrawConfig("my-name", WithID("different-id"))
		// Same ID produces same UUID
		test.That(t, config1.UUID, test.ShouldResemble, config2.UUID)
		// Different IDs produce different UUIDs
		test.That(t, config1.UUID, test.ShouldNotResemble, config3.UUID)
	})

	t.Run("UUIDIsStableForSameNameAndParent", func(t *testing.T) {
		config1 := NewDrawConfig("my-name", WithParent("world"))
		config2 := NewDrawConfig("my-name", WithParent("world"))
		test.That(t, config1.UUID, test.ShouldResemble, config2.UUID)
	})

	t.Run("UUIDChangesWithParent", func(t *testing.T) {
		configWorld := NewDrawConfig("my-name")
		configRobot := NewDrawConfig("my-name", WithParent("robot-base"))
		test.That(t, configWorld.UUID, test.ShouldNotResemble, configRobot.UUID)
	})
}
