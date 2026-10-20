package draw

import (
	"errors"

	"go.viam.com/rdk/spatialmath"

	drawv1 "github.com/viamrobotics/visualization/draw/v1"
)

// DrawingUpdate describes a partial update to a stored drawing.
//
// This is the cheap way to move or recolor a drawing whose payload is large: a point cloud can
// be repositioned or recolored without resending its positions. Redrawing it would upsert the
// whole shape.
//
// reference_frame is deliberately absent, as is the shape itself. A drawing's frame is its
// identity and the shape type is fixed. To change either, remove the entity and draw it again.
type DrawingUpdate struct {
	// Pose is the new pose. Nil leaves the pose untouched.
	Pose spatialmath.Pose
	// Parent reparents the drawing to this observer frame. Empty leaves it attached wherever it
	// already is, so moving something does not silently pull it to the world frame.
	Parent string
	// Shape is the new shape. Nil leaves the shape untouched. The shape type must match the
	// stored one, and the service rejects a change from, say, points to arrows. This is the
	// counterpart to TransformUpdate.Geometry: the same idea, a different proto type.
	//
	// Gotcha: colors and opacities live in metadata, not in the shape, and the service does not
	// reconcile the two. Changing the element count here without also sending Colors leaves the
	// stored per-element colors describing the old count. Elements past the end of the color
	// buffer render black, and colors past the end of the elements go unused. Not resending a
	// large per-vertex color buffer just to move some elements is the point of a partial update,
	// so this is left to the caller. The service logs a warning when the counts disagree.
	Shape *Shape
	// Metadata is the new display metadata (colors, opacity, visibility). Nil leaves it
	// untouched, and setting it replaces the stored metadata wholesale.
	//
	// A drawing's metadata is a typed message, so individual attributes can also be updated on
	// their own. See ShowAxesHelper and Invisible. A transform cannot do this, because its
	// metadata is an untyped struct.
	Metadata *Metadata
	// ShowAxesHelper toggles the drawing's axes helper on its own, leaving the rest of the
	// metadata alone. Nil leaves it untouched. Ignored when Metadata is set, which already
	// carries the attribute.
	ShowAxesHelper *bool
	// Invisible hides or shows the drawing on its own, leaving the rest of the metadata alone.
	// Nil leaves it untouched. Ignored when Metadata is set.
	Invisible *bool
}

// ErrEmptyDrawingUpdate is returned when a DrawingUpdate sets no fields. See
// ErrEmptyTransformUpdate for why this is an error rather than a no-op.
var ErrEmptyDrawingUpdate = errors.New(
	"update sets no fields; set at least one of Pose, Parent, Shape, Metadata, ShowAxesHelper, or Invisible",
)

// NewDrawingUpdate builds the drawing and field-mask paths for a partial update.
func NewDrawingUpdate(update DrawingUpdate) (*drawv1.Drawing, []string, error) {
	drawing := &drawv1.Drawing{}
	paths := make([]string, 0, 2)

	if posePaths := poseUpdatePaths(
		DrawingPathPose, DrawingPathPoseValue, DrawingPathPoseParent,
		update.Pose != nil, update.Parent != "",
	); len(posePaths) > 0 {
		pose := update.Pose
		if pose == nil {
			pose = spatialmath.NewZeroPose()
		}
		drawing.PoseInObserverFrame = poseInFrameToProtobuf(pose, update.Parent)
		paths = append(paths, posePaths...)
	}
	if update.Shape != nil {
		drawing.PhysicalObject = update.Shape.ToProto()
		paths = append(paths, DrawingPathShape)
	}

	switch {
	case update.Metadata != nil:
		drawing.Metadata = update.Metadata.ToProto()
		paths = append(paths, DrawingPathMetadata)
	case update.ShowAxesHelper != nil || update.Invisible != nil:
		// Metadata is a typed message here, so each attribute is addressable on its own and the
		// rest of the stored metadata (colors especially) survives untouched.
		drawing.Metadata = &drawv1.Metadata{}
		if update.ShowAxesHelper != nil {
			drawing.Metadata.ShowAxesHelper = update.ShowAxesHelper
			paths = append(paths, DrawingPathMetadataShowAxesHelper)
		}
		if update.Invisible != nil {
			drawing.Metadata.Invisible = update.Invisible
			paths = append(paths, DrawingPathMetadataInvisible)
		}
	}

	if len(paths) == 0 {
		return nil, nil, ErrEmptyDrawingUpdate
	}

	return drawing, paths, nil
}

// ApplyTo implements EntityUpdate.
func (update DrawingUpdate) ApplyTo(req *drawv1.UpdateEntityRequest) ([]string, error) {
	drawing, paths, err := NewDrawingUpdate(update)
	if err != nil {
		return nil, err
	}
	req.Entity = &drawv1.UpdateEntityRequest_Drawing{Drawing: drawing}
	return paths, nil
}
