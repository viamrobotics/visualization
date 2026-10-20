package api

import (
	"context"
	"fmt"
	"net"
	"net/http"
	"sync"
	"testing"

	"connectrpc.com/connect"
	"github.com/viamrobotics/visualization/client/server"
	drawv1 "github.com/viamrobotics/visualization/draw/v1"
	"github.com/viamrobotics/visualization/draw/v1/drawv1connect"
	commonv1 "go.viam.com/api/common/v1"
	"go.viam.com/test"
)

// fakeService records the requests client/api sends and returns canned
// responses, so a test can assert on the exact wire payload a Draw call builds
// without a real draw service, its disk buffers, or a rendered scene.
//
// Its errs field makes the RPC failure paths reachable: set errs[procedure] and
// the next call to that procedure fails with it.
type fakeService struct {
	mu sync.Mutex

	addEntity          []*drawv1.AddEntityRequest
	addEntities        []*drawv1.AddEntitiesRequest
	updateEntity       []*drawv1.UpdateEntityRequest
	removeEntity       []*drawv1.RemoveEntityRequest
	setScene           []*drawv1.SetSceneRequest
	removeAll          []*drawv1.RemoveAllRequest
	removeAllTransform []*drawv1.RemoveAllTransformsRequest
	removeAllDrawing   []*drawv1.RemoveAllDrawingsRequest
	createRelationship []*drawv1.CreateRelationshipRequest
	deleteRelationship []*drawv1.DeleteRelationshipRequest
	getEntityChunk     []*drawv1.GetEntityChunkRequest

	// uuids is handed out in order by AddEntity, falling back to a fixed value.
	uuids [][]byte

	// Counts the RemoveAll* responses report back, so a test can prove the
	// caller does the right arithmetic on them.
	removeAllTransforms  int32
	removeAllDrawings    int32
	removeDrawingsCount  int32
	removeTransformCount int32

	errs map[string]error
}

var _ drawv1connect.DrawServiceHandler = (*fakeService)(nil)

// fallbackUUID is what AddEntity returns once the queued uuids run out. Callers
// that care about the value queue their own.
var fallbackUUID = []byte{
	0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08,
	0x09, 0x0a, 0x0b, 0x0c, 0x0d, 0x0e, 0x0f, 0x10,
}

func (f *fakeService) fail(procedure string) error {
	f.mu.Lock()
	defer f.mu.Unlock()
	err, ok := f.errs[procedure]
	if !ok {
		return nil
	}
	delete(f.errs, procedure)
	return connect.NewError(connect.CodeInternal, err)
}

func (f *fakeService) nextUUID() []byte {
	f.mu.Lock()
	defer f.mu.Unlock()
	if len(f.uuids) == 0 {
		return fallbackUUID
	}
	next := f.uuids[0]
	f.uuids = f.uuids[1:]
	return next
}

func (f *fakeService) AddEntity(
	_ context.Context, req *connect.Request[drawv1.AddEntityRequest],
) (*connect.Response[drawv1.AddEntityResponse], error) {
	if err := f.fail("AddEntity"); err != nil {
		return nil, err
	}
	f.mu.Lock()
	f.addEntity = append(f.addEntity, req.Msg)
	f.mu.Unlock()
	return connect.NewResponse(&drawv1.AddEntityResponse{Uuid: f.nextUUID()}), nil
}

func (f *fakeService) AddEntities(
	_ context.Context, req *connect.Request[drawv1.AddEntitiesRequest],
) (*connect.Response[drawv1.AddEntitiesResponse], error) {
	if err := f.fail("AddEntities"); err != nil {
		return nil, err
	}
	f.mu.Lock()
	f.addEntities = append(f.addEntities, req.Msg)
	f.mu.Unlock()

	uuids := make([][]byte, 0, len(req.Msg.GetEntities()))
	for range req.Msg.GetEntities() {
		uuids = append(uuids, f.nextUUID())
	}
	return connect.NewResponse(&drawv1.AddEntitiesResponse{Uuids: uuids}), nil
}

func (f *fakeService) UpdateEntity(
	_ context.Context, req *connect.Request[drawv1.UpdateEntityRequest],
) (*connect.Response[drawv1.UpdateEntityResponse], error) {
	if err := f.fail("UpdateEntity"); err != nil {
		return nil, err
	}
	f.mu.Lock()
	f.updateEntity = append(f.updateEntity, req.Msg)
	f.mu.Unlock()
	return connect.NewResponse(&drawv1.UpdateEntityResponse{}), nil
}

func (f *fakeService) RemoveEntity(
	_ context.Context, req *connect.Request[drawv1.RemoveEntityRequest],
) (*connect.Response[drawv1.RemoveEntityResponse], error) {
	if err := f.fail("RemoveEntity"); err != nil {
		return nil, err
	}
	f.mu.Lock()
	f.removeEntity = append(f.removeEntity, req.Msg)
	f.mu.Unlock()
	return connect.NewResponse(&drawv1.RemoveEntityResponse{}), nil
}

func (f *fakeService) StreamEntityChanges(
	_ context.Context,
	_ *connect.Request[drawv1.StreamEntityChangesRequest],
	_ *connect.ServerStream[drawv1.StreamEntityChangesResponse],
) error {
	return nil
}

func (f *fakeService) SetScene(
	_ context.Context, req *connect.Request[drawv1.SetSceneRequest],
) (*connect.Response[drawv1.SetSceneResponse], error) {
	if err := f.fail("SetScene"); err != nil {
		return nil, err
	}
	f.mu.Lock()
	f.setScene = append(f.setScene, req.Msg)
	f.mu.Unlock()
	return connect.NewResponse(&drawv1.SetSceneResponse{}), nil
}

func (f *fakeService) StreamSceneChanges(
	_ context.Context,
	_ *connect.Request[drawv1.StreamSceneChangesRequest],
	_ *connect.ServerStream[drawv1.StreamSceneChangesResponse],
) error {
	return nil
}

func (f *fakeService) RemoveAllTransforms(
	_ context.Context, req *connect.Request[drawv1.RemoveAllTransformsRequest],
) (*connect.Response[drawv1.RemoveAllTransformsResponse], error) {
	if err := f.fail("RemoveAllTransforms"); err != nil {
		return nil, err
	}
	f.mu.Lock()
	f.removeAllTransform = append(f.removeAllTransform, req.Msg)
	count := f.removeTransformCount
	f.mu.Unlock()
	return connect.NewResponse(&drawv1.RemoveAllTransformsResponse{Count: count}), nil
}

func (f *fakeService) RemoveAllDrawings(
	_ context.Context, req *connect.Request[drawv1.RemoveAllDrawingsRequest],
) (*connect.Response[drawv1.RemoveAllDrawingsResponse], error) {
	if err := f.fail("RemoveAllDrawings"); err != nil {
		return nil, err
	}
	f.mu.Lock()
	f.removeAllDrawing = append(f.removeAllDrawing, req.Msg)
	count := f.removeDrawingsCount
	f.mu.Unlock()
	return connect.NewResponse(&drawv1.RemoveAllDrawingsResponse{Count: count}), nil
}

func (f *fakeService) RemoveAll(
	_ context.Context, req *connect.Request[drawv1.RemoveAllRequest],
) (*connect.Response[drawv1.RemoveAllResponse], error) {
	if err := f.fail("RemoveAll"); err != nil {
		return nil, err
	}
	f.mu.Lock()
	f.removeAll = append(f.removeAll, req.Msg)
	transforms, drawings := f.removeAllTransforms, f.removeAllDrawings
	f.mu.Unlock()
	return connect.NewResponse(&drawv1.RemoveAllResponse{
		TransformCount: transforms,
		DrawingCount:   drawings,
	}), nil
}

func (f *fakeService) CreateRelationship(
	_ context.Context, req *connect.Request[drawv1.CreateRelationshipRequest],
) (*connect.Response[drawv1.CreateRelationshipResponse], error) {
	if err := f.fail("CreateRelationship"); err != nil {
		return nil, err
	}
	f.mu.Lock()
	f.createRelationship = append(f.createRelationship, req.Msg)
	f.mu.Unlock()
	return connect.NewResponse(&drawv1.CreateRelationshipResponse{}), nil
}

func (f *fakeService) DeleteRelationship(
	_ context.Context, req *connect.Request[drawv1.DeleteRelationshipRequest],
) (*connect.Response[drawv1.DeleteRelationshipResponse], error) {
	if err := f.fail("DeleteRelationship"); err != nil {
		return nil, err
	}
	f.mu.Lock()
	f.deleteRelationship = append(f.deleteRelationship, req.Msg)
	f.mu.Unlock()
	return connect.NewResponse(&drawv1.DeleteRelationshipResponse{}), nil
}

func (f *fakeService) GetEntityChunk(
	_ context.Context, req *connect.Request[drawv1.GetEntityChunkRequest],
) (*connect.Response[drawv1.GetEntityChunkResponse], error) {
	if err := f.fail("GetEntityChunk"); err != nil {
		return nil, err
	}
	f.mu.Lock()
	f.getEntityChunk = append(f.getEntityChunk, req.Msg)
	f.mu.Unlock()
	return connect.NewResponse(&drawv1.GetEntityChunkResponse{}), nil
}

// startFake serves a fakeService and points server.GetClient() at it for the
// duration of the test.
//
// It leans on server.Start's attach path: the fake binds a port first, so
// Start's own net.Listen fails with EADDRINUSE and it wires a client to the
// existing listener instead of standing up a real draw service. That keeps the
// package's singleton the single source of the client, exactly as production
// code sees it, with nothing stubbed inside client/api itself.
func startFake(t *testing.T) *fakeService {
	t.Helper()

	// A leaked server from an earlier test would make server.Start return early
	// on its `running` check, leaving GetClient pointed somewhere else entirely.
	// Fail loudly rather than assert against the wrong target.
	test.That(t, server.GetClient(), test.ShouldBeNil)

	fake := &fakeService{errs: map[string]error{}}

	mux := http.NewServeMux()
	mux.Handle(drawv1connect.NewDrawServiceHandler(fake))

	// Port 0 on all interfaces, so Start's ":port" listen collides with it.
	listener, err := net.Listen("tcp", ":0")
	test.That(t, err, test.ShouldBeNil)

	port := listener.Addr().(*net.TCPAddr).Port
	httpServer := &http.Server{Handler: mux}

	served := make(chan struct{})
	go func() {
		defer close(served)
		_ = httpServer.Serve(listener)
	}()

	test.That(t, server.Start(server.DrawServerConfig{Port: port}), test.ShouldBeNil)
	test.That(t, server.GetClient(), test.ShouldNotBeNil)

	t.Cleanup(func() {
		_ = server.Stop()
		_ = httpServer.Close()
		<-served
	})

	return fake
}

// requireNoServer clears the package singleton so the ErrVisualizerNotRunning
// path is reachable.
func requireNoServer(t *testing.T) {
	t.Helper()
	_ = server.Stop()
	test.That(t, server.GetClient(), test.ShouldBeNil)
}

// onlyAddedDrawing returns the single drawing AddEntity received, failing when
// the call sent nothing, sent more than once, or sent a transform instead.
func (f *fakeService) onlyAddedDrawing(t *testing.T) *drawv1.Drawing {
	t.Helper()
	f.mu.Lock()
	defer f.mu.Unlock()

	test.That(t, f.addEntity, test.ShouldHaveLength, 1)
	drawing := f.addEntity[0].GetDrawing()
	test.That(t, drawing, test.ShouldNotBeNil)
	return drawing
}

// onlyAddedTransform is onlyAddedDrawing for the transform arm of the oneof.
func (f *fakeService) onlyAddedTransform(t *testing.T) *commonv1.Transform {
	t.Helper()
	f.mu.Lock()
	defer f.mu.Unlock()

	test.That(t, f.addEntity, test.ShouldHaveLength, 1)
	transform := f.addEntity[0].GetTransform()
	test.That(t, transform, test.ShouldNotBeNil)
	return transform
}

func (f *fakeService) addEntityCount() int {
	f.mu.Lock()
	defer f.mu.Unlock()
	return len(f.addEntity)
}

var errRPCBoom = fmt.Errorf("boom")
