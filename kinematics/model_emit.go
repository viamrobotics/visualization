package kinematics

import (
	"encoding/json"
	"fmt"

	commonpb "go.viam.com/api/common/v1"
	"go.viam.com/rdk/referenceframe"
	"go.viam.com/rdk/spatialmath"

	kinematicsv1 "github.com/viamrobotics/visualization/kinematics/v1"
)

// originSuffix names the static link a joint hangs off, `<joint>_origin`.
const originSuffix = "_origin"

// jointOriginID is the id of the static link that places joint id relative to its parent.
func jointOriginID(id string) string { return id + originSuffix }

// poseOrZero reads a proto pose, treating nil as the identity.
func poseOrZero(pose *commonpb.Pose) spatialmath.Pose {
	if pose == nil {
		return spatialmath.NewZeroPose()
	}
	return spatialmath.NewPoseFromProtobuf(pose)
}

// assemblyPoses returns every joint's pose in the assembly frame, the model base with every joint at
// zero. A joint's world pose at zero is its own origin, because every spec pose is already given there.
func assemblyPoses(spec *kinematicsv1.KinematicsSpec) map[string]spatialmath.Pose {
	world := make(map[string]spatialmath.Pose, len(spec.GetJoints()))
	for _, joint := range spec.GetJoints() {
		world[joint.GetId()] = poseOrZero(joint.GetOrigin())
	}
	return world
}

// localPose converts pose, given in the assembly frame, into the frame of parent. An empty parent is
// the model base, which is the assembly frame.
func localPose(world map[string]spatialmath.Pose, parent string, pose spatialmath.Pose) spatialmath.Pose {
	if parent == "" {
		return pose
	}
	return spatialmath.Compose(spatialmath.PoseInverse(world[parent]), pose)
}

// jointType maps a spec joint type to RDK's SVA name.
func jointType(t kinematicsv1.JointType) (string, error) {
	switch t {
	case kinematicsv1.JointType_JOINT_TYPE_REVOLUTE:
		return "revolute", nil
	case kinematicsv1.JointType_JOINT_TYPE_PRISMATIC:
		return "prismatic", nil
	default:
		return "", fmt.Errorf("unsupported joint type %s", t)
	}
}

// emitModel renders spec as RDK SVA kinematics JSON. geometries maps a link id to its collision
// geometry from collisionGeometry. Poses in the spec are in the assembly frame and the compiler
// converts each to its parent's local frame. Each joint gets a static `<joint>_origin` link and hangs
// off it. Every link sits at the identity on its parent with its origin carried in its geometry's
// offset, and TCPFrameID is the sole TCP frame. Joint origins and joints come first in spec
// order, then links, then the TCP.
func emitModel(spec *kinematicsv1.KinematicsSpec, geometries map[string]*spatialmath.GeometryConfig) ([]byte, error) {
	cfg := referenceframe.ModelConfigJSON{
		Name:         spec.GetName(),
		KinParamType: "SVA",
		OutputFrames: []string{TCPFrameID},
	}
	world := assemblyPoses(spec)

	for _, joint := range spec.GetJoints() {
		id := joint.GetId()
		origin, err := linkConfig(jointOriginID(id), spatialmath.PoseToProtobuf(localPose(world, joint.GetParent(), world[id])))
		if err != nil {
			return nil, err
		}
		origin.Parent = joint.GetParent()
		cfg.Links = append(cfg.Links, origin)

		kind, err := jointType(joint.GetType())
		if err != nil {
			return nil, fmt.Errorf("joint %q: %w", id, err)
		}
		jc := referenceframe.JointConfig{
			ID:     id,
			Type:   kind,
			Parent: jointOriginID(id),
			Axis:   spatialmath.AxisConfig{X: joint.GetAxis().GetX(), Y: joint.GetAxis().GetY(), Z: joint.GetAxis().GetZ()},
		}
		if m := joint.GetMimic(); m != nil {
			multiplier := m.GetMultiplier()
			if multiplier == 0 {
				multiplier = 1
			}
			jc.Mimic = &referenceframe.MimicConfig{Joint: m.GetJoint(), ValueMultiplier: multiplier, ValueOffset: m.GetOffset()}
		} else {
			jc.Min, jc.Max = joint.GetLower(), joint.GetUpper()
		}
		cfg.Joints = append(cfg.Joints, jc)
	}

	for _, link := range spec.GetLinks() {
		lc, err := linkConfig(link.GetId(), nil)
		if err != nil {
			return nil, err
		}
		lc.Parent = link.GetParent()
		origin := localPose(world, link.GetParent(), poseOrZero(link.GetOrigin()))
		lc.Geometry, err = originOffsetGeometry(geometries[link.GetId()], spatialmath.PoseToProtobuf(origin))
		if err != nil {
			return nil, fmt.Errorf("link %q: %w", link.GetId(), err)
		}
		cfg.Links = append(cfg.Links, lc)
	}
	tcpPose := localPose(world, spec.GetTcpParent(), poseOrZero(spec.GetTcpPose()))
	out, err := linkConfig(TCPFrameID, spatialmath.PoseToProtobuf(tcpPose))
	if err != nil {
		return nil, err
	}
	out.Parent = spec.GetTcpParent()
	cfg.Links = append(cfg.Links, out)

	data, err := json.MarshalIndent(cfg, "", "  ")
	if err != nil {
		return nil, fmt.Errorf("marshal model %q: %w", spec.GetName(), err)
	}
	return append(data, '\n'), nil
}

// linkConfig returns a geometry-less link posed at pose. A nil pose is the identity.
func linkConfig(id string, pose *commonpb.Pose) (referenceframe.LinkConfig, error) {
	p := spatialmath.NewZeroPose()
	if pose != nil {
		p = spatialmath.NewPoseFromProtobuf(pose)
	}
	orientation, err := spatialmath.NewOrientationConfig(p.Orientation())
	if err != nil {
		return referenceframe.LinkConfig{}, fmt.Errorf("link %q: encode orientation: %w", id, err)
	}
	return referenceframe.LinkConfig{ID: id, Translation: p.Point(), Orientation: orientation}, nil
}

// originOffsetGeometry returns a copy of geometry offset by origin. RDK places a link's geometry before the
// link's own transform, so a translation on a root link would not move its geometry. The origin
// travels in the geometry's offset instead. A nil geometry stays nil.
func originOffsetGeometry(geometry *spatialmath.GeometryConfig, origin *commonpb.Pose) (*spatialmath.GeometryConfig, error) {
	if geometry == nil {
		return nil, nil
	}
	originPose := spatialmath.NewZeroPose()
	if origin != nil {
		originPose = spatialmath.NewPoseFromProtobuf(origin)
	}
	offset := spatialmath.Compose(originPose, spatialmath.NewPoseFromPoint(geometry.TranslationOffset))
	orientation, err := spatialmath.NewOrientationConfig(offset.Orientation())
	if err != nil {
		return nil, fmt.Errorf("encode geometry offset orientation: %w", err)
	}
	offsetGeometry := *geometry
	offsetGeometry.TranslationOffset = offset.Point()
	offsetGeometry.OrientationOffset = *orientation
	return &offsetGeometry, nil
}
