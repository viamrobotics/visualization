package urdf

import (
	"errors"
	"math"
	"os"
	"reflect"
	"testing"
	"testing/fstest"

	"google.golang.org/protobuf/proto"

	"go.viam.com/rdk/spatialmath"

	"github.com/viamrobotics/visualization/kinematics/urdf/xacro"
	kinematicsv1 "github.com/viamrobotics/visualization/kinematics/v1"
)

func TestTwoFingerGripperFixture(t *testing.T) {
	imported, err := Convert(os.DirFS("testdata/two-finger-gripper"), Options{})
	if err != nil {
		t.Fatalf("Convert: %v", err)
	}
	spec, report := imported.Spec, imported.Report

	if spec.GetName() != "two_finger_gripper" || report.GetUrdfPath() != "urdf/two_finger_gripper.urdf" {
		t.Errorf("name = %q, urdf_path = %q", spec.GetName(), report.GetUrdfPath())
	}
	if got := linkIDs(spec); len(got) != 7 {
		t.Errorf("links = %v, want gripper_base, palm, both fingers, both tips, marker_link", got)
	}
	if len(spec.GetJoints()) != 2 {
		t.Fatalf("joints = %d, want 2", len(spec.GetJoints()))
	}

	palm := linkByID(t, spec, "palm")
	if palm.GetMeshPath() != "meshes/collision/palm.stl" || palm.GetMeshUnit() != kinematicsv1.LengthUnit_LENGTH_UNIT_MILLIMETERS {
		t.Errorf("palm = %v", palm)
	}
	for _, path := range []string{"meshes/collision/palm.stl", "meshes/collision/finger.stl", "meshes/visual/marker.stl"} {
		if len(imported.Meshes[path]) == 0 {
			t.Errorf("meshes missing %s", path)
		}
	}

	left := jointByID(t, spec, "left_finger_joint")
	right := jointByID(t, spec, "right_finger_joint")
	if math.Abs(left.GetUpper()-0.8*180/math.Pi) > 1e-9 || right.GetMimic().GetJoint() != "left_finger_joint" || right.GetMimic().GetMultiplier() != -1 {
		t.Errorf("left = %v, right = %v", left, right)
	}
	if linkByID(t, spec, "left_tip").GetParent() != "left_finger_joint" || linkByID(t, spec, "palm").GetParent() != "" {
		t.Errorf("fixed folding: left_tip parent = %q, palm parent = %q",
			linkByID(t, spec, "left_tip").GetParent(), linkByID(t, spec, "palm").GetParent())
	}

	if report.GetTcpLink() != "tool0" || spec.GetTcpParent() != "" {
		t.Errorf("tcp_link = %q, tcp_parent = %q", report.GetTcpLink(), spec.GetTcpParent())
	}
	if got := spatialmath.NewPoseFromProtobuf(spec.GetTcpPose()).Point(); math.Abs(got.Z-160) > 1e-9 {
		t.Errorf("tcp z = %v mm, want 160", got.Z)
	}
	if !contains(report.GetTcpCandidates(), "tool0") || !contains(report.GetVisualFallbacks(), "marker_link") {
		t.Errorf("tcp_candidates = %v, visual_fallbacks = %v", report.GetTcpCandidates(), report.GetVisualFallbacks())
	}
	for _, want := range []string{"<inertial> in palm", "<transmission> in left_finger_joint", "<gazebo> in palm", "<visual> in gripper_base"} {
		if !contains(report.GetDropped(), want) {
			t.Errorf("dropped = %v, missing %q", report.GetDropped(), want)
		}
	}
}

func TestSerialChainFixture(t *testing.T) {
	files := os.DirFS("testdata")
	imported, err := Convert(files, Options{URDFPath: "serial-chain.urdf"})
	if err != nil {
		t.Fatalf("Convert: %v", err)
	}
	spec := imported.Spec
	if len(spec.GetJoints()) != 4 || len(spec.GetLinks()) != 5 {
		t.Fatalf("joints = %d, links = %d, want 4 and 5", len(spec.GetJoints()), len(spec.GetLinks()))
	}
	wantParents := map[string]string{"joint1": "", "joint2": "joint1", "joint3": "joint2", "joint4": "joint3"}
	for id, want := range wantParents {
		if got := jointByID(t, spec, id).GetParent(); got != want {
			t.Errorf("%s parent = %q, want %q", id, got, want)
		}
	}
	if jointByID(t, spec, "joint4").GetType() != kinematicsv1.JointType_JOINT_TYPE_PRISMATIC {
		t.Error("joint4 is not prismatic")
	}
}

func TestTwoFingerGripperXacroMatchesURDF(t *testing.T) {
	fromURDF, err := Convert(os.DirFS("testdata/two-finger-gripper"), Options{})
	if err != nil {
		t.Fatalf("Convert URDF: %v", err)
	}
	fromXacro, err := Convert(os.DirFS("testdata/two-finger-gripper-xacro"), Options{})
	if err != nil {
		t.Fatalf("Convert xacro: %v", err)
	}
	if got := fromXacro.Report.GetUrdfPath(); got != "urdf/two_finger_gripper.urdf.xacro" {
		t.Errorf("urdf_path = %q, want the xacro entry", got)
	}
	fromURDF.Report.UrdfPath, fromXacro.Report.UrdfPath = "", ""

	marshal := proto.MarshalOptions{Deterministic: true}
	for name, pair := range map[string][2]proto.Message{
		"spec":   {fromURDF.Spec, fromXacro.Spec},
		"report": {fromURDF.Report, fromXacro.Report},
	} {
		want, err := marshal.Marshal(pair[0])
		if err != nil {
			t.Fatalf("marshal %s: %v", name, err)
		}
		got, err := marshal.Marshal(pair[1])
		if err != nil {
			t.Fatalf("marshal %s: %v", name, err)
		}
		if !reflect.DeepEqual(want, got) {
			t.Errorf("%s differs:\nurdf:  %v\nxacro: %v", name, pair[0], pair[1])
		}
	}
	if !reflect.DeepEqual(fromURDF.Meshes, fromXacro.Meshes) {
		t.Errorf("meshes differ: urdf has %d, xacro has %d", len(fromURDF.Meshes), len(fromXacro.Meshes))
	}
}

func TestUnsupportedXacroFeatureFailsNamingItAndTheCommand(t *testing.T) {
	files := fstest.MapFS{
		"urdf/arm.urdf.xacro": {Data: []byte(`<robot xmlns:xacro="http://www.ros.org/wiki/xacro" name="arm">` +
			`<link name="${xacro.load_yaml('limits.yaml')}"/></robot>`)},
		"urdf/limits.yaml": {Data: []byte("lower: 0")},
	}
	_, err := Convert(files, Options{})
	var unsupported *xacro.UnsupportedError
	if !errors.As(err, &unsupported) {
		t.Fatalf("error %v is not an *xacro.UnsupportedError", err)
	}
	if unsupported.Feature != "xacro.load_yaml" {
		t.Errorf("feature = %q", unsupported.Feature)
	}
	requireError(t, err, "xacro urdf/")
}
