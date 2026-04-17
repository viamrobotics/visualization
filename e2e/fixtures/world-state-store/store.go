package main

import (
	"context"
	"encoding/base64"
	"encoding/binary"
	"fmt"
	"math"
	"os"
	"path/filepath"
	"sync"

	"github.com/golang/geo/r3"
	"github.com/google/uuid"
	"github.com/viam-labs/motion-tools/draw"
	commonpb "go.viam.com/api/common/v1"
	pb "go.viam.com/api/service/worldstatestore/v1"
	"go.viam.com/rdk/logging"
	"go.viam.com/rdk/pointcloud"
	"go.viam.com/rdk/resource"
	"go.viam.com/rdk/services/worldstatestore"
	"go.viam.com/rdk/spatialmath"
	"google.golang.org/protobuf/types/known/structpb"
)

type TestStore struct {
	resource.Named
	resource.TriviallyReconfigurable
	resource.TriviallyCloseable

	logger logging.Logger

	mu         sync.RWMutex
	transforms map[string]*commonpb.Transform
	streamCtx  context.Context
	cancel     context.CancelFunc

	// Each active StreamTransformChanges subscription owns one channel. emitChange
	// fans out to every subscriber so concurrent pages don't starve each other.
	subsMu sync.Mutex
	subs   map[chan worldstatestore.TransformChange]struct{}

	// Per-entity chunked point cloud data keyed by the formatted UUID string
	// (matching what clients send back via get_entity_chunk).
	pointCloudPositions map[string][]float32
	pointCloudColors    map[string][]byte
	pointCloudChunkSize map[string]int
}

func newStore(
	ctx context.Context,
	deps resource.Dependencies,
	conf resource.Config,
	logger logging.Logger,
) (worldstatestore.Service, error) {
	streamCtx, cancel := context.WithCancel(context.Background())

	s := &TestStore{
		Named:               conf.ResourceName().AsNamed(),
		logger:              logger,
		transforms:          make(map[string]*commonpb.Transform),
		streamCtx:           streamCtx,
		cancel:              cancel,
		subs:                make(map[chan worldstatestore.TransformChange]struct{}),
		pointCloudPositions: make(map[string][]float32),
		pointCloudColors:    make(map[string][]byte),
		pointCloudChunkSize: make(map[string]int),
	}

	if err := s.populateTestData(); err != nil {
		cancel()
		return nil, fmt.Errorf("failed to populate test data: %w", err)
	}

	return s, nil
}

func (s *TestStore) Close(ctx context.Context) error {
	s.cancel()
	s.subsMu.Lock()
	for ch := range s.subs {
		delete(s.subs, ch)
		close(ch)
	}
	s.subsMu.Unlock()
	return nil
}

func (s *TestStore) ListUUIDs(ctx context.Context, extra map[string]any) ([][]byte, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	uuids := make([][]byte, 0, len(s.transforms))
	for _, t := range s.transforms {
		uuids = append(uuids, t.Uuid)
	}
	return uuids, nil
}

func (s *TestStore) GetTransform(ctx context.Context, uuid []byte, extra map[string]any) (*commonpb.Transform, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	t, ok := s.transforms[string(uuid)]
	if !ok {
		return nil, resource.NewNotFoundError(resource.NewName(worldstatestore.API, string(uuid)))
	}
	return t, nil
}

func (s *TestStore) StreamTransformChanges(ctx context.Context, extra map[string]any) (*worldstatestore.TransformChangeStream, error) {
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

func (s *TestStore) DoCommand(ctx context.Context, cmd map[string]any) (map[string]any, error) {
	cmdName, ok := cmd["command"].(string)
	if !ok {
		return map[string]any{"status": "no command specified"}, nil
	}

	switch cmdName {
	case "add_sphere":
		return s.addBox(cmd)
	case "get_entity_chunk":
		return s.getChunk(cmd)
	case "add_chunked":
		return s.addChunk(cmd)
	case "update":
		return s.update(cmd)
	case "remove":
		return s.remove(cmd)
	default:
		return map[string]any{"status": "unknown command"}, nil
	}
}

func (s *TestStore) addBox(cmd map[string]any) (map[string]any, error) {
	name, _ := cmd["name"].(string)
	if name == "" {
		name = "box"
	}

	box, err := spatialmath.NewBox(spatialmath.NewZeroPose(), r3.Vector{X: 200, Y: 200, Z: 200}, name)
	if err != nil {
		return nil, err
	}

	drawnBox, err := draw.NewDrawnGeometry(box, draw.WithGeometryColor(draw.ColorFromName("coral")))
	if err != nil {
		return nil, err
	}

	transform, err := drawnBox.Draw(name, draw.WithPose(spatialmath.NewPoseFromPoint(r3.Vector{X: 0, Y: 0, Z: 300})))
	if err != nil {
		return nil, err
	}

	uuid := string(transform.Uuid)

	s.mu.Lock()
	s.transforms[uuid] = transform
	s.mu.Unlock()

	s.emitChange(transform, pb.TransformChangeType_TRANSFORM_CHANGE_TYPE_ADDED)

	return map[string]any{"ok": true}, nil
}

func (s *TestStore) findByName(name string) (string, *commonpb.Transform) {
	for uuid, t := range s.transforms {
		if t.ReferenceFrame == name {
			return uuid, t
		}
	}
	return "", nil
}

func (s *TestStore) update(cmd map[string]any) (map[string]any, error) {
	name, _ := cmd["name"].(string)
	if name == "" {
		return nil, fmt.Errorf("name is required")
	}

	s.mu.Lock()
	_, t := s.findByName(name)
	if t == nil {
		s.mu.Unlock()
		return nil, fmt.Errorf("transform with name %q not found", name)
	}

	fields := make([]string, 0)

	if poseMap, ok := cmd["pose"].(map[string]any); ok {
		// Preserve existing pose fields for any values the caller didn't supply so
		// callers can partially update (e.g. only rotation or only position).
		current := t.PoseInObserverFrame.Pose
		x := floatField(poseMap, "x", current.X)
		y := floatField(poseMap, "y", current.Y)
		z := floatField(poseMap, "z", current.Z)
		ox := floatField(poseMap, "ox", current.OX)
		oy := floatField(poseMap, "oy", current.OY)
		oz := floatField(poseMap, "oz", current.OZ)
		theta := floatField(poseMap, "theta", current.Theta)

		t.PoseInObserverFrame.Pose = spatialmath.PoseToProtobuf(
			spatialmath.NewPose(
				r3.Vector{X: x, Y: y, Z: z},
				&spatialmath.OrientationVectorDegrees{OX: ox, OY: oy, OZ: oz, Theta: theta},
			),
		)
		fields = append(fields, "poseInObserverFrame.pose")
	}

	if metadataMap, ok := cmd["metadata"].(map[string]any); ok {
		metadata, err := draw.StructToMetadata(t.Metadata)
		if err != nil {
			metadata = draw.NewMetadata()
		}

		if colorsList, ok := metadataMap["colors"].([]any); ok {
			newColors := make([]draw.Color, 0, len(colorsList))
			for _, raw := range colorsList {
				cm, _ := raw.(map[string]any)
				if cm == nil {
					continue
				}
				r, _ := cm["r"].(float64)
				g, _ := cm["g"].(float64)
				b, _ := cm["b"].(float64)
				// Preserve the existing alpha unless the caller explicitly sets one,
				// so toggling color doesn't unintentionally reset opacity.
				a := draw.DefaultOpacity
				if len(metadata.Colors) > 0 {
					a = metadata.Colors[0].A
				}
				if av, ok := cm["a"].(float64); ok {
					a = uint8(av)
				}
				newColors = append(newColors, draw.Color{R: uint8(r), G: uint8(g), B: uint8(b), A: a})
			}
			metadata.SetColors(newColors)
			fields = append(fields, "metadata.colors")
		}

		if opacity, ok := metadataMap["opacity"].(float64); ok {
			alpha := uint8(opacity)
			if len(metadata.Colors) == 0 {
				metadata.SetColors([]draw.Color{{A: alpha}})
			} else {
				updated := make([]draw.Color, len(metadata.Colors))
				for i, c := range metadata.Colors {
					c.A = alpha
					updated[i] = c
				}
				metadata.SetColors(updated)
			}
			fields = append(fields, "metadata.opacities")
		}

		if showAxes, ok := metadataMap["showAxesHelper"].(bool); ok {
			metadata.SetShowAxesHelper(showAxes)
			fields = append(fields, "metadata.showAxesHelper")
		}

		if invisible, ok := metadataMap["invisible"].(bool); ok {
			metadata.SetInvisible(invisible)
			fields = append(fields, "metadata.invisible")
		}

		t.Metadata = draw.MetadataToStruct(metadata)
	}

	s.mu.Unlock()

	s.emitUpdate(t, fields)

	return map[string]any{"ok": true}, nil
}

// floatField returns the float64 at key if present, otherwise the fallback.
// structpb deserialization always produces float64 for numeric values, so this
// assertion suffices for commands received over the wire.
func floatField(m map[string]any, key string, fallback float64) float64 {
	if v, ok := m[key].(float64); ok {
		return v
	}
	return fallback
}

func (s *TestStore) remove(cmd map[string]any) (map[string]any, error) {
	name, _ := cmd["name"].(string)
	if name == "" {
		return nil, fmt.Errorf("name is required")
	}

	s.mu.Lock()
	rawKey, t := s.findByName(name)
	if t != nil {
		delete(s.transforms, rawKey)
		if pcKey, err := formatUUIDKey(t.Uuid); err == nil {
			delete(s.pointCloudPositions, pcKey)
			delete(s.pointCloudColors, pcKey)
			delete(s.pointCloudChunkSize, pcKey)
		}
	}
	s.mu.Unlock()

	if t != nil {
		s.emitChange(&commonpb.Transform{Uuid: t.Uuid}, pb.TransformChangeType_TRANSFORM_CHANGE_TYPE_REMOVED)
	}

	return map[string]any{"ok": true}, nil
}

func (s *TestStore) getChunk(cmd map[string]any) (map[string]any, error) {
	uuidStr, _ := cmd["uuid"].(string)
	if uuidStr == "" {
		return nil, fmt.Errorf("uuid is required")
	}

	start, _ := cmd["start"].(float64)
	startIdx := int(start)

	s.mu.RLock()
	positions, ok := s.pointCloudPositions[uuidStr]
	colors := s.pointCloudColors[uuidStr]
	chunkSize := s.pointCloudChunkSize[uuidStr]
	s.mu.RUnlock()

	if !ok {
		return nil, fmt.Errorf("no chunked data for uuid %s", uuidStr)
	}

	totalPoints := len(positions) / 3
	if startIdx >= totalPoints {
		return map[string]any{
			"start": startIdx,
			"done":  true,
		}, nil
	}

	endIdx := startIdx + chunkSize
	done := false
	if endIdx >= totalPoints {
		endIdx = totalPoints
		done = true
	}

	chunkPositions := positions[startIdx*3 : endIdx*3]
	posBytes := make([]byte, len(chunkPositions)*4)
	for i, v := range chunkPositions {
		binary.LittleEndian.PutUint32(posBytes[i*4:], math.Float32bits(v))
	}

	// Shape the response like a chunked Transform: metadata.colors/opacities
	// and physical_object.points.positions sit in their normal places, so the
	// client can reuse the same parsing path as regular transform events.
	metadata := map[string]any{}
	if colors != nil {
		chunkColors := colors[startIdx*3 : endIdx*3]
		metadata["colors"] = base64.StdEncoding.EncodeToString(chunkColors)
	}

	entity := map[string]any{
		"metadata": metadata,
		"physical_object": map[string]any{
			"points": map[string]any{
				"positions": base64.StdEncoding.EncodeToString(posBytes),
			},
		},
	}

	return map[string]any{
		"entity": entity,
		"start":  startIdx,
		"done":   done,
	}, nil
}

func (s *TestStore) addChunk(cmd map[string]any) (map[string]any, error) {
	name, _ := cmd["name"].(string)
	if name == "" {
		name = "chunked-pointcloud"
	}

	chunkSizeF, _ := cmd["chunk_size"].(float64)
	chunkSize := int(chunkSizeF)
	if chunkSize <= 0 {
		chunkSize = 50
	}

	numPointsF, _ := cmd["num_points"].(float64)
	numPoints := int(numPointsF)
	if numPoints <= 0 {
		numPoints = 200
	}

	// Generate a simple grid of points.
	allPositions := make([]float32, 0, numPoints*3)
	allColors := make([]byte, 0, numPoints*3)
	for i := 0; i < numPoints; i++ {
		x := float32(i%20) * 10
		y := float32(i/20) * 10
		allPositions = append(allPositions, x, y, 0)
		allColors = append(allColors, 0, 200, 255) // cyan
	}

	// Build a point cloud with only the first chunk for the initial transform.
	firstChunkEnd := min(chunkSize, numPoints)
	firstChunkPC := pointcloud.NewBasicPointCloud(firstChunkEnd)
	for i := range firstChunkEnd {
		err := firstChunkPC.Set(
			r3.Vector{
				X: float64(allPositions[i*3]),
				Y: float64(allPositions[i*3+1]),
				Z: float64(allPositions[i*3+2]),
			},
			pointcloud.NewBasicData(),
		)
		if err != nil {
			return nil, fmt.Errorf("failed to set point: %w", err)
		}
	}

	drawnPC, err := draw.NewDrawnPointCloud(firstChunkPC, draw.WithSinglePointCloudColor(draw.ColorFromName("cyan")))
	if err != nil {
		return nil, err
	}
	pcTransform, err := drawnPC.Draw(name,
		draw.WithPose(spatialmath.NewPoseFromPoint(r3.Vector{X: 0, Y: 300, Z: 300})),
		draw.WithAxesHelper(false),
	)
	if err != nil {
		return nil, err
	}

	if pcTransform.Metadata == nil {
		pcTransform.Metadata = &structpb.Struct{Fields: make(map[string]*structpb.Value)}
	}
	pcTransform.Metadata.Fields["chunks"] = structpb.NewStructValue(&structpb.Struct{
		Fields: map[string]*structpb.Value{
			"chunk_size": structpb.NewNumberValue(float64(chunkSize)),
			"total":      structpb.NewNumberValue(float64(numPoints)),
			"stride":     structpb.NewNumberValue(12),
		},
	})

	// transforms is keyed by raw 16-byte UUID (matches everywhere else), but
	// point cloud chunk maps are keyed by the formatted 36-char UUID string so
	// that client get_entity_chunk requests (which send transform.uuidString)
	// can find the data.
	rawKey := string(pcTransform.Uuid)
	pcKey, err := formatUUIDKey(pcTransform.Uuid)
	if err != nil {
		return nil, fmt.Errorf("invalid point cloud uuid: %w", err)
	}

	s.mu.Lock()
	s.transforms[rawKey] = pcTransform
	s.pointCloudPositions[pcKey] = allPositions
	s.pointCloudColors[pcKey] = allColors
	s.pointCloudChunkSize[pcKey] = chunkSize
	s.mu.Unlock()

	s.emitChange(pcTransform, pb.TransformChangeType_TRANSFORM_CHANGE_TYPE_ADDED)

	return map[string]any{"ok": true}, nil
}

func (s *TestStore) emitChange(transform *commonpb.Transform, changeType pb.TransformChangeType) {
	s.broadcast(worldstatestore.TransformChange{
		ChangeType: changeType,
		Transform:  transform,
	})
}

func (s *TestStore) emitUpdate(transform *commonpb.Transform, fields []string) {
	s.broadcast(worldstatestore.TransformChange{
		ChangeType:    pb.TransformChangeType_TRANSFORM_CHANGE_TYPE_UPDATED,
		Transform:     transform,
		UpdatedFields: fields,
	})
}

func (s *TestStore) broadcast(change worldstatestore.TransformChange) {
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

func (s *TestStore) addTransform(t *commonpb.Transform) {
	s.transforms[string(t.Uuid)] = t
}

// formatUUIDKey converts raw 16-byte UUID bytes to the canonical 36-char string
// that the frontend sends in get_entity_chunk requests (transform.uuidString).
func formatUUIDKey(raw []byte) (string, error) {
	u, err := uuid.FromBytes(raw)
	if err != nil {
		return "", err
	}
	return u.String(), nil
}

// fixturesDir returns the path to the e2e/fixtures directory relative to the binary location.
func fixturesDir() (string, error) {
	exe, err := os.Executable()
	if err != nil {
		return "", fmt.Errorf("could not determine executable path: %w", err)
	}
	return filepath.Join(filepath.Dir(exe), "..", "fixtures"), nil
}

func (s *TestStore) populateTestData() error {
	fixtures, err := fixturesDir()
	if err != nil {
		return err
	}

	// Blue box — far right
	box, err := spatialmath.NewBox(spatialmath.NewZeroPose(), r3.Vector{X: 300, Y: 300, Z: 300}, "test-box")
	if err != nil {
		return err
	}
	drawnBox, err := draw.NewDrawnGeometry(box, draw.WithGeometryColor(draw.ColorFromName("dodgerblue")))
	if err != nil {
		return err
	}
	boxTransform, err := drawnBox.Draw("test-box",
		draw.WithPose(spatialmath.NewPoseFromPoint(r3.Vector{X: 600, Y: 0, Z: 0})),
		draw.WithAxesHelper(false),
	)
	if err != nil {
		return err
	}
	s.addTransform(boxTransform)

	// Green sphere — far left
	sphere, err := spatialmath.NewSphere(spatialmath.NewZeroPose(), 200, "test-sphere")
	if err != nil {
		return err
	}
	drawnSphere, err := draw.NewDrawnGeometry(sphere, draw.WithGeometryColor(draw.ColorFromName("limegreen")))
	if err != nil {
		return err
	}
	sphereTransform, err := drawnSphere.Draw("test-sphere",
		draw.WithPose(spatialmath.NewPoseFromPoint(r3.Vector{X: -600, Y: 0, Z: 0})),
		draw.WithAxesHelper(false),
	)
	if err != nil {
		return err
	}
	s.addTransform(sphereTransform)

	// Purple capsule — far forward
	capsule, err := spatialmath.NewCapsule(spatialmath.NewZeroPose(), 75, 400, "test-capsule")
	if err != nil {
		return err
	}
	drawnCapsule, err := draw.NewDrawnGeometry(capsule, draw.WithGeometryColor(draw.ColorFromName("darkorchid")))
	if err != nil {
		return err
	}
	capsuleTransform, err := drawnCapsule.Draw("test-capsule",
		draw.WithPose(spatialmath.NewPoseFromPoint(r3.Vector{X: 0, Y: 600, Z: 0})),
		draw.WithAxesHelper(false),
	)
	if err != nil {
		return err
	}
	s.addTransform(capsuleTransform)

	// Point cloud from simple.pcd — below
	pcdFile, err := os.Open(filepath.Join(fixtures, "simple.pcd"))
	if err != nil {
		return fmt.Errorf("failed to open simple.pcd: %w", err)
	}
	defer pcdFile.Close()

	pc, err := pointcloud.ReadPCD(pcdFile, pointcloud.BasicType)
	if err != nil {
		return fmt.Errorf("failed to read simple.pcd: %w", err)
	}
	drawnPC, err := draw.NewDrawnPointCloud(pc, draw.WithSinglePointCloudColor(draw.ColorFromName("orange")))
	if err != nil {
		return err
	}
	pcTransform, err := drawnPC.Draw("test-pointcloud",
		draw.WithPose(spatialmath.NewPoseFromPoint(r3.Vector{X: 0, Y: -600, Z: 0})),
		draw.WithAxesHelper(false),
	)
	if err != nil {
		return err
	}
	s.addTransform(pcTransform)

	// Mesh from lod_100.ply — above
	plyData, err := os.ReadFile(filepath.Join(fixtures, "lod_100.ply"))
	if err != nil {
		return fmt.Errorf("failed to read lod_100.ply: %w", err)
	}
	meshConfig := draw.NewDrawConfig("test-mesh",
		draw.WithPose(spatialmath.NewPoseFromPoint(r3.Vector{X: 0, Y: 0, Z: 600})),
		draw.WithAxesHelper(false),
	)
	meshMetadata := draw.MetadataToStruct(draw.NewMetadata(draw.WithMetadataColors(draw.ColorFromName("tomato"))))
	meshTransform := &commonpb.Transform{
		Uuid:           meshConfig.UUID,
		ReferenceFrame: meshConfig.Name,
		PoseInObserverFrame: &commonpb.PoseInFrame{
			ReferenceFrame: meshConfig.Parent,
			Pose:           spatialmath.PoseToProtobuf(meshConfig.Pose),
		},
		PhysicalObject: &commonpb.Geometry{
			GeometryType: &commonpb.Geometry_Mesh{
				Mesh: &commonpb.Mesh{
					ContentType: "ply",
					Mesh:        plyData,
				},
			},
		},
		Metadata: meshMetadata,
	}
	s.addTransform(meshTransform)

	// Axes helper — behind and below
	axesSphere, err := spatialmath.NewSphere(spatialmath.NewZeroPose(), 30, "test-axes-helper")
	if err != nil {
		return err
	}
	drawnAxes, err := draw.NewDrawnGeometry(axesSphere, draw.WithGeometryColor(draw.ColorFromName("gold")))
	if err != nil {
		return err
	}
	axesTransform, err := drawnAxes.Draw("test-axes-helper",
		draw.WithPose(spatialmath.NewPoseFromPoint(r3.Vector{X: 0, Y: 0, Z: -400})),
		draw.WithAxesHelper(true),
	)
	if err != nil {
		return err
	}
	s.addTransform(axesTransform)

	return nil
}
