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

	"connectrpc.com/connect"
	"github.com/google/uuid"
	drawv1 "github.com/viam-labs/motion-tools/draw/v1"
	"github.com/viam-labs/motion-tools/draw/v1/drawv1connect"
	commonv1 "go.viam.com/api/common/v1"
	"google.golang.org/protobuf/proto"
	"google.golang.org/protobuf/reflect/protoreflect"
)

var _ drawv1connect.DrawServiceHandler = (*DrawService)(nil)

// chunkedEntity accumulates chunk data for any shape type using disk-backed
// buffers. It uses its own mutex/cond so GetEntityChunk callers can block
// until data is available without holding the service-wide lock.
type chunkedEntity struct {
	mu            sync.Mutex
	cond          *sync.Cond
	metadata      *drawv1.Chunks
	data          *diskBuffer
	colors        *diskBuffer
	opacities     *diskBuffer
	template      *drawv1.Drawing
	chunkComplete bool
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

	ce := &chunkedEntity{
		metadata:  meta,
		data:      data,
		colors:    colors,
		opacities: opacities,
		template:  template,
	}
	ce.cond = sync.NewCond(&ce.mu)
	return ce, nil
}

func (ce *chunkedEntity) close() {
	ce.data.close()
	ce.colors.close()
	ce.opacities.close()
}

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
		if cm := metadata.GetChunks(); cm != nil {
			if data, ok := extractShapeData(e.Drawing); ok {
				template := proto.Clone(e.Drawing).(*drawv1.Drawing)
				ce, ceErr := newChunkedEntity(cm, template, svc.tempDir)
				if ceErr != nil {
					return nil, connect.NewError(connect.CodeInternal, fmt.Errorf("create chunked entity: %w", ceErr))
				}
				ce.mu.Lock()
				if writeErr := ce.data.write(data); writeErr != nil {
					ce.mu.Unlock()
					ce.close()
					return nil, connect.NewError(connect.CodeInternal, fmt.Errorf("write initial chunk: %w", writeErr))
				}
				if md := e.Drawing.GetMetadata(); md != nil {
					if writeErr := ce.colors.write(md.GetColors()); writeErr != nil {
						ce.mu.Unlock()
						ce.close()
						return nil, connect.NewError(connect.CodeInternal, fmt.Errorf("write initial colors: %w", writeErr))
					}
					if writeErr := ce.opacities.write(md.GetOpacities()); writeErr != nil {
						ce.mu.Unlock()
						ce.close()
						return nil, connect.NewError(connect.CodeInternal, fmt.Errorf("write initial opacities: %w", writeErr))
					}
				}
				ce.mu.Unlock()
				svc.chunked[id] = ce
				log.Printf("draw: chunked entity %s created (total=%d, chunk_size=%d)",
					id, ce.metadata.GetTotal(), ce.metadata.GetChunkSize())
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

		if ce, ok := svc.chunked[id]; ok {
			if err := svc.accumulateChunk(ce, e.Drawing); err != nil {
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

func (svc *DrawService) accumulateChunk(ce *chunkedEntity, drawing *drawv1.Drawing) error {
	data, ok := extractShapeData(drawing)
	if !ok {
		return fmt.Errorf("no shape data in drawing")
	}

	ce.mu.Lock()
	defer ce.mu.Unlock()

	if err := ce.data.write(data); err != nil {
		return fmt.Errorf("write positions: %w", err)
	}
	if md := drawing.GetMetadata(); md != nil {
		if err := ce.colors.write(md.GetColors()); err != nil {
			return fmt.Errorf("write colors: %w", err)
		}
		if err := ce.opacities.write(md.GetOpacities()); err != nil {
			return fmt.Errorf("write opacities: %w", err)
		}
	}

	elementsReceived := ce.data.bytesWritten / ce.metadata.Stride
	if elementsReceived >= ce.metadata.Total {
		ce.chunkComplete = true
		log.Printf("draw: chunk accumulation complete (%d/%d elements)", elementsReceived, ce.metadata.Total)
	}

	ce.cond.Broadcast()
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
	if ce, ok := svc.chunked[id]; ok {
		ce.close()
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
	ce, ok := svc.chunked[id]
	svc.mu.RUnlock()
	if !ok {
		return nil, connect.NewError(connect.CodeNotFound, fmt.Errorf("chunked entity %s not found", id))
	}

	start := req.Msg.GetStart()
	startByte := start * ce.metadata.Stride

	ce.mu.Lock()
	for ce.data.bytesWritten <= startByte && !ce.chunkComplete {
		done := make(chan struct{})
		go func() {
			select {
			case <-ctx.Done():
				ce.cond.Broadcast()
			case <-done:
			}
		}()
		ce.cond.Wait()
		close(done)
		if ctx.Err() != nil {
			ce.mu.Unlock()
			return nil, connect.NewError(connect.CodeCanceled, ctx.Err())
		}
	}

	posLen := ce.data.bytesWritten
	if startByte >= posLen {
		ce.mu.Unlock()
		return connect.NewResponse(&drawv1.GetEntityChunkResponse{Done: true}), nil
	}

	endByte := startByte + ce.metadata.ChunkSize*ce.metadata.Stride
	if endByte > posLen {
		endByte = posLen
	}
	chunkPositions, err := ce.data.readSlice(startByte, endByte-startByte)
	if err != nil {
		ce.mu.Unlock()
		return nil, connect.NewError(connect.CodeInternal, fmt.Errorf("read chunk positions: %w", err))
	}

	chunkElements := (endByte - startByte) / ce.metadata.Stride
	isDone := (start+chunkElements >= ce.metadata.Total) && ce.chunkComplete

	var chunkColors, chunkOpacities []byte
	colorStart := start * 3
	colorEnd := colorStart + chunkElements*3
	if ce.colors.bytesWritten >= colorEnd {
		chunkColors, _ = ce.colors.readSlice(colorStart, colorEnd-colorStart)
	}
	opacityEnd := start + chunkElements
	if ce.opacities.bytesWritten >= opacityEnd {
		chunkOpacities, _ = ce.opacities.readSlice(start, opacityEnd-start)
	}

	ce.mu.Unlock()

	log.Printf("draw: served chunk=%d start=%d elements=%d done=%t", id, start, chunkElements, isDone)

	return connect.NewResponse(&drawv1.GetEntityChunkResponse{
		Positions: chunkPositions,
		Colors:    chunkColors,
		Opacities: chunkOpacities,
		Start:     start,
		Done:      isDone,
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
			if ce, ok := svc.chunked[id]; ok {
				replay = append(replay, svc.buildChunkedReplayMsg(ce))
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

func (svc *DrawService) buildChunkedReplayMsg(ce *chunkedEntity) *drawv1.StreamEntityChangesResponse {
	ce.mu.Lock()
	defer ce.mu.Unlock()

	endByte := ce.metadata.ChunkSize * ce.metadata.Stride
	if endByte > ce.data.bytesWritten {
		endByte = ce.data.bytesWritten
	}
	chunkPositions, _ := ce.data.readSlice(0, endByte)

	chunkElements := endByte / ce.metadata.Stride
	var chunkColors, chunkOpacities []byte
	colorEnd := chunkElements * 3
	if ce.colors.bytesWritten >= colorEnd {
		chunkColors, _ = ce.colors.readSlice(0, colorEnd)
	}
	if ce.opacities.bytesWritten >= chunkElements {
		chunkOpacities, _ = ce.opacities.readSlice(0, chunkElements)
	}

	drawing := proto.Clone(ce.template).(*drawv1.Drawing)
	setShapeData(drawing, chunkPositions)

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
		if ce, ok := svc.chunked[id]; ok {
			ce.close()
			delete(svc.chunked, id)
		}
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
		if ce, ok := svc.chunked[id]; ok {
			ce.close()
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
