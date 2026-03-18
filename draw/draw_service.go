package draw

import (
	"context"
	"errors"
	"fmt"
	"os"
	"sync"
	"sync/atomic"
	"time"

	"connectrpc.com/connect"
	"github.com/google/uuid"
	drawv1 "github.com/viam-labs/motion-tools/draw/v1"
	"github.com/viam-labs/motion-tools/draw/v1/drawv1connect"
	commonv1 "go.viam.com/api/common/v1"
	"google.golang.org/protobuf/proto"
	"google.golang.org/protobuf/reflect/protoreflect"
)

var _ drawv1connect.DrawServiceHandler = (*DrawService)(nil)

type entityKind int

const (
	entityKindTransform entityKind = iota
	entityKindDrawing
)

type storedEntity struct {
	kind      entityKind
	transform *commonv1.Transform
	drawing   *drawv1.Drawing
}

const entitySubscriberBufferSize = 64

// DrawService  stores transforms and drawings keyed by UUID and fans out change events to streaming subscribers.
type DrawService struct {
	mu            sync.RWMutex
	entities      map[uuid.UUID]storedEntity
	sceneMetadata *drawv1.SceneMetadata

	entitySubs map[uint64]chan *drawv1.StreamEntityChangesResponse
	sceneSubs  map[uint64]chan *drawv1.StreamSceneChangesResponse
	nextSubID  atomic.Uint64
}

// NewDrawService creates a new DrawService ready to serve requests.
func NewDrawService() *DrawService {
	return &DrawService{
		entities:      make(map[uuid.UUID]storedEntity),
		sceneMetadata: nil,
		entitySubs:    make(map[uint64]chan *drawv1.StreamEntityChangesResponse),
		sceneSubs:     make(map[uint64]chan *drawv1.StreamSceneChangesResponse),
	}
}

func (svc *DrawService) notifyEntityChange(msg *drawv1.StreamEntityChangesResponse) {
	// #region agent log
	{
		entityCase := "unknown"
		switch msg.Entity.(type) {
		case *drawv1.StreamEntityChangesResponse_Transform:
			entityCase = "transform"
		case *drawv1.StreamEntityChangesResponse_Drawing:
			entityCase = "drawing"
		}
		line := fmt.Sprintf("{\"sessionId\":\"23bd9f\",\"location\":\"draw_service.go:notifyEntityChange\",\"message\":\"stage3-notify-entity-change\",\"data\":{\"changeType\":%d,\"entityCase\":\"%s\",\"numSubs\":%d},\"timestamp\":%d}\n",
			msg.ChangeType, entityCase, len(svc.entitySubs), time.Now().UnixMilli())
		if f, err := os.OpenFile("/Users/devin/Projects/motion-tools/.cursor/debug-23bd9f.log", os.O_APPEND|os.O_CREATE|os.O_WRONLY, 0644); err == nil { f.WriteString(line); f.Close() }
	}
	// #endregion
	for _, ch := range svc.entitySubs {
		select {
		case ch <- msg:
		default:
			// Drop event for slow consumers rather than blocking mutations.
		}
	}
}

func (svc *DrawService) notifySceneChange(msg *drawv1.StreamSceneChangesResponse) {
	for _, ch := range svc.sceneSubs {
		select {
		case ch <- msg:
		default:
		}
	}
}

func (svc *DrawService) addEntitySub() (uint64, chan *drawv1.StreamEntityChangesResponse) {
	id := svc.nextSubID.Add(1)
	ch := make(chan *drawv1.StreamEntityChangesResponse, entitySubscriberBufferSize)
	svc.entitySubs[id] = ch
	return id, ch
}

func (svc *DrawService) removeEntitySub(id uint64) {
	if ch, ok := svc.entitySubs[id]; ok {
		delete(svc.entitySubs, id)
		close(ch)
	}
}

func (svc *DrawService) addSceneSub() (uint64, chan *drawv1.StreamSceneChangesResponse) {
	id := svc.nextSubID.Add(1)
	ch := make(chan *drawv1.StreamSceneChangesResponse, entitySubscriberBufferSize)
	svc.sceneSubs[id] = ch
	return id, ch
}

func (svc *DrawService) removeSceneSub(id uint64) {
	if ch, ok := svc.sceneSubs[id]; ok {
		delete(svc.sceneSubs, id)
		close(ch)
	}
}

// AddEntity adds a transform or drawing to the scene and returns its UUID.
// If the entity carries a non-empty Uuid field, AddEntity performs an upsert.
func (svc *DrawService) AddEntity(
	_ context.Context,
	req *connect.Request[drawv1.AddEntityRequest],
) (*connect.Response[drawv1.AddEntityResponse], error) {
	if req.Msg.GetEntity() == nil {
		return nil, connect.NewError(connect.CodeInvalidArgument, errors.New("entity is required"))
	}

	svc.mu.Lock()
	defer svc.mu.Unlock()

	var changeMsg *drawv1.StreamEntityChangesResponse
	var id uuid.UUID

	switch e := req.Msg.Entity.(type) {
	case *drawv1.AddEntityRequest_Transform:
		if e.Transform == nil {
			return nil, connect.NewError(connect.CodeInvalidArgument, errors.New("transform is required"))
		}
		id = resolveEntityUUID(e.Transform.GetUuid())
		_, exists := svc.entities[id]
		changeType := addedOrUpdated(exists)
		svc.entities[id] = storedEntity{kind: entityKindTransform, transform: e.Transform}
		changeMsg = &drawv1.StreamEntityChangesResponse{
			ChangeType: changeType,
			Entity:     &drawv1.StreamEntityChangesResponse_Transform{Transform: e.Transform},
		}
	case *drawv1.AddEntityRequest_Drawing:
		if e.Drawing == nil {
			return nil, connect.NewError(connect.CodeInvalidArgument, errors.New("drawing is required"))
		}
		id = resolveEntityUUID(e.Drawing.GetUuid())
		_, exists := svc.entities[id]
		changeType := addedOrUpdated(exists)
		svc.entities[id] = storedEntity{kind: entityKindDrawing, drawing: e.Drawing}
		changeMsg = &drawv1.StreamEntityChangesResponse{
			ChangeType: changeType,
			Entity:     &drawv1.StreamEntityChangesResponse_Drawing{Drawing: e.Drawing},
		}
	default:
		return nil, connect.NewError(connect.CodeInvalidArgument, errors.New("entity must be a transform or drawing"))
	}

	svc.notifyEntityChange(changeMsg)

	return connect.NewResponse(&drawv1.AddEntityResponse{Uuid: id[:]}), nil
}

func resolveEntityUUID(raw []byte) uuid.UUID {
	if id, err := uuid.FromBytes(raw); err == nil {
		return id
	}
	return uuid.New()
}

func addedOrUpdated(exists bool) drawv1.EntityChangeType {
	if exists {
		return drawv1.EntityChangeType_ENTITY_CHANGE_TYPE_UPDATED
	}
	return drawv1.EntityChangeType_ENTITY_CHANGE_TYPE_ADDED
}

// UpdateEntity replaces or partially updates an existing entity identified by UUID.
func (svc *DrawService) UpdateEntity(
	_ context.Context,
	req *connect.Request[drawv1.UpdateEntityRequest],
) (*connect.Response[drawv1.UpdateEntityResponse], error) {
	if len(req.Msg.GetUuid()) == 0 {
		return nil, connect.NewError(connect.CodeInvalidArgument, errors.New("uuid is required"))
	}
	if req.Msg.GetEntity() == nil {
		return nil, connect.NewError(connect.CodeInvalidArgument, errors.New("entity is required"))
	}

	id, err := uuid.FromBytes(req.Msg.GetUuid())
	if err != nil {
		return nil, connect.NewError(connect.CodeInvalidArgument, fmt.Errorf("invalid uuid: %w", err))
	}

	svc.mu.Lock()
	defer svc.mu.Unlock()

	existing, ok := svc.entities[id]
	if !ok {
		return nil, connect.NewError(connect.CodeNotFound, fmt.Errorf("entity %s not found", id))
	}

	var changeMsg *drawv1.StreamEntityChangesResponse

	switch e := req.Msg.Entity.(type) {
	case *drawv1.UpdateEntityRequest_Transform:
		if e.Transform == nil {
			return nil, connect.NewError(connect.CodeInvalidArgument, errors.New("transform is required"))
		}
		if existing.kind != entityKindTransform {
			return nil, connect.NewError(connect.CodeInvalidArgument, errors.New("entity type mismatch: existing entity is a drawing, not a transform"))
		}
		if err := validateTransformUpdate(existing.transform, e.Transform); err != nil {
			return nil, err
		}
		updated := applyTransformUpdate(existing.transform, e.Transform, req.Msg.UpdatedFields)
		svc.entities[id] = storedEntity{kind: entityKindTransform, transform: updated}
		changeMsg = &drawv1.StreamEntityChangesResponse{
			ChangeType:    drawv1.EntityChangeType_ENTITY_CHANGE_TYPE_UPDATED,
			Entity:        &drawv1.StreamEntityChangesResponse_Transform{Transform: updated},
			UpdatedFields: req.Msg.UpdatedFields,
		}
	case *drawv1.UpdateEntityRequest_Drawing:
		if e.Drawing == nil {
			return nil, connect.NewError(connect.CodeInvalidArgument, errors.New("drawing is required"))
		}
		if existing.kind != entityKindDrawing {
			return nil, connect.NewError(connect.CodeInvalidArgument, errors.New("entity type mismatch: existing entity is a transform, not a drawing"))
		}
		if err := validateDrawingUpdate(existing.drawing, e.Drawing); err != nil {
			return nil, err
		}
		updated := applyDrawingUpdate(existing.drawing, e.Drawing, req.Msg.UpdatedFields)
		svc.entities[id] = storedEntity{kind: entityKindDrawing, drawing: updated}
		changeMsg = &drawv1.StreamEntityChangesResponse{
			ChangeType:    drawv1.EntityChangeType_ENTITY_CHANGE_TYPE_UPDATED,
			Entity:        &drawv1.StreamEntityChangesResponse_Drawing{Drawing: updated},
			UpdatedFields: req.Msg.UpdatedFields,
		}
	default:
		return nil, connect.NewError(connect.CodeInvalidArgument, errors.New("entity must be a transform or drawing"))
	}

	svc.notifyEntityChange(changeMsg)

	return connect.NewResponse(&drawv1.UpdateEntityResponse{}), nil
}

func applyTransformUpdate(existing, incoming *commonv1.Transform, mask interface{ GetPaths() []string }) *commonv1.Transform {
	if mask == nil || len(mask.GetPaths()) == 0 {
		return incoming
	}
	dst := proto.Clone(existing).(*commonv1.Transform)
	applyFieldMask(dst, incoming, mask.GetPaths())
	return dst
}

func applyDrawingUpdate(existing, incoming *drawv1.Drawing, mask interface{ GetPaths() []string }) *drawv1.Drawing {
	if mask == nil || len(mask.GetPaths()) == 0 {
		return incoming
	}
	dst := proto.Clone(existing).(*drawv1.Drawing)
	applyFieldMask(dst, incoming, mask.GetPaths())
	return dst
}

func transformGeometryTypeCase(g *commonv1.Geometry) string {
	if g == nil {
		return ""
	}
	switch g.GeometryType.(type) {
	case *commonv1.Geometry_Box:
		return "box"
	case *commonv1.Geometry_Sphere:
		return "sphere"
	case *commonv1.Geometry_Capsule:
		return "capsule"
	case *commonv1.Geometry_Mesh:
		return "mesh"
	case *commonv1.Geometry_Pointcloud:
		return "pointcloud"
	default:
		return ""
	}
}

func drawingShapeTypeCase(s *drawv1.Shape) string {
	if s == nil {
		return ""
	}
	switch s.GeometryType.(type) {
	case *drawv1.Shape_Arrows:
		return "arrows"
	case *drawv1.Shape_Line:
		return "line"
	case *drawv1.Shape_Points:
		return "points"
	case *drawv1.Shape_Model:
		return "model"
	case *drawv1.Shape_Nurbs:
		return "nurbs"
	default:
		return ""
	}
}

func validateTransformUpdate(existing, incoming *commonv1.Transform) error {
	if incoming.GetReferenceFrame() != existing.GetReferenceFrame() {
		return connect.NewError(connect.CodeInvalidArgument, fmt.Errorf(
			"cannot change reference_frame from %q to %q remove the existing entity and add a new one instead",
			existing.GetReferenceFrame(), incoming.GetReferenceFrame(),
		))
	}

	existingCase := transformGeometryTypeCase(existing.GetPhysicalObject())
	incomingCase := transformGeometryTypeCase(incoming.GetPhysicalObject())
	if existingCase != "" && incomingCase != "" && existingCase != incomingCase {
		return connect.NewError(connect.CodeInvalidArgument, fmt.Errorf(
			"cannot change physical_object geometry type from %q to %q remove the existing entity and add a new one instead",
			existingCase, incomingCase,
		))
	}

	return nil
}

func validateDrawingUpdate(existing, incoming *drawv1.Drawing) error {
	if incoming.GetReferenceFrame() != existing.GetReferenceFrame() {
		return connect.NewError(connect.CodeInvalidArgument, fmt.Errorf(
			"cannot change reference_frame from %q to %q remove the existing entity and add a new one instead",
			existing.GetReferenceFrame(), incoming.GetReferenceFrame(),
		))
	}

	existingCase := drawingShapeTypeCase(existing.GetPhysicalObject())
	incomingCase := drawingShapeTypeCase(incoming.GetPhysicalObject())
	if existingCase != "" && incomingCase != "" && existingCase != incomingCase {
		return connect.NewError(connect.CodeInvalidArgument, fmt.Errorf(
			"cannot change physical_object geometry type from %q to %q remove the existing entity and add a new one instead",
			existingCase, incomingCase,
		))
	}

	return nil
}

func applyFieldMask(dst, src proto.Message, paths []string) {
	dstRef := dst.ProtoReflect()
	srcRef := src.ProtoReflect()
	fields := dstRef.Descriptor().Fields()
	for _, path := range paths {
		fd := fields.ByName(protoreflect.Name(path))
		if fd == nil {
			continue
		}
		if srcRef.Has(fd) {
			dstRef.Set(fd, srcRef.Get(fd))
		} else {
			dstRef.Clear(fd)
		}
	}
}

// RemoveEntity removes the entity with the given UUID from the scene.
func (svc *DrawService) RemoveEntity(
	_ context.Context,
	req *connect.Request[drawv1.RemoveEntityRequest],
) (*connect.Response[drawv1.RemoveEntityResponse], error) {
	if len(req.Msg.GetUuid()) == 0 {
		return nil, connect.NewError(connect.CodeInvalidArgument, errors.New("uuid is required"))
	}

	id, err := uuid.FromBytes(req.Msg.GetUuid())
	if err != nil {
		return nil, connect.NewError(connect.CodeInvalidArgument, fmt.Errorf("invalid uuid: %w", err))
	}

	svc.mu.Lock()
	defer svc.mu.Unlock()

	entity, ok := svc.entities[id]
	if !ok {
		return nil, connect.NewError(connect.CodeNotFound, fmt.Errorf("entity %s not found", id))
	}

	delete(svc.entities, id)

	var changeMsg *drawv1.StreamEntityChangesResponse
	switch entity.kind {
	case entityKindTransform:
		changeMsg = &drawv1.StreamEntityChangesResponse{
			ChangeType: drawv1.EntityChangeType_ENTITY_CHANGE_TYPE_REMOVED,
			Entity:     &drawv1.StreamEntityChangesResponse_Transform{Transform: entity.transform},
		}
	case entityKindDrawing:
		changeMsg = &drawv1.StreamEntityChangesResponse{
			ChangeType: drawv1.EntityChangeType_ENTITY_CHANGE_TYPE_REMOVED,
			Entity:     &drawv1.StreamEntityChangesResponse_Drawing{Drawing: entity.drawing},
		}
	}
	svc.notifyEntityChange(changeMsg)

	return connect.NewResponse(&drawv1.RemoveEntityResponse{}), nil
}

// StreamEntityChanges streams entity change events (add/update/remove) to the caller until the context is cancelled.
func (svc *DrawService) StreamEntityChanges(
	ctx context.Context,
	_ *connect.Request[drawv1.StreamEntityChangesRequest],
	stream *connect.ServerStream[drawv1.StreamEntityChangesResponse],
) error {
	svc.mu.Lock()
	subID, ch := svc.addEntitySub()
	svc.mu.Unlock()

	defer func() {
		svc.mu.Lock()
		svc.removeEntitySub(subID)
		svc.mu.Unlock()
	}()

	for {
		select {
		case <-ctx.Done():
			return nil
		case msg, ok := <-ch:
			if !ok {
				return nil
			}
			if err := stream.Send(msg); err != nil {
				return err
			}
		}
	}
}

// SetScene stores scene metadata and notifies scene subscribers.
func (svc *DrawService) SetScene(
	_ context.Context,
	req *connect.Request[drawv1.SetSceneRequest],
) (*connect.Response[drawv1.SetSceneResponse], error) {
	if req.Msg.GetSceneMetadata() == nil {
		return nil, connect.NewError(connect.CodeInvalidArgument, errors.New("scene_metadata is required"))
	}

	svc.mu.Lock()
	defer svc.mu.Unlock()

	svc.sceneMetadata = req.Msg.GetSceneMetadata()
	svc.notifySceneChange(&drawv1.StreamSceneChangesResponse{
		SceneMetadata: svc.sceneMetadata,
	})

	return connect.NewResponse(&drawv1.SetSceneResponse{}), nil
}

// StreamSceneChanges streams scene metadata changes to the caller until the context is cancelled.
func (svc *DrawService) StreamSceneChanges(
	ctx context.Context,
	_ *connect.Request[drawv1.StreamSceneChangesRequest],
	stream *connect.ServerStream[drawv1.StreamSceneChangesResponse],
) error {
	svc.mu.Lock()
	subID, ch := svc.addSceneSub()
	svc.mu.Unlock()

	defer func() {
		svc.mu.Lock()
		svc.removeSceneSub(subID)
		svc.mu.Unlock()
	}()

	for {
		select {
		case <-ctx.Done():
			return nil
		case msg, ok := <-ch:
			if !ok {
				return nil
			}
			if err := stream.Send(msg); err != nil {
				return err
			}
		}
	}
}

// RemoveAllTransforms removes all transform entities from the scene and returns the count removed.
func (svc *DrawService) RemoveAllTransforms(
	_ context.Context,
	_ *connect.Request[drawv1.RemoveAllTransformsRequest],
) (*connect.Response[drawv1.RemoveAllTransformsResponse], error) {
	svc.mu.Lock()
	defer svc.mu.Unlock()

	var count int32
	for id, entity := range svc.entities {
		if entity.kind != entityKindTransform {
			continue
		}
		delete(svc.entities, id)
		count++
		svc.notifyEntityChange(&drawv1.StreamEntityChangesResponse{
			ChangeType: drawv1.EntityChangeType_ENTITY_CHANGE_TYPE_REMOVED,
			Entity:     &drawv1.StreamEntityChangesResponse_Transform{Transform: entity.transform},
		})
	}

	return connect.NewResponse(&drawv1.RemoveAllTransformsResponse{Count: count}), nil
}

// RemoveAllDrawings removes all drawing entities from the scene and returns the count removed.
func (svc *DrawService) RemoveAllDrawings(
	_ context.Context,
	_ *connect.Request[drawv1.RemoveAllDrawingsRequest],
) (*connect.Response[drawv1.RemoveAllDrawingsResponse], error) {
	svc.mu.Lock()
	defer svc.mu.Unlock()

	var count int32
	for id, entity := range svc.entities {
		if entity.kind != entityKindDrawing {
			continue
		}
		delete(svc.entities, id)
		count++
		svc.notifyEntityChange(&drawv1.StreamEntityChangesResponse{
			ChangeType: drawv1.EntityChangeType_ENTITY_CHANGE_TYPE_REMOVED,
			Entity:     &drawv1.StreamEntityChangesResponse_Drawing{Drawing: entity.drawing},
		})
	}

	return connect.NewResponse(&drawv1.RemoveAllDrawingsResponse{Count: count}), nil
}

// RemoveAll removes all entities (transforms and drawings) from the scene.
func (svc *DrawService) RemoveAll(
	_ context.Context,
	_ *connect.Request[drawv1.RemoveAllRequest],
) (*connect.Response[drawv1.RemoveAllResponse], error) {
	svc.mu.Lock()
	defer svc.mu.Unlock()

	var transformCount, drawingCount int32
	for id, entity := range svc.entities {
		delete(svc.entities, id)
		switch entity.kind {
		case entityKindTransform:
			transformCount++
			svc.notifyEntityChange(&drawv1.StreamEntityChangesResponse{
				ChangeType: drawv1.EntityChangeType_ENTITY_CHANGE_TYPE_REMOVED,
				Entity:     &drawv1.StreamEntityChangesResponse_Transform{Transform: entity.transform},
			})
		case entityKindDrawing:
			drawingCount++
			svc.notifyEntityChange(&drawv1.StreamEntityChangesResponse{
				ChangeType: drawv1.EntityChangeType_ENTITY_CHANGE_TYPE_REMOVED,
				Entity:     &drawv1.StreamEntityChangesResponse_Drawing{Drawing: entity.drawing},
			})
		}
	}

	return connect.NewResponse(&drawv1.RemoveAllResponse{
		TransformCount: transformCount,
		DrawingCount:   drawingCount,
	}), nil
}
