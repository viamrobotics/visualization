package draw

import (
	"context"
	"encoding/hex"
	"fmt"
	"sync"

	"connectrpc.com/connect"
	drawv1 "github.com/viam-labs/motion-tools/draw/v1"
	commonv1 "go.viam.com/api/common/v1"
)

// Event represents a change event in the DrawService state
type Event struct {
	Type          drawv1.ChangeType
	Transform     *commonv1.Transform
	Drawing       *drawv1.Drawing
	SceneMetadata *drawv1.SceneMetadata
}

// Service implements the DrawService gRPC service for managing transforms and drawings
type Service struct {
	mu            sync.RWMutex
	transforms    map[string]*commonv1.Transform // keyed by UUID hex string
	drawings      map[string]*drawv1.Drawing     // keyed by UUID hex string
	sceneMetadata *drawv1.SceneMetadata

	subMu       sync.Mutex
	subscribers []chan Event
}

// NewService creates a new DrawService with empty state
func NewService() *Service {
	metadata := NewSceneMetadata()
	return &Service{
		transforms:    make(map[string]*commonv1.Transform),
		drawings:      make(map[string]*drawv1.Drawing),
		sceneMetadata: metadata.ToProto(),
		subscribers:   make([]chan Event, 0),
	}
}

// Subscribe registers a new subscriber to receive change events
// The returned channel will receive all events until Unsubscribe is called
// The channel is buffered to prevent slow consumers from blocking mutations
func (s *Service) Subscribe() <-chan Event {
	s.subMu.Lock()
	defer s.subMu.Unlock()

	// Use a buffered channel to prevent blocking on slow consumers
	ch := make(chan Event, 100)
	s.subscribers = append(s.subscribers, ch)
	return ch
}

// Unsubscribe removes a subscriber and closes its channel
func (s *Service) Unsubscribe(ch <-chan Event) {
	s.subMu.Lock()
	defer s.subMu.Unlock()

	for i, sub := range s.subscribers {
		if sub == ch {
			close(sub)
			s.subscribers = append(s.subscribers[:i], s.subscribers[i+1:]...)
			return
		}
	}
}

// broadcast sends an event to all subscribers
// If a subscriber's channel is full, the event is dropped for that subscriber
func (s *Service) broadcast(event Event) {
	s.subMu.Lock()
	defer s.subMu.Unlock()

	for _, sub := range s.subscribers {
		select {
		case sub <- event:
			// Event sent successfully
		default:
			// Channel is full, drop the event to prevent blocking
		}
	}
}

func (s *Service) AddTransform(
	ctx context.Context,
	req *connect.Request[drawv1.AddTransformRequest],
) (*connect.Response[drawv1.AddTransformResponse], error) {
	transform := req.Msg.Transform
	if transform == nil {
		return nil, connect.NewError(connect.CodeInvalidArgument, fmt.Errorf("transform is required"))
	}

	// Generate UUID if not provided
	if len(transform.Uuid) == 0 {
		return nil, connect.NewError(connect.CodeInvalidArgument, fmt.Errorf("transform UUID is required"))
	}

	uuidStr := hex.EncodeToString(transform.Uuid)

	s.mu.Lock()
	_, exists := s.transforms[uuidStr]
	s.transforms[uuidStr] = transform
	s.mu.Unlock()

	// Broadcast the appropriate event based on whether it's an add or update
	changeType := drawv1.ChangeType_CHANGE_TYPE_ADDED
	if exists {
		changeType = drawv1.ChangeType_CHANGE_TYPE_UPDATED
	}

	s.broadcast(Event{
		Type:      changeType,
		Transform: transform,
	})

	return connect.NewResponse(&drawv1.AddTransformResponse{
		Uuid: transform.Uuid,
	}), nil
}

func (s *Service) UpdateTransform(
	ctx context.Context,
	req *connect.Request[drawv1.UpdateTransformRequest],
) (*connect.Response[drawv1.UpdateTransformResponse], error) {
	if len(req.Msg.Uuid) == 0 {
		return nil, connect.NewError(connect.CodeInvalidArgument, fmt.Errorf("UUID is required"))
	}
	if req.Msg.Transform == nil {
		return nil, connect.NewError(connect.CodeInvalidArgument, fmt.Errorf("transform is required"))
	}

	uuidStr := hex.EncodeToString(req.Msg.Uuid)

	s.mu.Lock()
	_, exists := s.transforms[uuidStr]
	if !exists {
		s.mu.Unlock()
		return nil, connect.NewError(connect.CodeNotFound, fmt.Errorf("transform with UUID %s not found", uuidStr))
	}

	// Ensure the UUID in the transform matches the request
	req.Msg.Transform.Uuid = req.Msg.Uuid
	s.transforms[uuidStr] = req.Msg.Transform
	s.mu.Unlock()

	// Broadcast the update
	s.broadcast(Event{
		Type:      drawv1.ChangeType_CHANGE_TYPE_UPDATED,
		Transform: req.Msg.Transform,
	})

	return connect.NewResponse(&drawv1.UpdateTransformResponse{}), nil
}

func (s *Service) RemoveTransform(
	ctx context.Context,
	req *connect.Request[drawv1.RemoveTransformRequest],
) (*connect.Response[drawv1.RemoveTransformResponse], error) {
	if len(req.Msg.Uuid) == 0 {
		return nil, connect.NewError(connect.CodeInvalidArgument, fmt.Errorf("UUID is required"))
	}

	uuidStr := hex.EncodeToString(req.Msg.Uuid)

	s.mu.Lock()
	transform, exists := s.transforms[uuidStr]
	if !exists {
		s.mu.Unlock()
		return nil, connect.NewError(connect.CodeNotFound, fmt.Errorf("transform with UUID %s not found", uuidStr))
	}

	delete(s.transforms, uuidStr)
	s.mu.Unlock()

	// Broadcast the removal
	s.broadcast(Event{
		Type:      drawv1.ChangeType_CHANGE_TYPE_REMOVED,
		Transform: transform,
	})

	return connect.NewResponse(&drawv1.RemoveTransformResponse{}), nil
}

func (s *Service) RemoveAllTransforms(
	ctx context.Context,
	req *connect.Request[drawv1.RemoveAllTransformsRequest],
) (*connect.Response[drawv1.RemoveAllTransformsResponse], error) {
	s.mu.Lock()
	count := len(s.transforms)
	transforms := make([]*commonv1.Transform, 0, count)
	for _, t := range s.transforms {
		transforms = append(transforms, t)
	}
	s.transforms = make(map[string]*commonv1.Transform)
	s.mu.Unlock()

	// Broadcast all removals
	for _, transform := range transforms {
		s.broadcast(Event{
			Type:      drawv1.ChangeType_CHANGE_TYPE_REMOVED,
			Transform: transform,
		})
	}

	return connect.NewResponse(&drawv1.RemoveAllTransformsResponse{
		Count: int32(count),
	}), nil
}

func (s *Service) StreamTransformChanges(
	ctx context.Context,
	req *connect.Request[drawv1.StreamTransformChangesRequest],
	stream *connect.ServerStream[drawv1.StreamTransformChangesResponse],
) error {
	// Send all current transforms as ADDED events
	s.mu.RLock()
	initialTransforms := make([]*commonv1.Transform, 0, len(s.transforms))
	for _, t := range s.transforms {
		initialTransforms = append(initialTransforms, t)
	}
	s.mu.RUnlock()

	for _, transform := range initialTransforms {
		if err := stream.Send(&drawv1.StreamTransformChangesResponse{
			ChangeType: drawv1.ChangeType_CHANGE_TYPE_ADDED,
			Transform:  transform,
		}); err != nil {
			return err
		}
	}

	// Subscribe to future changes
	eventCh := s.Subscribe()
	defer s.Unsubscribe(eventCh)

	for {
		select {
		case <-ctx.Done():
			return ctx.Err()
		case event, ok := <-eventCh:
			if !ok {
				return nil
			}
			// Only send transform events
			if event.Transform != nil {
				if err := stream.Send(&drawv1.StreamTransformChangesResponse{
					ChangeType: event.Type,
					Transform:  event.Transform,
				}); err != nil {
					return err
				}
			}
		}
	}
}

func (s *Service) AddDrawing(
	ctx context.Context,
	req *connect.Request[drawv1.AddDrawingRequest],
) (*connect.Response[drawv1.AddDrawingResponse], error) {
	drawing := req.Msg.Drawing
	if drawing == nil {
		return nil, connect.NewError(connect.CodeInvalidArgument, fmt.Errorf("drawing is required"))
	}

	// Generate UUID if not provided
	if len(drawing.Uuid) == 0 {
		return nil, connect.NewError(connect.CodeInvalidArgument, fmt.Errorf("drawing UUID is required"))
	}

	uuidStr := hex.EncodeToString(drawing.Uuid)

	s.mu.Lock()
	s.drawings[uuidStr] = drawing
	s.mu.Unlock()

	// Broadcast the addition
	s.broadcast(Event{
		Type:    drawv1.ChangeType_CHANGE_TYPE_ADDED,
		Drawing: drawing,
	})

	return connect.NewResponse(&drawv1.AddDrawingResponse{
		Uuid: drawing.Uuid,
	}), nil
}

func (s *Service) UpdateDrawing(
	ctx context.Context,
	req *connect.Request[drawv1.UpdateDrawingRequest],
) (*connect.Response[drawv1.UpdateDrawingResponse], error) {
	if len(req.Msg.Uuid) == 0 {
		return nil, connect.NewError(connect.CodeInvalidArgument, fmt.Errorf("UUID is required"))
	}
	if req.Msg.Drawing == nil {
		return nil, connect.NewError(connect.CodeInvalidArgument, fmt.Errorf("drawing is required"))
	}

	uuidStr := hex.EncodeToString(req.Msg.Uuid)

	s.mu.Lock()
	_, exists := s.drawings[uuidStr]
	if !exists {
		s.mu.Unlock()
		return nil, connect.NewError(connect.CodeNotFound, fmt.Errorf("drawing with UUID %s not found", uuidStr))
	}

	// Ensure the UUID in the drawing matches the request
	req.Msg.Drawing.Uuid = req.Msg.Uuid
	s.drawings[uuidStr] = req.Msg.Drawing
	s.mu.Unlock()

	// Broadcast the update
	s.broadcast(Event{
		Type:    drawv1.ChangeType_CHANGE_TYPE_UPDATED,
		Drawing: req.Msg.Drawing,
	})

	return connect.NewResponse(&drawv1.UpdateDrawingResponse{}), nil
}

func (s *Service) RemoveDrawing(
	ctx context.Context,
	req *connect.Request[drawv1.RemoveDrawingRequest],
) (*connect.Response[drawv1.RemoveDrawingResponse], error) {
	if len(req.Msg.Uuid) == 0 {
		return nil, connect.NewError(connect.CodeInvalidArgument, fmt.Errorf("UUID is required"))
	}

	uuidStr := hex.EncodeToString(req.Msg.Uuid)

	s.mu.Lock()
	drawing, exists := s.drawings[uuidStr]
	if !exists {
		s.mu.Unlock()
		return nil, connect.NewError(connect.CodeNotFound, fmt.Errorf("drawing with UUID %s not found", uuidStr))
	}

	delete(s.drawings, uuidStr)
	s.mu.Unlock()

	// Broadcast the removal
	s.broadcast(Event{
		Type:    drawv1.ChangeType_CHANGE_TYPE_REMOVED,
		Drawing: drawing,
	})

	return connect.NewResponse(&drawv1.RemoveDrawingResponse{}), nil
}

func (s *Service) RemoveAllDrawings(
	ctx context.Context,
	req *connect.Request[drawv1.RemoveAllDrawingsRequest],
) (*connect.Response[drawv1.RemoveAllDrawingsResponse], error) {
	s.mu.Lock()
	count := len(s.drawings)
	drawings := make([]*drawv1.Drawing, 0, count)
	for _, d := range s.drawings {
		drawings = append(drawings, d)
	}
	s.drawings = make(map[string]*drawv1.Drawing)
	s.mu.Unlock()

	// Broadcast all removals
	for _, drawing := range drawings {
		s.broadcast(Event{
			Type:    drawv1.ChangeType_CHANGE_TYPE_REMOVED,
			Drawing: drawing,
		})
	}

	return connect.NewResponse(&drawv1.RemoveAllDrawingsResponse{
		Count: int32(count),
	}), nil
}

func (s *Service) StreamDrawingChanges(
	ctx context.Context,
	req *connect.Request[drawv1.StreamDrawingChangesRequest],
	stream *connect.ServerStream[drawv1.StreamDrawingChangesResponse],
) error {
	// Send all current drawings as ADDED events
	s.mu.RLock()
	initialDrawings := make([]*drawv1.Drawing, 0, len(s.drawings))
	for _, d := range s.drawings {
		initialDrawings = append(initialDrawings, d)
	}
	s.mu.RUnlock()

	for _, drawing := range initialDrawings {
		if err := stream.Send(&drawv1.StreamDrawingChangesResponse{
			ChangeType: drawv1.ChangeType_CHANGE_TYPE_ADDED,
			Drawing:    drawing,
		}); err != nil {
			return err
		}
	}

	// Subscribe to future changes
	eventCh := s.Subscribe()
	defer s.Unsubscribe(eventCh)

	for {
		select {
		case <-ctx.Done():
			return ctx.Err()
		case event, ok := <-eventCh:
			if !ok {
				return nil
			}
			// Only send drawing events
			if event.Drawing != nil {
				if err := stream.Send(&drawv1.StreamDrawingChangesResponse{
					ChangeType: event.Type,
					Drawing:    event.Drawing,
				}); err != nil {
					return err
				}
			}
		}
	}
}

func (s *Service) StreamSceneChanges(
	ctx context.Context,
	req *connect.Request[drawv1.StreamSceneChangesRequest],
	stream *connect.ServerStream[drawv1.StreamSceneChangesResponse],
) error {
	// Send current scene metadata
	s.mu.RLock()
	currentMetadata := s.sceneMetadata
	s.mu.RUnlock()

	if currentMetadata != nil {
		if err := stream.Send(&drawv1.StreamSceneChangesResponse{
			SceneMetadata: currentMetadata,
		}); err != nil {
			return err
		}
	}

	// Subscribe to future changes
	eventCh := s.Subscribe()
	defer s.Unsubscribe(eventCh)

	for {
		select {
		case <-ctx.Done():
			return ctx.Err()
		case event, ok := <-eventCh:
			if !ok {
				return nil
			}
			// Only send scene metadata events
			if event.SceneMetadata != nil {
				if err := stream.Send(&drawv1.StreamSceneChangesResponse{
					SceneMetadata: event.SceneMetadata,
				}); err != nil {
					return err
				}
			}
		}
	}
}

func (s *Service) SetSceneMetadata(
	ctx context.Context,
	req *connect.Request[drawv1.SetSceneMetadataRequest],
) (*connect.Response[drawv1.SetSceneMetadataResponse], error) {
	if req.Msg.SceneMetadata == nil {
		return nil, connect.NewError(connect.CodeInvalidArgument, fmt.Errorf("scene_metadata is required"))
	}

	s.mu.Lock()
	// Merge semantics: only update fields that are non-nil in the request
	// The proto uses optional for all SceneMetadata fields, so we check each one
	incoming := req.Msg.SceneMetadata

	if incoming.SceneCamera != nil {
		if s.sceneMetadata.SceneCamera == nil {
			s.sceneMetadata.SceneCamera = incoming.SceneCamera
		} else {
			// Merge camera fields
			if incoming.SceneCamera.Position != nil {
				s.sceneMetadata.SceneCamera.Position = incoming.SceneCamera.Position
			}
			if incoming.SceneCamera.LookAt != nil {
				s.sceneMetadata.SceneCamera.LookAt = incoming.SceneCamera.LookAt
			}
			if incoming.SceneCamera.Animated != nil {
				s.sceneMetadata.SceneCamera.Animated = incoming.SceneCamera.Animated
			}
			if incoming.SceneCamera.CameraType != nil {
				s.sceneMetadata.SceneCamera.CameraType = incoming.SceneCamera.CameraType
			}
		}
	}

	if incoming.Grid != nil {
		s.sceneMetadata.Grid = incoming.Grid
	}
	if incoming.GridCellSize != nil {
		s.sceneMetadata.GridCellSize = incoming.GridCellSize
	}
	if incoming.GridSectionSize != nil {
		s.sceneMetadata.GridSectionSize = incoming.GridSectionSize
	}
	if incoming.GridFadeDistance != nil {
		s.sceneMetadata.GridFadeDistance = incoming.GridFadeDistance
	}
	if incoming.PointSize != nil {
		s.sceneMetadata.PointSize = incoming.PointSize
	}
	if incoming.PointColor != nil {
		s.sceneMetadata.PointColor = incoming.PointColor
	}
	if incoming.LineWidth != nil {
		s.sceneMetadata.LineWidth = incoming.LineWidth
	}
	if incoming.LinePointSize != nil {
		s.sceneMetadata.LinePointSize = incoming.LinePointSize
	}
	if incoming.RenderArmModels != nil {
		s.sceneMetadata.RenderArmModels = incoming.RenderArmModels
	}
	if incoming.RenderShapes != nil {
		s.sceneMetadata.RenderShapes = incoming.RenderShapes
	}

	// Make a copy for broadcasting
	updatedMetadata := s.sceneMetadata
	s.mu.Unlock()

	// Broadcast the scene metadata change
	s.broadcast(Event{
		SceneMetadata: updatedMetadata,
	})

	return connect.NewResponse(&drawv1.SetSceneMetadataResponse{}), nil
}

func (s *Service) RemoveAll(
	ctx context.Context,
	req *connect.Request[drawv1.RemoveAllRequest],
) (*connect.Response[drawv1.RemoveAllResponse], error) {
	s.mu.Lock()
	transformCount := len(s.transforms)
	drawingCount := len(s.drawings)

	transforms := make([]*commonv1.Transform, 0, transformCount)
	for _, t := range s.transforms {
		transforms = append(transforms, t)
	}

	drawings := make([]*drawv1.Drawing, 0, drawingCount)
	for _, d := range s.drawings {
		drawings = append(drawings, d)
	}

	s.transforms = make(map[string]*commonv1.Transform)
	s.drawings = make(map[string]*drawv1.Drawing)
	s.mu.Unlock()

	// Broadcast all removals
	for _, transform := range transforms {
		s.broadcast(Event{
			Type:      drawv1.ChangeType_CHANGE_TYPE_REMOVED,
			Transform: transform,
		})
	}
	for _, drawing := range drawings {
		s.broadcast(Event{
			Type:    drawv1.ChangeType_CHANGE_TYPE_REMOVED,
			Drawing: drawing,
		})
	}

	return connect.NewResponse(&drawv1.RemoveAllResponse{
		TransformCount: int32(transformCount),
		DrawingCount:   int32(drawingCount),
	}), nil
}
