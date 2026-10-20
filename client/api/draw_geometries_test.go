package api

import (
	"testing"

	"github.com/viamrobotics/visualization/draw"
	"go.viam.com/rdk/referenceframe"
	"go.viam.com/rdk/spatialmath"
	"go.viam.com/test"
)

func testGeometriesInFrame(t *testing.T, parent string, labels ...string) *referenceframe.GeometriesInFrame {
	t.Helper()
	geometries := make([]spatialmath.Geometry, 0, len(labels))
	for _, label := range labels {
		geometries = append(geometries, testBox(t, label))
	}
	return referenceframe.NewGeometriesInFrame(parent, geometries)
}

// The batch goes out as one AddEntities call, not one AddEntity per geometry. A
// frame system with a couple hundred geometries would otherwise cost a couple
// hundred round trips per redraw.
func TestDrawGeometriesInFrameBatchesIntoOneCall(t *testing.T) {
	fake := startFake(t)

	uuids, err := DrawGeometriesInFrame(DrawGeometriesInFrameOptions{
		Geometries: testGeometriesInFrame(t, "world", "a", "b", "c"),
	})
	test.That(t, err, test.ShouldBeNil)

	fake.mu.Lock()
	defer fake.mu.Unlock()
	test.That(t, fake.addEntities, test.ShouldHaveLength, 1)
	test.That(t, fake.addEntity, test.ShouldBeEmpty)
	test.That(t, fake.addEntities[0].GetEntities(), test.ShouldHaveLength, 3)
	test.That(t, uuids, test.ShouldHaveLength, 3)
}

func TestDrawGeometriesInFrameSendsTransforms(t *testing.T) {
	fake := startFake(t)

	_, err := DrawGeometriesInFrame(DrawGeometriesInFrameOptions{
		Geometries: testGeometriesInFrame(t, "arm-1", "link"),
	})
	test.That(t, err, test.ShouldBeNil)

	entity := fake.addEntities[0].GetEntities()[0]
	test.That(t, entity.GetTransform(), test.ShouldNotBeNil)
	test.That(t, entity.GetDrawing(), test.ShouldBeNil)
}

// ToTransforms is called with no options, so its parent falls back to "world"
// and the frame the caller put the geometries in is discarded. There is also no
// Parent field on the options struct, unlike every other Draw* call, so a batch
// cannot be attached to a frame at all. Geometries whose poses are not already
// world-resolved render in the wrong place.
func TestDrawGeometriesInFrameIgnoresTheFrameAndAlwaysUsesWorld(t *testing.T) {
	fake := startFake(t)

	_, err := DrawGeometriesInFrame(DrawGeometriesInFrameOptions{
		Geometries: testGeometriesInFrame(t, "arm-1", "link"),
	})
	test.That(t, err, test.ShouldBeNil)

	observer := fake.addEntities[0].
		GetEntities()[0].
		GetTransform().
		GetPoseInObserverFrame().
		GetReferenceFrame()
	test.That(t, observer, test.ShouldEqual, "world")
}

// A consequence of the above: the same labels under two different frames collide
// on identity, because the derived id is "label:world" either way.
func TestDrawGeometriesInFrameCollidesAcrossFrames(t *testing.T) {
	uuidFor := func(t *testing.T, parent string) []byte {
		t.Helper()
		fake := startFake(t)
		_, err := DrawGeometriesInFrame(DrawGeometriesInFrameOptions{
			Geometries: testGeometriesInFrame(t, parent, "shared"),
		})
		test.That(t, err, test.ShouldBeNil)
		return fake.addEntities[0].GetEntities()[0].GetTransform().GetUuid()
	}

	var underArm, underGripper []byte
	t.Run("arm-1", func(t *testing.T) { underArm = uuidFor(t, "arm-1") })
	t.Run("gripper", func(t *testing.T) { underGripper = uuidFor(t, "gripper") })

	// Same uuid despite different frames. ID is the only way to separate them.
	test.That(t, underArm, test.ShouldResemble, underGripper)
}

// Identity is derived from "ID:label:parent", so a distinct ID keeps two batches
// that share labels and a parent from colliding.
func TestDrawGeometriesInFrameIDNamespacesTheBatch(t *testing.T) {
	uuidsFor := func(t *testing.T, id string) []byte {
		t.Helper()
		fake := startFake(t)
		_, err := DrawGeometriesInFrame(DrawGeometriesInFrameOptions{
			ID:         id,
			Geometries: testGeometriesInFrame(t, "world", "shared-label"),
		})
		test.That(t, err, test.ShouldBeNil)
		return fake.addEntities[0].GetEntities()[0].GetTransform().GetUuid()
	}

	var noID, withID, otherID []byte
	t.Run("no id", func(t *testing.T) { noID = uuidsFor(t, "") })
	t.Run("robot-a", func(t *testing.T) { withID = uuidsFor(t, "robot-a") })
	t.Run("robot-b", func(t *testing.T) { otherID = uuidsFor(t, "robot-b") })

	test.That(t, withID, test.ShouldNotResemble, noID)
	test.That(t, withID, test.ShouldNotResemble, otherID)
}

func TestDrawGeometriesInFrameRepeatedCallsUpsert(t *testing.T) {
	fake := startFake(t)
	geometries := testGeometriesInFrame(t, "world", "stable")

	_, err := DrawGeometriesInFrame(DrawGeometriesInFrameOptions{Geometries: geometries})
	test.That(t, err, test.ShouldBeNil)
	_, err = DrawGeometriesInFrame(DrawGeometriesInFrameOptions{Geometries: geometries})
	test.That(t, err, test.ShouldBeNil)

	fake.mu.Lock()
	defer fake.mu.Unlock()
	first := fake.addEntities[0].GetEntities()[0].GetTransform().GetUuid()
	second := fake.addEntities[1].GetEntities()[0].GetTransform().GetUuid()
	test.That(t, first, test.ShouldResemble, second)
}

// Empty Colors is not "no color": the batch defaults to red.
func TestDrawGeometriesInFrameColorBranches(t *testing.T) {
	red := draw.ColorFromRGB(255, 0, 0)
	green := draw.ColorFromRGB(0, 255, 0)

	for _, tc := range []struct {
		name   string
		colors []draw.Color
	}{
		{name: "empty defaults to red", colors: nil},
		{name: "one color is shared", colors: []draw.Color{red}},
		{name: "one color per geometry", colors: []draw.Color{red, green, red}},
		{name: "a shorter palette cycles", colors: []draw.Color{red, green}},
	} {
		t.Run(tc.name, func(t *testing.T) {
			fake := startFake(t)

			_, err := DrawGeometriesInFrame(DrawGeometriesInFrameOptions{
				Geometries: testGeometriesInFrame(t, "world", "a", "b", "c"),
				Colors:     tc.colors,
			})
			test.That(t, err, test.ShouldBeNil)

			test.That(t, fake.addEntities[0].GetEntities(), test.ShouldHaveLength, 3)
		})
	}
}

func TestDrawGeometriesInFrameRequiresAVisualizer(t *testing.T) {
	requireNoServer(t)

	_, err := DrawGeometriesInFrame(DrawGeometriesInFrameOptions{
		Geometries: testGeometriesInFrame(t, "world", "a"),
	})

	test.That(t, err, test.ShouldWrap, ErrVisualizerNotRunning)
}

func TestDrawGeometriesInFrameWrapsRPCFailures(t *testing.T) {
	fake := startFake(t)
	fake.errs["AddEntities"] = errRPCBoom

	_, err := DrawGeometriesInFrame(DrawGeometriesInFrameOptions{
		Geometries: testGeometriesInFrame(t, "world", "a"),
	})

	test.That(t, err, test.ShouldNotBeNil)
	test.That(t, err.Error(), test.ShouldContainSubstring, "AddEntities RPC failed")
}
