package draw

import (
	"context"
	"errors"
	"fmt"
	"log"
	"os"
	"path/filepath"
	"sync"
	"sync/atomic"

	"bytes"

	"connectrpc.com/connect"
	"github.com/google/uuid"
	drawv1 "github.com/viam-labs/motion-tools/draw/v1"
	"github.com/viam-labs/motion-tools/draw/v1/drawv1connect"
	commonv1 "go.viam.com/api/common/v1"
	"google.golang.org/protobuf/proto"
	"google.golang.org/protobuf/reflect/protoreflect"
	"google.golang.org/protobuf/types/known/fieldmaskpb"
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

type chunkedEntity struct {
	mu               sync.Mutex
	cond             *sync.Cond
	metadata         *drawv1.Chunks
	data             *diskBuffer
	colors           *diskBuffer
	opacities        *diskBuffer
	template         *drawv1.Drawing
	chunkComplete    bool
	opacitiesUniform bool // true when each chunk contributes exactly 1 opacity byte (uniform alpha)
}

func newChunkedEntity(meta *drawv1.Chunks, template *drawv1.Drawing, tempDir string) (*chunkedEntity, error) {
	data, err := newDiskBuffer(tempDir, "chunk-data-*")
	if err != nil {
		return nil, err
	}
	colors, err := newDiskBuffer(tempDir, "chunk-colors-*")
	if err != nil {
		data.close()
		return nil, err
	}
	opacities, err := newDiskBuffer(tempDir, "chunk-opacities-*")
	if err != nil {
		data.close()
		colors.close()
		return nil, err
	}

	entity := &chunkedEntity{
		metadata:  meta,
		data:      data,
		colors:    colors,
		opacities: opacities,
		template:  template,
	}
	entity.cond = sync.NewCond(&entity.mu)
	return entity, nil
}

func (entity *chunkedEntity) close() {
	entity.mu.Lock()
	entity.chunkComplete = true
	entity.cond.Broadcast()
	entity.mu.Unlock()
	entity.data.close()
	entity.colors.close()
	entity.opacities.close()
}

// DrawService stores transforms and drawings keyed by UUID and fans out change events to streaming subscribers.
type DrawService struct {
	mu            sync.RWMutex
	entities      map[uuid.UUID]storedEntity
	chunked       map[uuid.UUID]*chunkedEntity
	sceneMetadata *drawv1.SceneMetadata
	tempDir       string

	entitySubs map[uint64]chan *drawv1.StreamEntityChangesResponse
	sceneSubs  map[uint64]chan *drawv1.StreamSceneChangesResponse
	nextSubID  atomic.Uint64
}

// NewDrawService creates a new DrawService ready to serve requests.
func NewDrawService(tempDir string) *DrawService {
	if tempDir == "" {
		tempDir = os.TempDir()
	}
	if err := os.MkdirAll(tempDir, 0o755); err != nil {
		log.Printf("draw: failed to create temp dir %s: %v", tempDir, err)
	}
	cleanTempDir(tempDir)
	return &DrawService{
		entities:      make(map[uuid.UUID]storedEntity),
		chunked:       make(map[uuid.UUID]*chunkedEntity),
		sceneMetadata: nil,
		tempDir:       tempDir,
		entitySubs:    make(map[uint64]chan *drawv1.StreamEntityChangesResponse),
		sceneSubs:     make(map[uint64]chan *drawv1.StreamSceneChangesResponse),
	}
}

func cleanTempDir(dir string) {
	entries, err := os.ReadDir(dir)
	if err != nil {
		return
	}
	removed := 0
	for _, e := range entries {
		if e.IsDir() {
			continue
		}
		if err := os.Remove(filepath.Join(dir, e.Name())); err == nil {
			removed++
		}
	}
	if removed > 0 {
		log.Printf("draw: cleaned %d stale temp files from %s", removed, dir)
	}
}

func (svc *DrawService) notifyEntityChange(msg *drawv1.StreamEntityChangesResponse) {
	for _, ch := range svc.entitySubs {
		select {
		case ch <- msg:
		default:
			log.Printf("draw: entity change dropped for slow consumer")
		}
	}
}

func (svc *DrawService) notifySceneChange(msg *drawv1.StreamSceneChangesResponse) {
	for _, ch := range svc.sceneSubs {
		select {
		case ch <- msg:
		default:
			log.Printf("draw: scene change dropped for slow consumer")
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

		metadata := e.Drawing.GetMetadata()
		if chunks := metadata.GetChunks(); chunks != nil {
			if data, ok := extractShapeData(e.Drawing); ok {
				template := proto.Clone(e.Drawing).(*drawv1.Drawing)
				entity, err := newChunkedEntity(chunks, template, svc.tempDir)
				if err != nil {
					return nil, connect.NewError(connect.CodeInternal, fmt.Errorf("create chunked entity: %w", err))
				}
				entity.mu.Lock()
				if err := entity.data.write(data); err != nil {
					entity.mu.Unlock()
					entity.close()
					return nil, connect.NewError(connect.CodeInternal, fmt.Errorf("write initial chunk: %w", err))
				}
				if metadata != nil {
					if err := entity.colors.write(metadata.GetColors()); err != nil {
						entity.mu.Unlock()
						entity.close()
						return nil, connect.NewError(connect.CodeInternal, fmt.Errorf("write initial colors: %w", err))
					}
					opacities := metadata.GetOpacities()
					entity.opacitiesUniform = len(opacities) == 1
					if err := entity.opacities.write(opacities); err != nil {
						entity.mu.Unlock()
						entity.close()
						return nil, connect.NewError(connect.CodeInternal, fmt.Errorf("write initial opacities: %w", err))
					}
				}
				entity.mu.Unlock()
				svc.chunked[id] = entity
				log.Printf("draw: chunked entity %s created (total=%d, chunk_size=%d)",
					id, entity.metadata.GetTotal(), entity.metadata.GetChunkSize())
			}
		}

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

// extractShapeData returns the raw position/pose bytes from any shape type.
func extractShapeData(d *drawv1.Drawing) ([]byte, bool) {
	if d == nil || d.PhysicalObject == nil {
		return nil, false
	}
	switch g := d.PhysicalObject.GeometryType.(type) {
	case *drawv1.Shape_Points:
		return g.Points.GetPositions(), true
	case *drawv1.Shape_Arrows:
		return g.Arrows.GetPoses(), true
	case *drawv1.Shape_Line:
		return g.Line.GetPositions(), true
	case *drawv1.Shape_Nurbs:
		return g.Nurbs.GetControlPoints(), true
	default:
		return nil, false
	}
}

// setShapeData replaces the raw position/pose bytes in a drawing's shape.
func setShapeData(d *drawv1.Drawing, data []byte) {
	if d == nil || d.PhysicalObject == nil {
		return
	}
	switch g := d.PhysicalObject.GeometryType.(type) {
	case *drawv1.Shape_Points:
		g.Points.Positions = data
	case *drawv1.Shape_Arrows:
		g.Arrows.Poses = data
	case *drawv1.Shape_Line:
		g.Line.Positions = data
	case *drawv1.Shape_Nurbs:
		g.Nurbs.ControlPoints = data
	}
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

		if entity, ok := svc.chunked[id]; ok {
			if err := svc.accumulateChunk(entity, e.Drawing); err != nil {
				return nil, connect.NewError(connect.CodeInternal, fmt.Errorf("accumulate chunk: %w", err))
			}
			return connect.NewResponse(&drawv1.UpdateEntityResponse{}), nil
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

func (svc *DrawService) accumulateChunk(entity *chunkedEntity, drawing *drawv1.Drawing) error {
	data, ok := extractShapeData(drawing)
	if !ok {
		return fmt.Errorf("no shape data in drawing")
	}

	entity.mu.Lock()
	defer entity.mu.Unlock()

	if err := entity.data.write(data); err != nil {
		return fmt.Errorf("write positions: %w", err)
	}
	if md := drawing.GetMetadata(); md != nil {
		if err := entity.colors.write(md.GetColors()); err != nil {
			return fmt.Errorf("write colors: %w", err)
		}
		if err := entity.opacities.write(md.GetOpacities()); err != nil {
			return fmt.Errorf("write opacities: %w", err)
		}
	}

	elementsReceived := entity.data.bytesWritten / int64(entity.metadata.Stride)
	if elementsReceived >= int64(entity.metadata.Total) {
		entity.chunkComplete = true
		log.Printf("draw: chunk accumulation complete (%d/%d elements)", elementsReceived, entity.metadata.Total)
	}

	entity.cond.Broadcast()
	return nil
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

func entityMetadataRelationships(e storedEntity) []*drawv1.Relationship {
	switch e.kind {
	case entityKindDrawing:
		if e.drawing.Metadata == nil {
			return nil
		}
		return e.drawing.Metadata.Relationships
	case entityKindTransform:
		return RelationshipsFromStruct(e.transform.Metadata)
	}
	return nil
}

func setEntityMetadataRelationships(e *storedEntity, rels []*drawv1.Relationship) {
	switch e.kind {
	case entityKindDrawing:
		if e.drawing.Metadata == nil {
			e.drawing.Metadata = &drawv1.Metadata{}
		}
		e.drawing.Metadata.Relationships = rels
	case entityKindTransform:
		if e.transform.Metadata == nil {
			e.transform.Metadata = MetadataToStruct(NewMetadata())
		}
		SetRelationshipsOnStruct(e.transform.Metadata, rels)
	}
}

func entityAddedMsg(e storedEntity) *drawv1.StreamEntityChangesResponse {
	msg := &drawv1.StreamEntityChangesResponse{
		ChangeType: drawv1.EntityChangeType_ENTITY_CHANGE_TYPE_ADDED,
	}
	switch e.kind {
	case entityKindTransform:
		msg.Entity = &drawv1.StreamEntityChangesResponse_Transform{Transform: e.transform}
	case entityKindDrawing:
		msg.Entity = &drawv1.StreamEntityChangesResponse_Drawing{Drawing: e.drawing}
	}
	return msg
}

func entityChangeMsg(e storedEntity) *drawv1.StreamEntityChangesResponse {
	msg := &drawv1.StreamEntityChangesResponse{
		ChangeType:    drawv1.EntityChangeType_ENTITY_CHANGE_TYPE_UPDATED,
		UpdatedFields: &fieldmaskpb.FieldMask{Paths: []string{"metadata"}},
	}
	switch e.kind {
	case entityKindTransform:
		msg.Entity = &drawv1.StreamEntityChangesResponse_Transform{Transform: e.transform}
	case entityKindDrawing:
		msg.Entity = &drawv1.StreamEntityChangesResponse_Drawing{Drawing: e.drawing}
	}
	return msg
}

// CreateRelationship creates or replaces a relationship from source to the target specified
// in the relationship. The relationship is stored in the source entity's metadata.
func (svc *DrawService) CreateRelationship(
	_ context.Context,
	req *connect.Request[drawv1.CreateRelationshipRequest],
) (*connect.Response[drawv1.CreateRelationshipResponse], error) {
	if len(req.Msg.GetSourceUuid()) == 0 {
		return nil, connect.NewError(connect.CodeInvalidArgument, errors.New("source_uuid is required"))
	}
	if req.Msg.GetRelationship() == nil {
		return nil, connect.NewError(connect.CodeInvalidArgument, errors.New("relationship is required"))
	}
	if len(req.Msg.GetRelationship().GetTargetUuid()) == 0 {
		return nil, connect.NewError(connect.CodeInvalidArgument, errors.New("relationship.target_uuid is required"))
	}

	sourceID, err := uuid.FromBytes(req.Msg.GetSourceUuid())
	if err != nil {
		return nil, connect.NewError(connect.CodeInvalidArgument, fmt.Errorf("invalid source_uuid: %w", err))
	}
	targetID, err := uuid.FromBytes(req.Msg.GetRelationship().GetTargetUuid())
	if err != nil {
		return nil, connect.NewError(connect.CodeInvalidArgument, fmt.Errorf("invalid target_uuid: %w", err))
	}
	if sourceID == targetID {
		return nil, connect.NewError(connect.CodeInvalidArgument, errors.New("source_uuid and target_uuid must differ"))
	}

	svc.mu.Lock()
	defer svc.mu.Unlock()

	source, ok := svc.entities[sourceID]
	if !ok {
		return nil, connect.NewError(connect.CodeNotFound, fmt.Errorf("source entity %s not found", sourceID))
	}
	if _, ok := svc.entities[targetID]; !ok {
		return nil, connect.NewError(connect.CodeNotFound, fmt.Errorf("target entity %s not found", targetID))
	}

	rels := entityMetadataRelationships(source)
	replaced := false
	for i, r := range rels {
		if bytes.Equal(r.TargetUuid, req.Msg.Relationship.TargetUuid) {
			rels[i] = req.Msg.Relationship
			replaced = true
			break
		}
	}
	if !replaced {
		rels = append(rels, req.Msg.Relationship)
	}
	setEntityMetadataRelationships(&source, rels)
	svc.entities[sourceID] = source

	svc.notifyEntityChange(entityChangeMsg(source))

	return connect.NewResponse(&drawv1.CreateRelationshipResponse{}), nil
}

// DeleteRelationship removes the relationship from source to target_uuid.
func (svc *DrawService) DeleteRelationship(
	_ context.Context,
	req *connect.Request[drawv1.DeleteRelationshipRequest],
) (*connect.Response[drawv1.DeleteRelationshipResponse], error) {
	if len(req.Msg.GetSourceUuid()) == 0 {
		return nil, connect.NewError(connect.CodeInvalidArgument, errors.New("source_uuid is required"))
	}
	if len(req.Msg.GetTargetUuid()) == 0 {
		return nil, connect.NewError(connect.CodeInvalidArgument, errors.New("target_uuid is required"))
	}

	sourceID, err := uuid.FromBytes(req.Msg.GetSourceUuid())
	if err != nil {
		return nil, connect.NewError(connect.CodeInvalidArgument, fmt.Errorf("invalid source_uuid: %w", err))
	}

	svc.mu.Lock()
	defer svc.mu.Unlock()

	source, ok := svc.entities[sourceID]
	if !ok {
		return nil, connect.NewError(connect.CodeNotFound, fmt.Errorf("source entity %s not found", sourceID))
	}

	rels := entityMetadataRelationships(source)
	found := false
	filtered := make([]*drawv1.Relationship, 0, len(rels))
	for _, r := range rels {
		if bytes.Equal(r.TargetUuid, req.Msg.TargetUuid) {
			found = true
			continue
		}
		filtered = append(filtered, r)
	}
	if !found {
		return nil, connect.NewError(connect.CodeNotFound, errors.New("relationship not found"))
	}

	setEntityMetadataRelationships(&source, filtered)
	svc.entities[sourceID] = source

	svc.notifyEntityChange(entityChangeMsg(source))

	return connect.NewResponse(&drawv1.DeleteRelationshipResponse{}), nil
}

// cascadeRemoveRelationships removes any relationship pointing at removedID from all remaining
// entities, emitting UPDATED events for each affected source.
func (svc *DrawService) cascadeRemoveRelationships(removedID uuid.UUID) {
	for id, entity := range svc.entities {
		rels := entityMetadataRelationships(entity)
		if len(rels) == 0 {
			continue
		}
		filtered := make([]*drawv1.Relationship, 0, len(rels))
		for _, r := range rels {
			if bytes.Equal(r.TargetUuid, removedID[:]) {
				continue
			}
			filtered = append(filtered, r)
		}
		if len(filtered) == len(rels) {
			continue
		}
		setEntityMetadataRelationships(&entity, filtered)
		svc.entities[id] = entity
		svc.notifyEntityChange(entityChangeMsg(entity))
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
	if entity, ok := svc.chunked[id]; ok {
		entity.close()
		delete(svc.chunked, id)
	}

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
	svc.cascadeRemoveRelationships(id)

	return connect.NewResponse(&drawv1.RemoveEntityResponse{}), nil
}

// GetEntityChunk returns a chunk of accumulated data for a chunked entity.
// Blocks until the requested data is available or the context is cancelled.
func (svc *DrawService) GetEntityChunk(
	ctx context.Context,
	req *connect.Request[drawv1.GetEntityChunkRequest],
) (*connect.Response[drawv1.GetEntityChunkResponse], error) {
	if len(req.Msg.GetUuid()) == 0 {
		return nil, connect.NewError(connect.CodeInvalidArgument, errors.New("uuid is required"))
	}

	id, err := uuid.FromBytes(req.Msg.GetUuid())
	if err != nil {
		return nil, connect.NewError(connect.CodeInvalidArgument, fmt.Errorf("invalid uuid: %w", err))
	}

	svc.mu.RLock()
	entity, ok := svc.chunked[id]
	svc.mu.RUnlock()
	if !ok {
		return nil, connect.NewError(connect.CodeNotFound, fmt.Errorf("chunked entity %s not found", id))
	}

	start := req.Msg.GetStart()
	startByte := int64(start) * int64(entity.metadata.Stride)

	entity.mu.Lock()

	ctxDone := make(chan struct{})
	go func() {
		select {
		case <-ctx.Done():
			entity.cond.Broadcast()
		case <-ctxDone:
		}
	}()

	for entity.data.bytesWritten <= startByte && !entity.chunkComplete {
		entity.cond.Wait()
		if ctx.Err() != nil {
			close(ctxDone)
			entity.mu.Unlock()
			return nil, connect.NewError(connect.CodeCanceled, ctx.Err())
		}
	}
	close(ctxDone)

	posLen := entity.data.bytesWritten
	if startByte >= posLen {
		entity.mu.Unlock()
		return connect.NewResponse(&drawv1.GetEntityChunkResponse{Done: true}), nil
	}

	drawing, chunkElements, err := entity.buildChunkDrawing(start)
	done := (start+chunkElements >= entity.metadata.Total) && entity.chunkComplete

	entity.mu.Unlock()

	if err != nil {
		return nil, connect.NewError(connect.CodeInternal, fmt.Errorf("build chunk drawing: %w", err))
	}

	log.Printf("draw: served chunk=%d start=%d elements=%d done=%t", id, start, chunkElements, done)

	return connect.NewResponse(&drawv1.GetEntityChunkResponse{
		Entity: &drawv1.GetEntityChunkResponse_Drawing{Drawing: drawing},
		Start:  start,
		Done:   done,
	}), nil
}

// StreamEntityChanges streams entity change events (add/update/remove) to the caller until the context is cancelled.
// On connect, replays the current world state so new subscribers see all existing entities.
func (svc *DrawService) StreamEntityChanges(
	ctx context.Context,
	_ *connect.Request[drawv1.StreamEntityChangesRequest],
	stream *connect.ServerStream[drawv1.StreamEntityChangesResponse],
) error {
	svc.mu.Lock()
	subID, ch := svc.addEntitySub()

	replay := make([]*drawv1.StreamEntityChangesResponse, 0, len(svc.entities))
	for id, entity := range svc.entities {
		switch entity.kind {
		case entityKindTransform:
			replay = append(replay, &drawv1.StreamEntityChangesResponse{
				ChangeType: drawv1.EntityChangeType_ENTITY_CHANGE_TYPE_ADDED,
				Entity:     &drawv1.StreamEntityChangesResponse_Transform{Transform: entity.transform},
			})
		case entityKindDrawing:
			if chunked, ok := svc.chunked[id]; ok {
				if msg := svc.buildChunkedReplayMsg(chunked); msg != nil {
					replay = append(replay, msg)
				}
			} else {
				replay = append(replay, &drawv1.StreamEntityChangesResponse{
					ChangeType: drawv1.EntityChangeType_ENTITY_CHANGE_TYPE_ADDED,
					Entity:     &drawv1.StreamEntityChangesResponse_Drawing{Drawing: entity.drawing},
				})
			}
		}
	}
	svc.mu.Unlock()

	for _, msg := range replay {
		if err := stream.Send(msg); err != nil {
			return err
		}
	}

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

func (entity *chunkedEntity) buildChunkDrawing(start uint32) (*drawv1.Drawing, uint32, error) {
	stride := int64(entity.metadata.Stride)
	startByte := int64(start) * stride
	endByte := startByte + int64(entity.metadata.ChunkSize)*stride
	if endByte > entity.data.bytesWritten {
		endByte = entity.data.bytesWritten
	}

	// mu must be held here: bytesWritten is updated by accumulateChunk under the same lock,
	// so reading it and the file data forms a consistent snapshot.
	chunkData, err := entity.data.readSlice(startByte, endByte-startByte)
	if err != nil {
		return nil, 0, fmt.Errorf("read chunk data: %w", err)
	}

	chunkElements := uint32((endByte - startByte) / stride)

	var chunkColors, chunkOpacities []byte
	colorStart := int64(start) * 3
	colorEnd := colorStart + int64(chunkElements)*3
	if entity.colors.bytesWritten >= colorEnd {
		chunkColors, _ = entity.colors.readSlice(colorStart, colorEnd-colorStart)
	}
	if entity.opacitiesUniform {
		// One byte per chunk (opacitySummary produced a single shared alpha).
		chunkIndex := int64(start / entity.metadata.ChunkSize)
		if entity.opacities.bytesWritten > chunkIndex {
			chunkOpacities, _ = entity.opacities.readSlice(chunkIndex, 1)
		}
	} else {
		opacityEnd := int64(start + chunkElements)
		if entity.opacities.bytesWritten >= opacityEnd {
			chunkOpacities, _ = entity.opacities.readSlice(int64(start), opacityEnd-int64(start))
		}
	}

	drawing := proto.Clone(entity.template).(*drawv1.Drawing)
	setShapeData(drawing, chunkData)

	if len(chunkColors) > 0 || len(chunkOpacities) > 0 {
		md := &drawv1.Metadata{}
		if len(chunkColors) > 0 {
			md.Colors = chunkColors
		}
		if len(chunkOpacities) > 0 {
			md.Opacities = chunkOpacities
		}
		drawing.Metadata = md
	}

	return drawing, chunkElements, nil
}

func (svc *DrawService) buildChunkedReplayMsg(entity *chunkedEntity) *drawv1.StreamEntityChangesResponse {
	entity.mu.Lock()
	defer entity.mu.Unlock()

	drawing, _, err := entity.buildChunkDrawing(0)
	if err != nil {
		log.Printf("draw: failed to build chunk drawing for replay: %v", err)
		return nil
	}

	return &drawv1.StreamEntityChangesResponse{
		ChangeType: drawv1.EntityChangeType_ENTITY_CHANGE_TYPE_ADDED,
		Entity:     &drawv1.StreamEntityChangesResponse_Drawing{Drawing: drawing},
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

	removedIDs := make([]uuid.UUID, 0)
	var count int32
	for id, entity := range svc.entities {
		if entity.kind != entityKindTransform {
			continue
		}
		delete(svc.entities, id)
		count++
		removedIDs = append(removedIDs, id)
		svc.notifyEntityChange(&drawv1.StreamEntityChangesResponse{
			ChangeType: drawv1.EntityChangeType_ENTITY_CHANGE_TYPE_REMOVED,
			Entity:     &drawv1.StreamEntityChangesResponse_Transform{Transform: entity.transform},
		})
	}
	for _, id := range removedIDs {
		svc.cascadeRemoveRelationships(id)
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

	removedIDs := make([]uuid.UUID, 0)
	var count int32
	for id, entity := range svc.entities {
		if entity.kind != entityKindDrawing {
			continue
		}
		delete(svc.entities, id)
		if chunked, ok := svc.chunked[id]; ok {
			chunked.close()
			delete(svc.chunked, id)
		}
		count++
		removedIDs = append(removedIDs, id)
		svc.notifyEntityChange(&drawv1.StreamEntityChangesResponse{
			ChangeType: drawv1.EntityChangeType_ENTITY_CHANGE_TYPE_REMOVED,
			Entity:     &drawv1.StreamEntityChangesResponse_Drawing{Drawing: entity.drawing},
		})
	}
	for _, id := range removedIDs {
		svc.cascadeRemoveRelationships(id)
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
		if chunked, ok := svc.chunked[id]; ok {
			chunked.close()
			delete(svc.chunked, id)
		}
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
