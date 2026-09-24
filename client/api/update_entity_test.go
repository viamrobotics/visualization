package api

import (
	"testing"

	"github.com/viamrobotics/visualization/draw"
	"go.viam.com/rdk/spatialmath"
	"go.viam.com/test"
)

var entityUUID = []byte{0xaa, 0xbb, 0xcc}

func TestUpdateEntityRejectsMissingArguments(t *testing.T) {
	for _, tc := range []struct {
		name    string
		options UpdateEntityOptions
		wantMsg string
	}{
		{
			name:    "a nil UUID",
			options: UpdateEntityOptions{Update: &draw.TransformUpdate{Parent: "world"}},
			wantMsg: "UUID is required",
		},
		{
			name: "an empty UUID",
			options: UpdateEntityOptions{
				UUID:   []byte{},
				Update: &draw.TransformUpdate{Parent: "world"},
			},
			wantMsg: "UUID is required",
		},
		{
			name:    "a nil Update",
			options: UpdateEntityOptions{UUID: entityUUID},
			wantMsg: "Update is required",
		},
	} {
		t.Run(tc.name, func(t *testing.T) {
			fake := startFake(t)

			err := UpdateEntity(tc.options)

			test.That(t, err, test.ShouldNotBeNil)
			test.That(t, err.Error(), test.ShouldContainSubstring, tc.wantMsg)
			test.That(t, fake.updateEntity, test.ShouldBeEmpty)
		})
	}
}

// Both argument checks run before the client lookup, so a caller with a bug
// hears about the bug rather than about the visualizer.
func TestUpdateEntityValidatesBeforeReachingTheClient(t *testing.T) {
	requireNoServer(t)

	err := UpdateEntity(UpdateEntityOptions{})

	test.That(t, err, test.ShouldNotBeNil)
	test.That(t, err.Error(), test.ShouldContainSubstring, "UUID is required")
}

// An empty update would send an empty mask, which the service reads as "replace
// every field". The error comes from draw's ApplyTo and is passed through
// unwrapped.
func TestUpdateEntityRejectsAnUpdateThatSetsNothing(t *testing.T) {
	fake := startFake(t)

	err := UpdateEntity(UpdateEntityOptions{
		UUID:   entityUUID,
		Update: &draw.TransformUpdate{},
	})

	test.That(t, err, test.ShouldWrap, draw.ErrEmptyTransformUpdate)
	test.That(t, fake.updateEntity, test.ShouldBeEmpty)
}

func TestUpdateEntitySendsTheUUIDAndAMask(t *testing.T) {
	fake := startFake(t)

	err := UpdateEntity(UpdateEntityOptions{
		UUID:   entityUUID,
		Update: &draw.TransformUpdate{Parent: "arm-1"},
	})
	test.That(t, err, test.ShouldBeNil)

	test.That(t, fake.updateEntity, test.ShouldHaveLength, 1)
	req := fake.updateEntity[0]
	test.That(t, req.GetUuid(), test.ShouldResemble, entityUUID)
	test.That(t, req.GetUpdatedFields(), test.ShouldNotBeNil)
	test.That(t, req.GetUpdatedFields().GetPaths(), test.ShouldNotBeEmpty)
}

// The mask is derived from which fields the update sets, so a caller never
// writes proto field paths. A move and a reparent select different paths, and
// selecting the whole pose_in_observer_frame would rewrite the other one.
func TestUpdateEntityDerivesTheMaskFromTheUpdate(t *testing.T) {
	movedPose := spatialmath.NewPoseFromPoint(spatialmath.NewZeroPose().Point())

	for _, tc := range []struct {
		name   string
		update draw.EntityUpdate
	}{
		{name: "a pose only", update: &draw.TransformUpdate{Pose: movedPose}},
		{name: "a parent only", update: &draw.TransformUpdate{Parent: "arm-1"}},
		{
			name:   "a pose and a parent",
			update: &draw.TransformUpdate{Pose: movedPose, Parent: "arm-1"},
		},
	} {
		t.Run(tc.name, func(t *testing.T) {
			fake := startFake(t)

			err := UpdateEntity(UpdateEntityOptions{UUID: entityUUID, Update: tc.update})
			test.That(t, err, test.ShouldBeNil)

			paths := fake.updateEntity[0].GetUpdatedFields().GetPaths()
			test.That(t, paths, test.ShouldNotBeEmpty)
			// Never the whole subtree: that would rewrite the sibling field.
			test.That(t, paths, test.ShouldNotContain, "transform.pose_in_observer_frame")
		})
	}
}

// A pose-only move and a reparent must not produce the same mask, or one of them
// is silently overwriting the other's field.
func TestUpdateEntityMasksDifferByIntent(t *testing.T) {
	pathsFor := func(t *testing.T, update draw.EntityUpdate) []string {
		t.Helper()
		fake := startFake(t)
		test.That(
			t,
			UpdateEntity(UpdateEntityOptions{UUID: entityUUID, Update: update}),
			test.ShouldBeNil,
		)
		return fake.updateEntity[0].GetUpdatedFields().GetPaths()
	}

	var posePaths, parentPaths []string
	t.Run("pose only", func(t *testing.T) {
		posePaths = pathsFor(t, &draw.TransformUpdate{Pose: spatialmath.NewZeroPose()})
	})
	t.Run("parent only", func(t *testing.T) {
		parentPaths = pathsFor(t, &draw.TransformUpdate{Parent: "arm-1"})
	})

	test.That(t, posePaths, test.ShouldNotBeEmpty)
	test.That(t, parentPaths, test.ShouldNotBeEmpty)
	test.That(t, posePaths, test.ShouldNotResemble, parentPaths)
}

func TestUpdateEntityWrapsRPCFailures(t *testing.T) {
	fake := startFake(t)
	fake.errs["UpdateEntity"] = errRPCBoom

	err := UpdateEntity(UpdateEntityOptions{
		UUID:   entityUUID,
		Update: &draw.TransformUpdate{Parent: "arm-1"},
	})

	test.That(t, err, test.ShouldNotBeNil)
	test.That(t, err.Error(), test.ShouldContainSubstring, "UpdateEntity RPC failed")
}

func TestUpdateEntityRequiresAVisualizer(t *testing.T) {
	requireNoServer(t)

	err := UpdateEntity(UpdateEntityOptions{
		UUID:   entityUUID,
		Update: &draw.TransformUpdate{Parent: "arm-1"},
	})

	test.That(t, err, test.ShouldWrap, ErrVisualizerNotRunning)
}

// UpdateTransform and UpdateDrawing are shorthands that forward to UpdateEntity,
// so the only thing to prove is that they forward both arguments.
func TestUpdateTransformForwardsToUpdateEntity(t *testing.T) {
	fake := startFake(t)

	err := UpdateTransform(UpdateTransformOptions{
		UUID:   entityUUID,
		Update: draw.TransformUpdate{Parent: "arm-1"},
	})
	test.That(t, err, test.ShouldBeNil)

	test.That(t, fake.updateEntity, test.ShouldHaveLength, 1)
	test.That(t, fake.updateEntity[0].GetUuid(), test.ShouldResemble, entityUUID)
}

func TestUpdateDrawingForwardsToUpdateEntity(t *testing.T) {
	fake := startFake(t)

	err := UpdateDrawing(UpdateDrawingOptions{
		UUID:   entityUUID,
		Update: draw.DrawingUpdate{Parent: "arm-1"},
	})
	test.That(t, err, test.ShouldBeNil)

	test.That(t, fake.updateEntity, test.ShouldHaveLength, 1)
	test.That(t, fake.updateEntity[0].GetUuid(), test.ShouldResemble, entityUUID)
}

func TestUpdateShorthandsInheritTheUUIDCheck(t *testing.T) {
	fake := startFake(t)

	test.That(
		t,
		UpdateTransform(UpdateTransformOptions{Update: draw.TransformUpdate{Parent: "w"}}),
		test.ShouldNotBeNil,
	)
	test.That(
		t,
		UpdateDrawing(UpdateDrawingOptions{Update: draw.DrawingUpdate{Parent: "w"}}),
		test.ShouldNotBeNil,
	)
	test.That(t, fake.updateEntity, test.ShouldBeEmpty)
}

// The shorthands take Update by value, so an omitted one lands in UpdateEntity's
// interface field as a non-nil zero value. That skips the "Update is required"
// branch and surfaces as the empty-update error from draw instead. Same
// rejection, different message.
func TestUpdateShorthandsReportAnOmittedUpdateAsEmpty(t *testing.T) {
	t.Run("transform", func(t *testing.T) {
		fake := startFake(t)

		err := UpdateTransform(UpdateTransformOptions{UUID: entityUUID})

		test.That(t, err, test.ShouldWrap, draw.ErrEmptyTransformUpdate)
		test.That(t, fake.updateEntity, test.ShouldBeEmpty)
	})

	t.Run("drawing", func(t *testing.T) {
		fake := startFake(t)

		err := UpdateDrawing(UpdateDrawingOptions{UUID: entityUUID})

		test.That(t, err, test.ShouldNotBeNil)
		test.That(t, fake.updateEntity, test.ShouldBeEmpty)
	})
}
