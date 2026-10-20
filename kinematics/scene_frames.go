package kinematics

import (
	"errors"
	"fmt"
	"io/fs"
	"strings"

	"github.com/golang/geo/r3"
	commonpb "go.viam.com/api/common/v1"
	"go.viam.com/rdk/referenceframe"
	"go.viam.com/rdk/spatialmath"

	kinematicsv1 "github.com/viamrobotics/visualization/kinematics/v1"
)

// visualFrameName is the reference frame of link id's full-detail mesh.
func visualFrameName(id string) string { return id + " visual" }

// inputOrder returns the ids of the joints that take an input, in RDK's MoveableFrameNames order,
// which is ValidationReport.inputs order. It loads a geometry-less model, because the order does not
// depend on geometry or sources.
func inputOrder(spec *kinematicsv1.KinematicsSpec) ([]string, error) {
	data, err := emitModel(spec, nil)
	if err != nil {
		return nil, fmt.Errorf("emit model: %w", err)
	}
	model, err := referenceframe.UnmarshalModelJSON(data, spec.GetName())
	if err != nil {
		return nil, fmt.Errorf("load model: %w", err)
	}
	simple, ok := model.(interface{ MoveableFrameNames() []string })
	if !ok {
		return nil, errors.New("model does not list its moveable frames")
	}
	names := simple.MoveableFrameNames()
	order := make([]string, len(names))
	for i, name := range names {
		order[i] = strings.TrimPrefix(name, spec.GetName()+":")
	}
	return order, nil
}

// jointValues maps every joint id to its value: millimetres for a prismatic joint and radians for a
// revolute one. inputs are in order, the joint ids from inputOrder. A mimic is multiplier * source +
// offset with a multiplier of 0 read as 1. Inputs of any length other than len(order) are read as all
// zero.
func jointValues(spec *kinematicsv1.KinematicsSpec, order []string, inputs []float64) map[string]float64 {
	if len(inputs) != len(order) {
		inputs = make([]float64, len(order))
	}
	values := make(map[string]float64, len(spec.GetJoints()))
	for i, id := range order {
		values[id] = inputs[i]
	}
	for _, joint := range spec.GetJoints() {
		if m := joint.GetMimic(); m != nil {
			multiplier := m.GetMultiplier()
			if multiplier == 0 {
				multiplier = 1
			}
			values[joint.GetId()] = multiplier*values[m.GetJoint()] + m.GetOffset()
		}
	}
	return values
}

// motionPose is the pose a joint adds at value, about or along its normalized axis.
func motionPose(joint *kinematicsv1.Joint, value float64) spatialmath.Pose {
	axis := joint.GetAxis()
	dir := r3.Vector{X: axis.GetX(), Y: axis.GetY(), Z: axis.GetZ()}
	if n := dir.Norm(); n > 0 {
		dir = dir.Mul(1 / n)
	}
	if joint.GetType() == kinematicsv1.JointType_JOINT_TYPE_REVOLUTE {
		return spatialmath.NewPoseFromOrientation(&spatialmath.R4AA{Theta: value, RX: dir.X, RY: dir.Y, RZ: dir.Z})
	}
	return spatialmath.NewPoseFromPoint(dir.Mul(value))
}

// sceneGeometries returns every link's collision geometry in the link's own frame, keyed by link id.
// The link origin is not applied: the geometry's center is its offset within the frame, the identity for a
// mesh and the box's center for a box. meshes holds each link's full-detail visual mesh.
func sceneGeometries(
	spec *kinematicsv1.KinematicsSpec,
	sources fs.FS,
) (collision, meshes map[string]*commonpb.Geometry, err error) {
	collision = make(map[string]*commonpb.Geometry, len(spec.GetLinks()))
	meshes = make(map[string]*commonpb.Geometry, len(spec.GetLinks()))
	for _, link := range spec.GetLinks() {
		if link.GetPrimitive() != nil {
			cfg, err := primitiveGeometry(link)
			if err != nil {
				return nil, nil, fmt.Errorf("build collision geometry: %w", err)
			}
			geometry, err := cfg.ParseConfig()
			if err != nil {
				return nil, nil, fmt.Errorf("link %q: parse collision geometry: %w", link.GetId(), err)
			}
			collision[link.GetId()] = geometry.ToProtobuf()
			continue
		}
		source, err := loadMeshFile(sources, link)
		if err != nil {
			return nil, nil, fmt.Errorf("load link mesh: %w", err)
		}
		cfg, err := collisionGeometry(link, source)
		if err != nil {
			return nil, nil, fmt.Errorf("build collision geometry: %w", err)
		}
		geometry, err := cfg.ParseConfig()
		if err != nil {
			return nil, nil, fmt.Errorf("link %q: parse collision geometry: %w", link.GetId(), err)
		}
		collision[link.GetId()] = geometry.ToProtobuf()
		meshes[link.GetId()] = source.ToProtobuf()
	}
	return collision, meshes, nil
}

// jointFrames returns the joint transforms of spec at values, each relative to its parent joint or
// the root frame. The pose is inverse(world0(parent)) * origin * motion.
func jointFrames(spec *kinematicsv1.KinematicsSpec, values map[string]float64) []*commonpb.Transform {
	world := assemblyPoses(spec)
	frames := make([]*commonpb.Transform, 0, len(spec.GetJoints()))
	for _, joint := range spec.GetJoints() {
		id := joint.GetId()
		pose := spatialmath.Compose(localPose(world, joint.GetParent(), world[id]), motionPose(joint, values[id]))
		frames = append(frames, frameTransform(id, parentFrame(spec, joint.GetParent()), spatialmath.PoseToProtobuf(pose), nil))
	}
	return frames
}

// parentFrame is the reference frame a link, joint, or the TCP hangs off: the parent joint, or the
// root frame when parent is empty.
func parentFrame(_ *kinematicsv1.KinematicsSpec, parent string) string {
	if parent == "" {
		return RootFrameID
	}
	return parent
}

// sceneFrames returns the definition as a parent-relative frame tree: the root frame, joints in spec order,
// links in spec order carrying their collision geometry, the TCP, then, when meshes is not nil, a
// "<id> visual" child per link. collision and meshes come from sceneGeometries.
func sceneFrames(
	spec *kinematicsv1.KinematicsSpec,
	collision, meshes map[string]*commonpb.Geometry,
	values map[string]float64,
) []*commonpb.Transform {
	world := assemblyPoses(spec)
	frames := []*commonpb.Transform{
		frameTransform(RootFrameID, worldFrame, spatialmath.PoseToProtobuf(spatialmath.NewZeroPose()), nil),
	}
	frames = append(frames, jointFrames(spec, values)...)
	for _, link := range spec.GetLinks() {
		origin := localPose(world, link.GetParent(), poseOrZero(link.GetOrigin()))
		frames = append(frames, frameTransform(
			link.GetId(), parentFrame(spec, link.GetParent()), spatialmath.PoseToProtobuf(origin), collision[link.GetId()]))
	}
	tcp := localPose(world, spec.GetTcpParent(), poseOrZero(spec.GetTcpPose()))
	frames = append(frames, frameTransform(
		TCPFrameID, parentFrame(spec, spec.GetTcpParent()), spatialmath.PoseToProtobuf(tcp), nil))
	if meshes != nil {
		zero := spatialmath.PoseToProtobuf(spatialmath.NewZeroPose())
		for _, link := range spec.GetLinks() {
			if link.GetPrimitive() != nil {
				continue
			}
			frames = append(frames, frameTransform(visualFrameName(link.GetId()), link.GetId(), zero, meshes[link.GetId()]))
		}
	}
	return frames
}
