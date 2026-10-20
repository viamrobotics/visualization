package draw

// Field paths accepted in an UpdateEntityRequest's updated_fields mask.
//
// A mask names proto field names, which are snake_case and match neither the Go field name
// (PoseInObserverFrame) nor the JSON name (poseInObserverFrame). Use these constants rather
// than literals so a mask cannot silently name a field that does not exist. The service
// rejects unknown paths, but a constant fails at compile time instead.
//
// Paths may be nested with dots, as the FieldMask spec defines. That is how a caller changes a
// field without rewriting the message around it: TransformPathPoseValue moves an entity while
// leaving the frame it is attached to alone, and DrawingPathMetadataColors recolors a drawing
// without replacing the rest of its metadata. A repeated or map field may only appear last in a
// path.
//
// Prefer the api.UpdateTransform / api.UpdateDrawing helpers, which build the mask for you.
const (
	// TransformPathReferenceFrame is the transform's own frame name. Immutable: an update that
	// changes it is rejected. Remove the entity and add a new one instead.
	TransformPathReferenceFrame = "reference_frame"
	// TransformPathPose is the pose of the transform in its observer frame, together with the
	// name of that frame. Selecting it replaces both. To move an entity without reparenting it,
	// select TransformPathPoseValue instead.
	TransformPathPose = "pose_in_observer_frame"
	// TransformPathPoseValue is just the pose, leaving the observer frame untouched.
	TransformPathPoseValue = TransformPathPose + ".pose"
	// TransformPathPoseParent is just the observer frame, which reparents the entity.
	TransformPathPoseParent = TransformPathPose + ".reference_frame"
	// TransformPathGeometry is the transform's geometry. The geometry type is immutable.
	TransformPathGeometry = "physical_object"
	// TransformPathUUID is the transform's identity. Updating it is not meaningful, because the
	// UUID to update is carried by the request, not the entity.
	TransformPathUUID = "uuid"
	// TransformPathMetadata is the transform's display metadata (color, opacity, relationships).
	TransformPathMetadata = "metadata"
)

const (
	// DrawingPathReferenceFrame is the frame the drawing is attached to. Immutable: an update
	// that changes it is rejected. Remove the entity and add a new one instead.
	DrawingPathReferenceFrame = "reference_frame"
	// DrawingPathPose is the pose of the drawing in its observer frame, together with the name of
	// that frame. See TransformPathPose.
	DrawingPathPose = "pose_in_observer_frame"
	// DrawingPathPoseValue is just the pose, leaving the observer frame untouched.
	DrawingPathPoseValue = DrawingPathPose + ".pose"
	// DrawingPathPoseParent is just the observer frame, which reparents the drawing.
	DrawingPathPoseParent = DrawingPathPose + ".reference_frame"
	// DrawingPathShape is the drawing's shape. The shape type is immutable.
	DrawingPathShape = "physical_object"
	// DrawingPathUUID is the drawing's identity.
	DrawingPathUUID = "uuid"
	// DrawingPathMetadata is the drawing's display metadata (name, color, opacity,
	// relationships). Selecting it replaces the metadata wholesale. Select one of the nested
	// paths below to change a single attribute.
	DrawingPathMetadata = "metadata"
	// DrawingPathMetadataColors is the packed color buffer.
	DrawingPathMetadataColors = DrawingPathMetadata + ".colors"
	// DrawingPathMetadataOpacities is the packed opacity buffer.
	DrawingPathMetadataOpacities = DrawingPathMetadata + ".opacities"
	// DrawingPathMetadataInvisible hides or shows the drawing.
	DrawingPathMetadataInvisible = DrawingPathMetadata + ".invisible"
	// DrawingPathMetadataShowAxesHelper toggles the drawing's axes helper.
	DrawingPathMetadataShowAxesHelper = DrawingPathMetadata + ".show_axes_helper"
)
