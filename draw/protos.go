package draw

import (
	commonv1 "go.viam.com/api/common/v1"
	"go.viam.com/rdk/spatialmath"
)

func poseToProtobuf(pose spatialmath.Pose, units Units) *commonv1.Pose {
	poseProto := spatialmath.PoseToProtobuf(pose)
	if units == UnitsM {
		poseProto.X = float64ToMeters(poseProto.X)
		poseProto.Y = float64ToMeters(poseProto.Y)
		poseProto.Z = float64ToMeters(poseProto.Z)
	}
	return poseProto
}

func poseInFrameToProtobuf(pose spatialmath.Pose, parent string, units Units) *commonv1.PoseInFrame {

	return &commonv1.PoseInFrame{
		ReferenceFrame: parent,
		Pose:           poseToProtobuf(pose, units),
	}
}

func geometryToProtobuf(geometry spatialmath.Geometry, units Units) *commonv1.Geometry {
	geometryProto := geometry.ToProtobuf()
	if units == UnitsM {
		geometryProto.Center.X = float64ToMeters(geometryProto.Center.X)
		geometryProto.Center.Y = float64ToMeters(geometryProto.Center.Y)
		geometryProto.Center.Z = float64ToMeters(geometryProto.Center.Z)
	}

	sphere := geometryProto.GetSphere()
	if sphere != nil {
		if units == UnitsM {
			sphere.RadiusMm = float64ToMeters(sphere.RadiusMm)
		}
		geometryProto.GeometryType = &commonv1.Geometry_Sphere{
			Sphere: sphere,
		}

		return geometryProto
	}

	box := geometryProto.GetBox()
	if box != nil {
		if units == UnitsM {
			box.DimsMm.X = float64ToMeters(box.DimsMm.X)
			box.DimsMm.Y = float64ToMeters(box.DimsMm.Y)
			box.DimsMm.Z = float64ToMeters(box.DimsMm.Z)
		}

		geometryProto.GeometryType = &commonv1.Geometry_Box{
			Box: box,
		}
		return geometryProto
	}

	capsule := geometryProto.GetCapsule()
	if capsule != nil {
		if units == UnitsM {
			capsule.RadiusMm = float64ToMeters(capsule.RadiusMm)
			capsule.LengthMm = float64ToMeters(capsule.LengthMm)
		}
		geometryProto.GeometryType = &commonv1.Geometry_Capsule{
			Capsule: capsule,
		}
		return geometryProto
	}

	return geometryProto
}
