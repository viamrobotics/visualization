package draw

import (
	"bytes"
	"compress/gzip"
	"fmt"

	"github.com/golang/geo/r3"
	drawv1 "github.com/viam-labs/motion-tools/draw/v1"
	commonv1 "go.viam.com/api/common/v1"
	"go.viam.com/rdk/referenceframe"
	"go.viam.com/rdk/spatialmath"

	"github.com/google/uuid"
	"google.golang.org/protobuf/encoding/protojson"
	"google.golang.org/protobuf/proto"
)

// Snapshot is a self-contained, serializable scene captured at a single point in
// time: a set of transforms (physical entities in the frame system), a set of
// drawings (non-physical visualizations), the scene's render metadata, and a
// stable UUID. Snapshots are produced by NewSnapshot, populated via the Draw*
// helpers, and serialized for delivery to the visualizer via MarshalJSON,
// MarshalBinary, or MarshalBinaryGzip.
type Snapshot struct {
	uuid          []byte
	transforms    []*commonv1.Transform
	drawings      []*Drawing
	sceneMetadata SceneMetadata
}

// UUID returns the snapshot's stable identifier as a 16-byte slice.
func (snapshot *Snapshot) UUID() []byte {
	return snapshot.uuid
}

// Transforms returns the transforms (physical entities in the frame system) the
// snapshot has accumulated. The returned slice is the snapshot's own backing
// storage; callers should not mutate it.
func (snapshot *Snapshot) Transforms() []*commonv1.Transform {
	return snapshot.transforms
}

// Drawings returns the drawings (non-physical visualizations) the snapshot has
// accumulated. The returned slice is the snapshot's own backing storage; callers
// should not mutate it.
func (snapshot *Snapshot) Drawings() []*Drawing {
	return snapshot.drawings
}

// SceneMetadata returns the snapshot's scene-wide render configuration (camera,
// grid, default styles, and visibility flags).
func (snapshot *Snapshot) SceneMetadata() SceneMetadata {
	return snapshot.sceneMetadata
}

// ToProto converts the snapshot to a drawv1.Snapshot proto, serializing every
// drawing via Drawing.ToProto and the scene metadata via SceneMetadata.ToProto.
func (snapshot *Snapshot) ToProto() *drawv1.Snapshot {
	drawingProtos := make([]*drawv1.Drawing, len(snapshot.drawings))
	for i, drawing := range snapshot.drawings {
		drawingProtos[i] = drawing.ToProto()
	}

	return &drawv1.Snapshot{
		Transforms:    snapshot.transforms,
		Drawings:      drawingProtos,
		Uuid:          snapshot.uuid,
		SceneMetadata: snapshot.sceneMetadata.ToProto(),
	}
}

// MarshalJSON marshals the snapshot to JSON via protojson, emitting unpopulated
// fields so the output round-trips faithfully. JSON is the most human-readable
// format and is convenient for debugging; for delivery to the visualizer, prefer
// MarshalBinary or MarshalBinaryGzip.
func (snapshot *Snapshot) MarshalJSON() ([]byte, error) {
	marshaler := protojson.MarshalOptions{
		EmitUnpopulated: true,
	}

	return marshaler.Marshal(snapshot.ToProto())
}

// MarshalBinary marshals the snapshot to a compact binary protobuf payload. This
// is the recommended format when payload size matters but the consumer cannot
// decompress gzip; otherwise prefer MarshalBinaryGzip.
func (snapshot *Snapshot) MarshalBinary() ([]byte, error) {
	return proto.Marshal(snapshot.ToProto())
}

// MarshalBinaryGzip marshals the snapshot to a gzip-compressed binary protobuf
// payload. This is the smallest of the three serialization formats and the best
// choice for transport over the network or storage on disk.
func (snapshot *Snapshot) MarshalBinaryGzip() ([]byte, error) {
	binaryData, err := snapshot.MarshalBinary()
	if err != nil {
		return nil, fmt.Errorf("failed to marshal binary: %w", err)
	}

	var buf bytes.Buffer
	gz := gzip.NewWriter(&buf)
	if _, err := gz.Write(binaryData); err != nil {
		return nil, fmt.Errorf("failed to write gzip data: %w", err)
	}
	if err := gz.Close(); err != nil {
		return nil, fmt.Errorf("failed to close gzip writer: %w", err)
	}

	return buf.Bytes(), nil
}

// NewSnapshot returns an empty Snapshot with a freshly generated UUID and the
// given scene-metadata options applied. Without any options, the snapshot uses
// the package-default scene metadata (perspective camera, grid enabled, every
// shape category visible).
func NewSnapshot(sceneOptions ...sceneMetadataOption) *Snapshot {
	uuidBytes := uuid.New()
	return &Snapshot{
		uuid:          uuidBytes[:],
		transforms:    []*commonv1.Transform{},
		drawings:      []*Drawing{},
		sceneMetadata: NewSceneMetadata(sceneOptions...),
	}
}

// Validate checks that the snapshot is well-formed: the receiver itself must be
// non-nil, the UUID must be exactly 16 bytes, the transforms and drawings slices
// must be non-nil (empty is fine), every transform must carry a reference frame
// and an observer-frame pose, every drawing must carry a name and pose, and the
// scene metadata must pass SceneMetadata.Validate. Returns the first failing
// condition wrapped with context.
func (snapshot *Snapshot) Validate() error {
	if snapshot == nil {
		return fmt.Errorf("snapshot is nil")
	}

	if len(snapshot.uuid) == 0 {
		return fmt.Errorf("snapshot UUID is empty")
	}

	if len(snapshot.uuid) != 16 {
		return fmt.Errorf("snapshot UUID must be 16 bytes, got %d", len(snapshot.uuid))
	}

	if snapshot.transforms == nil {
		return fmt.Errorf("snapshot transforms is nil")
	}

	if snapshot.drawings == nil {
		return fmt.Errorf("snapshot drawings is nil")
	}

	for i, transform := range snapshot.transforms {
		if transform == nil {
			return fmt.Errorf("transform at index %d is nil", i)
		}
		if transform.ReferenceFrame == "" {
			return fmt.Errorf("transform at index %d has empty reference frame", i)
		}
		if transform.PoseInObserverFrame == nil {
			return fmt.Errorf("transform at index %d has nil pose in observer frame", i)
		}
	}

	for i, drawing := range snapshot.drawings {
		if drawing == nil {
			return fmt.Errorf("drawing at index %d is nil", i)
		}
		if drawing.Name == "" {
			return fmt.Errorf("drawing at index %d has empty name", i)
		}
		if drawing.Pose == nil {
			return fmt.Errorf("drawing at index %d has nil pose in observer frame", i)
		}
	}

	if err := snapshot.sceneMetadata.Validate(); err != nil {
		return fmt.Errorf("invalid scene metadata: %w", err)
	}

	return nil
}

// DrawFrameSystemGeometries appends a transform per geometry in frameSystem to
// the snapshot, evaluated at the given inputs. colors maps frame names to render
// colors; frames not present in the map inherit from their parent (falling back
// to magenta at the root). Returns an error if frame system resolution fails.
func (snapshot *Snapshot) DrawFrameSystemGeometries(
	frameSystem *referenceframe.FrameSystem,
	inputs referenceframe.FrameSystemInputs,
	colors map[string]Color,
) error {
	drawnFrameSystem := NewDrawnFrameSystem(frameSystem, inputs, WithFrameSystemColors(colors))
	transforms, err := drawnFrameSystem.ToTransforms()
	if err != nil {
		return err
	}

	snapshot.transforms = append(snapshot.transforms, transforms...)
	return nil
}

// DrawFrame appends a single transform to the snapshot for a named frame attached
// to parent at pose, optionally carrying an attached geometry. metadata, if
// non-nil, is converted via MetadataOptionsFromProto and applied to the
// transform. The transform is given a fresh random UUID.
func (snapshot *Snapshot) DrawFrame(
	name string,
	parent string,
	pose spatialmath.Pose,
	geometry spatialmath.Geometry,
	metadata *drawv1.Metadata,
) {
	id := uuid.New()
	config := NewDrawConfig(name, WithUUID(id[:]), WithParent(parent), WithPose(pose))
	transform := NewTransform(config, geometry, MetadataOptionsFromProto(metadata)...)
	snapshot.transforms = append(snapshot.transforms, transform)
}

// DrawGeometry appends a transform for the given geometry to the snapshot,
// positioned at pose within the parent reference frame and rendered with color.
// The transform's name is taken from the geometry's existing label. Returns an
// error if NewDrawnGeometry or the inner Draw call fails.
func (snapshot *Snapshot) DrawGeometry(
	geometry spatialmath.Geometry,
	pose spatialmath.Pose,
	parent string,
	color Color,
) error {
	drawing, err := NewDrawnGeometry(geometry, WithGeometryColor(color))
	if err != nil {
		return err
	}

	transforms, err := drawing.Draw(geometry.Label(), WithParent(parent), WithPose(pose))
	if err != nil {
		return err
	}

	snapshot.transforms = append(snapshot.transforms, transforms)
	return nil
}

// DrawArrows constructs an Arrows from poses and the supplied DrawArrowsOptions
// and appends the resulting drawing to the snapshot, positioned at pose within
// the parent reference frame. Returns the same validation errors NewArrows would
// return (e.g. mismatched color count).
func (snapshot *Snapshot) DrawArrows(
	name string,
	parent string,
	pose spatialmath.Pose,
	poses []spatialmath.Pose,
	options ...DrawArrowsOption,
) error {
	arrows, err := NewArrows(poses, options...)
	if err != nil {
		return err
	}

	drawing := arrows.Draw(name, WithParent(parent), WithPose(pose))
	snapshot.drawings = append(snapshot.drawings, drawing)
	return nil
}

// DrawLine constructs a Line from points and the supplied DrawLineOptions and
// appends the resulting drawing to the snapshot, positioned at pose within the
// parent reference frame. Returns the same validation errors NewLine would
// return (e.g. fewer than 2 points, mismatched color count).
func (snapshot *Snapshot) DrawLine(
	name string,
	parent string,
	pose spatialmath.Pose,
	points []r3.Vector,
	options ...DrawLineOption,
) error {
	line, err := NewLine(points, options...)
	if err != nil {
		return err
	}

	drawing := line.Draw(name, WithParent(parent), WithPose(pose))
	snapshot.drawings = append(snapshot.drawings, drawing)
	return nil
}

// DrawModel constructs a Model from the supplied DrawModelOptions and appends
// the resulting drawing to the snapshot, positioned at pose within the parent
// reference frame. Returns the same validation errors NewModel would return
// (e.g. no assets supplied, zero scale on any axis).
func (snapshot *Snapshot) DrawModel(
	name string,
	parent string,
	pose spatialmath.Pose,
	options ...DrawModelOption,
) error {
	model, err := NewModel(options...)
	if err != nil {
		return err
	}

	drawing := model.Draw(name, WithParent(parent), WithPose(pose))
	snapshot.drawings = append(snapshot.drawings, drawing)
	return nil
}

// DrawPoints constructs a Points from positions and the supplied DrawPointsOptions
// and appends the resulting drawing to the snapshot, positioned at pose within
// the parent reference frame. Returns the same validation errors NewPoints would
// return (e.g. empty positions, mismatched color count).
func (snapshot *Snapshot) DrawPoints(
	name string,
	parent string,
	pose spatialmath.Pose,
	positions []r3.Vector,
	options ...DrawPointsOption,
) error {
	points, err := NewPoints(positions, options...)
	if err != nil {
		return err
	}

	drawing := points.Draw(name, WithParent(parent), WithPose(pose))
	snapshot.drawings = append(snapshot.drawings, drawing)
	return nil
}
