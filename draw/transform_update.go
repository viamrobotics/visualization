package draw

import (
	"errors"

	commonv1 "go.viam.com/api/common/v1"
	"go.viam.com/rdk/spatialmath"

	drawv1 "github.com/viamrobotics/visualization/draw/v1"
)

var (
	_ EntityUpdate = TransformUpdate{}
	_ EntityUpdate = DrawingUpdate{}
)

// EntityUpdate is a partial update to one stored entity. TransformUpdate and DrawingUpdate
// implement it, so callers can update either kind through a single entry point.
type EntityUpdate interface {
	// ApplyTo sets req's entity payload and returns the field paths the update touches.
	// Returns an error when the update sets no fields, since an empty mask would mean
	// "replace every field".
	ApplyTo(req *drawv1.UpdateEntityRequest) ([]string, error)
}

// TransformUpdate describes a partial update to a stored transform.
//
// Presence is the signal: a nil field is left untouched on the stored entity. This is what the
// update RPC's field mask expresses. Building the mask from these fields means callers never
// write proto field-path strings themselves. A misspelled path is a mask that quietly updates
// nothing.
//
// reference_frame is deliberately absent. A transform's own frame name is its identity and the
// service rejects changing it. Remove the entity and add a new one instead.
type TransformUpdate struct {
	// Pose is the new pose. Nil leaves the pose untouched.
	Pose spatialmath.Pose
	// Parent reparents the entity to this observer frame. Empty leaves the entity attached
	// wherever it already is, so moving something does not silently pull it to the world frame.
	Parent string
	// Geometry is the new geometry. Nil leaves the geometry untouched. The geometry type must
	// match the stored one. The service rejects a change from, say, box to sphere.
	Geometry spatialmath.Geometry
	// Metadata is the new display metadata (color, opacity, visibility). Nil leaves it
	// untouched. Note this replaces the stored metadata wholesale rather than merging.
	Metadata *Metadata
}

// ErrEmptyTransformUpdate is returned when a TransformUpdate sets no fields.
//
// An empty update is a programming error rather than a no-op: sending it with an empty field
// mask would mean "replace every field", wiping the stored entity's pose, geometry, and
// metadata.
var ErrEmptyTransformUpdate = errors.New("update sets no fields; set at least one of Pose, Parent, Geometry, or Metadata")

// poseUpdatePaths returns the mask paths covering a pose and/or parent change.
//
// Selecting the whole pose_in_observer_frame would rewrite the observer frame along with the
// pose, so a move with no reparent selects only the nested pose and a reparent with no move
// selects only the nested frame.
//
// A reparent with no move still has to put something in the pose field of the message it sends,
// and callers build that with a zero pose. That is harmless: the mask names only the
// reference_frame leaf, so the stored pose is never read from the message and never overwritten.
func poseUpdatePaths(posePath, poseValuePath, poseParentPath string, hasPose, hasParent bool) []string {
	switch {
	case hasPose && hasParent:
		return []string{posePath}
	case hasPose:
		return []string{poseValuePath}
	case hasParent:
		return []string{poseParentPath}
	default:
		return nil
	}
}

// NewTransformUpdate builds the transform and field-mask paths for a partial update.
//
// The returned transform carries only the fields the update touches, and the paths name exactly
// those fields, so the service leaves everything else alone.
func NewTransformUpdate(update TransformUpdate) (*commonv1.Transform, []string, error) {
	transform := &commonv1.Transform{}
	paths := make([]string, 0, 3)

	if posePaths := poseUpdatePaths(
		TransformPathPose, TransformPathPoseValue, TransformPathPoseParent,
		update.Pose != nil, update.Parent != "",
	); len(posePaths) > 0 {
		pose := update.Pose
		if pose == nil {
			pose = spatialmath.NewZeroPose()
		}
		transform.PoseInObserverFrame = poseInFrameToProtobuf(pose, update.Parent)
		paths = append(paths, posePaths...)
	}
	if update.Geometry != nil {
		transform.PhysicalObject = geometryToProtobuf(update.Geometry)
		paths = append(paths, TransformPathGeometry)
	}
	if update.Metadata != nil {
		transform.Metadata = MetadataToStruct(*update.Metadata)
		paths = append(paths, TransformPathMetadata)
	}

	if len(paths) == 0 {
		return nil, nil, ErrEmptyTransformUpdate
	}

	return transform, paths, nil
}

// ApplyTo implements EntityUpdate.
func (update TransformUpdate) ApplyTo(req *drawv1.UpdateEntityRequest) ([]string, error) {
	transform, paths, err := NewTransformUpdate(update)
	if err != nil {
		return nil, err
	}
	req.Entity = &drawv1.UpdateEntityRequest_Transform{Transform: transform}
	return paths, nil
}
