package draw

import (
	"context"
	"testing"

	"connectrpc.com/connect"
	"github.com/golang/geo/r3"
	"github.com/google/uuid"
	commonv1 "go.viam.com/api/common/v1"
	"go.viam.com/rdk/spatialmath"
	"go.viam.com/test"
	"google.golang.org/protobuf/types/known/fieldmaskpb"

	drawv1 "github.com/viamrobotics/visualization/draw/v1"
	"github.com/viamrobotics/visualization/draw/v1/drawv1connect"
)

func TestNewTransformUpdate(t *testing.T) {
	pose := spatialmath.NewPoseFromPoint(r3.Vector{X: 1, Y: 2, Z: 3})

	// A move with no reparent selects the nested pose, so the observer frame the entity is
	// attached to is left alone rather than being reset to the world frame.
	t.Run("MoveSelectsOnlyTheNestedPose", func(t *testing.T) {
		transform, paths, err := NewTransformUpdate(TransformUpdate{Pose: pose})
		test.That(t, err, test.ShouldBeNil)
		test.That(t, paths, test.ShouldResemble, []string{TransformPathPoseValue})
		test.That(t, transform.GetPoseInObserverFrame().GetPose().GetX(), test.ShouldEqual, 1)
		test.That(t, transform.GetMetadata(), test.ShouldBeNil)
	})

	t.Run("ReparentSelectsOnlyTheObserverFrame", func(t *testing.T) {
		transform, paths, err := NewTransformUpdate(TransformUpdate{Parent: "arm"})
		test.That(t, err, test.ShouldBeNil)
		test.That(t, paths, test.ShouldResemble, []string{TransformPathPoseParent})
		test.That(t, transform.GetPoseInObserverFrame().GetReferenceFrame(), test.ShouldEqual, "arm")
	})

	t.Run("MoveAndReparentSelectsTheWholePose", func(t *testing.T) {
		transform, paths, err := NewTransformUpdate(TransformUpdate{Pose: pose, Parent: "arm"})
		test.That(t, err, test.ShouldBeNil)
		test.That(t, paths, test.ShouldResemble, []string{TransformPathPose})
		test.That(t, transform.GetPoseInObserverFrame().GetReferenceFrame(), test.ShouldEqual, "arm")
		test.That(t, transform.GetPoseInObserverFrame().GetPose().GetX(), test.ShouldEqual, 1)
	})

	t.Run("MasksEveryFieldSet", func(t *testing.T) {
		metadata := NewMetadata()
		_, paths, err := NewTransformUpdate(TransformUpdate{
			Pose:     pose,
			Parent:   "arm",
			Geometry: spatialmath.NewPoint(r3.Vector{}, "point"),
			Metadata: &metadata,
		})
		test.That(t, err, test.ShouldBeNil)
		test.That(t, paths, test.ShouldResemble, []string{
			TransformPathPose, TransformPathGeometry, TransformPathMetadata,
		})
	})

	// An empty mask means "replace every field", so an update that sets nothing would wipe the
	// stored entity rather than do nothing.
	t.Run("EmptyUpdateIsAnError", func(t *testing.T) {
		_, _, err := NewTransformUpdate(TransformUpdate{})
		test.That(t, err, test.ShouldEqual, ErrEmptyTransformUpdate)
	})
}

func TestNewDrawingUpdate(t *testing.T) {
	pose := spatialmath.NewPoseFromPoint(r3.Vector{X: 4, Y: 5, Z: 6})

	t.Run("MasksOnlyTheFieldsSet", func(t *testing.T) {
		drawing, paths, err := NewDrawingUpdate(DrawingUpdate{Pose: pose, Parent: "arm"})
		test.That(t, err, test.ShouldBeNil)
		test.That(t, paths, test.ShouldResemble, []string{DrawingPathPose})
		test.That(t, drawing.GetPoseInObserverFrame().GetReferenceFrame(), test.ShouldEqual, "arm")
		test.That(t, drawing.GetMetadata(), test.ShouldBeNil)
	})

	t.Run("MoveSelectsOnlyTheNestedPose", func(t *testing.T) {
		_, paths, err := NewDrawingUpdate(DrawingUpdate{Pose: pose})
		test.That(t, err, test.ShouldBeNil)
		test.That(t, paths, test.ShouldResemble, []string{DrawingPathPoseValue})
	})

	// A drawing's metadata is a typed message, so one attribute can be changed without
	// resending the colors alongside it.
	t.Run("AttributesSelectNestedMetadataPaths", func(t *testing.T) {
		invisible := true
		drawing, paths, err := NewDrawingUpdate(DrawingUpdate{Invisible: &invisible})
		test.That(t, err, test.ShouldBeNil)
		test.That(t, paths, test.ShouldResemble, []string{DrawingPathMetadataInvisible})
		test.That(t, drawing.GetMetadata().GetInvisible(), test.ShouldBeTrue)
		test.That(t, drawing.GetMetadata().GetColors(), test.ShouldBeNil)
	})

	t.Run("WholesaleMetadataWins", func(t *testing.T) {
		invisible := true
		metadata := NewMetadata()
		_, paths, err := NewDrawingUpdate(DrawingUpdate{Metadata: &metadata, Invisible: &invisible})
		test.That(t, err, test.ShouldBeNil)
		test.That(t, paths, test.ShouldResemble, []string{DrawingPathMetadata})
	})

	t.Run("ShapeSelectsThePhysicalObject", func(t *testing.T) {
		points, err := NewPoints([]r3.Vector{{X: 1}})
		test.That(t, err, test.ShouldBeNil)
		shape := NewShape(spatialmath.NewZeroPose(), "pts", WithPoints(*points))

		drawing, paths, err := NewDrawingUpdate(DrawingUpdate{Shape: &shape})
		test.That(t, err, test.ShouldBeNil)
		test.That(t, paths, test.ShouldResemble, []string{DrawingPathShape})
		test.That(t, drawing.GetPhysicalObject().GetPoints(), test.ShouldNotBeNil)
	})

	t.Run("EmptyUpdateIsAnError", func(t *testing.T) {
		_, _, err := NewDrawingUpdate(DrawingUpdate{})
		test.That(t, err, test.ShouldEqual, ErrEmptyDrawingUpdate)
	})
}

// A transform stores metadata as an untyped struct, so a mask that implies a surgical metadata
// change is rejected rather than silently performing a wholesale replace.
func TestDrawService_TransformMetadataRejectsNestedPaths(t *testing.T) {
	svc := NewDrawService(t.TempDir())
	client := newTestServer(t, svc)

	addResp, err := client.AddEntity(context.Background(), connect.NewRequest(&drawv1.AddEntityRequest{
		Entity: &drawv1.AddEntityRequest_Transform{Transform: sampleTransform("struct-metadata")},
	}))
	test.That(t, err, test.ShouldBeNil)

	for _, path := range []string{"metadata.fields", "metadata.invisible"} {
		_, err := client.UpdateEntity(context.Background(), connect.NewRequest(&drawv1.UpdateEntityRequest{
			Uuid:          addResp.Msg.GetUuid(),
			Entity:        &drawv1.UpdateEntityRequest_Transform{Transform: &commonv1.Transform{}},
			UpdatedFields: &fieldmaskpb.FieldMask{Paths: []string{path}},
		}))
		test.That(t, connect.CodeOf(err), test.ShouldEqual, connect.CodeInvalidArgument)
	}

	// The wholesale path is still accepted.
	_, err = client.UpdateEntity(context.Background(), connect.NewRequest(&drawv1.UpdateEntityRequest{
		Uuid: addResp.Msg.GetUuid(),
		Entity: &drawv1.UpdateEntityRequest_Transform{Transform: &commonv1.Transform{
			Metadata: MetadataToStruct(NewMetadata()),
		}},
		UpdatedFields: &fieldmaskpb.FieldMask{Paths: []string{TransformPathMetadata}},
	}))
	test.That(t, err, test.ShouldBeNil)
}

func TestEntityUpdate_ApplyTo(t *testing.T) {
	pose := spatialmath.NewPoseFromPoint(r3.Vector{X: 1})

	t.Run("Transform", func(t *testing.T) {
		req := &drawv1.UpdateEntityRequest{}
		paths, err := TransformUpdate{Pose: pose}.ApplyTo(req)
		test.That(t, err, test.ShouldBeNil)
		test.That(t, paths, test.ShouldResemble, []string{TransformPathPoseValue})
		test.That(t, req.GetTransform(), test.ShouldNotBeNil)
	})

	t.Run("Drawing", func(t *testing.T) {
		req := &drawv1.UpdateEntityRequest{}
		paths, err := DrawingUpdate{Pose: pose}.ApplyTo(req)
		test.That(t, err, test.ShouldBeNil)
		test.That(t, paths, test.ShouldResemble, []string{DrawingPathPoseValue})
		test.That(t, req.GetDrawing(), test.ShouldNotBeNil)
	})
}

// A chunked drawing receives its payload through UpdateEntity, so the service has to tell a
// chunk append apart from a field patch. Mask presence is the signal: the chunker never sends
// one, and a partial update always does.
func TestDrawService_ChunkedDrawingDistinguishesPatchFromChunk(t *testing.T) {
	const stride = 12
	const total = 4

	// Two elements of packed RGB, matching the first chunk's element count.
	chunkColorBytes := []byte{1, 2, 3, 4, 5, 6}

	newChunkedDrawing := func(t *testing.T) (*DrawService, drawv1connect.DrawServiceClient, []byte) {
		t.Helper()
		svc := NewDrawService(t.TempDir())
		client := newTestServer(t, svc)

		drawing := sampleDrawing("cloud")
		drawing.PhysicalObject = &drawv1.Shape{
			GeometryType: &drawv1.Shape_Points{
				Points: &drawv1.Points{Positions: make([]byte, stride*2)},
			},
		}
		drawing.Metadata = &drawv1.Metadata{
			Chunks: &drawv1.Chunks{ChunkSize: 2, Total: total, Stride: stride},
			Colors: chunkColorBytes,
		}

		resp, err := client.AddEntity(context.Background(), connect.NewRequest(&drawv1.AddEntityRequest{
			Entity: &drawv1.AddEntityRequest_Drawing{Drawing: drawing},
		}))
		test.That(t, err, test.ShouldBeNil)
		return svc, client, resp.Msg.GetUuid()
	}

	t.Run("UnmaskedUpdateAppendsAChunk", func(t *testing.T) {
		svc, client, id := newChunkedDrawing(t)

		next := sampleDrawing("cloud")
		next.PhysicalObject = &drawv1.Shape{
			GeometryType: &drawv1.Shape_Points{
				Points: &drawv1.Points{Positions: make([]byte, stride*2)},
			},
		}
		_, err := client.UpdateEntity(context.Background(), connect.NewRequest(&drawv1.UpdateEntityRequest{
			Uuid:   id,
			Entity: &drawv1.UpdateEntityRequest_Drawing{Drawing: next},
		}))
		test.That(t, err, test.ShouldBeNil)

		parsed, err := uuid.FromBytes(id)
		test.That(t, err, test.ShouldBeNil)
		svc.mu.RLock()
		chunked := svc.chunked[parsed]
		svc.mu.RUnlock()

		chunked.mu.Lock()
		defer chunked.mu.Unlock()
		test.That(t, chunked.data.bytesWritten, test.ShouldEqual, int64(stride*total))
	})

	// A chunked drawing is replayed to new subscribers from its template, not from the stored
	// entity, because the payload has to be rebuilt from the on-disk buffer. A partial update
	// that only reached the stored entity would be invisible to anyone connecting afterwards.
	t.Run("MaskedUpdateReachesTheReplayTemplate", func(t *testing.T) {
		svc, client, id := newChunkedDrawing(t)

		_, err := client.UpdateEntity(context.Background(), connect.NewRequest(&drawv1.UpdateEntityRequest{
			Uuid: id,
			Entity: &drawv1.UpdateEntityRequest_Drawing{Drawing: &drawv1.Drawing{
				PoseInObserverFrame: &commonv1.PoseInFrame{Pose: &commonv1.Pose{X: 77}},
			}},
			UpdatedFields: &fieldmaskpb.FieldMask{Paths: []string{DrawingPathPoseValue}},
		}))
		test.That(t, err, test.ShouldBeNil)

		parsed, err := uuid.FromBytes(id)
		test.That(t, err, test.ShouldBeNil)
		svc.mu.RLock()
		chunked := svc.chunked[parsed]
		svc.mu.RUnlock()

		replay := svc.buildChunkedReplayMsg(chunked)
		test.That(t, replay, test.ShouldNotBeNil)
		test.That(t, replay.GetDrawing().GetPoseInObserverFrame().GetPose().GetX(), test.ShouldEqual, 77)
	})

	// The replay overlays each chunk's packed buffers onto the template. Replacing the metadata
	// outright would drop the chunks descriptor, and a client that cannot see it renders the
	// first chunk and never asks for the rest.
	t.Run("ReplayKeepsTheChunksDescriptor", func(t *testing.T) {
		svc, _, id := newChunkedDrawing(t)

		parsed, err := uuid.FromBytes(id)
		test.That(t, err, test.ShouldBeNil)
		svc.mu.RLock()
		chunked := svc.chunked[parsed]
		svc.mu.RUnlock()

		replay := svc.buildChunkedReplayMsg(chunked)
		test.That(t, replay, test.ShouldNotBeNil)

		metadata := replay.GetDrawing().GetMetadata()
		test.That(t, metadata.GetChunks(), test.ShouldNotBeNil)
		test.That(t, metadata.GetChunks().GetTotal(), test.ShouldEqual, uint32(total))
		// The packed buffers still come from the chunk itself.
		test.That(t, metadata.GetColors(), test.ShouldResemble, chunkColorBytes)
	})

	t.Run("MaskedUpdatePatchesFieldsInsteadOfAppending", func(t *testing.T) {
		svc, client, id := newChunkedDrawing(t)

		_, err := client.UpdateEntity(context.Background(), connect.NewRequest(&drawv1.UpdateEntityRequest{
			Uuid: id,
			Entity: &drawv1.UpdateEntityRequest_Drawing{Drawing: &drawv1.Drawing{
				PoseInObserverFrame: &commonv1.PoseInFrame{
					ReferenceFrame: "world",
					Pose:           &commonv1.Pose{X: 42},
				},
			}},
			UpdatedFields: &fieldmaskpb.FieldMask{Paths: []string{DrawingPathPose}},
		}))
		test.That(t, err, test.ShouldBeNil)

		parsed, err := uuid.FromBytes(id)
		test.That(t, err, test.ShouldBeNil)

		svc.mu.RLock()
		chunked := svc.chunked[parsed]
		stored := svc.entities[parsed]
		svc.mu.RUnlock()

		// The patch must not have been appended to the chunk buffer.
		chunked.mu.Lock()
		defer chunked.mu.Unlock()
		test.That(t, chunked.data.bytesWritten, test.ShouldEqual, int64(stride*2))
		test.That(t, stored.drawing.GetPoseInObserverFrame().GetPose().GetX(), test.ShouldEqual, 42)
	})
}
