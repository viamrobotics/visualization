package api

import (
	"testing"

	"github.com/golang/geo/r3"
	"github.com/viamrobotics/visualization/draw"
	"go.viam.com/rdk/referenceframe"
	"go.viam.com/rdk/spatialmath"
	"go.viam.com/test"
)

func testAxesFrame(t *testing.T, name string) referenceframe.Frame {
	t.Helper()
	frame, err := referenceframe.NewStaticFrame(name, spatialmath.NewZeroPose())
	test.That(t, err, test.ShouldBeNil)
	return frame
}

func testGeometryFrame(t *testing.T, name, label string) referenceframe.Frame {
	t.Helper()
	box, err := spatialmath.NewBox(
		spatialmath.NewZeroPose(),
		r3.Vector{X: 10, Y: 10, Z: 10},
		label,
	)
	test.That(t, err, test.ShouldBeNil)
	frame, err := referenceframe.NewStaticFrameWithGeometry(name, spatialmath.NewZeroPose(), box)
	test.That(t, err, test.ShouldBeNil)
	return frame
}

// A bare frame contributes one axes transform, and a frame with geometry
// contributes one transform per geometry.
func TestDrawFramesEmitsOneTransformPerGeometry(t *testing.T) {
	fake := startFake(t)

	uuids, err := DrawFrames(DrawFramesOptions{
		Frames: []referenceframe.Frame{
			testAxesFrame(t, "bare"),
			testGeometryFrame(t, "with-box", "box"),
		},
	})
	test.That(t, err, test.ShouldBeNil)

	test.That(t, fake.addEntities, test.ShouldHaveLength, 1)
	test.That(t, uuids, test.ShouldHaveLength, 2)
}

func TestDrawFramesBatchesIntoOneCall(t *testing.T) {
	fake := startFake(t)

	_, err := DrawFrames(DrawFramesOptions{
		Frames: []referenceframe.Frame{
			testAxesFrame(t, "a"),
			testAxesFrame(t, "b"),
			testAxesFrame(t, "c"),
		},
	})
	test.That(t, err, test.ShouldBeNil)

	fake.mu.Lock()
	defer fake.mu.Unlock()
	test.That(t, fake.addEntities, test.ShouldHaveLength, 1)
	test.That(t, fake.addEntity, test.ShouldBeEmpty)
	test.That(t, fake.addEntities[0].GetEntities(), test.ShouldHaveLength, 3)
}

// Colors is a name-keyed map, so a frame missing from it takes the default
// rather than erroring.
func TestDrawFramesColorsByName(t *testing.T) {
	fake := startFake(t)

	_, err := DrawFrames(DrawFramesOptions{
		Frames: []referenceframe.Frame{testAxesFrame(t, "named"), testAxesFrame(t, "unnamed")},
		Colors: map[string]draw.Color{"named": draw.ColorFromRGB(0, 255, 0)},
	})
	test.That(t, err, test.ShouldBeNil)

	test.That(t, fake.addEntities[0].GetEntities(), test.ShouldHaveLength, 2)
}

func TestDrawFramesIDNamespacesTheBatch(t *testing.T) {
	uuidFor := func(t *testing.T, id string) []byte {
		t.Helper()
		fake := startFake(t)
		_, err := DrawFrames(DrawFramesOptions{
			ID:     id,
			Frames: []referenceframe.Frame{testAxesFrame(t, "shared")},
		})
		test.That(t, err, test.ShouldBeNil)
		return fake.addEntities[0].GetEntities()[0].GetTransform().GetUuid()
	}

	var noID, withID []byte
	t.Run("no id", func(t *testing.T) { noID = uuidFor(t, "") })
	t.Run("robot-a", func(t *testing.T) { withID = uuidFor(t, "robot-a") })

	test.That(t, withID, test.ShouldNotResemble, noID)
}

// An empty batch short-circuits in addTransforms: no RPC, an empty slice, and
// no error.
func TestDrawFramesWithNoFramesSendsNothing(t *testing.T) {
	fake := startFake(t)

	uuids, err := DrawFrames(DrawFramesOptions{})

	test.That(t, err, test.ShouldBeNil)
	test.That(t, uuids, test.ShouldBeEmpty)
	fake.mu.Lock()
	defer fake.mu.Unlock()
	test.That(t, fake.addEntities, test.ShouldBeEmpty)
}

func TestDrawFramesRequiresAVisualizer(t *testing.T) {
	requireNoServer(t)

	_, err := DrawFrames(DrawFramesOptions{Frames: []referenceframe.Frame{testAxesFrame(t, "a")}})

	test.That(t, err, test.ShouldWrap, ErrVisualizerNotRunning)
}

func TestDrawFramesWrapsRPCFailures(t *testing.T) {
	fake := startFake(t)
	fake.errs["AddEntities"] = errRPCBoom

	_, err := DrawFrames(DrawFramesOptions{Frames: []referenceframe.Frame{testAxesFrame(t, "a")}})

	test.That(t, err, test.ShouldNotBeNil)
	test.That(t, err.Error(), test.ShouldContainSubstring, "AddEntities RPC failed")
}
