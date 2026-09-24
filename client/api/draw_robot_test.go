package api

import (
	"context"
	"errors"
	"testing"

	"go.viam.com/rdk/referenceframe"
	"go.viam.com/rdk/robot"
	"go.viam.com/rdk/robot/framesystem"
	"go.viam.com/rdk/spatialmath"
	"go.viam.com/test"
)

// fakeRobot answers the one method DrawRobot calls on a robot and embeds the
// interface for the rest.
//
// Deliberately not testutils/inject.Robot: importing that pulls the whole RDK
// robot stack into this module's build graph, which `go mod tidy` turns into
// roughly forty new indirect requirements (pion/webrtc, gorgonia, periph.io) for
// the sake of one test file. `robot` and `robot/framesystem` are already here
// because draw_robot.go imports them, so this costs nothing.
//
// mutils.GetInputs only reaches for a resource when a frame has degrees of
// freedom, so static frames never touch the embedded nil interface.
type fakeRobot struct {
	robot.Robot
	frameSystemConfig func(context.Context) (*framesystem.Config, error)
}

func (f *fakeRobot) FrameSystemConfig(ctx context.Context) (*framesystem.Config, error) {
	return f.frameSystemConfig(ctx)
}

func robotWithParts(parts ...*referenceframe.FrameSystemPart) *fakeRobot {
	return &fakeRobot{
		frameSystemConfig: func(context.Context) (*framesystem.Config, error) {
			return &framesystem.Config{Parts: parts}, nil
		},
	}
}

func linkPart(t *testing.T, name, geometryLabel string) *referenceframe.FrameSystemPart {
	t.Helper()
	var geometry spatialmath.Geometry
	if geometryLabel != "" {
		geometry = testBox(t, geometryLabel)
	}
	return &referenceframe.FrameSystemPart{
		FrameConfig: referenceframe.NewLinkInFrame(
			referenceframe.World,
			spatialmath.NewZeroPose(),
			name,
			geometry,
		),
	}
}

func TestDrawRobotDrawsFrameSystemGeometries(t *testing.T) {
	fake := startFake(t)

	uuids, err := DrawRobot(DrawRobotOptions{
		Ctx:   context.Background(),
		Robot: robotWithParts(linkPart(t, "link-1", "box-1")),
	})
	test.That(t, err, test.ShouldBeNil)

	test.That(t, uuids, test.ShouldNotBeEmpty)
	fake.mu.Lock()
	defer fake.mu.Unlock()
	test.That(t, fake.addEntities, test.ShouldNotBeEmpty)
}

// Each sub-call gets an ID derived from the prefix, so two robots in one scene
// do not collide on shared geometry labels.
func TestDrawRobotIDNamespacesEveryEntity(t *testing.T) {
	// The uuids DrawRobot returns come from the server, so identity has to be
	// read off the transforms it sent rather than the values it got back.
	sentUUIDFor := func(t *testing.T, id string) []byte {
		t.Helper()
		fake := startFake(t)
		_, err := DrawRobot(DrawRobotOptions{
			Ctx:   context.Background(),
			Robot: robotWithParts(linkPart(t, "link-1", "shared-box")),
			ID:    id,
		})
		test.That(t, err, test.ShouldBeNil)

		fake.mu.Lock()
		defer fake.mu.Unlock()
		test.That(t, fake.addEntities, test.ShouldNotBeEmpty)
		return fake.addEntities[0].GetEntities()[0].GetTransform().GetUuid()
	}

	var noID, robotA, robotB []byte
	t.Run("no id", func(t *testing.T) { noID = sentUUIDFor(t, "") })
	t.Run("robot-a", func(t *testing.T) { robotA = sentUUIDFor(t, "robot-a") })
	t.Run("robot-b", func(t *testing.T) { robotB = sentUUIDFor(t, "robot-b") })

	test.That(t, robotA, test.ShouldNotResemble, noID)
	test.That(t, robotA, test.ShouldNotResemble, robotB)
}

// A world state is optional, and drawing one issues strictly more calls.
func TestDrawRobotWorldStateIsOptional(t *testing.T) {
	countFor := func(t *testing.T, worldState *referenceframe.WorldState) int {
		t.Helper()
		fake := startFake(t)
		_, err := DrawRobot(DrawRobotOptions{
			Ctx:        context.Background(),
			Robot:      robotWithParts(linkPart(t, "link-1", "box-1")),
			WorldState: worldState,
		})
		test.That(t, err, test.ShouldBeNil)
		fake.mu.Lock()
		defer fake.mu.Unlock()
		return len(fake.addEntities)
	}

	var without, with int
	t.Run("without a world state", func(t *testing.T) { without = countFor(t, nil) })
	t.Run("with a world state", func(t *testing.T) {
		with = countFor(t, testWorldState(t, "obstacle"))
	})

	test.That(t, without, test.ShouldBeGreaterThan, 0)
	test.That(t, with, test.ShouldBeGreaterThan, without)
}

// The visualizer check precedes the robot call, so a broken robot is not what a
// caller without a visualizer hears about.
func TestDrawRobotRequiresAVisualizer(t *testing.T) {
	requireNoServer(t)

	_, err := DrawRobot(DrawRobotOptions{
		Ctx: context.Background(),
		Robot: &fakeRobot{
			frameSystemConfig: func(context.Context) (*framesystem.Config, error) {
				t.Fatal("the robot should not be reached without a visualizer")
				return nil, nil
			},
		},
	})

	test.That(t, err, test.ShouldWrap, ErrVisualizerNotRunning)
}

func TestDrawRobotWrapsAFrameSystemConfigFailure(t *testing.T) {
	fake := startFake(t)

	_, err := DrawRobot(DrawRobotOptions{
		Ctx: context.Background(),
		Robot: &fakeRobot{
			frameSystemConfig: func(context.Context) (*framesystem.Config, error) {
				return nil, errors.New("no config")
			},
		},
	})

	test.That(t, err, test.ShouldNotBeNil)
	test.That(t, err.Error(), test.ShouldContainSubstring, "failed to get frame system config")
	test.That(t, fake.addEntityCount(), test.ShouldEqual, 0)
}

func TestDrawRobotWrapsRPCFailures(t *testing.T) {
	fake := startFake(t)
	fake.errs["AddEntities"] = errRPCBoom

	_, err := DrawRobot(DrawRobotOptions{
		Ctx:   context.Background(),
		Robot: robotWithParts(linkPart(t, "link-1", "box-1")),
	})

	test.That(t, err, test.ShouldNotBeNil)
	test.That(t, err.Error(), test.ShouldContainSubstring, "frame system geometries")
}

// A robot whose links carry no geometry draws nothing and reports no error.
func TestDrawRobotWithNoGeometries(t *testing.T) {
	fake := startFake(t)

	uuids, err := DrawRobot(DrawRobotOptions{
		Ctx:   context.Background(),
		Robot: robotWithParts(linkPart(t, "bare", "")),
	})

	test.That(t, err, test.ShouldBeNil)
	test.That(t, uuids, test.ShouldBeEmpty)
	fake.mu.Lock()
	defer fake.mu.Unlock()
	test.That(t, fake.addEntities, test.ShouldBeEmpty)
}
