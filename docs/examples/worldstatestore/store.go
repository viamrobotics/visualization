package main

import (
	"context"
	"fmt"
	"sync"
	"time"

	"github.com/golang/geo/r3"
	"github.com/viam-labs/motion-tools/draw"
	commonpb "go.viam.com/api/common/v1"
	pb "go.viam.com/api/service/worldstatestore/v1"
	"go.viam.com/rdk/components/sensor"
	"go.viam.com/rdk/logging"
	"go.viam.com/rdk/resource"
	"go.viam.com/rdk/services/worldstatestore"
	"go.viam.com/rdk/spatialmath"
)

var StoreModel = resource.NewModel("viam-viz", "obstacles", "store")

const pollInterval = time.Second

type obstacleStore struct {
	resource.Named
	resource.TriviallyReconfigurable
	resource.TriviallyCloseable

	logger logging.Logger
	sensor sensor.Sensor

	mu         sync.RWMutex
	transforms map[string]*commonpb.Transform // keyed by obstacle id
	last       map[string]obstacle            // last-seen reading per id, for diffing

	streamCtx context.Context
	cancel    context.CancelFunc

	subsMu sync.Mutex
	subs   map[chan worldstatestore.TransformChange]struct{}
}

type obstacle struct {
	ID         string
	X, Y, Z    float64
	SX, SY, SZ float64
	EndingSoon bool
	Lifecycle  string
}

const (
	lifecycleAppearing    = "appearing"
	lifecycleAlive        = "alive"
	lifecycleDisappearing = "disappearing"
)

func newObstacleStore(
	_ context.Context,
	deps resource.Dependencies,
	conf resource.Config,
	logger logging.Logger,
) (worldstatestore.Service, error) {
	obstacleSensor, err := sensor.FromProvider(deps, "obstacle-sensor")
	if err != nil {
		return nil, fmt.Errorf("getting obstacle-sensor: %w", err)
	}

	streamCtx, cancel := context.WithCancel(context.Background())
	s := &obstacleStore{
		Named:      conf.ResourceName().AsNamed(),
		logger:     logger,
		sensor:     obstacleSensor,
		transforms: make(map[string]*commonpb.Transform),
		last:       make(map[string]obstacle),
		streamCtx:  streamCtx,
		cancel:     cancel,
		subs:       make(map[chan worldstatestore.TransformChange]struct{}),
	}

	go s.pollLoop()
	return s, nil
}

func (s *obstacleStore) Close(_ context.Context) error {
	s.cancel()
	s.subsMu.Lock()
	for ch := range s.subs {
		delete(s.subs, ch)
		close(ch)
	}
	s.subsMu.Unlock()
	return nil
}

func (s *obstacleStore) ListUUIDs(_ context.Context, _ map[string]any) ([][]byte, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	uuids := make([][]byte, 0, len(s.transforms))
	for _, t := range s.transforms {
		uuids = append(uuids, t.Uuid)
	}
	return uuids, nil
}

func (s *obstacleStore) GetTransform(_ context.Context, uuid []byte, _ map[string]any) (*commonpb.Transform, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	for _, t := range s.transforms {
		if string(t.Uuid) == string(uuid) {
			return t, nil
		}
	}
	return nil, resource.NewNotFoundError(resource.NewName(worldstatestore.API, string(uuid)))
}

func (s *obstacleStore) StreamTransformChanges(
	ctx context.Context,
	_ map[string]any,
) (*worldstatestore.TransformChangeStream, error) {
	ch := make(chan worldstatestore.TransformChange, 100)

	s.subsMu.Lock()
	s.subs[ch] = struct{}{}
	s.subsMu.Unlock()

	go func() {
		<-ctx.Done()
		s.subsMu.Lock()
		if _, ok := s.subs[ch]; ok {
			delete(s.subs, ch)
			close(ch)
		}
		s.subsMu.Unlock()
	}()

	return worldstatestore.NewTransformChangeStreamFromChannel(ctx, ch), nil
}

func (s *obstacleStore) pollLoop() {
	ticker := time.NewTicker(pollInterval)
	defer ticker.Stop()

	for {
		select {
		case <-s.streamCtx.Done():
			return
		case <-ticker.C:
			obstacles, err := s.readObstacles()
			if err != nil {
				s.logger.Warnw("failed to read obstacles", "err", err)
				continue
			}
			s.reconcile(obstacles)
		}
	}
}

func (s *obstacleStore) readObstacles() ([]obstacle, error) {
	readings, err := s.sensor.Readings(s.streamCtx, nil)
	if err != nil {
		return nil, err
	}

	raw, ok := readings["obstacles"].([]any)
	if !ok {
		return nil, fmt.Errorf("sensor returned no obstacles slice")
	}

	out := make([]obstacle, 0, len(raw))
	for _, r := range raw {
		m, _ := r.(map[string]any)
		if m == nil {
			continue
		}
		id, _ := m["id"].(string)
		if id == "" {
			continue
		}
		out = append(out, obstacle{
			ID: id,
			X:  floatField(m, "x"), Y: floatField(m, "y"), Z: floatField(m, "z"),
			SX: floatField(m, "sx"), SY: floatField(m, "sy"), SZ: floatField(m, "sz"),
			EndingSoon: boolField(m, "ending_soon"),
		})
	}
	return out, nil
}

func floatField(m map[string]any, key string) float64 {
	if v, ok := m[key].(float64); ok {
		return v
	}
	return 0
}

func boolField(m map[string]any, key string) bool {
	if v, ok := m[key].(bool); ok {
		return v
	}
	return false
}

func (s *obstacleStore) reconcile(obstacles []obstacle) {
	next := make(map[string]obstacle, len(obstacles))
	for _, o := range obstacles {
		next[o.ID] = o
	}

	s.mu.Lock()
	defer s.mu.Unlock()

	for id, o := range next {
		prev, seen := s.last[id]
		// Lifecycle: appearing on the first frame we ever see this id; the
		// sensor's lookahead tags the final frame as ending-soon; everything
		// else is alive.
		switch {
		case !seen:
			o.Lifecycle = lifecycleAppearing
		case o.EndingSoon:
			o.Lifecycle = lifecycleDisappearing
		default:
			o.Lifecycle = lifecycleAlive
		}

		if seen && prev == o {
			continue
		}
		transform, err := buildTransform(o)
		if err != nil {
			s.logger.Warnw("failed to build transform", "err", err, "id", id)
			continue
		}
		s.transforms[id] = transform
		s.last[id] = o

		if !seen {
			s.emit(transform, pb.TransformChangeType_TRANSFORM_CHANGE_TYPE_ADDED, nil)
			continue
		}
		var fields []string
		if prev.X != o.X || prev.Y != o.Y || prev.Z != o.Z {
			fields = append(fields, "pose_in_observer_frame")
		}
		if prev.SX != o.SX || prev.SY != o.SY || prev.SZ != o.SZ {
			fields = append(fields, "physical_object")
		}
		if prev.Lifecycle != o.Lifecycle {
			fields = append(fields, "metadata")
		}
		s.emit(transform, pb.TransformChangeType_TRANSFORM_CHANGE_TYPE_UPDATED, fields)
	}

	for id, t := range s.transforms {
		if _, present := next[id]; present {
			continue
		}
		delete(s.transforms, id)
		delete(s.last, id)
		s.emit(&commonpb.Transform{Uuid: t.Uuid}, pb.TransformChangeType_TRANSFORM_CHANGE_TYPE_REMOVED, nil)
	}
}

func buildTransform(o obstacle) (*commonpb.Transform, error) {
	box, err := spatialmath.NewBox(
		spatialmath.NewZeroPose(),
		r3.Vector{X: o.SX, Y: o.SY, Z: o.SZ},
		o.ID,
	)
	if err != nil {
		return nil, err
	}

	drawn, err := draw.NewDrawnGeometry(box, draw.WithGeometryColor(colorFor(o.Lifecycle)))
	if err != nil {
		return nil, err
	}

	return drawn.Draw(o.ID,
		draw.WithID(o.ID),
		draw.WithPose(spatialmath.NewPoseFromPoint(r3.Vector{X: o.X, Y: o.Y, Z: o.Z})),
	)
}

// colorFor maps lifecycle → color. Opacity rides on the alpha channel:
// 127/255 ≈ 50%. Picked via colour name + SetAlpha rather than raw RGBA so
// the intent stays readable.
func colorFor(lifecycle string) draw.Color {
	switch lifecycle {
	case lifecycleAppearing:
		return draw.ColorFromName("blue").SetAlpha(127)
	case lifecycleDisappearing:
		return draw.ColorFromName("red").SetAlpha(127)
	default:
		return draw.ColorFromName("orange")
	}
}

func (s *obstacleStore) emit(
	transform *commonpb.Transform,
	changeType pb.TransformChangeType,
	updatedFields []string,
) {
	change := worldstatestore.TransformChange{
		ChangeType:    changeType,
		Transform:     transform,
		UpdatedFields: updatedFields,
	}

	s.subsMu.Lock()
	subs := make([]chan worldstatestore.TransformChange, 0, len(s.subs))
	for ch := range s.subs {
		subs = append(subs, ch)
	}
	s.subsMu.Unlock()

	for _, ch := range subs {
		select {
		case ch <- change:
		case <-s.streamCtx.Done():
			return
		default:
		}
	}
}
