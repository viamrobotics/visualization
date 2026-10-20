package draw

import (
	"bytes"
	"context"
	"errors"
	"fmt"
	"log"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"sync/atomic"

	"connectrpc.com/connect"
	"github.com/google/uuid"
	drawv1 "github.com/viamrobotics/visualization/draw/v1"
	"github.com/viamrobotics/visualization/draw/v1/drawv1connect"
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

// DrawService is the in-memory backing store and Connect-RPC handler for the draw service. It
// keeps every transform and drawing keyed by UUID, persists scene metadata, and fans out
// add/update/remove events to streaming subscribers.
//
// Chunked drawings (point clouds and similar large entities) are accumulated to disk under a
// configurable temp directory and served on demand via GetEntityChunk. The rest of the state
// lives entirely in memory.
//
// All public methods are safe for concurrent use.
type DrawService struct {
	mu            sync.RWMutex
	entities      map[uuid.UUID]storedEntity
	chunked       map[uuid.UUID]*chunkedEntity
	sceneMetadata *drawv1.SceneMetadata
	tempDir       string

	entitySubs map[uint64]*entitySubscriber
	sceneSubs  map[uint64]*sceneSubscriber
	nextSubID  atomic.Uint64
}

// NewDrawService returns a DrawService whose chunked-entity payloads are buffered
// in tempDir. If tempDir is empty, os.TempDir is used. The directory is created
// if it does not exist and any stale chunk files left over from a previous run
// are removed at startup. NewDrawService never fails: directory or cleanup
// errors are logged and the service is returned anyway.
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
		entitySubs:    make(map[uint64]*entitySubscriber),
		sceneSubs:     make(map[uint64]*sceneSubscriber),
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

// notifyEntityChange publishes a change to every entity subscriber. A nil msg is ignored.
//
// Callers hold svc.mu. That is safe because push only takes the subscriber's own lock and a
// non-blocking channel send, so it cannot block on a stalled consumer. The lock order is
// always svc.mu then sub.mu, and svc.mu is never held across a stream.Send.
//
// Invariant: the entity carried by msg must not be mutated afterwards. The message is queued
// by pointer and may be marshalled on another goroutine at any later time. To change a stored
// entity, clone it, mutate the clone, and replace the stored pointer — see
// withEntityMetadataRelationships.
func (svc *DrawService) notifyEntityChange(msg *drawv1.StreamEntityChangesResponse) {
	if msg == nil {
		return
	}
	for _, sub := range svc.entitySubs {
		sub.push(msg)
	}
}

// notifyEntityCleared publishes a single bulk-removal event covering every entity in scope,
// rather than one REMOVED per entity. Clearing a large scene would otherwise publish hundreds of
// messages in one lock hold.
func (svc *DrawService) notifyEntityCleared(scope drawv1.EntityScope) {
	svc.notifyEntityChange(&drawv1.StreamEntityChangesResponse{
		ChangeType:   drawv1.EntityChangeType_ENTITY_CHANGE_TYPE_REMOVED,
		ClearedScope: scope,
	})
}

func (svc *DrawService) notifySceneChange(msg *drawv1.StreamSceneChangesResponse) {
	if msg == nil {
		return
	}
	for _, sub := range svc.sceneSubs {
		sub.push(msg)
	}
}

func (svc *DrawService) addEntitySub() (uint64, *entitySubscriber) {
	id := svc.nextSubID.Add(1)
	sub := newEntitySubscriber()
	svc.entitySubs[id] = sub
	return id, sub
}

func (svc *DrawService) removeEntitySub(id uint64) {
	if sub, ok := svc.entitySubs[id]; ok {
		delete(svc.entitySubs, id)
		sub.close()
	}
}

func (svc *DrawService) addSceneSub() (uint64, *sceneSubscriber) {
	id := svc.nextSubID.Add(1)
	sub := newSceneSubscriber()
	svc.sceneSubs[id] = sub
	return id, sub
}

func (svc *DrawService) removeSceneSub(id uint64) {
	if sub, ok := svc.sceneSubs[id]; ok {
		delete(svc.sceneSubs, id)
		sub.close()
	}
}

// AddEntity stores a transform or drawing and returns the assigned UUID. If the incoming
// entity carries a valid Uuid, that ID is used, replacing any existing entity with the same
// ID — an upsert. Otherwise a fresh UUID is generated.
//
// Drawings whose metadata.chunks field is set are registered as chunked entities: the first
// call captures the template and the initial chunk, and subsequent chunks must be delivered
// via UpdateEntity.
//
// Returns InvalidArgument if the entity, transform, or drawing field is missing, and Internal
// if a chunked entity cannot be initialized on disk.
func (svc *DrawService) AddEntity(
	_ context.Context,
	req *connect.Request[drawv1.AddEntityRequest],
) (*connect.Response[drawv1.AddEntityResponse], error) {
	svc.mu.Lock()
	defer svc.mu.Unlock()

	id, err := svc.addEntityLocked(req.Msg)
	if err != nil {
		return nil, err
	}

	return connect.NewResponse(&drawv1.AddEntityResponse{Uuid: id[:]}), nil
}

// AddEntities stores every entity in the batch and returns their UUIDs in request order.
// Semantics per entity match AddEntity, and the batch is applied under a single lock so no
// other RPC observes the store midway through it.
//
// Returns InvalidArgument if the batch is empty or any entity is malformed. Every entity is
// checked before any is stored, so a malformed entity anywhere in the batch leaves the store
// untouched. That guarantee does not extend to Internal errors: a chunked drawing whose buffer
// cannot be created partway through the batch leaves the entities before it stored.
//
// Note this is atomic with respect to the store, not to stream subscribers. Changes are queued
// per entity and delivered as the consumer drains them, so a subscriber can observe part of a
// batch before the rest arrives.
func (svc *DrawService) AddEntities(
	_ context.Context,
	req *connect.Request[drawv1.AddEntitiesRequest],
) (*connect.Response[drawv1.AddEntitiesResponse], error) {
	entities := req.Msg.GetEntities()
	if len(entities) == 0 {
		return nil, connect.NewError(connect.CodeInvalidArgument, errors.New("entities is required"))
	}

	for i, entity := range entities {
		if err := validateAddEntity(entity); err != nil {
			return nil, fmt.Errorf("entity %d: %w", i, err)
		}
	}

	svc.mu.Lock()
	defer svc.mu.Unlock()

	uuids := make([][]byte, 0, len(entities))
	for i, entity := range entities {
		id, err := svc.addEntityLocked(entity)
		if err != nil {
			return nil, fmt.Errorf("entity %d: %w", i, err)
		}
		uuids = append(uuids, id[:])
	}

	return connect.NewResponse(&drawv1.AddEntitiesResponse{Uuids: uuids}), nil
}

// validateAddEntity reports whether a request carries a well-formed entity. Kept separate from
// addEntityLocked so a batch can be checked in full before any of it is stored.
func validateAddEntity(msg *drawv1.AddEntityRequest) error {
	switch e := msg.GetEntity().(type) {
	case *drawv1.AddEntityRequest_Transform:
		if e.Transform == nil {
			return connect.NewError(connect.CodeInvalidArgument, errors.New("transform is required"))
		}
	case *drawv1.AddEntityRequest_Drawing:
		if e.Drawing == nil {
			return connect.NewError(connect.CodeInvalidArgument, errors.New("drawing is required"))
		}
	case nil:
		return connect.NewError(connect.CodeInvalidArgument, errors.New("entity is required"))
	default:
		return connect.NewError(connect.CodeInvalidArgument, errors.New("entity must be a transform or drawing"))
	}
	return nil
}

// addEntityLocked stores one entity and publishes its change. svc.mu must be held.
func (svc *DrawService) addEntityLocked(msg *drawv1.AddEntityRequest) (uuid.UUID, error) {
	var id uuid.UUID
	if msg.GetEntity() == nil {
		return id, connect.NewError(connect.CodeInvalidArgument, errors.New("entity is required"))
	}

	var changeMsg *drawv1.StreamEntityChangesResponse

	switch e := msg.Entity.(type) {
	case *drawv1.AddEntityRequest_Transform:
		if e.Transform == nil {
			return id, connect.NewError(connect.CodeInvalidArgument, errors.New("transform is required"))
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
			return id, connect.NewError(connect.CodeInvalidArgument, errors.New("drawing is required"))
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
					return id, connect.NewError(connect.CodeInternal, fmt.Errorf("create chunked entity: %w", err))
				}
				entity.mu.Lock()
				if err := entity.data.write(data); err != nil {
					entity.mu.Unlock()
					entity.close()
					return id, connect.NewError(connect.CodeInternal, fmt.Errorf("write initial chunk: %w", err))
				}
				if metadata != nil {
					if err := entity.colors.write(metadata.GetColors()); err != nil {
						entity.mu.Unlock()
						entity.close()
						return id, connect.NewError(connect.CodeInternal, fmt.Errorf("write initial colors: %w", err))
					}
					opacities := metadata.GetOpacities()
					entity.opacitiesUniform = len(opacities) == 1
					if err := entity.opacities.write(opacities); err != nil {
						entity.mu.Unlock()
						entity.close()
						return id, connect.NewError(connect.CodeInternal, fmt.Errorf("write initial opacities: %w", err))
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
		return id, connect.NewError(connect.CodeInvalidArgument, errors.New("entity must be a transform or drawing"))
	}

	svc.notifyEntityChange(changeMsg)

	return id, nil
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

// UpdateEntity replaces or partially updates an existing entity identified by UUID. When
// updated_fields is non-empty, only the listed proto field paths are merged into the stored
// entity. Otherwise the incoming entity replaces the stored one wholesale. The kind of the
// incoming entity must match the kind of the stored entity (transform vs. drawing).
//
// For chunked drawings, UpdateEntity is also the channel for delivering subsequent chunks:
// each call appends positions, colors, and opacities to the on-disk buffer for the entity.
//
// Returns InvalidArgument for missing or malformed inputs, NotFound when no
// entity has the given UUID, and Internal if a chunk cannot be persisted.
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
		if err := validateFieldMask(e.Transform, req.Msg.GetUpdatedFields().GetPaths()); err != nil {
			return nil, err
		}
		if err := rejectNestedTransformMetadata(req.Msg.GetUpdatedFields().GetPaths()); err != nil {
			return nil, err
		}
		if err := validateTransformUpdate(existing.transform, e.Transform, req.Msg.UpdatedFields); err != nil {
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
		if err := validateFieldMask(e.Drawing, req.Msg.GetUpdatedFields().GetPaths()); err != nil {
			return nil, err
		}
		if err := validateDrawingUpdate(existing.drawing, e.Drawing, req.Msg.UpdatedFields); err != nil {
			return nil, err
		}

		// A chunked drawing receives its payload through UpdateEntity, so an unmasked update is
		// the next chunk. A masked update is a field patch (a recolor, a move) and must not be
		// appended to the buffer.
		//
		// TODO: define how a masked update interacts with the chunk buffer. A chunked entity
		// keeps its element data on disk rather than in physical_object, so a mask that selects
		// the shape (physical_object, or a nested path such as
		// physical_object.points.positions) patches a proto field that is not the source of
		// truth, and the patch is invisible to GetEntityChunk. Masks that only touch metadata or
		// the pose are unaffected. Until this is settled, partial element updates on a chunked
		// entity are undefined; redraw the entity instead.
		// Redraw the entity instead.
		if entity, ok := svc.chunked[id]; ok && len(req.Msg.GetUpdatedFields().GetPaths()) == 0 {
			if err := svc.accumulateChunk(entity, e.Drawing); err != nil {
				return nil, connect.NewError(connect.CodeInternal, fmt.Errorf("accumulate chunk: %w", err))
			}
			return connect.NewResponse(&drawv1.UpdateEntityResponse{}), nil
		}

		updated := applyDrawingUpdate(existing.drawing, e.Drawing, req.Msg.UpdatedFields)
		warnOnAttributeCountMismatch(id, updated)
		svc.entities[id] = storedEntity{kind: entityKindDrawing, drawing: updated}
		svc.syncChunkedTemplate(id, e.Drawing, req.Msg.UpdatedFields)
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

// syncChunkedTemplate applies a partial update to a chunked entity's replay template.
//
// A chunked drawing is replayed to new subscribers from its template rather than from the
// stored entity, because the payload has to be rebuilt from the on-disk buffer. Updating only
// the stored entity would therefore be invisible to anyone connecting later: they would
// receive the pose and metadata the entity was created with, and nothing would ever correct
// it.
//
// Shape masks are skipped. A chunked entity's elements live in the buffer, not in the template's
// physical_object, so there is nothing meaningful to sync; see the TODO in UpdateEntity.
//
// svc.mu must be held.
func (svc *DrawService) syncChunkedTemplate(id uuid.UUID, incoming *drawv1.Drawing, mask *fieldmaskpb.FieldMask) {
	if len(mask.GetPaths()) == 0 || maskSelects(mask, DrawingPathShape) {
		return
	}

	chunked, ok := svc.chunked[id]
	if !ok {
		return
	}

	chunked.mu.Lock()
	defer chunked.mu.Unlock()
	chunked.template = applyDrawingUpdate(chunked.template, incoming, mask)
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

// validateTransformUpdate rejects updates that would change a transform's identity or shape.
//
// Only fields the mask selects are checked: a partial update that leaves reference_frame unset
// is not trying to change it, and reading the unset field as a rename would make every masked
// update fail unless the caller redundantly echoed fields it was not updating.
func validateTransformUpdate(existing, incoming *commonv1.Transform, mask interface{ GetPaths() []string }) error {
	if maskSelects(mask, "reference_frame") && incoming.GetReferenceFrame() != existing.GetReferenceFrame() {
		return connect.NewError(connect.CodeInvalidArgument, fmt.Errorf(
			"cannot change reference_frame from %q to %q; remove the existing entity and add a new one instead",
			existing.GetReferenceFrame(), incoming.GetReferenceFrame(),
		))
	}

	existingCase := transformGeometryTypeCase(existing.GetPhysicalObject())
	incomingCase := transformGeometryTypeCase(incoming.GetPhysicalObject())
	if maskSelects(mask, "physical_object") && existingCase != "" && incomingCase != "" && existingCase != incomingCase {
		return connect.NewError(connect.CodeInvalidArgument, fmt.Errorf(
			"cannot change physical_object geometry type from %q to %q; remove the existing entity and add a new one instead",
			existingCase, incomingCase,
		))
	}

	return nil
}

// validateDrawingUpdate mirrors validateTransformUpdate. See that function for why the mask
// gates each check.
func validateDrawingUpdate(existing, incoming *drawv1.Drawing, mask interface{ GetPaths() []string }) error {
	if maskSelects(mask, "reference_frame") && incoming.GetReferenceFrame() != existing.GetReferenceFrame() {
		return connect.NewError(connect.CodeInvalidArgument, fmt.Errorf(
			"cannot change reference_frame from %q to %q; remove the existing entity and add a new one instead",
			existing.GetReferenceFrame(), incoming.GetReferenceFrame(),
		))
	}

	existingCase := drawingShapeTypeCase(existing.GetPhysicalObject())
	incomingCase := drawingShapeTypeCase(incoming.GetPhysicalObject())
	if maskSelects(mask, "physical_object") && existingCase != "" && incomingCase != "" && existingCase != incomingCase {
		return connect.NewError(connect.CodeInvalidArgument, fmt.Errorf(
			"cannot change physical_object geometry type from %q to %q; remove the existing entity and add a new one instead",
			existingCase, incomingCase,
		))
	}

	return nil
}

// validateFieldMask checks every path in the mask against msg's descriptor.
//
// FieldMask paths are proto field names (snake_case), not Go or JSON names, and may name a
// nested field with dots ("pose_in_observer_frame.pose"). Silently skipping an unrecognized
// path would let a misspelled mask, or one written with the Go name PoseInObserverFrame or the
// JSON name poseInObserverFrame, report success while updating nothing. The FieldMask spec
// requires unmappable paths be rejected with InvalidArgument, so that is what we do.
//
// fieldmaskpb.New does the walk, which also enforces the spec rule that a repeated or map field
// may only appear last in a path.
func validateFieldMask(msg proto.Message, paths []string) error {
	if len(paths) == 0 {
		return nil
	}
	if _, err := fieldmaskpb.New(msg, paths...); err != nil {
		return connect.NewError(connect.CodeInvalidArgument, fmt.Errorf(
			"invalid updated_fields: %w; paths are proto field names such as %s, and may be nested with dots",
			err, strings.Join(fieldNames(msg), ", "),
		))
	}
	return nil
}

func fieldNames(msg proto.Message) []string {
	fields := msg.ProtoReflect().Descriptor().Fields()
	names := make([]string, 0, fields.Len())
	for i := range fields.Len() {
		names = append(names, string(fields.Get(i).Name()))
	}
	return names
}

// rejectNestedTransformMetadata refuses a mask that reaches inside a transform's metadata.
//
// A transform stores metadata as an untyped google.protobuf.Struct, so the only paths a mask can
// express are "metadata" and "metadata.fields", and both replace the whole thing. Accepting
// either of the nested spellings would imply a surgical update that the encoding cannot deliver.
// A drawing's metadata is a typed message and does support per-attribute paths, which is why
// this restriction is specific to transforms.
func rejectNestedTransformMetadata(paths []string) error {
	for _, path := range paths {
		if strings.HasPrefix(path, TransformPathMetadata+".") {
			return connect.NewError(connect.CodeInvalidArgument, fmt.Errorf(
				"updated_fields path %q reaches into a transform's metadata, which is an untyped struct "+
					"and can only be replaced wholesale; select %q and send the complete metadata instead",
				path, TransformPathMetadata,
			))
		}
	}
	return nil
}

// maskSelects reports whether the mask reaches into field, either by naming it outright or by
// naming something within it. An empty mask selects every field, matching the wholesale-replace
// semantics of an UpdateEntity call without a mask.
func maskSelects(mask interface{ GetPaths() []string }, field string) bool {
	if mask == nil || len(mask.GetPaths()) == 0 {
		return true
	}
	for _, path := range mask.GetPaths() {
		if path == field || strings.HasPrefix(path, field+".") {
			return true
		}
	}
	return false
}

// applyFieldMask copies the fields named by paths from src onto dst, leaving everything else on
// dst alone. Paths may be nested ("pose_in_observer_frame.pose"), which is how a caller moves an
// entity without also rewriting the observer frame it is attached to.
//
// Paths are assumed to have been checked by validateFieldMask.
func applyFieldMask(dst, src proto.Message, paths []string) {
	for _, path := range paths {
		applyFieldPath(dst.ProtoReflect(), src.ProtoReflect(), strings.Split(path, "."))
	}
}

func applyFieldPath(dst, src protoreflect.Message, segments []string) {
	fd := dst.Descriptor().Fields().ByName(protoreflect.Name(segments[0]))
	if fd == nil {
		return
	}

	if len(segments) == 1 {
		if !src.Has(fd) {
			// The mask selects this field and the incoming message leaves it unset, which the
			// FieldMask spec defines as a clear rather than a no-op.
			dst.Clear(fd)
			return
		}
		setFieldCloned(dst, src, fd)
		return
	}

	// Descending only makes sense into a singular message. validateFieldMask rejects a path that
	// continues past a scalar, a list, or a map.
	if fd.Message() == nil || fd.IsList() || fd.IsMap() {
		return
	}
	// Nothing on either side, so every leaf under this path is already absent.
	if !src.Has(fd) && !dst.Has(fd) {
		return
	}
	// src.Get on an unset message field yields an empty read-only message, which is what we want:
	// the selected leaves read as unset and are cleared on dst.
	applyFieldPath(dst.Mutable(fd).Message(), src.Get(fd).Message(), segments[1:])
}

// setFieldCloned copies one field from src to dst, deep-copying any message values.
//
// Sharing a message pointer would alias the caller's request proto into the stored entity, which
// is then published to subscribers by pointer and must not change afterwards. Scalars and bytes
// are copied by value or reference from a request that is discarded once the RPC returns, so
// they need no clone.
func setFieldCloned(dst, src protoreflect.Message, fd protoreflect.FieldDescriptor) {
	switch {
	case fd.IsMap():
		dst.Clear(fd)
		out := dst.Mutable(fd).Map()
		src.Get(fd).Map().Range(func(key protoreflect.MapKey, value protoreflect.Value) bool {
			out.Set(key, clonedValue(fd.MapValue(), value))
			return true
		})
	case fd.IsList():
		dst.Clear(fd)
		out := dst.Mutable(fd).List()
		in := src.Get(fd).List()
		for i := range in.Len() {
			out.Append(clonedValue(fd, in.Get(i)))
		}
	default:
		dst.Set(fd, clonedValue(fd, src.Get(fd)))
	}
}

func clonedValue(fd protoreflect.FieldDescriptor, value protoreflect.Value) protoreflect.Value {
	if fd.Message() == nil {
		return value
	}
	return protoreflect.ValueOfMessage(proto.Clone(value.Message().Interface()).ProtoReflect())
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

// withEntityMetadataRelationships returns a copy of e whose metadata carries rels.
//
// The stored proto is cloned rather than mutated: the previous pointer has already been handed
// to subscribers by notifyEntityChange and may still be queued, unmarshalled, in another
// goroutine. See the invariant documented on notifyEntityChange.
func withEntityMetadataRelationships(e storedEntity, rels []*drawv1.Relationship) storedEntity {
	switch e.kind {
	case entityKindDrawing:
		drawing := proto.Clone(e.drawing).(*drawv1.Drawing)
		if drawing.Metadata == nil {
			drawing.Metadata = &drawv1.Metadata{}
		}
		drawing.Metadata.Relationships = rels
		return storedEntity{kind: entityKindDrawing, drawing: drawing}
	case entityKindTransform:
		transform := proto.Clone(e.transform).(*commonv1.Transform)
		if transform.Metadata == nil {
			transform.Metadata = MetadataToStruct(NewMetadata())
		}
		SetRelationshipsOnStruct(transform.Metadata, rels)
		return storedEntity{kind: entityKindTransform, transform: transform}
	}
	return e
}

// removedChangeMsg builds the REMOVED event for a stored entity. Returns nil
// for an entity whose kind is neither transform nor drawing, which would mean
// the store was populated through a path that skipped both AddEntity branches.
func removedChangeMsg(e storedEntity) *drawv1.StreamEntityChangesResponse {
	switch e.kind {
	case entityKindTransform:
		return &drawv1.StreamEntityChangesResponse{
			ChangeType: drawv1.EntityChangeType_ENTITY_CHANGE_TYPE_REMOVED,
			Entity:     &drawv1.StreamEntityChangesResponse_Transform{Transform: e.transform},
		}
	case entityKindDrawing:
		return &drawv1.StreamEntityChangesResponse{
			ChangeType: drawv1.EntityChangeType_ENTITY_CHANGE_TYPE_REMOVED,
			Entity:     &drawv1.StreamEntityChangesResponse_Drawing{Drawing: e.drawing},
		}
	default:
		log.Printf("draw: cannot build removed event for entity of unknown kind %d", e.kind)
		return nil
	}
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

// CreateRelationship creates or replaces a relationship from the source entity to the target
// named in the relationship. Relationships are stored in the source entity's metadata, and an
// existing relationship with the same target_uuid is replaced in place rather than
// duplicated. The change is published to entity subscribers as an UPDATED event on the
// source.
//
// Returns InvalidArgument for missing source_uuid, relationship, or target_uuid, when source
// and target UUIDs are equal, or when a UUID byte slice cannot be parsed. Returns NotFound
// when either entity does not exist.
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

	// Build a fresh slice: writing into the one returned by entityMetadataRelationships would
	// mutate the stored proto's backing array, which subscribers may still hold.
	existing := entityMetadataRelationships(source)
	rels := make([]*drawv1.Relationship, 0, len(existing)+1)
	replaced := false
	for _, r := range existing {
		if bytes.Equal(r.TargetUuid, req.Msg.GetRelationship().GetTargetUuid()) {
			rels = append(rels, req.Msg.Relationship)
			replaced = true
			continue
		}
		rels = append(rels, r)
	}
	if !replaced {
		rels = append(rels, req.Msg.Relationship)
	}
	updated := withEntityMetadataRelationships(source, rels)
	svc.entities[sourceID] = updated

	svc.notifyEntityChange(entityChangeMsg(updated))

	return connect.NewResponse(&drawv1.CreateRelationshipResponse{}), nil
}

// DeleteRelationship removes the relationship from the source entity to
// target_uuid and publishes an UPDATED event on the source.
//
// Returns InvalidArgument for missing source_uuid or target_uuid, NotFound when
// the source entity does not exist or no matching relationship is found.
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

	updated := withEntityMetadataRelationships(source, filtered)
	svc.entities[sourceID] = updated

	svc.notifyEntityChange(entityChangeMsg(updated))

	return connect.NewResponse(&drawv1.DeleteRelationshipResponse{}), nil
}

// cascadeRemoveRelationships removes any relationship pointing at one of the removed IDs from
// all remaining entities, emitting at most one UPDATED event per affected source.
//
// Takes the whole removed set rather than a single ID so a bulk removal is one pass over the
// store: calling this once per removed entity is O(removed * remaining) in both work and
// published messages.
func (svc *DrawService) cascadeRemoveRelationships(removed map[uuid.UUID]struct{}) {
	if len(removed) == 0 {
		return
	}
	for id, entity := range svc.entities {
		rels := entityMetadataRelationships(entity)
		if len(rels) == 0 {
			continue
		}
		filtered := make([]*drawv1.Relationship, 0, len(rels))
		for _, r := range rels {
			if targetID, err := uuid.FromBytes(r.TargetUuid); err == nil {
				if _, ok := removed[targetID]; ok {
					continue
				}
			}
			filtered = append(filtered, r)
		}
		if len(filtered) == len(rels) {
			continue
		}
		updated := withEntityMetadataRelationships(entity, filtered)
		svc.entities[id] = updated
		svc.notifyEntityChange(entityChangeMsg(updated))
	}
}

// RemoveEntity removes the entity with the given UUID and publishes a REMOVED
// event. If the entity is a chunked drawing, its on-disk buffers are released.
// Any relationship pointing at the removed entity is dropped from other
// entities' metadata, and each affected source emits its own UPDATED event.
//
// Returns InvalidArgument for a missing or unparseable UUID, NotFound when no
// entity has the given UUID.
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
	if chunked, ok := svc.chunked[id]; ok {
		chunked.close()
		delete(svc.chunked, id)
	}

	svc.notifyEntityChange(removedChangeMsg(entity))
	svc.cascadeRemoveRelationships(map[uuid.UUID]struct{}{id: {}})

	return connect.NewResponse(&drawv1.RemoveEntityResponse{}), nil
}

// GetEntityChunk returns a single chunk of accumulated data from a chunked entity, starting
// at the requested element index. The call blocks until enough data has been accumulated to
// satisfy the request or the entity is marked complete. Passing a context with a deadline is
// the recommended way to bound the wait. The Done flag in the response is set when the
// returned chunk finishes the entity.
//
// Returns InvalidArgument for a missing or unparseable UUID, NotFound when no chunked entity
// has the given UUID, Canceled if the context is cancelled before the chunk becomes
// available, and Internal if the chunk cannot be rebuilt from the on-disk buffer.
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

// StreamEntityChanges streams ADDED, UPDATED, and REMOVED events for every transform and
// drawing in the scene. On connect, the current world state is replayed as a series of
// ADDED events so new subscribers see existing entities before live updates begin. The
// stream ends when the request context is cancelled. Changes queue per subscriber and are
// never dropped. A subscriber that falls further behind than maxPendingEntityChanges has its
// stream closed with ResourceExhausted so it can reconnect and take a fresh replay.
func (svc *DrawService) StreamEntityChanges(
	ctx context.Context,
	_ *connect.Request[drawv1.StreamEntityChangesRequest],
	stream *connect.ServerStream[drawv1.StreamEntityChangesResponse],
) error {
	svc.mu.Lock()
	subID, sub := svc.addEntitySub()

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

	// Registered before the replay loop: a client that disconnects mid-replay
	// would otherwise leave its channel in svc.entitySubs with nobody draining
	// it, filling up and logging a drop on every subsequent mutation forever.
	defer func() {
		svc.mu.Lock()
		svc.removeEntitySub(subID)
		svc.mu.Unlock()
	}()

	for _, msg := range replay {
		if err := stream.Send(msg); err != nil {
			return err
		}
	}

	for {
		msgs, overflow, closed := sub.take()
		if overflow {
			log.Printf("draw: subscriber %d fell more than %d changes behind; closing stream for resync", subID, maxPendingEntityChanges)
			return connect.NewError(
				connect.CodeResourceExhausted,
				errors.New("entity change queue overflow; reconnect for a fresh snapshot"),
			)
		}
		for _, msg := range msgs {
			if err := stream.Send(msg); err != nil {
				return err
			}
		}
		if len(msgs) > 0 {
			continue
		}
		if closed {
			return nil
		}
		select {
		case <-ctx.Done():
			return nil
		case <-sub.notify:
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
		// Override only the packed buffers, keeping the rest of the template's metadata.
		// Replacing it wholesale would drop the chunks descriptor, which is how a client
		// recognizes a chunked entity and knows to keep pulling. A subscriber replayed
		// without it would render the first chunk and stop.
		if drawing.Metadata == nil {
			drawing.Metadata = &drawv1.Metadata{}
		}
		if len(chunkColors) > 0 {
			drawing.Metadata.Colors = chunkColors
		}
		if len(chunkOpacities) > 0 {
			drawing.Metadata.Opacities = chunkOpacities
		}
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

// SetScene replaces the current scene metadata and publishes the new metadata
// to every scene subscriber.
//
// Returns InvalidArgument if scene_metadata is nil.
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

// StreamSceneChanges streams every subsequent SetScene call as a scene-changes
// event. Unlike StreamEntityChanges, the current scene metadata is not replayed
// on connect. The stream ends when the request context is cancelled.
func (svc *DrawService) StreamSceneChanges(
	ctx context.Context,
	_ *connect.Request[drawv1.StreamSceneChangesRequest],
	stream *connect.ServerStream[drawv1.StreamSceneChangesResponse],
) error {
	svc.mu.Lock()
	subID, sub := svc.addSceneSub()
	svc.mu.Unlock()

	defer func() {
		svc.mu.Lock()
		svc.removeSceneSub(subID)
		svc.mu.Unlock()
	}()

	for {
		msg, closed := sub.take()
		if msg != nil {
			if err := stream.Send(msg); err != nil {
				return err
			}
			continue
		}
		if closed {
			return nil
		}
		select {
		case <-ctx.Done():
			return nil
		case <-sub.notify:
		}
	}
}

// RemoveAllTransforms removes every transform entity, publishes a REMOVED event
// for each, and cascades any relationships pointing at the removed transforms.
// Drawings are left untouched. Returns the number of transforms removed.
func (svc *DrawService) RemoveAllTransforms(
	_ context.Context,
	_ *connect.Request[drawv1.RemoveAllTransformsRequest],
) (*connect.Response[drawv1.RemoveAllTransformsResponse], error) {
	svc.mu.Lock()
	defer svc.mu.Unlock()

	removedIDs := make(map[uuid.UUID]struct{})
	var count int32
	for id, entity := range svc.entities {
		if entity.kind != entityKindTransform {
			continue
		}
		delete(svc.entities, id)
		count++
		removedIDs[id] = struct{}{}
	}
	svc.notifyEntityCleared(drawv1.EntityScope_ENTITY_SCOPE_TRANSFORMS)
	svc.cascadeRemoveRelationships(removedIDs)

	return connect.NewResponse(&drawv1.RemoveAllTransformsResponse{Count: count}), nil
}

// RemoveAllDrawings removes every drawing entity, releases any associated
// chunked-entity buffers, publishes a REMOVED event for each, and cascades any
// relationships pointing at the removed drawings. Transforms are left
// untouched. Returns the number of drawings removed.
func (svc *DrawService) RemoveAllDrawings(
	_ context.Context,
	_ *connect.Request[drawv1.RemoveAllDrawingsRequest],
) (*connect.Response[drawv1.RemoveAllDrawingsResponse], error) {
	svc.mu.Lock()
	defer svc.mu.Unlock()

	removedIDs := make(map[uuid.UUID]struct{})
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
		removedIDs[id] = struct{}{}
	}
	svc.notifyEntityCleared(drawv1.EntityScope_ENTITY_SCOPE_DRAWINGS)
	svc.cascadeRemoveRelationships(removedIDs)

	return connect.NewResponse(&drawv1.RemoveAllDrawingsResponse{Count: count}), nil
}

// RemoveAll removes every transform and drawing entity, releases any associated
// chunked-entity buffers, and publishes a REMOVED event for each. Returns the
// number of transforms and drawings removed. Note: unlike RemoveAllTransforms
// and RemoveAllDrawings, this method does not run the relationship cascade
// because every entity is being removed.
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
		case entityKindDrawing:
			drawingCount++
		}
	}
	svc.notifyEntityCleared(drawv1.EntityScope_ENTITY_SCOPE_ALL)

	return connect.NewResponse(&drawv1.RemoveAllResponse{
		TransformCount: transformCount,
		DrawingCount:   drawingCount,
	}), nil
}
