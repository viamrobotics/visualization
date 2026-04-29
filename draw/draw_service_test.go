package draw

import (
	"context"
	"crypto/tls"
	"net"
	"net/http"
	"net/http/httptest"
	"sync"
	"testing"
	"time"

	"connectrpc.com/connect"
	"github.com/google/uuid"
	drawv1 "github.com/viam-labs/motion-tools/draw/v1"
	"github.com/viam-labs/motion-tools/draw/v1/drawv1connect"
	commonv1 "go.viam.com/api/common/v1"
	"go.viam.com/test"
	"golang.org/x/net/http2"
	"golang.org/x/net/http2/h2c"
	"google.golang.org/protobuf/types/known/fieldmaskpb"
)

func newTestServer(t *testing.T, svc *DrawService) drawv1connect.DrawServiceClient {
	t.Helper()

	mux := http.NewServeMux()
	path, handler := drawv1connect.NewDrawServiceHandler(svc)
	mux.Handle(path, handler)

	srv := httptest.NewUnstartedServer(h2c.NewHandler(mux, &http2.Server{}))
	srv.Start()
	t.Cleanup(srv.Close)

	h2cTransport := &http2.Transport{
		AllowHTTP: true,
		DialTLSContext: func(ctx context.Context, network, addr string, _ *tls.Config) (net.Conn, error) {
			return (&net.Dialer{}).DialContext(ctx, network, addr)
		},
	}

	return drawv1connect.NewDrawServiceClient(
		&http.Client{Transport: h2cTransport},
		srv.URL,
		connect.WithGRPC(),
	)
}

func waitForEntitySubs(t *testing.T, svc *DrawService, count int) {
	t.Helper()
	deadline := time.After(2 * time.Second)
	for {
		svc.mu.RLock()
		n := len(svc.entitySubs)
		svc.mu.RUnlock()
		if n >= count {
			return
		}
		select {
		case <-deadline:
			t.Fatalf("timed out waiting for %d entity subscriber(s), got %d", count, n)
		case <-time.After(5 * time.Millisecond):
		}
	}
}

func waitForSceneSubs(t *testing.T, svc *DrawService, count int) {
	t.Helper()
	deadline := time.After(2 * time.Second)
	for {
		svc.mu.RLock()
		n := len(svc.sceneSubs)
		svc.mu.RUnlock()
		if n >= count {
			return
		}
		select {
		case <-deadline:
			t.Fatalf("timed out waiting for %d scene subscriber(s), got %d", count, n)
		case <-time.After(5 * time.Millisecond):
		}
	}
}

func sampleTransform(name string) *commonv1.Transform {
	return &commonv1.Transform{
		ReferenceFrame: name,
		PoseInObserverFrame: &commonv1.PoseInFrame{
			ReferenceFrame: "world",
			Pose: &commonv1.Pose{
				X: 1, Y: 2, Z: 3,
				OX: 0, OY: 0, OZ: 1, Theta: 0,
			},
		},
	}
}

func sampleDrawing(name string) *drawv1.Drawing {
	return &drawv1.Drawing{
		ReferenceFrame: name,
		PoseInObserverFrame: &commonv1.PoseInFrame{
			ReferenceFrame: "world",
			Pose:           &commonv1.Pose{X: 0, Y: 0, Z: 0, OX: 0, OY: 0, OZ: 1, Theta: 0},
		},
	}
}

func TestDrawService_AddEntity(t *testing.T) {
	t.Run("AddTransform", func(t *testing.T) {
		svc := NewDrawService(t.TempDir())
		client := newTestServer(t, svc)

		resp, err := client.AddEntity(context.Background(), connect.NewRequest(&drawv1.AddEntityRequest{
			Entity: &drawv1.AddEntityRequest_Transform{Transform: sampleTransform("frame-1")},
		}))
		test.That(t, err, test.ShouldBeNil)
		test.That(t, resp.Msg.GetUuid(), test.ShouldHaveLength, 16)
	})

	t.Run("AddDrawing", func(t *testing.T) {
		svc := NewDrawService(t.TempDir())
		client := newTestServer(t, svc)

		resp, err := client.AddEntity(context.Background(), connect.NewRequest(&drawv1.AddEntityRequest{
			Entity: &drawv1.AddEntityRequest_Drawing{Drawing: sampleDrawing("drawing-1")},
		}))
		test.That(t, err, test.ShouldBeNil)
		test.That(t, resp.Msg.GetUuid(), test.ShouldHaveLength, 16)
	})

	t.Run("AddMultipleEntitiesReturnsUniqueUUIDs", func(t *testing.T) {
		svc := NewDrawService(t.TempDir())
		client := newTestServer(t, svc)

		resp1, err := client.AddEntity(context.Background(), connect.NewRequest(&drawv1.AddEntityRequest{
			Entity: &drawv1.AddEntityRequest_Transform{Transform: sampleTransform("frame-1")},
		}))
		test.That(t, err, test.ShouldBeNil)

		resp2, err := client.AddEntity(context.Background(), connect.NewRequest(&drawv1.AddEntityRequest{
			Entity: &drawv1.AddEntityRequest_Transform{Transform: sampleTransform("frame-2")},
		}))
		test.That(t, err, test.ShouldBeNil)

		test.That(t, resp1.Msg.GetUuid(), test.ShouldNotResemble, resp2.Msg.GetUuid())
	})

	t.Run("NoEntityReturnsInvalidArgument", func(t *testing.T) {
		svc := NewDrawService(t.TempDir())
		client := newTestServer(t, svc)

		_, err := client.AddEntity(context.Background(), connect.NewRequest(&drawv1.AddEntityRequest{}))
		test.That(t, err, test.ShouldNotBeNil)
		test.That(t, connect.CodeOf(err), test.ShouldEqual, connect.CodeInvalidArgument)
	})

	t.Run("UpsertTransformWithExistingUUID", func(t *testing.T) {
		svc := NewDrawService(t.TempDir())
		client := newTestServer(t, svc)

		id := uuid.New()
		first := sampleTransform("original")
		first.Uuid = id[:]

		resp1, err := client.AddEntity(context.Background(), connect.NewRequest(&drawv1.AddEntityRequest{
			Entity: &drawv1.AddEntityRequest_Transform{Transform: first},
		}))
		test.That(t, err, test.ShouldBeNil)
		test.That(t, resp1.Msg.GetUuid(), test.ShouldResemble, id[:])

		second := sampleTransform("replaced")
		second.Uuid = id[:]

		resp2, err := client.AddEntity(context.Background(), connect.NewRequest(&drawv1.AddEntityRequest{
			Entity: &drawv1.AddEntityRequest_Transform{Transform: second},
		}))
		test.That(t, err, test.ShouldBeNil)
		test.That(t, resp2.Msg.GetUuid(), test.ShouldResemble, id[:])

		svc.mu.RLock()
		entityCount := len(svc.entities)
		stored := svc.entities[id]
		svc.mu.RUnlock()

		test.That(t, entityCount, test.ShouldEqual, 1)
		test.That(t, stored.transform.ReferenceFrame, test.ShouldEqual, "replaced")
	})

	t.Run("UpsertDrawingWithExistingUUID", func(t *testing.T) {
		svc := NewDrawService(t.TempDir())
		client := newTestServer(t, svc)

		id := uuid.New()
		first := sampleDrawing("original")
		first.Uuid = id[:]

		_, err := client.AddEntity(context.Background(), connect.NewRequest(&drawv1.AddEntityRequest{
			Entity: &drawv1.AddEntityRequest_Drawing{Drawing: first},
		}))
		test.That(t, err, test.ShouldBeNil)

		second := sampleDrawing("replaced")
		second.Uuid = id[:]

		resp2, err := client.AddEntity(context.Background(), connect.NewRequest(&drawv1.AddEntityRequest{
			Entity: &drawv1.AddEntityRequest_Drawing{Drawing: second},
		}))
		test.That(t, err, test.ShouldBeNil)
		test.That(t, resp2.Msg.GetUuid(), test.ShouldResemble, id[:])

		svc.mu.RLock()
		entityCount := len(svc.entities)
		stored := svc.entities[id]
		svc.mu.RUnlock()

		test.That(t, entityCount, test.ShouldEqual, 1)
		test.That(t, stored.drawing.ReferenceFrame, test.ShouldEqual, "replaced")
	})

	t.Run("UpsertEmitsAddedThenUpdated", func(t *testing.T) {
		svc := NewDrawService(t.TempDir())
		client := newTestServer(t, svc)

		id := uuid.New()
		transform := sampleTransform("v1")
		transform.Uuid = id[:]

		ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()

		type streamResult struct {
			stream *connect.ServerStreamForClient[drawv1.StreamEntityChangesResponse]
			err    error
		}
		sCh := make(chan streamResult, 1)
		go func() {
			s, err := client.StreamEntityChanges(ctx, connect.NewRequest(&drawv1.StreamEntityChangesRequest{}))
			sCh <- streamResult{s, err}
		}()

		waitForEntitySubs(t, svc, 1)

		_, err := client.AddEntity(context.Background(), connect.NewRequest(&drawv1.AddEntityRequest{
			Entity: &drawv1.AddEntityRequest_Transform{Transform: transform},
		}))
		test.That(t, err, test.ShouldBeNil)

		transform2 := sampleTransform("v2")
		transform2.Uuid = id[:]
		_, err = client.AddEntity(context.Background(), connect.NewRequest(&drawv1.AddEntityRequest{
			Entity: &drawv1.AddEntityRequest_Transform{Transform: transform2},
		}))
		test.That(t, err, test.ShouldBeNil)

		sr := <-sCh
		test.That(t, sr.err, test.ShouldBeNil)

		var events []*drawv1.StreamEntityChangesResponse
		for i := 0; i < 2; i++ {
			test.That(t, sr.stream.Receive(), test.ShouldBeTrue)
			events = append(events, sr.stream.Msg())
		}
		test.That(t, events, test.ShouldHaveLength, 2)
		test.That(t, events[0].ChangeType, test.ShouldEqual, drawv1.EntityChangeType_ENTITY_CHANGE_TYPE_ADDED)
		test.That(t, events[1].ChangeType, test.ShouldEqual, drawv1.EntityChangeType_ENTITY_CHANGE_TYPE_UPDATED)
	})
}

func TestDrawService_RemoveEntity(t *testing.T) {
	t.Run("RemoveExistingTransform", func(t *testing.T) {
		svc := NewDrawService(t.TempDir())
		client := newTestServer(t, svc)

		addResp, err := client.AddEntity(context.Background(), connect.NewRequest(&drawv1.AddEntityRequest{
			Entity: &drawv1.AddEntityRequest_Transform{Transform: sampleTransform("frame-1")},
		}))
		test.That(t, err, test.ShouldBeNil)

		_, err = client.RemoveEntity(context.Background(), connect.NewRequest(&drawv1.RemoveEntityRequest{
			Uuid: addResp.Msg.GetUuid(),
		}))
		test.That(t, err, test.ShouldBeNil)
	})

	t.Run("RemoveNonExistentEntityReturnsNotFound", func(t *testing.T) {
		svc := NewDrawService(t.TempDir())
		client := newTestServer(t, svc)

		id := uuid.New()
		_, err := client.RemoveEntity(context.Background(), connect.NewRequest(&drawv1.RemoveEntityRequest{
			Uuid: id[:],
		}))
		test.That(t, err, test.ShouldNotBeNil)
		test.That(t, connect.CodeOf(err), test.ShouldEqual, connect.CodeNotFound)
	})

	t.Run("MissingUUIDReturnsInvalidArgument", func(t *testing.T) {
		svc := NewDrawService(t.TempDir())
		client := newTestServer(t, svc)

		_, err := client.RemoveEntity(context.Background(), connect.NewRequest(&drawv1.RemoveEntityRequest{}))
		test.That(t, err, test.ShouldNotBeNil)
		test.That(t, connect.CodeOf(err), test.ShouldEqual, connect.CodeInvalidArgument)
	})
}

func TestDrawService_UpdateEntity(t *testing.T) {
	t.Run("FullReplaceTransform", func(t *testing.T) {
		svc := NewDrawService(t.TempDir())
		client := newTestServer(t, svc)

		addResp, err := client.AddEntity(context.Background(), connect.NewRequest(&drawv1.AddEntityRequest{
			Entity: &drawv1.AddEntityRequest_Transform{Transform: sampleTransform("original")},
		}))
		test.That(t, err, test.ShouldBeNil)

		updated := sampleTransform("original")
		updated.PoseInObserverFrame.Pose.X = 99
		_, err = client.UpdateEntity(context.Background(), connect.NewRequest(&drawv1.UpdateEntityRequest{
			Uuid:   addResp.Msg.GetUuid(),
			Entity: &drawv1.UpdateEntityRequest_Transform{Transform: updated},
		}))
		test.That(t, err, test.ShouldBeNil)

		svc.mu.RLock()
		id, parseErr := uuid.FromBytes(addResp.Msg.GetUuid())
		test.That(t, parseErr, test.ShouldBeNil)
		stored := svc.entities[id]
		svc.mu.RUnlock()
		test.That(t, stored.transform.PoseInObserverFrame.Pose.X, test.ShouldEqual, 99)
	})

	t.Run("FullReplaceDrawing", func(t *testing.T) {
		svc := NewDrawService(t.TempDir())
		client := newTestServer(t, svc)

		addResp, err := client.AddEntity(context.Background(), connect.NewRequest(&drawv1.AddEntityRequest{
			Entity: &drawv1.AddEntityRequest_Drawing{Drawing: sampleDrawing("original")},
		}))
		test.That(t, err, test.ShouldBeNil)

		updated := sampleDrawing("original")
		updated.PoseInObserverFrame.Pose.X = 42
		_, err = client.UpdateEntity(context.Background(), connect.NewRequest(&drawv1.UpdateEntityRequest{
			Uuid:   addResp.Msg.GetUuid(),
			Entity: &drawv1.UpdateEntityRequest_Drawing{Drawing: updated},
		}))
		test.That(t, err, test.ShouldBeNil)

		svc.mu.RLock()
		id, _ := uuid.FromBytes(addResp.Msg.GetUuid())
		stored := svc.entities[id]
		svc.mu.RUnlock()
		test.That(t, stored.drawing.ReferenceFrame, test.ShouldEqual, "original")
		test.That(t, stored.drawing.PoseInObserverFrame.Pose.X, test.ShouldEqual, 42)
	})

	t.Run("PartialUpdateWithFieldMask", func(t *testing.T) {
		svc := NewDrawService(t.TempDir())
		client := newTestServer(t, svc)

		original := sampleTransform("original")
		addResp, err := client.AddEntity(context.Background(), connect.NewRequest(&drawv1.AddEntityRequest{
			Entity: &drawv1.AddEntityRequest_Transform{Transform: original},
		}))
		test.That(t, err, test.ShouldBeNil)

		patch := &commonv1.Transform{
			ReferenceFrame: "original",
			PoseInObserverFrame: &commonv1.PoseInFrame{
				ReferenceFrame: "nav",
				Pose:           &commonv1.Pose{X: 50, Y: 60, Z: 70},
			},
		}
		_, err = client.UpdateEntity(context.Background(), connect.NewRequest(&drawv1.UpdateEntityRequest{
			Uuid:          addResp.Msg.GetUuid(),
			Entity:        &drawv1.UpdateEntityRequest_Transform{Transform: patch},
			UpdatedFields: &fieldmaskpb.FieldMask{Paths: []string{"pose_in_observer_frame"}},
		}))
		test.That(t, err, test.ShouldBeNil)

		svc.mu.RLock()
		id, _ := uuid.FromBytes(addResp.Msg.GetUuid())
		stored := svc.entities[id]
		svc.mu.RUnlock()
		test.That(t, stored.transform.ReferenceFrame, test.ShouldEqual, "original")
		test.That(t, stored.transform.PoseInObserverFrame, test.ShouldNotBeNil)
		test.That(t, stored.transform.PoseInObserverFrame.Pose.X, test.ShouldEqual, 50)
	})

	t.Run("FieldMaskDoesNotLeakUnmaskedFields", func(t *testing.T) {
		svc := NewDrawService(t.TempDir())
		client := newTestServer(t, svc)

		originalPose := &commonv1.PoseInFrame{
			ReferenceFrame: "world",
			Pose:           &commonv1.Pose{X: 10, Y: 20, Z: 30, OX: 0, OY: 0, OZ: 1, Theta: 0},
		}
		original := &commonv1.Transform{
			ReferenceFrame:      "original",
			PoseInObserverFrame: originalPose,
		}
		addResp, err := client.AddEntity(context.Background(), connect.NewRequest(&drawv1.AddEntityRequest{
			Entity: &drawv1.AddEntityRequest_Transform{Transform: original},
		}))
		test.That(t, err, test.ShouldBeNil)

		incomingWithExtraFields := &commonv1.Transform{
			ReferenceFrame: "original",
			PoseInObserverFrame: &commonv1.PoseInFrame{
				ReferenceFrame: "nav",
				Pose:           &commonv1.Pose{X: 999, Y: 999, Z: 999},
			},
		}
		_, err = client.UpdateEntity(context.Background(), connect.NewRequest(&drawv1.UpdateEntityRequest{
			Uuid:          addResp.Msg.GetUuid(),
			Entity:        &drawv1.UpdateEntityRequest_Transform{Transform: incomingWithExtraFields},
			UpdatedFields: &fieldmaskpb.FieldMask{Paths: []string{"pose_in_observer_frame"}},
		}))
		test.That(t, err, test.ShouldBeNil)

		svc.mu.RLock()
		id, _ := uuid.FromBytes(addResp.Msg.GetUuid())
		stored := svc.entities[id]
		svc.mu.RUnlock()

		test.That(t, stored.transform.ReferenceFrame, test.ShouldEqual, "original")
		test.That(t, stored.transform.PoseInObserverFrame.ReferenceFrame, test.ShouldEqual, "nav")
		test.That(t, stored.transform.PoseInObserverFrame.Pose.X, test.ShouldEqual, 999)
	})

	t.Run("FieldMaskClearsFieldWhenIncomingHasItUnset", func(t *testing.T) {
		svc := NewDrawService(t.TempDir())
		client := newTestServer(t, svc)

		id := uuid.New()
		original := sampleDrawing("d1")
		original.Uuid = id[:]
		original.PhysicalObject = &drawv1.Shape{Label: "to-be-cleared"}

		_, err := client.AddEntity(context.Background(), connect.NewRequest(&drawv1.AddEntityRequest{
			Entity: &drawv1.AddEntityRequest_Drawing{Drawing: original},
		}))
		test.That(t, err, test.ShouldBeNil)

		// Incoming has no physical_object set; mask names physical_object -- it should be cleared.
		_, err = client.UpdateEntity(context.Background(), connect.NewRequest(&drawv1.UpdateEntityRequest{
			Uuid:          id[:],
			Entity:        &drawv1.UpdateEntityRequest_Drawing{Drawing: sampleDrawing("d1")},
			UpdatedFields: &fieldmaskpb.FieldMask{Paths: []string{"physical_object"}},
		}))
		test.That(t, err, test.ShouldBeNil)

		svc.mu.RLock()
		stored := svc.entities[id]
		svc.mu.RUnlock()
		test.That(t, stored.drawing.PhysicalObject, test.ShouldBeNil)
	})

	t.Run("FieldMaskOnDrawingOnlyUpdatesNamedFields", func(t *testing.T) {
		svc := NewDrawService(t.TempDir())
		client := newTestServer(t, svc)

		id := uuid.New()
		original := sampleDrawing("original-name")
		original.Uuid = id[:]
		original.PhysicalObject = &drawv1.Shape{Label: "keep-me"}

		_, err := client.AddEntity(context.Background(), connect.NewRequest(&drawv1.AddEntityRequest{
			Entity: &drawv1.AddEntityRequest_Drawing{Drawing: original},
		}))
		test.That(t, err, test.ShouldBeNil)

		incoming := sampleDrawing("original-name")
		incoming.PoseInObserverFrame = &commonv1.PoseInFrame{
			ReferenceFrame: "nav",
			Pose:           &commonv1.Pose{X: 77},
		}
		_, err = client.UpdateEntity(context.Background(), connect.NewRequest(&drawv1.UpdateEntityRequest{
			Uuid:          id[:],
			Entity:        &drawv1.UpdateEntityRequest_Drawing{Drawing: incoming},
			UpdatedFields: &fieldmaskpb.FieldMask{Paths: []string{"pose_in_observer_frame"}},
		}))
		test.That(t, err, test.ShouldBeNil)

		svc.mu.RLock()
		stored := svc.entities[id]
		svc.mu.RUnlock()
		test.That(t, stored.drawing.ReferenceFrame, test.ShouldEqual, "original-name")
		test.That(t, stored.drawing.PhysicalObject, test.ShouldNotBeNil)
		test.That(t, stored.drawing.PhysicalObject.Label, test.ShouldEqual, "keep-me")
		test.That(t, stored.drawing.PoseInObserverFrame.Pose.X, test.ShouldEqual, 77)
	})

	t.Run("TypeMismatchTransformOnDrawingReturnsInvalidArgument", func(t *testing.T) {
		svc := NewDrawService(t.TempDir())
		client := newTestServer(t, svc)

		addResp, err := client.AddEntity(context.Background(), connect.NewRequest(&drawv1.AddEntityRequest{
			Entity: &drawv1.AddEntityRequest_Drawing{Drawing: sampleDrawing("d1")},
		}))
		test.That(t, err, test.ShouldBeNil)

		_, err = client.UpdateEntity(context.Background(), connect.NewRequest(&drawv1.UpdateEntityRequest{
			Uuid:   addResp.Msg.GetUuid(),
			Entity: &drawv1.UpdateEntityRequest_Transform{Transform: sampleTransform("t1")},
		}))
		test.That(t, err, test.ShouldNotBeNil)
		test.That(t, connect.CodeOf(err), test.ShouldEqual, connect.CodeInvalidArgument)
	})

	t.Run("NonExistentUUIDReturnsNotFound", func(t *testing.T) {
		svc := NewDrawService(t.TempDir())
		client := newTestServer(t, svc)

		id := uuid.New()
		_, err := client.UpdateEntity(context.Background(), connect.NewRequest(&drawv1.UpdateEntityRequest{
			Uuid:   id[:],
			Entity: &drawv1.UpdateEntityRequest_Transform{Transform: sampleTransform("t1")},
		}))
		test.That(t, err, test.ShouldNotBeNil)
		test.That(t, connect.CodeOf(err), test.ShouldEqual, connect.CodeNotFound)
	})

	t.Run("MissingUUIDReturnsInvalidArgument", func(t *testing.T) {
		svc := NewDrawService(t.TempDir())
		client := newTestServer(t, svc)

		_, err := client.UpdateEntity(context.Background(), connect.NewRequest(&drawv1.UpdateEntityRequest{
			Entity: &drawv1.UpdateEntityRequest_Transform{Transform: sampleTransform("t1")},
		}))
		test.That(t, err, test.ShouldNotBeNil)
		test.That(t, connect.CodeOf(err), test.ShouldEqual, connect.CodeInvalidArgument)
	})
}

func TestDrawService_StreamEntityChanges(t *testing.T) {
	t.Run("ReceivesAddedEvent", func(t *testing.T) {
		svc := NewDrawService(t.TempDir())
		client := newTestServer(t, svc)

		ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()

		type streamResult struct {
			stream *connect.ServerStreamForClient[drawv1.StreamEntityChangesResponse]
			err    error
		}
		sCh := make(chan streamResult, 1)
		go func() {
			s, err := client.StreamEntityChanges(ctx, connect.NewRequest(&drawv1.StreamEntityChangesRequest{}))
			sCh <- streamResult{s, err}
		}()

		waitForEntitySubs(t, svc, 1)

		_, addErr := client.AddEntity(context.Background(), connect.NewRequest(&drawv1.AddEntityRequest{
			Entity: &drawv1.AddEntityRequest_Transform{Transform: sampleTransform("frame-1")},
		}))
		test.That(t, addErr, test.ShouldBeNil)

		sr := <-sCh
		test.That(t, sr.err, test.ShouldBeNil)

		test.That(t, sr.stream.Receive(), test.ShouldBeTrue)
		received := sr.stream.Msg()
		test.That(t, received.ChangeType, test.ShouldEqual, drawv1.EntityChangeType_ENTITY_CHANGE_TYPE_ADDED)
		test.That(t, received.GetTransform(), test.ShouldNotBeNil)
		test.That(t, received.GetTransform().ReferenceFrame, test.ShouldEqual, "frame-1")
	})

	t.Run("ReceivesRemovedEvent", func(t *testing.T) {
		svc := NewDrawService(t.TempDir())
		client := newTestServer(t, svc)

		addResp, err := client.AddEntity(context.Background(), connect.NewRequest(&drawv1.AddEntityRequest{
			Entity: &drawv1.AddEntityRequest_Transform{Transform: sampleTransform("to-remove")},
		}))
		test.That(t, err, test.ShouldBeNil)

		ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()

		type streamResult struct {
			stream *connect.ServerStreamForClient[drawv1.StreamEntityChangesResponse]
			err    error
		}
		sCh := make(chan streamResult, 1)
		go func() {
			s, err := client.StreamEntityChanges(ctx, connect.NewRequest(&drawv1.StreamEntityChangesRequest{}))
			sCh <- streamResult{s, err}
		}()

		waitForEntitySubs(t, svc, 1)

		_, removeErr := client.RemoveEntity(context.Background(), connect.NewRequest(&drawv1.RemoveEntityRequest{
			Uuid: addResp.Msg.GetUuid(),
		}))
		test.That(t, removeErr, test.ShouldBeNil)

		sr := <-sCh
		test.That(t, sr.err, test.ShouldBeNil)

		drainSnapshot(t, sr.stream, 1)

		test.That(t, sr.stream.Receive(), test.ShouldBeTrue)
		received := sr.stream.Msg()
		test.That(t, received.ChangeType, test.ShouldEqual, drawv1.EntityChangeType_ENTITY_CHANGE_TYPE_REMOVED)
	})

	t.Run("ReceivesUpdatedEvent", func(t *testing.T) {
		svc := NewDrawService(t.TempDir())
		client := newTestServer(t, svc)

		addResp, err := client.AddEntity(context.Background(), connect.NewRequest(&drawv1.AddEntityRequest{
			Entity: &drawv1.AddEntityRequest_Transform{Transform: sampleTransform("original")},
		}))
		test.That(t, err, test.ShouldBeNil)

		ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()

		type streamResult struct {
			stream *connect.ServerStreamForClient[drawv1.StreamEntityChangesResponse]
			err    error
		}
		sCh := make(chan streamResult, 1)
		go func() {
			s, err := client.StreamEntityChanges(ctx, connect.NewRequest(&drawv1.StreamEntityChangesRequest{}))
			sCh <- streamResult{s, err}
		}()

		waitForEntitySubs(t, svc, 1)

		updatedTransform := sampleTransform("original")
		updatedTransform.PoseInObserverFrame.Pose.X = 99
		_, updateErr := client.UpdateEntity(context.Background(), connect.NewRequest(&drawv1.UpdateEntityRequest{
			Uuid:   addResp.Msg.GetUuid(),
			Entity: &drawv1.UpdateEntityRequest_Transform{Transform: updatedTransform},
		}))
		test.That(t, updateErr, test.ShouldBeNil)

		sr := <-sCh
		test.That(t, sr.err, test.ShouldBeNil)

		drainSnapshot(t, sr.stream, 1)

		test.That(t, sr.stream.Receive(), test.ShouldBeTrue)
		received := sr.stream.Msg()
		test.That(t, received.ChangeType, test.ShouldEqual, drawv1.EntityChangeType_ENTITY_CHANGE_TYPE_UPDATED)
		test.That(t, received.UpdatedFields, test.ShouldBeNil)
	})

	t.Run("UpdatedFieldMaskPropagatedToStream", func(t *testing.T) {
		svc := NewDrawService(t.TempDir())
		client := newTestServer(t, svc)

		addResp, err := client.AddEntity(context.Background(), connect.NewRequest(&drawv1.AddEntityRequest{
			Entity: &drawv1.AddEntityRequest_Transform{Transform: sampleTransform("original")},
		}))
		test.That(t, err, test.ShouldBeNil)

		ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()

		type streamResult struct {
			stream *connect.ServerStreamForClient[drawv1.StreamEntityChangesResponse]
			err    error
		}
		sCh := make(chan streamResult, 1)
		go func() {
			s, err := client.StreamEntityChanges(ctx, connect.NewRequest(&drawv1.StreamEntityChangesRequest{}))
			sCh <- streamResult{s, err}
		}()

		waitForEntitySubs(t, svc, 1)

		patchedTransform := sampleTransform("original")
		patchedTransform.PoseInObserverFrame = &commonv1.PoseInFrame{
			ReferenceFrame: "nav",
			Pose:           &commonv1.Pose{X: 50},
		}
		_, updateErr := client.UpdateEntity(context.Background(), connect.NewRequest(&drawv1.UpdateEntityRequest{
			Uuid:          addResp.Msg.GetUuid(),
			Entity:        &drawv1.UpdateEntityRequest_Transform{Transform: patchedTransform},
			UpdatedFields: &fieldmaskpb.FieldMask{Paths: []string{"pose_in_observer_frame"}},
		}))
		test.That(t, updateErr, test.ShouldBeNil)

		sr := <-sCh
		test.That(t, sr.err, test.ShouldBeNil)

		drainSnapshot(t, sr.stream, 1)

		test.That(t, sr.stream.Receive(), test.ShouldBeTrue)
		received := sr.stream.Msg()
		test.That(t, received.ChangeType, test.ShouldEqual, drawv1.EntityChangeType_ENTITY_CHANGE_TYPE_UPDATED)
		test.That(t, received.UpdatedFields, test.ShouldNotBeNil)
		test.That(t, received.UpdatedFields.Paths, test.ShouldResemble, []string{"pose_in_observer_frame"})
	})

	t.Run("StreamClosesOnContextCancellation", func(t *testing.T) {
		svc := NewDrawService(t.TempDir())
		client := newTestServer(t, svc)

		ctx, cancel := context.WithCancel(context.Background())

		type streamResult struct {
			stream *connect.ServerStreamForClient[drawv1.StreamEntityChangesResponse]
			err    error
		}
		sCh := make(chan streamResult, 1)
		go func() {
			s, err := client.StreamEntityChanges(ctx, connect.NewRequest(&drawv1.StreamEntityChangesRequest{}))
			sCh <- streamResult{s, err}
		}()

		waitForEntitySubs(t, svc, 1)

		cancel()

		select {
		case sr := <-sCh:
			if sr.err != nil {
				return
			}
			test.That(t, sr.stream.Receive(), test.ShouldBeFalse)
		case <-time.After(5 * time.Second):
			t.Fatal("stream did not close within 5s after context cancellation")
		}
	})

	t.Run("MultipleSubscribersAllReceiveEvents", func(t *testing.T) {
		svc := NewDrawService(t.TempDir())
		client := newTestServer(t, svc)

		ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()

		type streamResult struct {
			stream *connect.ServerStreamForClient[drawv1.StreamEntityChangesResponse]
			err    error
		}
		sCh1 := make(chan streamResult, 1)
		sCh2 := make(chan streamResult, 1)
		go func() {
			s, err := client.StreamEntityChanges(ctx, connect.NewRequest(&drawv1.StreamEntityChangesRequest{}))
			sCh1 <- streamResult{s, err}
		}()
		go func() {
			s, err := client.StreamEntityChanges(ctx, connect.NewRequest(&drawv1.StreamEntityChangesRequest{}))
			sCh2 <- streamResult{s, err}
		}()

		waitForEntitySubs(t, svc, 2)

		_, addErr := client.AddEntity(context.Background(), connect.NewRequest(&drawv1.AddEntityRequest{
			Entity: &drawv1.AddEntityRequest_Transform{Transform: sampleTransform("broadcast")},
		}))
		test.That(t, addErr, test.ShouldBeNil)

		sr1 := <-sCh1
		test.That(t, sr1.err, test.ShouldBeNil)
		sr2 := <-sCh2
		test.That(t, sr2.err, test.ShouldBeNil)

		test.That(t, sr1.stream.Receive(), test.ShouldBeTrue)
		test.That(t, sr2.stream.Receive(), test.ShouldBeTrue)
	})
}

func TestDrawService_SetScene(t *testing.T) {
	t.Run("StoresSceneMetadata", func(t *testing.T) {
		svc := NewDrawService(t.TempDir())
		client := newTestServer(t, svc)

		meta := &drawv1.SceneMetadata{Grid: boolPtr(true)}
		_, err := client.SetScene(context.Background(), connect.NewRequest(&drawv1.SetSceneRequest{
			SceneMetadata: meta,
		}))
		test.That(t, err, test.ShouldBeNil)

		svc.mu.RLock()
		stored := svc.sceneMetadata
		svc.mu.RUnlock()
		test.That(t, stored, test.ShouldNotBeNil)
		test.That(t, stored.GetGrid(), test.ShouldBeTrue)
	})

	t.Run("MissingMetadataReturnsInvalidArgument", func(t *testing.T) {
		svc := NewDrawService(t.TempDir())
		client := newTestServer(t, svc)

		_, err := client.SetScene(context.Background(), connect.NewRequest(&drawv1.SetSceneRequest{}))
		test.That(t, err, test.ShouldNotBeNil)
		test.That(t, connect.CodeOf(err), test.ShouldEqual, connect.CodeInvalidArgument)
	})
}

func TestDrawService_StreamSceneChanges(t *testing.T) {
	t.Run("ReceivesSceneChangeEvent", func(t *testing.T) {
		svc := NewDrawService(t.TempDir())
		client := newTestServer(t, svc)

		ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()

		type streamResult struct {
			stream *connect.ServerStreamForClient[drawv1.StreamSceneChangesResponse]
			err    error
		}
		sCh := make(chan streamResult, 1)
		go func() {
			s, err := client.StreamSceneChanges(ctx, connect.NewRequest(&drawv1.StreamSceneChangesRequest{}))
			sCh <- streamResult{s, err}
		}()

		waitForSceneSubs(t, svc, 1)

		_, setErr := client.SetScene(context.Background(), connect.NewRequest(&drawv1.SetSceneRequest{
			SceneMetadata: &drawv1.SceneMetadata{Grid: boolPtr(false)},
		}))
		test.That(t, setErr, test.ShouldBeNil)

		sr := <-sCh
		test.That(t, sr.err, test.ShouldBeNil)

		test.That(t, sr.stream.Receive(), test.ShouldBeTrue)
		received := sr.stream.Msg()
		test.That(t, received.GetSceneMetadata(), test.ShouldNotBeNil)
		test.That(t, received.GetSceneMetadata().GetGrid(), test.ShouldBeFalse)
	})
}

func TestDrawService_RemoveAllTransforms(t *testing.T) {
	t.Run("RemovesOnlyTransforms", func(t *testing.T) {
		svc := NewDrawService(t.TempDir())
		client := newTestServer(t, svc)

		for i := 0; i < 3; i++ {
			_, err := client.AddEntity(context.Background(), connect.NewRequest(&drawv1.AddEntityRequest{
				Entity: &drawv1.AddEntityRequest_Transform{Transform: sampleTransform("t")},
			}))
			test.That(t, err, test.ShouldBeNil)
		}
		_, err := client.AddEntity(context.Background(), connect.NewRequest(&drawv1.AddEntityRequest{
			Entity: &drawv1.AddEntityRequest_Drawing{Drawing: sampleDrawing("d")},
		}))
		test.That(t, err, test.ShouldBeNil)

		resp, err := client.RemoveAllTransforms(context.Background(), connect.NewRequest(&drawv1.RemoveAllTransformsRequest{}))
		test.That(t, err, test.ShouldBeNil)
		test.That(t, resp.Msg.GetCount(), test.ShouldEqual, 3)

		svc.mu.RLock()
		remaining := len(svc.entities)
		svc.mu.RUnlock()
		test.That(t, remaining, test.ShouldEqual, 1)
	})

	t.Run("EmptyStoreReturnsZeroCount", func(t *testing.T) {
		svc := NewDrawService(t.TempDir())
		client := newTestServer(t, svc)

		resp, err := client.RemoveAllTransforms(context.Background(), connect.NewRequest(&drawv1.RemoveAllTransformsRequest{}))
		test.That(t, err, test.ShouldBeNil)
		test.That(t, resp.Msg.GetCount(), test.ShouldEqual, 0)
	})
}

func TestDrawService_RemoveAllDrawings(t *testing.T) {
	t.Run("RemovesOnlyDrawings", func(t *testing.T) {
		svc := NewDrawService(t.TempDir())
		client := newTestServer(t, svc)

		_, err := client.AddEntity(context.Background(), connect.NewRequest(&drawv1.AddEntityRequest{
			Entity: &drawv1.AddEntityRequest_Transform{Transform: sampleTransform("t")},
		}))
		test.That(t, err, test.ShouldBeNil)
		for i := 0; i < 2; i++ {
			_, err = client.AddEntity(context.Background(), connect.NewRequest(&drawv1.AddEntityRequest{
				Entity: &drawv1.AddEntityRequest_Drawing{Drawing: sampleDrawing("d")},
			}))
			test.That(t, err, test.ShouldBeNil)
		}

		resp, err := client.RemoveAllDrawings(context.Background(), connect.NewRequest(&drawv1.RemoveAllDrawingsRequest{}))
		test.That(t, err, test.ShouldBeNil)
		test.That(t, resp.Msg.GetCount(), test.ShouldEqual, 2)

		svc.mu.RLock()
		remaining := len(svc.entities)
		svc.mu.RUnlock()
		test.That(t, remaining, test.ShouldEqual, 1)
	})
}

func TestDrawService_RemoveAll(t *testing.T) {
	t.Run("RemovesAllEntitiesAndReturnsCounts", func(t *testing.T) {
		svc := NewDrawService(t.TempDir())
		client := newTestServer(t, svc)

		for i := 0; i < 2; i++ {
			_, err := client.AddEntity(context.Background(), connect.NewRequest(&drawv1.AddEntityRequest{
				Entity: &drawv1.AddEntityRequest_Transform{Transform: sampleTransform("t")},
			}))
			test.That(t, err, test.ShouldBeNil)
		}
		for i := 0; i < 3; i++ {
			_, err := client.AddEntity(context.Background(), connect.NewRequest(&drawv1.AddEntityRequest{
				Entity: &drawv1.AddEntityRequest_Drawing{Drawing: sampleDrawing("d")},
			}))
			test.That(t, err, test.ShouldBeNil)
		}

		resp, err := client.RemoveAll(context.Background(), connect.NewRequest(&drawv1.RemoveAllRequest{}))
		test.That(t, err, test.ShouldBeNil)
		test.That(t, resp.Msg.GetTransformCount(), test.ShouldEqual, 2)
		test.That(t, resp.Msg.GetDrawingCount(), test.ShouldEqual, 3)

		svc.mu.RLock()
		remaining := len(svc.entities)
		svc.mu.RUnlock()
		test.That(t, remaining, test.ShouldEqual, 0)
	})

	t.Run("EmptyStoreReturnsZeroCounts", func(t *testing.T) {
		svc := NewDrawService(t.TempDir())
		client := newTestServer(t, svc)

		resp, err := client.RemoveAll(context.Background(), connect.NewRequest(&drawv1.RemoveAllRequest{}))
		test.That(t, err, test.ShouldBeNil)
		test.That(t, resp.Msg.GetTransformCount(), test.ShouldEqual, 0)
		test.That(t, resp.Msg.GetDrawingCount(), test.ShouldEqual, 0)
	})
}

func TestDrawService_ConcurrentAccess(t *testing.T) {
	svc := NewDrawService(t.TempDir())
	client := newTestServer(t, svc)

	const goroutines = 20
	const opsPerGoroutine = 10

	var wg sync.WaitGroup
	for i := 0; i < goroutines; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			for j := 0; j < opsPerGoroutine; j++ {
				addResp, err := client.AddEntity(context.Background(), connect.NewRequest(&drawv1.AddEntityRequest{
					Entity: &drawv1.AddEntityRequest_Transform{Transform: sampleTransform("concurrent")},
				}))
				if err != nil {
					return
				}
				client.RemoveEntity(context.Background(), connect.NewRequest(&drawv1.RemoveEntityRequest{ //nolint:errcheck
					Uuid: addResp.Msg.GetUuid(),
				}))
			}
		}()
	}

	wg.Wait()

	svc.mu.RLock()
	remaining := len(svc.entities)
	svc.mu.RUnlock()
	test.That(t, remaining, test.ShouldEqual, 0)
}

func drainSnapshot(t *testing.T, stream *connect.ServerStreamForClient[drawv1.StreamEntityChangesResponse], n int) {
	t.Helper()
	for range n {
		test.That(t, stream.Receive(), test.ShouldBeTrue)
		test.That(t, stream.Msg().ChangeType, test.ShouldEqual, drawv1.EntityChangeType_ENTITY_CHANGE_TYPE_ADDED)
	}
}

func addTransformAndDrawing(t *testing.T, client drawv1connect.DrawServiceClient) ([]byte, []byte) {
	t.Helper()
	tResp, err := client.AddEntity(context.Background(), connect.NewRequest(&drawv1.AddEntityRequest{
		Entity: &drawv1.AddEntityRequest_Transform{Transform: sampleTransform("source")},
	}))
	test.That(t, err, test.ShouldBeNil)
	dResp, err := client.AddEntity(context.Background(), connect.NewRequest(&drawv1.AddEntityRequest{
		Entity: &drawv1.AddEntityRequest_Drawing{Drawing: sampleDrawing("target")},
	}))
	test.That(t, err, test.ShouldBeNil)
	return tResp.Msg.GetUuid(), dResp.Msg.GetUuid()
}

func TestDrawService_CreateRelationship(t *testing.T) {
	t.Run("TransformToDrawing", func(t *testing.T) {
		svc := NewDrawService(t.TempDir())
		client := newTestServer(t, svc)
		srcUUID, tgtUUID := addTransformAndDrawing(t, client)

		_, err := client.CreateRelationship(context.Background(), connect.NewRequest(&drawv1.CreateRelationshipRequest{
			SourceUuid: srcUUID,
			Relationship: &drawv1.Relationship{
				TargetUuid: tgtUUID,
				Type:       "HoverLink",
			},
		}))
		test.That(t, err, test.ShouldBeNil)

		srcID, _ := uuid.FromBytes(srcUUID)
		svc.mu.RLock()
		stored := svc.entities[srcID]
		svc.mu.RUnlock()
		rels := entityMetadataRelationships(stored)
		test.That(t, rels, test.ShouldHaveLength, 1)
		test.That(t, rels[0].Type, test.ShouldEqual, "HoverLink")
		test.That(t, rels[0].TargetUuid, test.ShouldResemble, tgtUUID)
	})

	t.Run("DrawingToTransform", func(t *testing.T) {
		svc := NewDrawService(t.TempDir())
		client := newTestServer(t, svc)
		tUUID, dUUID := addTransformAndDrawing(t, client)

		_, err := client.CreateRelationship(context.Background(), connect.NewRequest(&drawv1.CreateRelationshipRequest{
			SourceUuid: dUUID,
			Relationship: &drawv1.Relationship{
				TargetUuid: tUUID,
				Type:       "HoverLink",
			},
		}))
		test.That(t, err, test.ShouldBeNil)

		dID, _ := uuid.FromBytes(dUUID)
		svc.mu.RLock()
		stored := svc.entities[dID]
		svc.mu.RUnlock()
		rels := entityMetadataRelationships(stored)
		test.That(t, rels, test.ShouldHaveLength, 1)
		test.That(t, rels[0].TargetUuid, test.ShouldResemble, tUUID)
	})

	t.Run("DuplicateTargetReplaces", func(t *testing.T) {
		svc := NewDrawService(t.TempDir())
		client := newTestServer(t, svc)
		srcUUID, tgtUUID := addTransformAndDrawing(t, client)

		idx := "index * 2"
		_, err := client.CreateRelationship(context.Background(), connect.NewRequest(&drawv1.CreateRelationshipRequest{
			SourceUuid: srcUUID,
			Relationship: &drawv1.Relationship{
				TargetUuid:   tgtUUID,
				Type:         "HoverLink",
				IndexMapping: &idx,
			},
		}))
		test.That(t, err, test.ShouldBeNil)

		idx2 := "index * 3"
		_, err = client.CreateRelationship(context.Background(), connect.NewRequest(&drawv1.CreateRelationshipRequest{
			SourceUuid: srcUUID,
			Relationship: &drawv1.Relationship{
				TargetUuid:   tgtUUID,
				Type:         "HoverLink",
				IndexMapping: &idx2,
			},
		}))
		test.That(t, err, test.ShouldBeNil)

		srcID, _ := uuid.FromBytes(srcUUID)
		svc.mu.RLock()
		stored := svc.entities[srcID]
		svc.mu.RUnlock()
		rels := entityMetadataRelationships(stored)
		test.That(t, rels, test.ShouldHaveLength, 1)
		test.That(t, *rels[0].IndexMapping, test.ShouldEqual, "index * 3")
	})

	t.Run("MissingSourceReturnsNotFound", func(t *testing.T) {
		svc := NewDrawService(t.TempDir())
		client := newTestServer(t, svc)
		_, tgtUUID := addTransformAndDrawing(t, client)
		missingID := uuid.New()

		_, err := client.CreateRelationship(context.Background(), connect.NewRequest(&drawv1.CreateRelationshipRequest{
			SourceUuid: missingID[:],
			Relationship: &drawv1.Relationship{
				TargetUuid: tgtUUID,
				Type:       "HoverLink",
			},
		}))
		test.That(t, err, test.ShouldNotBeNil)
		test.That(t, connect.CodeOf(err), test.ShouldEqual, connect.CodeNotFound)
	})

	t.Run("MissingTargetReturnsNotFound", func(t *testing.T) {
		svc := NewDrawService(t.TempDir())
		client := newTestServer(t, svc)
		srcUUID, _ := addTransformAndDrawing(t, client)
		missingID := uuid.New()

		_, err := client.CreateRelationship(context.Background(), connect.NewRequest(&drawv1.CreateRelationshipRequest{
			SourceUuid: srcUUID,
			Relationship: &drawv1.Relationship{
				TargetUuid: missingID[:],
				Type:       "HoverLink",
			},
		}))
		test.That(t, err, test.ShouldNotBeNil)
		test.That(t, connect.CodeOf(err), test.ShouldEqual, connect.CodeNotFound)
	})

	t.Run("SelfReferenceRejected", func(t *testing.T) {
		svc := NewDrawService(t.TempDir())
		client := newTestServer(t, svc)
		srcUUID, _ := addTransformAndDrawing(t, client)

		_, err := client.CreateRelationship(context.Background(), connect.NewRequest(&drawv1.CreateRelationshipRequest{
			SourceUuid: srcUUID,
			Relationship: &drawv1.Relationship{
				TargetUuid: srcUUID,
				Type:       "HoverLink",
			},
		}))
		test.That(t, err, test.ShouldNotBeNil)
		test.That(t, connect.CodeOf(err), test.ShouldEqual, connect.CodeInvalidArgument)
	})

	t.Run("EmitsUpdatedEventWithMetadataField", func(t *testing.T) {
		svc := NewDrawService(t.TempDir())
		client := newTestServer(t, svc)
		srcUUID, tgtUUID := addTransformAndDrawing(t, client)

		ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()

		type streamResult struct {
			stream *connect.ServerStreamForClient[drawv1.StreamEntityChangesResponse]
			err    error
		}
		sCh := make(chan streamResult, 1)
		go func() {
			s, err := client.StreamEntityChanges(ctx, connect.NewRequest(&drawv1.StreamEntityChangesRequest{}))
			sCh <- streamResult{s, err}
		}()
		waitForEntitySubs(t, svc, 1)

		_, err := client.CreateRelationship(context.Background(), connect.NewRequest(&drawv1.CreateRelationshipRequest{
			SourceUuid:   srcUUID,
			Relationship: &drawv1.Relationship{TargetUuid: tgtUUID, Type: "HoverLink"},
		}))
		test.That(t, err, test.ShouldBeNil)

		sr := <-sCh
		test.That(t, sr.err, test.ShouldBeNil)

		drainSnapshot(t, sr.stream, 2)

		test.That(t, sr.stream.Receive(), test.ShouldBeTrue)
		received := sr.stream.Msg()
		test.That(t, received.ChangeType, test.ShouldEqual, drawv1.EntityChangeType_ENTITY_CHANGE_TYPE_UPDATED)
		test.That(t, received.UpdatedFields, test.ShouldNotBeNil)
		test.That(t, received.UpdatedFields.Paths, test.ShouldResemble, []string{"metadata"})
	})
}

func TestDrawService_DeleteRelationship(t *testing.T) {
	t.Run("DeleteExisting", func(t *testing.T) {
		svc := NewDrawService(t.TempDir())
		client := newTestServer(t, svc)
		srcUUID, tgtUUID := addTransformAndDrawing(t, client)

		_, err := client.CreateRelationship(context.Background(), connect.NewRequest(&drawv1.CreateRelationshipRequest{
			SourceUuid:   srcUUID,
			Relationship: &drawv1.Relationship{TargetUuid: tgtUUID, Type: "HoverLink"},
		}))
		test.That(t, err, test.ShouldBeNil)

		_, err = client.DeleteRelationship(context.Background(), connect.NewRequest(&drawv1.DeleteRelationshipRequest{
			SourceUuid: srcUUID,
			TargetUuid: tgtUUID,
		}))
		test.That(t, err, test.ShouldBeNil)

		srcID, _ := uuid.FromBytes(srcUUID)
		svc.mu.RLock()
		stored := svc.entities[srcID]
		svc.mu.RUnlock()
		rels := entityMetadataRelationships(stored)
		test.That(t, rels, test.ShouldHaveLength, 0)
	})

	t.Run("DeleteMissingRelationshipReturnsNotFound", func(t *testing.T) {
		svc := NewDrawService(t.TempDir())
		client := newTestServer(t, svc)
		srcUUID, tgtUUID := addTransformAndDrawing(t, client)

		_, err := client.DeleteRelationship(context.Background(), connect.NewRequest(&drawv1.DeleteRelationshipRequest{
			SourceUuid: srcUUID,
			TargetUuid: tgtUUID,
		}))
		test.That(t, err, test.ShouldNotBeNil)
		test.That(t, connect.CodeOf(err), test.ShouldEqual, connect.CodeNotFound)
	})
}

func TestDrawService_CascadeRelationships(t *testing.T) {
	t.Run("RemoveTargetCascadesAndEmitsUpdated", func(t *testing.T) {
		svc := NewDrawService(t.TempDir())
		client := newTestServer(t, svc)
		srcUUID, tgtUUID := addTransformAndDrawing(t, client)

		_, err := client.CreateRelationship(context.Background(), connect.NewRequest(&drawv1.CreateRelationshipRequest{
			SourceUuid:   srcUUID,
			Relationship: &drawv1.Relationship{TargetUuid: tgtUUID, Type: "HoverLink"},
		}))
		test.That(t, err, test.ShouldBeNil)

		ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()

		type streamResult struct {
			stream *connect.ServerStreamForClient[drawv1.StreamEntityChangesResponse]
			err    error
		}
		sCh := make(chan streamResult, 1)
		go func() {
			s, err := client.StreamEntityChanges(ctx, connect.NewRequest(&drawv1.StreamEntityChangesRequest{}))
			sCh <- streamResult{s, err}
		}()
		waitForEntitySubs(t, svc, 1)

		_, err = client.RemoveEntity(context.Background(), connect.NewRequest(&drawv1.RemoveEntityRequest{
			Uuid: tgtUUID,
		}))
		test.That(t, err, test.ShouldBeNil)

		sr := <-sCh
		test.That(t, sr.err, test.ShouldBeNil)

		drainSnapshot(t, sr.stream, 2)

		// First event: REMOVED for target
		test.That(t, sr.stream.Receive(), test.ShouldBeTrue)
		removed := sr.stream.Msg()
		test.That(t, removed.ChangeType, test.ShouldEqual, drawv1.EntityChangeType_ENTITY_CHANGE_TYPE_REMOVED)

		// Second event: UPDATED for source (cascade)
		test.That(t, sr.stream.Receive(), test.ShouldBeTrue)
		updated := sr.stream.Msg()
		test.That(t, updated.ChangeType, test.ShouldEqual, drawv1.EntityChangeType_ENTITY_CHANGE_TYPE_UPDATED)
		test.That(t, updated.UpdatedFields.Paths, test.ShouldResemble, []string{"metadata"})

		srcID, _ := uuid.FromBytes(srcUUID)
		svc.mu.RLock()
		stored := svc.entities[srcID]
		svc.mu.RUnlock()
		rels := entityMetadataRelationships(stored)
		test.That(t, rels, test.ShouldHaveLength, 0)
	})

	t.Run("AddEntityWithRelationshipsInMetadata", func(t *testing.T) {
		svc := NewDrawService(t.TempDir())
		client := newTestServer(t, svc)

		tgtResp, err := client.AddEntity(context.Background(), connect.NewRequest(&drawv1.AddEntityRequest{
			Entity: &drawv1.AddEntityRequest_Drawing{Drawing: sampleDrawing("target")},
		}))
		test.That(t, err, test.ShouldBeNil)

		drawing := sampleDrawing("source-with-rels")
		drawing.Metadata = &drawv1.Metadata{
			Relationships: []*drawv1.Relationship{
				{TargetUuid: tgtResp.Msg.GetUuid(), Type: "HoverLink"},
			},
		}

		srcResp, err := client.AddEntity(context.Background(), connect.NewRequest(&drawv1.AddEntityRequest{
			Entity: &drawv1.AddEntityRequest_Drawing{Drawing: drawing},
		}))
		test.That(t, err, test.ShouldBeNil)

		srcID, _ := uuid.FromBytes(srcResp.Msg.GetUuid())
		svc.mu.RLock()
		stored := svc.entities[srcID]
		svc.mu.RUnlock()
		rels := entityMetadataRelationships(stored)
		test.That(t, rels, test.ShouldHaveLength, 1)
		test.That(t, rels[0].TargetUuid, test.ShouldResemble, tgtResp.Msg.GetUuid())
	})

	t.Run("RemoveAllTransformsCascadesRelationships", func(t *testing.T) {
		svc := NewDrawService(t.TempDir())
		client := newTestServer(t, svc)
		srcUUID, tgtUUID := addTransformAndDrawing(t, client)

		// source=transform, target=drawing — rel lives on the transform
		_, err := client.CreateRelationship(context.Background(), connect.NewRequest(&drawv1.CreateRelationshipRequest{
			SourceUuid:   tgtUUID,
			Relationship: &drawv1.Relationship{TargetUuid: srcUUID, Type: "HoverLink"},
		}))
		test.That(t, err, test.ShouldBeNil)

		_, err = client.RemoveAllTransforms(context.Background(), connect.NewRequest(&drawv1.RemoveAllTransformsRequest{}))
		test.That(t, err, test.ShouldBeNil)

		// drawing that referenced the removed transform must have its relationship cleared
		dID, _ := uuid.FromBytes(tgtUUID)
		svc.mu.RLock()
		stored := svc.entities[dID]
		svc.mu.RUnlock()
		rels := entityMetadataRelationships(stored)
		test.That(t, rels, test.ShouldHaveLength, 0)
	})

	t.Run("RemoveAllDrawingsCascadesRelationships", func(t *testing.T) {
		svc := NewDrawService(t.TempDir())
		client := newTestServer(t, svc)
		srcUUID, tgtUUID := addTransformAndDrawing(t, client)

		// source=transform, target=drawing
		_, err := client.CreateRelationship(context.Background(), connect.NewRequest(&drawv1.CreateRelationshipRequest{
			SourceUuid:   srcUUID,
			Relationship: &drawv1.Relationship{TargetUuid: tgtUUID, Type: "HoverLink"},
		}))
		test.That(t, err, test.ShouldBeNil)

		_, err = client.RemoveAllDrawings(context.Background(), connect.NewRequest(&drawv1.RemoveAllDrawingsRequest{}))
		test.That(t, err, test.ShouldBeNil)

		// transform that referenced the removed drawing must have its relationship cleared
		tID, _ := uuid.FromBytes(srcUUID)
		svc.mu.RLock()
		stored := svc.entities[tID]
		svc.mu.RUnlock()
		rels := entityMetadataRelationships(stored)
		test.That(t, rels, test.ShouldHaveLength, 0)
	})
}

func boolPtr(b bool) *bool {
	return &b
}
