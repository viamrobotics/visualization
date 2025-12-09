package draw

import (
	commonv1 "go.viam.com/api/common/v1"
	"go.viam.com/rdk/spatialmath"
)

// poseToProtobuf converts a spatialmath.Pose to its Protocol Buffer representation (commonv1.Pose).
func poseToProtobuf(pose spatialmath.Pose) *commonv1.Pose {
	poseProto := spatialmath.PoseToProtobuf(pose)
	return poseProto
}

// poseInFrameToProtobuf converts a spatialmath.Pose and reference frame name to a Protocol Buffer
// commonv1.PoseInFrame, which represents a pose within a specific coordinate frame.
func poseInFrameToProtobuf(pose spatialmath.Pose, parent string) *commonv1.PoseInFrame {

	return &commonv1.PoseInFrame{
		ReferenceFrame: parent,
		Pose:           poseToProtobuf(pose),
	}
}

// geometryToProtobuf converts a spatialmath.Geometry to its Protocol Buffer representation (commonv1.Geometry).
// Handles sphere, box, and capsule geometry types.
func geometryToProtobuf(geometry spatialmath.Geometry) *commonv1.Geometry {
	geometryProto := geometry.ToProtobuf()
	sphere := geometryProto.GetSphere()
	if sphere != nil {
		geometryProto.GeometryType = &commonv1.Geometry_Sphere{
			Sphere: sphere,
		}

		return geometryProto
	}

	box := geometryProto.GetBox()
	if box != nil {
		geometryProto.GeometryType = &commonv1.Geometry_Box{
			Box: box,
		}
		return geometryProto
	}

	capsule := geometryProto.GetCapsule()
	if capsule != nil {
		geometryProto.GeometryType = &commonv1.Geometry_Capsule{
			Capsule: capsule,
		}
		return geometryProto
	}

	return geometryProto
}
