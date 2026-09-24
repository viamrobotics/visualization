package api

import (
	"testing"

	"github.com/viamrobotics/visualization/draw"
	"go.viam.com/rdk/referenceframe"
	"go.viam.com/test"
)

func testFrameSystem(t *testing.T, frames ...referenceframe.Frame) *referenceframe.FrameSystem {
	t.Helper()
	system := referenceframe.NewEmptyFrameSystem("test")
	for _, frame := range frames {
		test.That(t, system.AddFrame(frame, system.World()), test.ShouldBeNil)
	}
	return system
}

func TestDrawFrameSystemEmitsOneTransformPerGeometry(t *testing.T) {
	fake := startFake(t)
	system := testFrameSystem(
		t,
		testGeometryFrame(t, "link-1", "box-1"),
		testGeometryFrame(t, "link-2", "box-2"),
	)

	uuids, err := DrawFrameSystem(DrawFrameSystemOptions{
		FrameSystem: system,
		Inputs:      referenceframe.FrameSystemInputs{},
	})
	test.That(t, err, test.ShouldBeNil)

	test.That(t, fake.addEntities, test.ShouldHaveLength, 1)
	test.That(t, uuids, test.ShouldHaveLength, 2)
}

// A nil Colors map is replaced with an empty one before it reaches the draw
// layer, so passing nil is safe rather than a nil map write.
func TestDrawFrameSystemAcceptsNilColors(t *testing.T) {
	fake := startFake(t)

	_, err := DrawFrameSystem(DrawFrameSystemOptions{
		FrameSystem: testFrameSystem(t, testGeometryFrame(t, "link", "box")),
		Inputs:      referenceframe.FrameSystemInputs{},
		Colors:      nil,
	})

	test.That(t, err, test.ShouldBeNil)
	test.That(t, fake.addEntities, test.ShouldHaveLength, 1)
}

func TestDrawFrameSystemColorsByName(t *testing.T) {
	fake := startFake(t)

	_, err := DrawFrameSystem(DrawFrameSystemOptions{
		FrameSystem: testFrameSystem(t, testGeometryFrame(t, "link", "box")),
		Inputs:      referenceframe.FrameSystemInputs{},
		Colors:      map[string]draw.Color{"link": draw.ColorFromRGB(0, 0, 255)},
	})

	test.That(t, err, test.ShouldBeNil)
	test.That(t, fake.addEntities[0].GetEntities(), test.ShouldHaveLength, 1)
}

func TestDrawFrameSystemIDNamespacesTheBatch(t *testing.T) {
	uuidFor := func(t *testing.T, id string) []byte {
		t.Helper()
		fake := startFake(t)
		_, err := DrawFrameSystem(DrawFrameSystemOptions{
			ID:          id,
			FrameSystem: testFrameSystem(t, testGeometryFrame(t, "link", "shared-box")),
			Inputs:      referenceframe.FrameSystemInputs{},
		})
		test.That(t, err, test.ShouldBeNil)
		return fake.addEntities[0].GetEntities()[0].GetTransform().GetUuid()
	}

	var noID, robotA, robotB []byte
	t.Run("no id", func(t *testing.T) { noID = uuidFor(t, "") })
	t.Run("robot-a", func(t *testing.T) { robotA = uuidFor(t, "robot-a") })
	t.Run("robot-b", func(t *testing.T) { robotB = uuidFor(t, "robot-b") })

	// Two robots sharing geometry labels are what ID exists to separate.
	test.That(t, robotA, test.ShouldNotResemble, noID)
	test.That(t, robotA, test.ShouldNotResemble, robotB)
}

// A frame system with no geometries emits nothing, and addTransforms
// short-circuits rather than sending an empty batch.
func TestDrawFrameSystemWithNoGeometriesSendsNothing(t *testing.T) {
	fake := startFake(t)

	uuids, err := DrawFrameSystem(DrawFrameSystemOptions{
		FrameSystem: testFrameSystem(t, testAxesFrame(t, "bare")),
		Inputs:      referenceframe.FrameSystemInputs{},
	})

	test.That(t, err, test.ShouldBeNil)
	test.That(t, uuids, test.ShouldBeEmpty)
	fake.mu.Lock()
	defer fake.mu.Unlock()
	test.That(t, fake.addEntities, test.ShouldBeEmpty)
}

func TestDrawFrameSystemRequiresAVisualizer(t *testing.T) {
	requireNoServer(t)

	_, err := DrawFrameSystem(DrawFrameSystemOptions{
		FrameSystem: testFrameSystem(t, testGeometryFrame(t, "link", "box")),
	})

	test.That(t, err, test.ShouldWrap, ErrVisualizerNotRunning)
}

func TestDrawFrameSystemWrapsRPCFailures(t *testing.T) {
	fake := startFake(t)
	fake.errs["AddEntities"] = errRPCBoom

	_, err := DrawFrameSystem(DrawFrameSystemOptions{
		FrameSystem: testFrameSystem(t, testGeometryFrame(t, "link", "box")),
		Inputs:      referenceframe.FrameSystemInputs{},
	})

	test.That(t, err, test.ShouldNotBeNil)
	test.That(t, err.Error(), test.ShouldContainSubstring, "AddEntities RPC failed")
}
