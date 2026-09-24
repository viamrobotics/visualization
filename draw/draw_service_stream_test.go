package draw

import (
	"context"
	"fmt"
	"testing"
	"time"

	"connectrpc.com/connect"
	commonv1 "go.viam.com/api/common/v1"
	"go.viam.com/test"
	"google.golang.org/protobuf/proto"
	"google.golang.org/protobuf/types/known/fieldmaskpb"

	"github.com/google/uuid"
	drawv1 "github.com/viamrobotics/visualization/draw/v1"
	"github.com/viamrobotics/visualization/draw/v1/drawv1connect"
)

func waitFor(t *testing.T, timeout time.Duration, message string, condition func() bool) {
	t.Helper()
	deadline := time.After(timeout)
	for {
		if condition() {
			return
		}
		select {
		case <-deadline:
			t.Fatal(message)
		case <-time.After(10 * time.Millisecond):
		}
	}
}

func addTestTransforms(t *testing.T, client drawv1connect.DrawServiceClient, n int) {
	t.Helper()
	entities := make([]*drawv1.AddEntityRequest, 0, n)
	for i := range n {
		entities = append(entities, &drawv1.AddEntityRequest{
			Entity: &drawv1.AddEntityRequest_Transform{Transform: sampleTransform(fmt.Sprintf("frame-%d", i))},
		})
	}
	_, err := client.AddEntities(context.Background(), connect.NewRequest(&drawv1.AddEntitiesRequest{
		Entities: entities,
	}))
	test.That(t, err, test.ShouldBeNil)
}

// A client that disconnects while the on-connect replay is still being sent must not leave its
// subscriber registered. A leaked subscriber has nobody draining it, so it accumulates every
// later change and (before the queue rewrite) logged a dropped-change warning on every mutation
// for the lifetime of the process.
func TestDrawService_SubscriberRemovedWhenReplayFails(t *testing.T) {
	svc := NewDrawService(t.TempDir())
	client := newTestServer(t, svc)

	// The replay has to be large enough that it cannot drain into the connection's buffers, so
	// the server is still mid-send when the client goes away. That is the case this guards: a
	// replay that completes registers the cleanup either way.
	const entityCount = 200
	entities := make([]*drawv1.AddEntityRequest, 0, entityCount)
	for i := range entityCount {
		drawing := sampleDrawing(fmt.Sprintf("bulky-%d", i))
		drawing.PhysicalObject = &drawv1.Shape{
			GeometryType: &drawv1.Shape_Points{
				Points: &drawv1.Points{Positions: make([]byte, 256*1024)},
			},
		}
		entities = append(entities, &drawv1.AddEntityRequest{
			Entity: &drawv1.AddEntityRequest_Drawing{Drawing: drawing},
		})
	}
	_, err := client.AddEntities(context.Background(), connect.NewRequest(&drawv1.AddEntitiesRequest{
		Entities: entities,
	}))
	test.That(t, err, test.ShouldBeNil)

	ctx, cancel := context.WithCancel(context.Background())
	stream, err := client.StreamEntityChanges(ctx, connect.NewRequest(&drawv1.StreamEntityChangesRequest{}))
	test.That(t, err, test.ShouldBeNil)
	waitForEntitySubs(t, svc, 1)

	// Walk away without draining the replay.
	cancel()
	_ = stream.Close()

	waitFor(t, 10*time.Second, "subscriber leaked after the client abandoned the replay", func() bool {
		svc.mu.RLock()
		defer svc.mu.RUnlock()
		return len(svc.entitySubs) == 0
	})
}

// Clearing and repopulating a large scene used to overflow a fixed-size buffer and silently
// discard changes, which permanently desynced the consumer: a lost REMOVED left a ghost the
// server would never mention again.
func TestDrawService_NoChangesLostUnderBurst(t *testing.T) {
	svc := NewDrawService(t.TempDir())
	client := newTestServer(t, svc)

	const entityCount = 500

	// Populate before subscribing: the replay is what flushes the stream's headers, so a
	// subscriber to an empty store would block until the first later change.
	addTestTransforms(t, client, entityCount)

	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	stream, err := client.StreamEntityChanges(ctx, connect.NewRequest(&drawv1.StreamEntityChangesRequest{}))
	test.That(t, err, test.ShouldBeNil)
	waitForEntitySubs(t, svc, 1)
	drainSnapshot(t, stream, entityCount)

	_, err = client.RemoveAll(context.Background(), connect.NewRequest(&drawv1.RemoveAllRequest{}))
	test.That(t, err, test.ShouldBeNil)
	addTestTransforms(t, client, entityCount)

	// One bulk-clear event, then entityCount adds.
	var added, cleared int
	for added+cleared < entityCount+1 {
		test.That(t, stream.Receive(), test.ShouldBeTrue)
		msg := stream.Msg()
		if msg.GetClearedScope() != drawv1.EntityScope_ENTITY_SCOPE_UNSPECIFIED {
			cleared++
			continue
		}
		added++
	}

	test.That(t, cleared, test.ShouldEqual, 1)
	test.That(t, added, test.ShouldEqual, entityCount)
}

func TestDrawService_RemoveAllEmitsSingleClearEvent(t *testing.T) {
	for _, tc := range []struct {
		name  string
		call  func(client drawv1connect.DrawServiceClient) error
		scope drawv1.EntityScope
	}{
		{
			name: "RemoveAll",
			call: func(client drawv1connect.DrawServiceClient) error {
				_, err := client.RemoveAll(context.Background(), connect.NewRequest(&drawv1.RemoveAllRequest{}))
				return err
			},
			scope: drawv1.EntityScope_ENTITY_SCOPE_ALL,
		},
		{
			name: "RemoveAllTransforms",
			call: func(client drawv1connect.DrawServiceClient) error {
				_, err := client.RemoveAllTransforms(context.Background(), connect.NewRequest(&drawv1.RemoveAllTransformsRequest{}))
				return err
			},
			scope: drawv1.EntityScope_ENTITY_SCOPE_TRANSFORMS,
		},
		{
			name: "RemoveAllDrawings",
			call: func(client drawv1connect.DrawServiceClient) error {
				_, err := client.RemoveAllDrawings(context.Background(), connect.NewRequest(&drawv1.RemoveAllDrawingsRequest{}))
				return err
			},
			scope: drawv1.EntityScope_ENTITY_SCOPE_DRAWINGS,
		},
	} {
		t.Run(tc.name, func(t *testing.T) {
			svc := NewDrawService(t.TempDir())
			client := newTestServer(t, svc)

			addTestTransforms(t, client, 10)

			ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
			defer cancel()

			stream, err := client.StreamEntityChanges(ctx, connect.NewRequest(&drawv1.StreamEntityChangesRequest{}))
			test.That(t, err, test.ShouldBeNil)
			waitForEntitySubs(t, svc, 1)
			drainSnapshot(t, stream, 10)

			test.That(t, tc.call(client), test.ShouldBeNil)

			test.That(t, stream.Receive(), test.ShouldBeTrue)
			msg := stream.Msg()
			test.That(t, msg.GetClearedScope(), test.ShouldEqual, tc.scope)
			test.That(t, msg.GetChangeType(), test.ShouldEqual, drawv1.EntityChangeType_ENTITY_CHANGE_TYPE_REMOVED)
			test.That(t, msg.GetTransform(), test.ShouldBeNil)
			test.That(t, msg.GetDrawing(), test.ShouldBeNil)
		})
	}
}

// A published message is queued by pointer and may be marshalled long after the RPC that
// produced it returned, so later mutations must not reach into it.
func TestDrawService_PublishedEntitiesAreNotMutatedInPlace(t *testing.T) {
	svc := NewDrawService(t.TempDir())
	client := newTestServer(t, svc)

	sourceUUID, targetUUID := addTransformAndDrawing(t, client)

	svc.mu.Lock()
	_, sub := svc.addEntitySub()
	svc.mu.Unlock()

	_, err := client.CreateRelationship(context.Background(), connect.NewRequest(&drawv1.CreateRelationshipRequest{
		SourceUuid: sourceUUID,
		Relationship: &drawv1.Relationship{
			TargetUuid:   targetUUID,
			IndexMapping: proto.String("index * 3"),
		},
	}))
	test.That(t, err, test.ShouldBeNil)

	queued, _, _ := sub.take()
	test.That(t, len(queued), test.ShouldBeGreaterThan, 0)
	captured := queued[len(queued)-1].GetTransform()
	test.That(t, captured, test.ShouldNotBeNil)
	before := RelationshipsFromStruct(captured.GetMetadata())
	test.That(t, before, test.ShouldHaveLength, 1)

	_, err = client.DeleteRelationship(context.Background(), connect.NewRequest(&drawv1.DeleteRelationshipRequest{
		SourceUuid: sourceUUID,
		TargetUuid: targetUUID,
	}))
	test.That(t, err, test.ShouldBeNil)

	after := RelationshipsFromStruct(captured.GetMetadata())
	test.That(t, after, test.ShouldHaveLength, 1)
}

// Cascading a bulk removal must be one pass over the store rather than one pass per removed
// entity, otherwise removing N entities that M sources reference publishes N*M updates.
func TestDrawService_CascadeIsSinglePass(t *testing.T) {
	svc := NewDrawService(t.TempDir())
	client := newTestServer(t, svc)

	const sources = 3
	const targets = 4

	targetUUIDs := make([][]byte, 0, targets)
	for i := range targets {
		resp, err := client.AddEntity(context.Background(), connect.NewRequest(&drawv1.AddEntityRequest{
			Entity: &drawv1.AddEntityRequest_Drawing{Drawing: sampleDrawing(fmt.Sprintf("target-%d", i))},
		}))
		test.That(t, err, test.ShouldBeNil)
		targetUUIDs = append(targetUUIDs, resp.Msg.GetUuid())
	}

	for i := range sources {
		resp, err := client.AddEntity(context.Background(), connect.NewRequest(&drawv1.AddEntityRequest{
			Entity: &drawv1.AddEntityRequest_Transform{Transform: sampleTransform(fmt.Sprintf("source-%d", i))},
		}))
		test.That(t, err, test.ShouldBeNil)
		for _, targetUUID := range targetUUIDs {
			_, err = client.CreateRelationship(context.Background(), connect.NewRequest(&drawv1.CreateRelationshipRequest{
				SourceUuid:   resp.Msg.GetUuid(),
				Relationship: &drawv1.Relationship{TargetUuid: targetUUID},
			}))
			test.That(t, err, test.ShouldBeNil)
		}
	}

	svc.mu.Lock()
	_, sub := svc.addEntitySub()
	svc.mu.Unlock()

	_, err := client.RemoveAllDrawings(context.Background(), connect.NewRequest(&drawv1.RemoveAllDrawingsRequest{}))
	test.That(t, err, test.ShouldBeNil)

	queued, _, _ := sub.take()
	var updates int
	for _, msg := range queued {
		if msg.GetChangeType() == drawv1.EntityChangeType_ENTITY_CHANGE_TYPE_UPDATED {
			updates++
		}
	}
	test.That(t, updates, test.ShouldEqual, sources)
}

func TestDrawService_NotifyNilChangeIsIgnored(t *testing.T) {
	svc := NewDrawService(t.TempDir())

	svc.mu.Lock()
	_, sub := svc.addEntitySub()
	svc.notifyEntityChange(nil)
	svc.mu.Unlock()

	msgs, _, _ := sub.take()
	test.That(t, msgs, test.ShouldHaveLength, 0)
}

func TestDrawService_AddEntities(t *testing.T) {
	t.Run("AssignsUUIDsInRequestOrder", func(t *testing.T) {
		svc := NewDrawService(t.TempDir())
		client := newTestServer(t, svc)

		resp, err := client.AddEntities(context.Background(), connect.NewRequest(&drawv1.AddEntitiesRequest{
			Entities: []*drawv1.AddEntityRequest{
				{Entity: &drawv1.AddEntityRequest_Transform{Transform: sampleTransform("a")}},
				{Entity: &drawv1.AddEntityRequest_Drawing{Drawing: sampleDrawing("b")}},
			},
		}))
		test.That(t, err, test.ShouldBeNil)
		test.That(t, resp.Msg.GetUuids(), test.ShouldHaveLength, 2)

		svc.mu.RLock()
		defer svc.mu.RUnlock()
		test.That(t, svc.entities, test.ShouldHaveLength, 2)
	})

	t.Run("EmptyBatchReturnsInvalidArgument", func(t *testing.T) {
		svc := NewDrawService(t.TempDir())
		client := newTestServer(t, svc)

		_, err := client.AddEntities(context.Background(), connect.NewRequest(&drawv1.AddEntitiesRequest{}))
		test.That(t, connect.CodeOf(err), test.ShouldEqual, connect.CodeInvalidArgument)
	})

	t.Run("MalformedEntityReturnsInvalidArgument", func(t *testing.T) {
		svc := NewDrawService(t.TempDir())
		client := newTestServer(t, svc)

		_, err := client.AddEntities(context.Background(), connect.NewRequest(&drawv1.AddEntitiesRequest{
			Entities: []*drawv1.AddEntityRequest{
				{Entity: &drawv1.AddEntityRequest_Transform{Transform: sampleTransform("ok")}},
				{},
			},
		}))
		test.That(t, connect.CodeOf(err), test.ShouldEqual, connect.CodeInvalidArgument)
	})

	t.Run("PublishesOneEventPerEntity", func(t *testing.T) {
		svc := NewDrawService(t.TempDir())
		client := newTestServer(t, svc)

		svc.mu.Lock()
		_, sub := svc.addEntitySub()
		svc.mu.Unlock()

		_, err := client.AddEntities(context.Background(), connect.NewRequest(&drawv1.AddEntitiesRequest{
			Entities: []*drawv1.AddEntityRequest{
				{Entity: &drawv1.AddEntityRequest_Transform{Transform: sampleTransform("a")}},
				{Entity: &drawv1.AddEntityRequest_Transform{Transform: sampleTransform("b")}},
			},
		}))
		test.That(t, err, test.ShouldBeNil)

		msgs, _, _ := sub.take()
		test.That(t, frameNames(msgs), test.ShouldResemble, []string{"a", "b"})
	})
}

func TestDrawService_UpdateEntityFieldMask(t *testing.T) {
	setup := func(t *testing.T) (drawv1connect.DrawServiceClient, []byte) {
		t.Helper()
		svc := NewDrawService(t.TempDir())
		client := newTestServer(t, svc)
		resp, err := client.AddEntity(context.Background(), connect.NewRequest(&drawv1.AddEntityRequest{
			Entity: &drawv1.AddEntityRequest_Transform{Transform: sampleTransform("original")},
		}))
		test.That(t, err, test.ShouldBeNil)
		return client, resp.Msg.GetUuid()
	}

	// A mask naming a field that does not exist would otherwise apply nothing while reporting
	// success. The proto field name is snake_case and matches neither the Go name
	// (PoseInObserverFrame) nor the JSON name (poseInObserverFrame), so this is easy to hit.
	t.Run("UnknownPathReturnsInvalidArgument", func(t *testing.T) {
		for _, path := range []string{"PoseInObserverFrame", "poseInObserverFrame", "pose"} {
			client, id := setup(t)
			_, err := client.UpdateEntity(context.Background(), connect.NewRequest(&drawv1.UpdateEntityRequest{
				Uuid:          id,
				Entity:        &drawv1.UpdateEntityRequest_Transform{Transform: &commonv1.Transform{}},
				UpdatedFields: &fieldmaskpb.FieldMask{Paths: []string{path}},
			}))
			test.That(t, connect.CodeOf(err), test.ShouldEqual, connect.CodeInvalidArgument)
			test.That(t, err.Error(), test.ShouldContainSubstring, path)
		}
	})

	t.Run("UnknownNestedPathReturnsInvalidArgument", func(t *testing.T) {
		client, id := setup(t)
		for _, path := range []string{
			"pose_in_observer_frame.nope",
			"reference_frame.pose", // cannot descend into a scalar
		} {
			_, err := client.UpdateEntity(context.Background(), connect.NewRequest(&drawv1.UpdateEntityRequest{
				Uuid:          id,
				Entity:        &drawv1.UpdateEntityRequest_Transform{Transform: &commonv1.Transform{}},
				UpdatedFields: &fieldmaskpb.FieldMask{Paths: []string{path}},
			}))
			test.That(t, connect.CodeOf(err), test.ShouldEqual, connect.CodeInvalidArgument)
		}
	})

	// The whole point of a nested path: change the pose without rewriting the observer frame the
	// entity is attached to.
	t.Run("NestedPathUpdatesOnlyTheNamedLeaf", func(t *testing.T) {
		svc := NewDrawService(t.TempDir())
		client := newTestServer(t, svc)

		original := sampleTransform("nested")
		original.PoseInObserverFrame = &commonv1.PoseInFrame{
			ReferenceFrame: "arm",
			Pose:           &commonv1.Pose{X: 1, Y: 2, Z: 3},
		}
		addResp, err := client.AddEntity(context.Background(), connect.NewRequest(&drawv1.AddEntityRequest{
			Entity: &drawv1.AddEntityRequest_Transform{Transform: original},
		}))
		test.That(t, err, test.ShouldBeNil)

		_, err = client.UpdateEntity(context.Background(), connect.NewRequest(&drawv1.UpdateEntityRequest{
			Uuid: addResp.Msg.GetUuid(),
			Entity: &drawv1.UpdateEntityRequest_Transform{Transform: &commonv1.Transform{
				PoseInObserverFrame: &commonv1.PoseInFrame{Pose: &commonv1.Pose{X: 90}},
			}},
			UpdatedFields: &fieldmaskpb.FieldMask{Paths: []string{TransformPathPoseValue}},
		}))
		test.That(t, err, test.ShouldBeNil)

		id, err := uuid.FromBytes(addResp.Msg.GetUuid())
		test.That(t, err, test.ShouldBeNil)
		svc.mu.RLock()
		stored := svc.entities[id]
		svc.mu.RUnlock()

		test.That(t, stored.transform.GetPoseInObserverFrame().GetPose().GetX(), test.ShouldEqual, 90)
		// Untouched, because the mask never named it.
		test.That(t, stored.transform.GetPoseInObserverFrame().GetReferenceFrame(), test.ShouldEqual, "arm")
	})

	// A nested leaf the incoming message leaves unset is a clear, per the FieldMask spec, and
	// must not take its siblings with it.
	t.Run("NestedPathClearsOnlyTheNamedLeaf", func(t *testing.T) {
		svc := NewDrawService(t.TempDir())
		client := newTestServer(t, svc)

		original := sampleDrawing("nested-drawing")
		original.Metadata = &drawv1.Metadata{
			Colors:    []byte{1, 2, 3},
			Opacities: []byte{9},
		}
		addResp, err := client.AddEntity(context.Background(), connect.NewRequest(&drawv1.AddEntityRequest{
			Entity: &drawv1.AddEntityRequest_Drawing{Drawing: original},
		}))
		test.That(t, err, test.ShouldBeNil)

		_, err = client.UpdateEntity(context.Background(), connect.NewRequest(&drawv1.UpdateEntityRequest{
			Uuid: addResp.Msg.GetUuid(),
			Entity: &drawv1.UpdateEntityRequest_Drawing{Drawing: &drawv1.Drawing{
				Metadata: &drawv1.Metadata{},
			}},
			UpdatedFields: &fieldmaskpb.FieldMask{Paths: []string{DrawingPathMetadataColors}},
		}))
		test.That(t, err, test.ShouldBeNil)

		id, err := uuid.FromBytes(addResp.Msg.GetUuid())
		test.That(t, err, test.ShouldBeNil)
		svc.mu.RLock()
		stored := svc.entities[id]
		svc.mu.RUnlock()

		test.That(t, stored.drawing.GetMetadata().GetColors(), test.ShouldBeNil)
		test.That(t, stored.drawing.GetMetadata().GetOpacities(), test.ShouldResemble, []byte{9})
	})

	// A nested pose change still has to clear the type-change guards, which read the top-level
	// fields the mask does not select.
	t.Run("NestedPathDoesNotTripTopLevelValidation", func(t *testing.T) {
		client, id := setup(t)
		_, err := client.UpdateEntity(context.Background(), connect.NewRequest(&drawv1.UpdateEntityRequest{
			Uuid: id,
			Entity: &drawv1.UpdateEntityRequest_Transform{Transform: &commonv1.Transform{
				PoseInObserverFrame: &commonv1.PoseInFrame{Pose: &commonv1.Pose{X: 5}},
			}},
			UpdatedFields: &fieldmaskpb.FieldMask{Paths: []string{TransformPathPoseValue}},
		}))
		test.That(t, err, test.ShouldBeNil)
	})

	// Validation only applies to fields the mask selects. A partial update leaves the fields it
	// is not touching unset, and reading those as an attempted rename would reject every masked
	// update unless the caller redundantly echoed them.
	t.Run("PartialUpdateNeedNotEchoUnmaskedFields", func(t *testing.T) {
		client, id := setup(t)
		_, err := client.UpdateEntity(context.Background(), connect.NewRequest(&drawv1.UpdateEntityRequest{
			Uuid: id,
			Entity: &drawv1.UpdateEntityRequest_Transform{Transform: &commonv1.Transform{
				PoseInObserverFrame: &commonv1.PoseInFrame{
					ReferenceFrame: "world",
					Pose:           &commonv1.Pose{X: 7, Y: 8, Z: 9},
				},
			}},
			UpdatedFields: &fieldmaskpb.FieldMask{Paths: []string{TransformPathPose}},
		}))
		test.That(t, err, test.ShouldBeNil)
	})

	// A masked update must not hand the stored entity a pointer into the request message.
	t.Run("DoesNotAliasRequestSubMessages", func(t *testing.T) {
		svc := NewDrawService(t.TempDir())
		client := newTestServer(t, svc)
		addResp, err := client.AddEntity(context.Background(), connect.NewRequest(&drawv1.AddEntityRequest{
			Entity: &drawv1.AddEntityRequest_Transform{Transform: sampleTransform("aliased")},
		}))
		test.That(t, err, test.ShouldBeNil)

		patch := &commonv1.Transform{
			PoseInObserverFrame: &commonv1.PoseInFrame{
				ReferenceFrame: "world",
				Pose:           &commonv1.Pose{X: 1},
			},
		}
		_, err = svc.UpdateEntity(context.Background(), connect.NewRequest(&drawv1.UpdateEntityRequest{
			Uuid:          addResp.Msg.GetUuid(),
			Entity:        &drawv1.UpdateEntityRequest_Transform{Transform: patch},
			UpdatedFields: &fieldmaskpb.FieldMask{Paths: []string{TransformPathPose}},
		}))
		test.That(t, err, test.ShouldBeNil)

		patch.PoseInObserverFrame.Pose.X = 999

		id, err := uuid.FromBytes(addResp.Msg.GetUuid())
		test.That(t, err, test.ShouldBeNil)
		svc.mu.RLock()
		stored := svc.entities[id]
		svc.mu.RUnlock()
		test.That(t, stored.transform.GetPoseInObserverFrame().GetPose().GetX(), test.ShouldEqual, 1)
	})
}
