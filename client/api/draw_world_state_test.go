package api

import (
	"testing"

	"github.com/viamrobotics/visualization/draw"
	"go.viam.com/rdk/referenceframe"
	"go.viam.com/test"
)

func testWorldState(t *testing.T, labels ...string) *referenceframe.WorldState {
	t.Helper()
	worldState, err := referenceframe.NewWorldState(
		[]*referenceframe.GeometriesInFrame{testGeometriesInFrame(t, "world", labels...)},
		nil,
	)
	test.That(t, err, test.ShouldBeNil)
	return worldState
}

func TestDrawWorldStateEmitsOneTransformPerObstacle(t *testing.T) {
	fake := startFake(t)

	uuids, err := DrawWorldState(DrawWorldStateOptions{
		WorldState: testWorldState(t, "obstacle-a", "obstacle-b"),
	})
	test.That(t, err, test.ShouldBeNil)

	test.That(t, fake.addEntities, test.ShouldHaveLength, 1)
	test.That(t, fake.addEntities[0].GetEntities(), test.ShouldHaveLength, 2)
	test.That(t, uuids, test.ShouldHaveLength, 2)
}

// The empty case is the interesting branch: rather than falling back to a single
// default color, it asks ChromaticColorChooser for one color per obstacle.
func TestDrawWorldStateColorBranches(t *testing.T) {
	red := draw.ColorFromRGB(255, 0, 0)
	green := draw.ColorFromRGB(0, 255, 0)

	for _, tc := range []struct {
		name   string
		colors []draw.Color
	}{
		{name: "empty cycles the chromatic chooser", colors: nil},
		{name: "one color is shared", colors: []draw.Color{red}},
		{name: "one color per obstacle", colors: []draw.Color{red, green, red}},
		{name: "a shorter palette cycles", colors: []draw.Color{red, green}},
	} {
		t.Run(tc.name, func(t *testing.T) {
			fake := startFake(t)

			_, err := DrawWorldState(DrawWorldStateOptions{
				WorldState: testWorldState(t, "a", "b", "c"),
				Colors:     tc.colors,
			})
			test.That(t, err, test.ShouldBeNil)

			test.That(t, fake.addEntities[0].GetEntities(), test.ShouldHaveLength, 3)
		})
	}
}

func TestDrawWorldStateIDNamespacesTheBatch(t *testing.T) {
	uuidFor := func(t *testing.T, id string) []byte {
		t.Helper()
		fake := startFake(t)
		_, err := DrawWorldState(DrawWorldStateOptions{
			ID:         id,
			WorldState: testWorldState(t, "shared"),
		})
		test.That(t, err, test.ShouldBeNil)
		return fake.addEntities[0].GetEntities()[0].GetTransform().GetUuid()
	}

	var noID, withID []byte
	t.Run("no id", func(t *testing.T) { noID = uuidFor(t, "") })
	t.Run("scene-a", func(t *testing.T) { withID = uuidFor(t, "scene-a") })

	test.That(t, withID, test.ShouldNotResemble, noID)
}

func TestDrawWorldStateRequiresAVisualizer(t *testing.T) {
	requireNoServer(t)

	_, err := DrawWorldState(DrawWorldStateOptions{WorldState: testWorldState(t, "a")})

	test.That(t, err, test.ShouldWrap, ErrVisualizerNotRunning)
}

// A nil WorldState is handled rather than dereferenced, which is the opposite of
// DrawGeometry and DrawGeometriesInFrame. See TestNilRequiredArgumentsPanic.
func TestDrawWorldStateToleratesANilWorldState(t *testing.T) {
	fake := startFake(t)

	uuids, err := DrawWorldState(DrawWorldStateOptions{})

	test.That(t, err, test.ShouldBeNil)
	test.That(t, uuids, test.ShouldBeEmpty)
	fake.mu.Lock()
	defer fake.mu.Unlock()
	test.That(t, fake.addEntities, test.ShouldBeEmpty)
}

func TestDrawWorldStateWrapsRPCFailures(t *testing.T) {
	fake := startFake(t)
	fake.errs["AddEntities"] = errRPCBoom

	_, err := DrawWorldState(DrawWorldStateOptions{WorldState: testWorldState(t, "a")})

	test.That(t, err, test.ShouldNotBeNil)
	test.That(t, err.Error(), test.ShouldContainSubstring, "AddEntities RPC failed")
}
