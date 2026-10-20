package urdf

import (
	"fmt"
	"io/fs"
	"math"
	"path"
	"strconv"
	"strings"

	"go.viam.com/rdk/spatialmath"

	commonpb "go.viam.com/api/common/v1"

	"github.com/viamrobotics/visualization/kinematics/urdf/xacro"
	kinematicsv1 "github.com/viamrobotics/visualization/kinematics/v1"
)

const (
	continuousLimitDegrees = 360
	radiansToDegrees       = 180 / math.Pi
	jointAxisDefault       = "1 0 0"
)

// converter holds the state of one import.
type converter struct {
	files    fs.FS
	resolver *meshResolver
	meshes   map[string][]byte
	report   *kinematicsv1.ImportReport
}

// linkDraft is a spec link before ids are final.
type linkDraft struct {
	id     string
	driver string
	link   *kinematicsv1.Link
}

// Convert reads a URDF, or a `.xacro` file it expands first, and the mesh files it references from
// files, which is a package directory, an unzipped upload, or a single URDF beside its meshes. An
// unsupported xacro feature fails with a *xacro.UnsupportedError and imports nothing.
func Convert(files fs.FS, opts Options) (*Import, error) {
	urdfPath := opts.URDFPath
	if urdfPath == "" {
		found, err := FindURDF(files)
		if err != nil {
			return nil, err
		}
		urdfPath = found
	}
	urdfPath = path.Clean(urdfPath)
	isXacro := strings.EqualFold(path.Ext(urdfPath), ".xacro")
	resolver := newMeshResolver(files, urdfPath, isXacro)
	data, err := readURDF(files, urdfPath, resolver)
	if err != nil {
		return nil, err
	}
	robot, err := parseURDF(data)
	if err != nil {
		return nil, fmt.Errorf("%q: %w", urdfPath, err)
	}
	tree, err := buildLinkTree(robot)
	if err != nil {
		return nil, fmt.Errorf("%q: %w", urdfPath, err)
	}

	converter := &converter{
		files:    files,
		resolver: resolver,
		meshes:   map[string][]byte{},
		report:   &kinematicsv1.ImportReport{UrdfPath: urdfPath},
	}
	return converter.convert(robot, tree, urdfPath, opts)
}

// readURDF returns the URDF text at urdfPath, expanding it when it is a xacro file.
func readURDF(files fs.FS, urdfPath string, resolver *meshResolver) ([]byte, error) {
	if !resolver.xacro {
		data, err := fs.ReadFile(files, urdfPath)
		if err != nil {
			return nil, fmt.Errorf("read URDF %q: %w", urdfPath, err)
		}
		return data, nil
	}
	data, err := xacro.Expand(files, urdfPath, xacro.Options{FindPackage: resolver.findPackage})
	if err != nil {
		return nil, fmt.Errorf("expand xacro %q: %w", urdfPath, err)
	}
	return data, nil
}

func (converter *converter) convert(robot *urdfRobot, tree *linkTree, urdfPath string, opts Options) (*Import, error) {
	drafts, geometryless, err := converter.draftLinks(robot, tree)
	if err != nil {
		return nil, err
	}
	converter.reportDroppedElements(robot)

	namer := newIDNamer()
	spec := &kinematicsv1.KinematicsSpec{Name: robot.Name}
	if spec.Name == "" {
		spec.Name = strings.TrimSuffix(path.Base(urdfPath), path.Ext(urdfPath))
	}
	for _, draft := range drafts {
		draft.link.Id = namer.claim(draft.id, linkSuffix)
	}
	jointIDs := map[string]string{}
	for i := range robot.Joints {
		if joint := &robot.Joints[i]; joint.Type != jointFixed {
			jointIDs[joint.Name] = namer.claim(joint.Name, jointSuffix)
		}
	}
	for _, draft := range drafts {
		draft.link.Parent = jointIDs[draft.driver]
		spec.Links = append(spec.Links, draft.link)
	}
	for i := range robot.Joints {
		joint := &robot.Joints[i]
		if joint.Type == jointFixed {
			continue
		}
		specJoint, err := converter.specJoint(tree, joint, jointIDs)
		if err != nil {
			return nil, err
		}
		spec.Joints = append(spec.Joints, specJoint)
	}

	if err := converter.placeTCP(spec, tree, geometryless, jointIDs, opts.TCPLink); err != nil {
		return nil, err
	}
	converter.report.Renamed = namer.renamed
	return &Import{Spec: spec, Meshes: converter.meshes, Report: converter.report}, nil
}

// draftLinks makes one spec link per collision, and returns the links that have no geometry.
func (converter *converter) draftLinks(robot *urdfRobot, tree *linkTree) ([]linkDraft, map[string]bool, error) {
	var drafts []linkDraft
	geometryless := map[string]bool{}
	for i := range robot.Links {
		link := &robot.Links[i]
		if link.Inertial != nil {
			converter.report.Dropped = append(converter.report.Dropped, "<inertial> in "+link.Name)
		}
		geometries, err := converter.linkGeometries(link)
		if err != nil {
			return nil, nil, err
		}
		if len(geometries) == 0 {
			geometryless[link.Name] = true
		}
		for index, geometry := range geometries {
			id := link.Name
			if index > 0 {
				id = link.Name + "_" + strconv.Itoa(index+1)
			}
			drafts = append(drafts, linkDraft{
				id:     id,
				driver: tree.driver(link.Name),
				link:   specLink(geometry, spatialmath.Compose(tree.world[link.Name], geometry.origin)),
			})
		}
	}
	return drafts, geometryless, nil
}

func specLink(geometry placedGeometry, origin spatialmath.Pose) *kinematicsv1.Link {
	link := &kinematicsv1.Link{Origin: spatialmath.PoseToProtobuf(origin)}
	if geometry.primitive != nil {
		link.Primitive = geometry.primitive
		return link
	}
	link.MeshPath = geometry.meshPath
	link.MeshUnit = geometry.meshUnit
	link.Collision = kinematicsv1.CollisionShape_COLLISION_SHAPE_MESH
	return link
}

func (converter *converter) reportDroppedElements(robot *urdfRobot) {
	for _, transmission := range robot.Transmissions {
		owner := transmission.Name
		if len(transmission.Joints) > 0 {
			owner = transmission.Joints[0].Name
		}
		converter.report.Dropped = append(converter.report.Dropped, "<transmission> in "+owner)
	}
	for _, gazebo := range robot.Gazebos {
		owner := gazebo.Reference
		if owner == "" {
			owner = robot.Name
		}
		converter.report.Dropped = append(converter.report.Dropped, "<gazebo> in "+owner)
	}
	for _, control := range robot.Controls {
		converter.report.Dropped = append(converter.report.Dropped, "<ros2_control> in "+control.Name)
	}
}

// specJoint converts a revolute, continuous, or prismatic joint.
func (converter *converter) specJoint(tree *linkTree, joint *urdfJoint, jointIDs map[string]string) (*kinematicsv1.Joint, error) {
	axis, err := parseFloats(axisText(joint), 3, nil, "axis xyz")
	if err != nil {
		return nil, fmt.Errorf("joint %q: %w", joint.Name, err)
	}
	length := math.Sqrt(axis[0]*axis[0] + axis[1]*axis[1] + axis[2]*axis[2])
	if length == 0 {
		return nil, fmt.Errorf("joint %q has a zero axis", joint.Name)
	}
	specJoint := &kinematicsv1.Joint{
		Id:     jointIDs[joint.Name],
		Type:   kinematicsv1.JointType_JOINT_TYPE_REVOLUTE,
		Parent: jointIDs[tree.driver(joint.Parent.Link)],
		Origin: spatialmath.PoseToProtobuf(tree.world[joint.Child.Link]),
		Axis:   &commonpb.Vector3{X: axis[0] / length, Y: axis[1] / length, Z: axis[2] / length},
	}
	if joint.Type == jointPrismatic {
		specJoint.Type = kinematicsv1.JointType_JOINT_TYPE_PRISMATIC
	}
	if joint.Mimic != nil {
		specJoint.Mimic, err = specMimic(tree, joint, jointIDs)
		return specJoint, err
	}
	if err := converter.setLimits(specJoint, joint); err != nil {
		return nil, err
	}
	return specJoint, nil
}

func axisText(joint *urdfJoint) string {
	if joint.Axis == nil || strings.TrimSpace(joint.Axis.XYZ) == "" {
		return jointAxisDefault
	}
	return joint.Axis.XYZ
}

func (converter *converter) setLimits(specJoint *kinematicsv1.Joint, joint *urdfJoint) error {
	if joint.Type == jointContinuous {
		specJoint.Lower, specJoint.Upper = -continuousLimitDegrees, continuousLimitDegrees
		converter.report.Dropped = append(converter.report.Dropped, "continuous limits in "+joint.Name)
		return nil
	}
	if joint.Limit == nil {
		return fmt.Errorf("joint %q is %s and has no <limit>", joint.Name, joint.Type)
	}
	lower, err := parseNumber(joint.Limit.Lower, 0, "limit lower")
	if err != nil {
		return fmt.Errorf("joint %q: %w", joint.Name, err)
	}
	upper, err := parseNumber(joint.Limit.Upper, 0, "limit upper")
	if err != nil {
		return fmt.Errorf("joint %q: %w", joint.Name, err)
	}
	scale := unitScale(joint.Type)
	specJoint.Lower, specJoint.Upper = lower*scale, upper*scale
	return nil
}

// unitScale converts a joint's URDF unit, radians or metres, to the spec's degrees or millimetres.
func unitScale(jointType string) float64 {
	if jointType == jointPrismatic {
		return millimetresPerMetre
	}
	return radiansToDegrees
}

func specMimic(tree *linkTree, joint *urdfJoint, jointIDs map[string]string) (*kinematicsv1.Mimic, error) {
	source := tree.joints[joint.Mimic.Joint]
	if source == nil || source.Type == jointFixed {
		return nil, fmt.Errorf("joint %q mimics %q, which is not a moving joint", joint.Name, joint.Mimic.Joint)
	}
	multiplier, err := parseNumber(joint.Mimic.Multiplier, 1, "mimic multiplier")
	if err != nil {
		return nil, fmt.Errorf("joint %q: %w", joint.Name, err)
	}
	offset, err := parseNumber(joint.Mimic.Offset, 0, "mimic offset")
	if err != nil {
		return nil, fmt.Errorf("joint %q: %w", joint.Name, err)
	}
	return &kinematicsv1.Mimic{Joint: jointIDs[source.Name], Multiplier: multiplier, Offset: offset * unitScale(source.Type)}, nil
}

// placeTCP lists the TCP candidates and puts the TCP at the picked link.
func (converter *converter) placeTCP(spec *kinematicsv1.KinematicsSpec, tree *linkTree, geometryless map[string]bool, jointIDs map[string]string, explicit string) error {
	var candidates []string
	for _, name := range tree.order {
		if geometryless[name] && !tree.hasChildren[name] {
			candidates = append(candidates, name)
		}
	}
	converter.report.TcpCandidates = candidates
	picked, err := pickTCP(tree, candidates, explicit)
	if err != nil {
		return err
	}
	spec.TcpPose = spatialmath.PoseToProtobuf(spatialmath.NewZeroPose())
	if picked == "" {
		return nil
	}
	converter.report.TcpLink = picked
	spec.TcpPose = spatialmath.PoseToProtobuf(tree.world[picked])
	spec.TcpParent = jointIDs[tree.driver(picked)]
	return nil
}
