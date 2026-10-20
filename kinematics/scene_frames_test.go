package kinematics

import (
	"context"
	"io/fs"
	"math"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"connectrpc.com/connect"
	commonpb "go.viam.com/api/common/v1"
	"go.viam.com/rdk/referenceframe"
	"go.viam.com/rdk/spatialmath"
	"go.viam.com/test"

	kinematicsv1 "github.com/viamrobotics/visualization/kinematics/v1"
)

// treeWorldPoses composes every frame of a tree walked from the model, times its geometry center.
// Frames without geometry map to their frame pose alone.
func treeWorldPoses(t *testing.T, frames []*commonpb.Transform) map[string]spatialmath.Pose {
	t.Helper()
	byFrame := transformsByFrame(frames)
	frameWorld := map[string]spatialmath.Pose{}
	var resolve func(name string) spatialmath.Pose
	resolve = func(name string) spatialmath.Pose {
		if p, ok := frameWorld[name]; ok {
			return p
		}
		tr := byFrame[name]
		test.That(t, tr, test.ShouldNotBeNil)
		local := spatialmath.NewPoseFromProtobuf(tr.GetPoseInObserverFrame().GetPose())
		parent := tr.GetPoseInObserverFrame().GetReferenceFrame()
		var p spatialmath.Pose = local
		if parent != worldFrame {
			p = spatialmath.Compose(resolve(parent), local)
		}
		frameWorld[name] = p
		return p
	}
	out := map[string]spatialmath.Pose{}
	for name, tr := range byFrame {
		p := resolve(name)
		if obj := tr.GetPhysicalObject(); obj != nil {
			p = spatialmath.Compose(p, spatialmath.NewPoseFromProtobuf(obj.GetCenter()))
		}
		out[name] = p
	}
	return out
}

func buildSceneFrames(t *testing.T, spec *kinematicsv1.KinematicsSpec, inputs []float64, withSources bool) []*commonpb.Transform {
	t.Helper()
	collision, meshes, err := sceneGeometries(spec, os.DirFS("testdata"))
	test.That(t, err, test.ShouldBeNil)
	if !withSources {
		meshes = nil
	}
	order, err := inputOrder(spec)
	test.That(t, err, test.ShouldBeNil)
	return sceneFrames(spec, collision, meshes, jointValues(spec, order, inputs))
}

// requireMatchesRobot checks that every part's composed world pose equals the pose of its geometry in
// the model a robot loads, at inputs.
func requireMatchesRobot(t *testing.T, spec *kinematicsv1.KinematicsSpec, inputs []float64) {
	t.Helper()
	out, err := Build(spec, os.DirFS("testdata"))
	test.That(t, err, test.ShouldBeNil)
	model, err := referenceframe.UnmarshalModelJSON(out.Files[ModelFileName], spec.GetName())
	test.That(t, err, test.ShouldBeNil)
	robot, err := referenceframe.KinematicModelFromProtobuf(spec.GetName(), referenceframe.KinematicModelToProtobuf(model))
	test.That(t, err, test.ShouldBeNil)
	robotInputs := make([]referenceframe.Input, len(inputs))
	for i, v := range inputs {
		robotInputs[i] = referenceframe.Input(v)
	}
	geoms, err := robot.Geometries(robotInputs)
	test.That(t, err, test.ShouldBeNil)

	world := treeWorldPoses(t, buildSceneFrames(t, spec, inputs, false))
	test.That(t, len(geoms.Geometries()), test.ShouldEqual, len(spec.GetLinks()))
	for _, geom := range geoms.Geometries() {
		id := strings.TrimPrefix(geom.Label(), spec.GetName()+":")
		got := world[id]
		test.That(t, got, test.ShouldNotBeNil)
		test.That(t, spatialmath.PoseAlmostCoincidentEps(got, geom.Pose(), 1e-6), test.ShouldBeTrue)
	}
}

func TestSceneFramesGripperTree(t *testing.T) {
	spec, err := LoadSpec(filepath.Join("testdata", "parallel-gripper.kinematics.json"))
	test.That(t, err, test.ShouldBeNil)
	frames := buildSceneFrames(t, spec, []float64{0}, false)

	var order []string
	parents := map[string]string{}
	for _, tr := range frames {
		order = append(order, tr.GetReferenceFrame())
		parents[tr.GetReferenceFrame()] = tr.GetPoseInObserverFrame().GetReferenceFrame()
	}
	test.That(t, order, test.ShouldResemble, []string{
		RootFrameID, "left-slide", "right-slide", "base", "left-finger", "right-finger", "tcp",
	})
	test.That(t, parents, test.ShouldResemble, map[string]string{
		RootFrameID:    "world",
		"left-slide":   RootFrameID,
		"right-slide":  RootFrameID,
		"base":         RootFrameID,
		"left-finger":  "left-slide",
		"right-finger": "right-slide",
		"tcp":          RootFrameID,
	})
}

func TestSceneFramesVisualMeshes(t *testing.T) {
	spec, err := LoadSpec(filepath.Join("testdata", "parallel-gripper.kinematics.json"))
	test.That(t, err, test.ShouldBeNil)
	frames := buildSceneFrames(t, spec, []float64{0}, true)
	n := len(frames)
	test.That(t, n, test.ShouldEqual, 10)
	for i, id := range []string{"base", "left-finger", "right-finger"} {
		tr := frames[7+i]
		test.That(t, tr.GetReferenceFrame(), test.ShouldEqual, id+" visual")
		test.That(t, tr.GetPoseInObserverFrame().GetReferenceFrame(), test.ShouldEqual, id)
		test.That(t, tr.GetPhysicalObject().GetMesh(), test.ShouldNotBeNil)
		test.That(t, spatialmath.PoseAlmostEqual(spatialmath.NewPoseFromProtobuf(tr.GetPoseInObserverFrame().GetPose()), spatialmath.NewZeroPose()), test.ShouldBeTrue)
	}
}

func TestSceneFramesMatchRobotGripper(t *testing.T) {
	spec, err := LoadSpec(filepath.Join("testdata", "parallel-gripper.kinematics.json"))
	test.That(t, err, test.ShouldBeNil)
	for _, inputs := range [][]float64{{0}, {40}} {
		requireMatchesRobot(t, spec, inputs)
	}
}

func TestSceneFramesMatchRobotRevolute(t *testing.T) {
	link := func(id, parent string, origin *commonpb.Pose) *kinematicsv1.Link {
		return &kinematicsv1.Link{
			Id: id, MeshPath: "cube-300mm.stl", MeshUnit: kinematicsv1.LengthUnit_LENGTH_UNIT_MILLIMETERS,
			Origin: origin, Collision: kinematicsv1.CollisionShape_COLLISION_SHAPE_BOX, Parent: parent,
		}
	}
	spec := &kinematicsv1.KinematicsSpec{
		Name: "chain",
		Links: []*kinematicsv1.Link{
			link("base", "", &commonpb.Pose{Z: 150}),
			link("upper", "shoulder", &commonpb.Pose{X: 20, Y: 10, Z: 300, OX: 1, Theta: 30}),
			link("lower", "elbow", &commonpb.Pose{X: 80, Z: 420, OY: 1, Theta: 15}),
		},
		Joints: []*kinematicsv1.Joint{
			{
				Id: "shoulder", Type: kinematicsv1.JointType_JOINT_TYPE_REVOLUTE,
				Origin: &commonpb.Pose{Z: 300, OZ: 1, Theta: 20}, Axis: &commonpb.Vector3{Z: 1}, Lower: -180, Upper: 180,
			},
			{
				Id: "elbow", Type: kinematicsv1.JointType_JOINT_TYPE_REVOLUTE, Parent: "shoulder",
				Origin: &commonpb.Pose{X: 50, Z: 400, OX: 1, Theta: 40}, Axis: &commonpb.Vector3{Y: 1}, Lower: -180, Upper: 180,
			},
		},
		TcpParent: "elbow",
		TcpPose:   &commonpb.Pose{X: 80, Z: 500, OZ: 1},
	}
	for _, inputs := range [][]float64{{math.Pi / 2, 0}, {0, math.Pi / 2}, {math.Pi / 2, math.Pi / 2}} {
		requireMatchesRobot(t, spec, inputs)
	}
}

func TestJointValues(t *testing.T) {
	spec := &kinematicsv1.KinematicsSpec{Joints: []*kinematicsv1.Joint{
		{Id: "a"},
		{Id: "b", Mimic: &kinematicsv1.Mimic{Joint: "a", Multiplier: -2, Offset: 1}},
		{Id: "c", Mimic: &kinematicsv1.Mimic{Joint: "a"}},
		{Id: "d"},
	}}
	order := []string{"a", "d"}
	test.That(t, jointValues(spec, order, []float64{3, 5}), test.ShouldResemble, map[string]float64{"a": 3, "b": -5, "c": 3, "d": 5})
	test.That(t, jointValues(spec, order, []float64{3}), test.ShouldResemble, map[string]float64{"a": 0, "b": 1, "c": 0, "d": 0})
	test.That(t, jointValues(spec, order, nil), test.ShouldResemble, map[string]float64{"a": 0, "b": 1, "c": 0, "d": 0})
}

func TestInputOrderMatchesValidateInputs(t *testing.T) {
	spec, err := LoadSpec(filepath.Join("testdata", "parallel-gripper.kinematics.json"))
	test.That(t, err, test.ShouldBeNil)
	_, report := buildFixture(t, spec)
	order, err := inputOrder(spec)
	test.That(t, err, test.ShouldBeNil)
	test.That(t, len(order), test.ShouldEqual, len(report.GetInputs()))
	for i, id := range order {
		test.That(t, id, test.ShouldEqual, report.GetInputs()[i].GetJoint())
	}
}

// childFirstChain lists joint b, whose parent is a, before a.
func childFirstChain() *kinematicsv1.KinematicsSpec {
	return &kinematicsv1.KinematicsSpec{
		Name: "chain",
		Links: []*kinematicsv1.Link{{
			Id: "base", MeshPath: "cube-300mm.stl", MeshUnit: kinematicsv1.LengthUnit_LENGTH_UNIT_MILLIMETERS,
			Collision: kinematicsv1.CollisionShape_COLLISION_SHAPE_BOX,
		}},
		Joints: []*kinematicsv1.Joint{
			{
				Id: "b", Type: kinematicsv1.JointType_JOINT_TYPE_PRISMATIC, Parent: "a",
				Origin: &commonpb.Pose{X: 10, Z: 100}, Axis: &commonpb.Vector3{Y: 1}, Lower: 0, Upper: 100,
			},
			{
				Id: "a", Type: kinematicsv1.JointType_JOINT_TYPE_PRISMATIC,
				Origin: &commonpb.Pose{Z: 50}, Axis: &commonpb.Vector3{X: 1}, Lower: 0, Upper: 100,
			},
		},
		TcpParent: "b",
		TcpPose:   &commonpb.Pose{X: 10, Z: 100},
	}
}

func TestInputOrderChildBeforeParent(t *testing.T) {
	spec := childFirstChain()
	out, report := buildFixture(t, spec)
	test.That(t, report.GetFailures(), test.ShouldBeEmpty)
	test.That(t, out, test.ShouldNotBeNil)
	order, err := inputOrder(spec)
	test.That(t, err, test.ShouldBeNil)
	test.That(t, len(order), test.ShouldEqual, 2)
	for i, id := range order {
		test.That(t, id, test.ShouldEqual, report.GetInputs()[i].GetJoint())
	}

	// Only input 0 is non-zero: the joint Validate names first must move, and the other must not.
	first, other := order[0], order[1]
	inputs := []float64{30, 0}
	built := transformsByFrame(buildSceneFrames(t, spec, inputs, false))
	service := NewKinematicsService()
	posed, err := service.Pose(context.Background(), connect.NewRequest(&kinematicsv1.PoseRequest{Spec: spec, Inputs: inputs}))
	test.That(t, err, test.ShouldBeNil)
	posedByFrame := transformsByFrame(posed.Msg.GetFrames())
	moved := func(tr *commonpb.Transform, joint string) float64 {
		origin := poseOrZero(map[string]*commonpb.Pose{"a": spec.Joints[1].Origin, "b": spec.Joints[0].Origin}[joint])
		if joint == "b" {
			origin = spatialmath.Compose(spatialmath.PoseInverse(poseOrZero(spec.Joints[1].Origin)), origin)
		}
		return spatialmath.NewPoseFromProtobuf(tr.GetPoseInObserverFrame().GetPose()).Point().Sub(origin.Point()).Norm()
	}
	for _, frames := range []map[string]*commonpb.Transform{built, posedByFrame} {
		test.That(t, moved(frames[first], first), test.ShouldAlmostEqual, 30, 1e-6)
		test.That(t, moved(frames[other], other), test.ShouldAlmostEqual, 0, 1e-6)
	}

	requireMatchesRobot(t, spec, []float64{30, 0})
	requireMatchesRobot(t, spec, []float64{0, 30})
}

func testdataFS() fs.FS { return os.DirFS("testdata") }
