package draw

import (
	commonv1 "go.viam.com/api/common/v1"
	"go.viam.com/rdk/spatialmath"
)

// poseToProtobuf converts a spatialmath.Pose to its Protocol Buffer representation (commonv1.Pose).
func poseToProtobuf(pose spatialmath.Pose) *commonv1.Pose {
	return spatialmath.PoseToProtobuf(pose)
}

// poseInFrameToProtobuf converts a spatialmath.Pose and reference frame name to a Protocol Buffer
// commonv1.PoseInFrame, which represents a pose within a specific coordinate frame.
func poseInFrameToProtobuf(pose spatialmath.Pose, parent string) *commonv1.PoseInFrame {
	return &commonv1.PoseInFrame{
		ReferenceFrame: parent,
		Pose:           poseToProtobuf(pose),
	}
}

// renderableGeometry lowers geometry types that have no wire representation into ones that do.
// A spatialmath.Cylinder has no cylinder message in the commonv1.Geometry oneof, so its
// ToProtobuf panics by design and callers are expected to intercept it upstream; we tessellate
// it to a mesh, which the renderer already draws as a model. This also covers open cylinders,
// which are the same type. All other geometries are returned unchanged.
func renderableGeometry(geometry spatialmath.Geometry) spatialmath.Geometry {
	if cyl, ok := geometry.(*spatialmath.Cylinder); ok {
		return cyl.ToMesh()
	}
	return geometry
}

// geometryToProtobuf converts a spatialmath.Geometry to its Protocol Buffer representation (commonv1.Geometry).
// It re-tags the geometry_type oneof for spheres, boxes, and capsules. Other geometry types are returned as
// ToProtobuf produced them.
func geometryToProtobuf(geometry spatialmath.Geometry) *commonv1.Geometry {
	geometryProto := renderableGeometry(geometry).ToProtobuf()
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
