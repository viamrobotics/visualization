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
	"google.golang.org/protobuf/types/known/structpb"
)

// Snapshot represents a snapshot of a world state
type Snapshot struct {
	uuid          []byte
	transforms    []*commonv1.Transform
	drawings      []*Drawing
	sceneMetadata SceneMetadata
}

// UUID returns the UUID of the snapshot
func (snapshot *Snapshot) UUID() []byte {
	return snapshot.uuid
}

// Transforms returns the transforms of the snapshot
func (snapshot *Snapshot) Transforms() []*commonv1.Transform {
	return snapshot.transforms
}

// Drawings returns the drawings of the snapshot
func (snapshot *Snapshot) Drawings() []*Drawing {
	return snapshot.drawings
}

// SceneMetadata returns the scene metadata of the snapshot
func (snapshot *Snapshot) SceneMetadata() SceneMetadata {
	return snapshot.sceneMetadata
}

// ToProto converts the snapshot to a protobuf message
func (snapshot *Snapshot) ToProto() *drawv1.Snapshot {
	drawingProtos := make([]*drawv1.Drawing, len(snapshot.drawings))
	for i, drawing := range snapshot.drawings {
		drawingProtos[i] = drawing.toProto()
	}

	return &drawv1.Snapshot{
		Transforms:    snapshot.transforms,
		Drawings:      drawingProtos,
		Uuid:          snapshot.uuid,
		SceneMetadata: snapshot.sceneMetadata.ToProto(),
	}
}

// MarshalJSON marshals a snapshot to JSON
func (snapshot *Snapshot) MarshalJSON() ([]byte, error) {
	marshaler := protojson.MarshalOptions{
		EmitUnpopulated: true,
	}

	return marshaler.Marshal(snapshot.ToProto())
}

// MarshalBinary marshals a snapshot to binary protobuf format
func (snapshot *Snapshot) MarshalBinary() ([]byte, error) {
	return proto.Marshal(snapshot.ToProto())
}

// MarshalBinaryGzip marshals a snapshot to gzip-compressed binary protobuf format
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

// NewSnapshot creates a new snapshot with a unique UUID
func NewSnapshot(sceneOptions ...sceneMetadataOption) *Snapshot {
	uuidBytes := uuid.New()
	return &Snapshot{
		uuid:          uuidBytes[:],
		transforms:    []*commonv1.Transform{},
		drawings:      []*Drawing{},
		sceneMetadata: NewSceneMetadata(sceneOptions...),
	}
}

// Validate validates a snapshot
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

// DrawFrameSystemGeometries draws the geometries of a frame system in the world frame to the snapshot
//   - frameSystem is the frame system to draw
//   - inputs are the inputs to the frame system
//   - colors are the colors to use for the frame system geometries, mapped by frame name
//   - Returns an error if the frame system geometries cannot be drawn
func (snapshot *Snapshot) DrawFrameSystemGeometries(
	frameSystem *referenceframe.FrameSystem,
	inputs referenceframe.FrameSystemInputs,
	colors map[string]Color,
) error {
	transforms, err := DrawFrameSystemGeometries(frameSystem, inputs, colors)
	if err != nil {
		return err
	}

	snapshot.transforms = append(snapshot.transforms, transforms.Transforms...)
	return nil
}

// DrawFrame draws a frame transform to the snapshot
//   - id is the ID of the frame
//   - name is the name of the frame
//   - parent is the parent of the frame
//   - pose is the pose of the frame
//   - geometry is the geometry of the frame
//   - metadata is visualizer metadata for the frame
//   - Returns an error if the frame transform cannot be drawn
func (snapshot *Snapshot) DrawFrame(
	id string,
	name string,
	parent string,
	pose spatialmath.Pose,
	geometry spatialmath.Geometry,
	metadata *structpb.Struct,
) error {
	transform, err := NewTransform(id, name, parent, pose, geometry, metadata)
	if err != nil {
		return err
	}
	snapshot.transforms = append(snapshot.transforms, transform)
	return nil
}

// DrawGeometry draws a geometry to the snapshot
//   - geometry is the geometry to draw
//   - pose is the pose of the geometry
//   - parent is the parent of the geometry
//   - color is the color of the geometry
//   - Returns an error if the geometry cannot be drawn
func (snapshot *Snapshot) DrawGeometry(
	geometry spatialmath.Geometry,
	pose spatialmath.Pose,
	parent string,
	color Color,
) error {
	transform, err := DrawGeometry("", geometry, pose, parent, color)
	if err != nil {
		return err
	}

	snapshot.transforms = append(snapshot.transforms, transform)
	return nil
}

// DrawArrows draws arrows to the snapshot
//   - name is the name of the arrows
//   - parent is the parent of the arrows
//   - pose is the pose of the arrows
//   - poses are the poses of the arrows
//   - options are the options for the arrows
//   - Returns an error if the arrows cannot be drawn
func (snapshot *Snapshot) DrawArrows(
	name string,
	parent string,
	pose spatialmath.Pose,
	poses []spatialmath.Pose,
	options ...drawArrowsOption,
) error {
	arrows, err := NewArrows(poses, options...)
	if err != nil {
		return err
	}

	drawing := arrows.Draw(name, parent, pose)
	snapshot.drawings = append(snapshot.drawings, drawing)
	return nil
}

// DrawLine draws a line to the snapshot
//   - name is the name of the line
//   - parent is the parent of the line
//   - pose is the pose of the line
//   - points are the points of the line
//   - options are the options for the line
//   - Returns an error if the line cannot be drawn
func (snapshot *Snapshot) DrawLine(
	name string,
	parent string,
	pose spatialmath.Pose,
	points []r3.Vector,
	options ...drawLineOption,
) error {
	line, err := NewLine(points, options...)
	if err != nil {
		return err
	}

	drawing := line.Draw(name, parent, pose)
	snapshot.drawings = append(snapshot.drawings, drawing)
	return nil
}

// DrawModelFromURL draws a model from a URL to the snapshot
//   - name is the name of the model
//   - parent is the parent of the model
//   - pose is the pose of the model
//   - options are the options for the model
//   - Returns an error if the model cannot be drawn
func (snapshot *Snapshot) DrawModel(
	name string,
	parent string,
	pose spatialmath.Pose,
	options ...drawModelOption,
) error {
	model, err := NewModel(options...)
	if err != nil {
		return err
	}

	drawing := model.Draw(name, parent, pose)
	snapshot.drawings = append(snapshot.drawings, drawing)
	return nil
}

// DrawPoints draws a set of points to the snapshot
//   - name is the name of the points
//   - parent is the parent of the points
//   - pose is the pose of the points
//   - positions are the positions of the points
//   - options are the options for the points
//   - Returns an error if the points cannot be drawn
func (snapshot *Snapshot) DrawPoints(
	name string,
	parent string,
	pose spatialmath.Pose,
	positions []r3.Vector,
	options ...drawPointsOption,
) error {
	points, err := NewPoints(positions, options...)
	if err != nil {
		return err
	}

	drawing := points.Draw(name, parent, pose)
	snapshot.drawings = append(snapshot.drawings, drawing)
	return nil
}
