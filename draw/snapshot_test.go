package draw

import (
	"testing"

	"github.com/golang/geo/r3"
	"go.viam.com/rdk/spatialmath"
	"go.viam.com/test"
)

func TestNewSnapshot(t *testing.T) {
	t.Run("creates snapshot with defaults", func(t *testing.T) {
		snapshot := NewSnapshot()

		test.That(t, snapshot, test.ShouldNotBeNil)
		test.That(t, len(snapshot.UUID()), test.ShouldEqual, 16)
		test.That(t, snapshot.Transforms(), test.ShouldNotBeNil)
		test.That(t, snapshot.Drawings(), test.ShouldNotBeNil)
		test.That(t, snapshot.SceneMetadata().Grid, test.ShouldBeTrue)
	})

	t.Run("creates snapshot with custom camera", func(t *testing.T) {
		camera := NewSceneCamera(
			r3.Vector{X: 1000, Y: 2000, Z: 3000},
			r3.Vector{X: 0, Y: 0, Z: 0},
		)
		snapshot := NewSnapshot(WithSceneCamera(camera))

		test.That(t, snapshot.SceneMetadata().SceneCamera.Position, test.ShouldResemble, r3.Vector{X: 1000, Y: 2000, Z: 3000})
		test.That(t, snapshot.SceneMetadata().SceneCamera.LookAt, test.ShouldResemble, r3.Vector{X: 0, Y: 0, Z: 0})
	})

	t.Run("creates snapshot with grid disabled", func(t *testing.T) {
		snapshot := NewSnapshot(WithGrid(false))

		test.That(t, snapshot.SceneMetadata().Grid, test.ShouldBeFalse)
	})
}

func TestSnapshotValidate(t *testing.T) {
	t.Run("valid empty snapshot", func(t *testing.T) {
		snapshot := NewSnapshot()
		err := snapshot.Validate()

		test.That(t, err, test.ShouldBeNil)
	})

	t.Run("valid snapshot with geometry", func(t *testing.T) {
		snapshot := NewSnapshot()
		box, _ := spatialmath.NewBox(spatialmath.NewZeroPose(), r3.Vector{X: 100, Y: 100, Z: 100}, "box")
		err := snapshot.DrawGeometry(box, spatialmath.NewZeroPose(), "world", NewColor(WithName("red")))
		test.That(t, err, test.ShouldBeNil)

		err = snapshot.Validate()
		test.That(t, err, test.ShouldBeNil)
	})

	t.Run("nil snapshot", func(t *testing.T) {
		var snapshot *Snapshot
		err := snapshot.Validate()

		test.That(t, err, test.ShouldNotBeNil)
		test.That(t, err.Error(), test.ShouldContainSubstring, "snapshot is nil")
	})
}

func TestSnapshotToProto(t *testing.T) {
	t.Run("converts snapshot to proto", func(t *testing.T) {
		snapshot := NewSnapshot()
		box, _ := spatialmath.NewBox(spatialmath.NewZeroPose(), r3.Vector{X: 100, Y: 100, Z: 100}, "box")
		_ = snapshot.DrawGeometry(box, spatialmath.NewZeroPose(), "world", NewColor(WithName("red")))

		positions := []r3.Vector{{X: 0, Y: 0, Z: 0}, {X: 100, Y: 0, Z: 0}}
		_ = snapshot.DrawPoints("points", "world", spatialmath.NewZeroPose(), positions,
			WithPointColors(NewColor(WithName("blue"))))

		protoSnapshot := snapshot.ToProto()
		test.That(t, protoSnapshot, test.ShouldNotBeNil)
		test.That(t, len(protoSnapshot.Uuid), test.ShouldEqual, 16)
		test.That(t, len(protoSnapshot.Transforms), test.ShouldEqual, 1)
		test.That(t, len(protoSnapshot.Drawings), test.ShouldEqual, 1)
		test.That(t, protoSnapshot.SceneMetadata, test.ShouldNotBeNil)
	})
}
