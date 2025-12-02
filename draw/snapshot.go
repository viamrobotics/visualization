package draw

import (
	"fmt"

	"github.com/golang/geo/r3"
	drawv1 "github.com/viam-labs/motion-tools/gen/draw/v1"
	commonv1 "go.viam.com/api/common/v1"
	"go.viam.com/rdk/referenceframe"
	"go.viam.com/rdk/spatialmath"

	"github.com/google/uuid"
	"google.golang.org/protobuf/encoding/protojson"
	"google.golang.org/protobuf/types/known/structpb"
)

type PassSnapshot struct {
	uuid          []byte
	transforms    []*commonv1.Transform
	drawings      []*Drawing
	sceneMetadata SceneMetadata
}

func (snapshot *PassSnapshot) UUID() []byte {
	return snapshot.uuid
}

func (snapshot *PassSnapshot) Transforms() []*commonv1.Transform {
	return snapshot.transforms
}

func (snapshot *PassSnapshot) Drawings() []*Drawing {
	return snapshot.drawings
}

func (snapshot *PassSnapshot) SceneMetadata() *SceneMetadata {
	return &snapshot.sceneMetadata
}

func (snapshot *PassSnapshot) ToProto() *drawv1.PassSnapshot {
	drawingProtos := make([]*drawv1.Drawing, len(snapshot.drawings))
	for i, drawing := range snapshot.drawings {
		drawingProtos[i] = drawing.toProto()
	}

	return &drawv1.PassSnapshot{
		Transforms:    snapshot.transforms,
		Drawings:      drawingProtos,
		Uuid:          snapshot.uuid,
		SceneMetadata: snapshot.sceneMetadata.ToProto(),
	}
}

// MarshalPassSnapshot marshals a pass snapshot to JSON with camelCase field names.
// All dimensional units should be converted from millimeters to meters before marshalling.
func (snapshot *PassSnapshot) Marshal() ([]byte, error) {
	marshaler := protojson.MarshalOptions{
		EmitUnpopulated: true,
		Indent:          "  ", // Pretty-print with 2-space indentation
	}
	return marshaler.Marshal(snapshot.ToProto())
}

// NewPassSnapshot creates a new snapshot with a unique UUID
func NewPassSnapshot() *PassSnapshot {
	uuidBytes := uuid.New()
	return &PassSnapshot{
		uuid:          uuidBytes[:],
		transforms:    []*commonv1.Transform{},
		drawings:      []*Drawing{},
		sceneMetadata: NewSceneMetadata(UnitsM),
	}
}

// ValidateSnapshot validates a snapshot
func (snapshot *PassSnapshot) Validate() error {
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

	// Validate each Transform in transforms
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

	// Validate each Drawing in drawings
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
		if drawing.Shape == nil {
			return fmt.Errorf("drawing at index %d has nil shape", i)
		}
	}

	// Validate SceneMetadata if present
	if err := snapshot.sceneMetadata.Validate(); err != nil {
		return fmt.Errorf("invalid scene metadata: %w", err)
	}

	return nil
}

// SetSceneCam

// DrawArrows draws arrows to the snapshot
// Returns the arrows drawing that was drawn
func (snapshot *PassSnapshot) DrawArrows(
	name string,
	parent string,
	pose spatialmath.Pose,
	poses []spatialmath.Pose,
	colors []*Color,
) (*Drawing, error) {
	arrows, err := NewArrows(poses, colors)
	if err != nil {
		return nil, err
	}

	drawing := arrows.Draw(name, parent, pose, UnitsM)
	snapshot.drawings = append(snapshot.drawings, drawing)
	return drawing, nil
}

// DrawFrameSystemGeometries draws the geometries of a frame system in the world frame to the snapshot
// Colors are mapped by frame name
// Returns the transforms that were drawn
func (snapshot *PassSnapshot) DrawFrameSystemGeometries(
	frameSystem *referenceframe.FrameSystem,
	inputs referenceframe.FrameSystemInputs,
	colors map[string]*Color,
) (*drawv1.Transforms, error) {
	transforms, err := DrawFrameSystemGeometries(frameSystem, inputs, colors, UnitsM)
	if err != nil {
		return nil, err
	}

	snapshot.transforms = append(snapshot.transforms, transforms.Transforms...)
	return transforms, nil
}

// DrawFrame draws a frame transform to the snapshot
// Returns the transform that was drawn
func (snapshot *PassSnapshot) DrawFrame(
	id string,
	name string,
	parent string,
	pose spatialmath.Pose,
	geometry spatialmath.Geometry,
	metadata *structpb.Struct,
) (*commonv1.Transform, error) {
	transform, err := NewTransform(id, name, parent, pose, geometry, metadata, UnitsM)
	if err != nil {
		return nil, err
	}
	snapshot.transforms = append(snapshot.transforms, transform)
	return transform, nil
}

// DrawGeometry draws a geometry to the snapshot
// Returns the geometry drawing that was drawn
func (snapshot *PassSnapshot) DrawGeometry(
	geometry spatialmath.Geometry,
	pose spatialmath.Pose,
	parent string,
	color *Color,
) (*commonv1.Transform, error) {
	transform, err := DrawGeometry("", geometry, pose, parent, color, UnitsM)
	if err != nil {
		return nil, err
	}

	snapshot.transforms = append(snapshot.transforms, transform)
	return transform, nil
}

// DrawLine draws a line to the snapshot
// Returns the line drawing that was drawn
func (snapshot *PassSnapshot) DrawLine(
	name string,
	parent string,
	pose spatialmath.Pose,
	points []r3.Vector,
	colors []*Color,
	lineWidth float32,
	dotSize float32,
) (*Drawing, error) {
	line, err := NewLine(points, &lineWidth, &dotSize, colors)
	if err != nil {
		return nil, err
	}

	drawing := line.Draw(name, parent, pose, UnitsM)
	snapshot.drawings = append(snapshot.drawings, drawing)
	return drawing, nil
}

// DrawModelFromURL draws a model from a URL to the snapshot
// Returns the model drawing that was drawn
func (snapshot *PassSnapshot) DrawModelFromURL(
	name string,
	parent string,
	pose spatialmath.Pose,
	url string,
	cacheKey string,
	sizeBytes uint64,
	scale float32,
	animate bool,
) (*Drawing, error) {
	model, err := NewModelFromURL(url, &cacheKey, &sizeBytes, &scale, &animate)
	if err != nil {
		return nil, err
	}

	drawing := model.Draw(name, parent, pose, UnitsM)
	snapshot.drawings = append(snapshot.drawings, drawing)
	return drawing, nil
}

// DrawModelFromGLB draws a model from GLB data to the snapshot
// Returns the model drawing that was drawn
func (snapshot *PassSnapshot) DrawModelFromGLB(
	name string,
	parent string,
	pose spatialmath.Pose,
	glbData []byte,
	cacheKey string,
	scale float32,
	animate bool,
) (*Drawing, error) {
	model, err := NewModelFromGLB(glbData, &cacheKey, nil, &scale, &animate)
	if err != nil {
		return nil, err
	}

	drawing := model.Draw(name, parent, pose, UnitsM)
	snapshot.drawings = append(snapshot.drawings, drawing)
	return drawing, nil
}

// DrawPoints draws a set of points to the snapshot
// Returns the points drawing that was drawn
func (snapshot *PassSnapshot) DrawPoints(
	name string,
	parent string,
	pose spatialmath.Pose,
	positions []r3.Vector,
	colors []*Color,
	pointSize float32,
) (*Drawing, error) {
	points, err := NewPoints(positions, &pointSize, colors)
	if err != nil {
		return nil, err
	}

	drawing := points.Draw(name, parent, pose, UnitsM)
	snapshot.drawings = append(snapshot.drawings, drawing)
	return drawing, nil
}
