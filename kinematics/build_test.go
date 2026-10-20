package kinematics

import (
	"bytes"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"io/fs"
	"math"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/golang/geo/r3"
	commonpb "go.viam.com/api/common/v1"
	"go.viam.com/rdk/referenceframe"
	"go.viam.com/test"
	"google.golang.org/protobuf/proto"

	kinematicsv1 "github.com/viamrobotics/visualization/kinematics/v1"
)

func buildFixture(t *testing.T, spec *kinematicsv1.KinematicsSpec) (*Output, *kinematicsv1.ValidationReport) {
	t.Helper()
	out, err := Build(spec, os.DirFS("testdata"))
	test.That(t, err, test.ShouldBeNil)
	return out, ValidateSpec(out.Files[ModelFileName], spec)
}

func linkByID(t *testing.T, report *kinematicsv1.ValidationReport, id string) *kinematicsv1.LinkReport {
	t.Helper()
	for _, l := range report.GetLinks() {
		if l.GetId() == id {
			return l
		}
	}
	t.Fatalf("link %q not in report", id)
	return nil
}

func TestBuildFixture(t *testing.T) {
	spec, err := LoadSpec("testdata/kinematics.json")
	test.That(t, err, test.ShouldBeNil)

	out, report := buildFixture(t, spec)
	test.That(t, report.GetFailures(), test.ShouldBeEmpty)
	test.That(t, report.GetDof(), test.ShouldEqual, 0)
	test.That(t, report.GetTcpPose().GetX(), test.ShouldAlmostEqual, 0, 1e-6)
	test.That(t, report.GetTcpPose().GetY(), test.ShouldAlmostEqual, 0, 1e-6)
	test.That(t, report.GetTcpPose().GetZ(), test.ShouldAlmostEqual, 400, 1e-6)
	test.That(t, report.GetModelBytes(), test.ShouldEqual, len(out.Files[ModelFileName]))
	test.That(t, len(report.GetLinks()), test.ShouldEqual, 2)

	frame := linkByID(t, report, "frame")
	test.That(t, frame.GetShape(), test.ShouldEqual, kinematicsv1.CollisionShape_COLLISION_SHAPE_MESH)
	test.That(t, frame.GetTriangles(), test.ShouldEqual, 12)
	test.That(t, frame.GetExtent().GetX(), test.ShouldAlmostEqual, 300, 1e-3)
	test.That(t, frame.GetExtent().GetY(), test.ShouldAlmostEqual, 300, 1e-3)
	test.That(t, frame.GetExtent().GetZ(), test.ShouldAlmostEqual, 300, 1e-3)

	cup := linkByID(t, report, "cup")
	test.That(t, cup.GetShape(), test.ShouldEqual, kinematicsv1.CollisionShape_COLLISION_SHAPE_MESH)
	test.That(t, cup.GetTriangles(), test.ShouldBeBetweenOrEqual, 12, 200)
	for _, v := range []float64{cup.GetExtent().GetX(), cup.GetExtent().GetY(), cup.GetExtent().GetZ()} {
		test.That(t, v, test.ShouldBeBetweenOrEqual, 100-1e-3, 120)
	}

	again, err := Build(spec, os.DirFS("testdata"))
	test.That(t, err, test.ShouldBeNil)
	test.That(t, bytes.Equal(out.Files[ModelFileName], again.Files[ModelFileName]), test.ShouldBeTrue)
}

func TestBuildBoxCollision(t *testing.T) {
	spec, err := LoadSpec("testdata/kinematics.json")
	test.That(t, err, test.ShouldBeNil)
	boxed := proto.Clone(spec).(*kinematicsv1.KinematicsSpec)
	boxed.Links[0].Collision = kinematicsv1.CollisionShape_COLLISION_SHAPE_BOX

	_, report := buildFixture(t, boxed)
	test.That(t, report.GetFailures(), test.ShouldBeEmpty)
	frame := linkByID(t, report, "frame")
	test.That(t, frame.GetShape(), test.ShouldEqual, kinematicsv1.CollisionShape_COLLISION_SHAPE_BOX)
	test.That(t, frame.GetTriangles(), test.ShouldEqual, 0)
	test.That(t, frame.GetExtent().GetX(), test.ShouldAlmostEqual, 300, 1e-3)
	test.That(t, frame.GetExtent().GetY(), test.ShouldAlmostEqual, 300, 1e-3)
	test.That(t, frame.GetExtent().GetZ(), test.ShouldAlmostEqual, 300, 1e-3)
}

func TestWriteDir(t *testing.T) {
	spec, err := LoadSpec("testdata/kinematics.json")
	test.That(t, err, test.ShouldBeNil)
	out, err := Build(spec, os.DirFS("testdata"))
	test.That(t, err, test.ShouldBeNil)

	dir := filepath.Join(t.TempDir(), "nested", "out")
	test.That(t, out.WriteDir(dir), test.ShouldBeNil)
	got, err := os.ReadFile(filepath.Join(dir, ModelFileName))
	test.That(t, err, test.ShouldBeNil)
	test.That(t, bytes.Equal(got, out.Files[ModelFileName]), test.ShouldBeTrue)
}

func TestBuildRejects(t *testing.T) {
	link := func(id string) *kinematicsv1.Link {
		return &kinematicsv1.Link{
			Id:       id,
			MeshPath: "cube-300mm.stl",
			MeshUnit: kinematicsv1.LengthUnit_LENGTH_UNIT_MILLIMETERS,
		}
	}
	cases := []struct {
		name    string
		spec    *kinematicsv1.KinematicsSpec
		wantIs  error
		wantMsg string
	}{
		{name: "empty name", spec: &kinematicsv1.KinematicsSpec{Links: []*kinematicsv1.Link{link("a")}}},
		{name: "no links", spec: &kinematicsv1.KinematicsSpec{Name: "x"}},
		{name: "empty id", spec: &kinematicsv1.KinematicsSpec{Name: "x", Links: []*kinematicsv1.Link{link("")}}},
		{name: "duplicate id", spec: &kinematicsv1.KinematicsSpec{Name: "x", Links: []*kinematicsv1.Link{link("a"), link("a")}}},
		{name: "reserved id", spec: &kinematicsv1.KinematicsSpec{Name: "x", Links: []*kinematicsv1.Link{link(TCPFrameID)}}},
		{name: "name is tcp", spec: &kinematicsv1.KinematicsSpec{Name: TCPFrameID, Links: []*kinematicsv1.Link{link("a")}}, wantMsg: "name"},
		{name: "name is a visual frame", spec: &kinematicsv1.KinematicsSpec{Name: "a visual", Links: []*kinematicsv1.Link{link("a")}}, wantMsg: "name"},
		{
			name: "missing visual",
			spec: &kinematicsv1.KinematicsSpec{Name: "x", Links: []*kinematicsv1.Link{{
				Id: "a", MeshPath: "nope.stl", MeshUnit: kinematicsv1.LengthUnit_LENGTH_UNIT_MILLIMETERS,
			}}},
			wantIs: fs.ErrNotExist,
		},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			out, err := Build(tc.spec, os.DirFS("testdata"))
			test.That(t, err, test.ShouldNotBeNil)
			test.That(t, out, test.ShouldBeNil)
			if tc.wantIs != nil {
				test.That(t, errors.Is(err, tc.wantIs), test.ShouldBeTrue)
			}
			if tc.wantMsg != "" {
				test.That(t, err.Error(), test.ShouldContainSubstring, tc.wantMsg)
			}
		})
	}
}

func TestBuildPlacesGeometryAtOrigin(t *testing.T) {
	spec, err := LoadSpec("testdata/kinematics.json")
	test.That(t, err, test.ShouldBeNil)
	out, err := Build(spec, os.DirFS("testdata"))
	test.That(t, err, test.ShouldBeNil)

	model, err := referenceframe.UnmarshalModelJSON(out.Files[ModelFileName], spec.GetName())
	test.That(t, err, test.ShouldBeNil)
	// The robot parses the GetKinematics response, so check placement on that side of the round trip.
	robot, err := referenceframe.KinematicModelFromProtobuf(spec.GetName(), referenceframe.KinematicModelToProtobuf(model))
	test.That(t, err, test.ShouldBeNil)
	geometries, err := robot.Geometries(nil)
	test.That(t, err, test.ShouldBeNil)

	wantZ := map[string]float64{spec.GetName() + ":frame": 150, spec.GetName() + ":cup": 350}
	test.That(t, geometries.Geometries(), test.ShouldHaveLength, len(wantZ))
	for _, geometry := range geometries.Geometries() {
		z, ok := wantZ[geometry.Label()]
		test.That(t, ok, test.ShouldBeTrue)
		test.That(t, geometry.Pose().Point().Z, test.ShouldAlmostEqual, z, 1e-6)
	}
}

// robotModel loads built model bytes the way a robot does, through the GetKinematics round trip.
func robotModel(t *testing.T, data []byte, name string) referenceframe.Model {
	t.Helper()
	model, err := referenceframe.UnmarshalModelJSON(data, name)
	test.That(t, err, test.ShouldBeNil)
	robot, err := referenceframe.KinematicModelFromProtobuf(name, referenceframe.KinematicModelToProtobuf(model))
	test.That(t, err, test.ShouldBeNil)
	return robot
}

func geometryCenters(t *testing.T, robot referenceframe.Model, name string, inputs []referenceframe.Input) map[string]r3.Vector {
	t.Helper()
	geometries, err := robot.Geometries(inputs)
	test.That(t, err, test.ShouldBeNil)
	centers := map[string]r3.Vector{}
	for _, g := range geometries.Geometries() {
		centers[strings.TrimPrefix(g.Label(), name+":")] = g.Pose().Point()
	}
	return centers
}

func assertCenter(t *testing.T, centers map[string]r3.Vector, id string, want r3.Vector) {
	t.Helper()
	got, ok := centers[id]
	test.That(t, ok, test.ShouldBeTrue)
	test.That(t, got.X, test.ShouldAlmostEqual, want.X, 1e-6)
	test.That(t, got.Y, test.ShouldAlmostEqual, want.Y, 1e-6)
	test.That(t, got.Z, test.ShouldAlmostEqual, want.Z, 1e-6)
}

func TestBuildParallelGripper(t *testing.T) {
	spec, err := LoadSpec("testdata/parallel-gripper.kinematics.json")
	test.That(t, err, test.ShouldBeNil)
	out, report := buildFixture(t, spec)
	test.That(t, report.GetFailures(), test.ShouldBeEmpty)
	test.That(t, report.GetDof(), test.ShouldEqual, 1)
	test.That(t, report.GetInputs(), test.ShouldHaveLength, 1)
	input := report.GetInputs()[0]
	test.That(t, input.GetJoint(), test.ShouldEqual, "left-slide")
	test.That(t, input.GetType(), test.ShouldEqual, kinematicsv1.JointType_JOINT_TYPE_PRISMATIC)
	test.That(t, input.GetMin(), test.ShouldEqual, 0)
	test.That(t, input.GetMax(), test.ShouldEqual, 40)

	robot := robotModel(t, out.Files[ModelFileName], spec.GetName())
	for _, tc := range []struct {
		input       float64
		left, right r3.Vector
	}{
		{0, r3.Vector{Y: 50, Z: 340}, r3.Vector{Y: -50, Z: 340}},
		{40, r3.Vector{Y: 90, Z: 340}, r3.Vector{Y: -90, Z: 340}},
	} {
		inputs := []referenceframe.Input{tc.input}
		centers := geometryCenters(t, robot, spec.GetName(), inputs)
		test.That(t, centers, test.ShouldHaveLength, 3)
		assertCenter(t, centers, "base", r3.Vector{Z: 150})
		assertCenter(t, centers, "left-finger", tc.left)
		assertCenter(t, centers, "right-finger", tc.right)
		pose, err := robot.Transform(inputs)
		test.That(t, err, test.ShouldBeNil)
		test.That(t, pose.Point().X, test.ShouldAlmostEqual, 0, 1e-6)
		test.That(t, pose.Point().Y, test.ShouldAlmostEqual, 0, 1e-6)
		test.That(t, pose.Point().Z, test.ShouldAlmostEqual, 380, 1e-6)
	}
}

func TestBuildRevoluteChain(t *testing.T) {
	spec := &kinematicsv1.KinematicsSpec{
		Name: "arm-model",
		Links: []*kinematicsv1.Link{{
			Id:        "arm",
			MeshPath:  "cube-300mm.stl",
			MeshUnit:  kinematicsv1.LengthUnit_LENGTH_UNIT_MILLIMETERS,
			Collision: kinematicsv1.CollisionShape_COLLISION_SHAPE_BOX,
			Origin:    &commonpb.Pose{X: 200, OZ: 1},
			Parent:    "shoulder",
		}},
		Joints: []*kinematicsv1.Joint{{
			Id:     "shoulder",
			Type:   kinematicsv1.JointType_JOINT_TYPE_REVOLUTE,
			Origin: &commonpb.Pose{X: 100, OZ: 1},
			Axis:   &commonpb.Vector3{Z: 1},
			Lower:  -180,
			Upper:  180,
		}},
		TcpParent: "shoulder",
		TcpPose:   &commonpb.Pose{X: 200, OZ: 1},
	}
	out, report := buildFixture(t, spec)
	test.That(t, report.GetFailures(), test.ShouldBeEmpty)
	test.That(t, report.GetInputs(), test.ShouldHaveLength, 1)
	test.That(t, report.GetInputs()[0].GetType(), test.ShouldEqual, kinematicsv1.JointType_JOINT_TYPE_REVOLUTE)
	// RDK input units for a revolute joint are radians, though the spec and the model JSON use degrees.
	test.That(t, report.GetInputs()[0].GetMin(), test.ShouldAlmostEqual, -math.Pi, 1e-9)
	test.That(t, report.GetInputs()[0].GetMax(), test.ShouldAlmostEqual, math.Pi, 1e-9)

	robot := robotModel(t, out.Files[ModelFileName], "arm-model")
	assertCenter(t, geometryCenters(t, robot, "arm-model", []referenceframe.Input{0}), "arm", r3.Vector{X: 200})
	centers := geometryCenters(t, robot, "arm-model", []referenceframe.Input{math.Pi / 2})
	assertCenter(t, centers, "arm", r3.Vector{X: 100, Y: 100})
	pose, err := robot.Transform([]referenceframe.Input{math.Pi / 2})
	test.That(t, err, test.ShouldBeNil)
	test.That(t, pose.Point().X, test.ShouldAlmostEqual, 100, 1e-6)
	test.That(t, pose.Point().Y, test.ShouldAlmostEqual, 100, 1e-6)
}

// staticModelSHA256 is the SHA-256 of the model Build emitted for testdata/kinematics.json before
// joints existed, 9489 bytes (renamed output frame to tcp). A static spec must keep emitting exactly those bytes.
const staticModelSHA256 = "ed1e557e4c63a8fb6e5df15caa137a6598de27c17ef41ec5049a73ca6d968ac4"

func TestBuildStaticBytesUnchanged(t *testing.T) {
	spec, err := LoadSpec("testdata/kinematics.json")
	test.That(t, err, test.ShouldBeNil)
	out, err := Build(spec, os.DirFS("testdata"))
	test.That(t, err, test.ShouldBeNil)
	sum := sha256.Sum256(out.Files[ModelFileName])
	test.That(t, len(out.Files[ModelFileName]), test.ShouldEqual, 9489)
	test.That(t, hex.EncodeToString(sum[:]), test.ShouldEqual, staticModelSHA256)
}

func TestBuildRejectsJoints(t *testing.T) {
	joint := func(id, parent string) *kinematicsv1.Joint {
		return &kinematicsv1.Joint{
			Id: id, Parent: parent, Type: kinematicsv1.JointType_JOINT_TYPE_PRISMATIC,
			Axis: &commonpb.Vector3{Y: 1}, Lower: 0, Upper: 10,
		}
	}
	mimic := func(id, source string) *kinematicsv1.Joint {
		j := joint(id, "")
		j.Lower, j.Upper = 0, 0
		j.Mimic = &kinematicsv1.Mimic{Joint: source}
		return j
	}
	link := func(id, parent string) *kinematicsv1.Link {
		return &kinematicsv1.Link{
			Id: id, Parent: parent, MeshPath: "cube-300mm.stl",
			MeshUnit: kinematicsv1.LengthUnit_LENGTH_UNIT_MILLIMETERS,
		}
	}
	with := func(mut func(j *kinematicsv1.Joint)) *kinematicsv1.Joint {
		j := joint("j", "")
		mut(j)
		return j
	}
	spec := func(joints ...*kinematicsv1.Joint) *kinematicsv1.KinematicsSpec {
		return &kinematicsv1.KinematicsSpec{Name: "x", Links: []*kinematicsv1.Link{link("a", "")}, Joints: joints}
	}
	cases := []struct {
		name    string
		spec    *kinematicsv1.KinematicsSpec
		wantMsg string
	}{
		{"joint id duplicates link id", spec(joint("a", "")), "joints[0].id"},
		{"duplicate joint ids", spec(joint("j", ""), joint("j", "")), "joints[1].id"},
		{"joint id is tcp", spec(joint(TCPFrameID, "")), "joints[0].id"},
		{"joint id collides with generated origin", &kinematicsv1.KinematicsSpec{
			Name: "x", Links: []*kinematicsv1.Link{link("j_origin", "")}, Joints: []*kinematicsv1.Joint{joint("j", "")},
		}, "j_origin"},
		{"joint type unset", spec(with(func(j *kinematicsv1.Joint) { j.Type = kinematicsv1.JointType_JOINT_TYPE_UNSPECIFIED })), "joints[0].type"},
		{"axis unset", spec(with(func(j *kinematicsv1.Joint) { j.Axis = nil })), "joints[0].axis"},
		{"axis zero", spec(with(func(j *kinematicsv1.Joint) { j.Axis = &commonpb.Vector3{} })), "joints[0].axis"},
		{"lower above upper", spec(with(func(j *kinematicsv1.Joint) { j.Lower, j.Upper = 5, 1 })), "joints[0].lower"},
		{"joint parent unknown", spec(joint("j", "nope")), "joints[0].parent"},
		{"joint parent is a link", spec(joint("j", "a")), "joints[0].parent"},
		{"link parent unknown", &kinematicsv1.KinematicsSpec{
			Name: "x", Links: []*kinematicsv1.Link{link("a", "nope")}, Joints: []*kinematicsv1.Joint{joint("j", "")},
		}, "links[0].parent"},
		{"tcp parent unknown", &kinematicsv1.KinematicsSpec{
			Name: "x", Links: []*kinematicsv1.Link{link("a", "")}, TcpParent: "nope",
		}, "tcp_parent"},
		{"mimic source unknown", spec(mimic("m", "nope")), "joints[0].mimic.joint"},
		{"mimic of a mimic", spec(joint("j", ""), mimic("m1", "j"), mimic("m2", "m1")), "joints[2].mimic.joint"},
		{"parent cycle", spec(joint("p", "q"), joint("q", "p")), "cycle"},
		{"self parent", spec(joint("p", "p")), "cycle"},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			out, err := Build(tc.spec, os.DirFS("testdata"))
			test.That(t, err, test.ShouldNotBeNil)
			test.That(t, out, test.ShouldBeNil)
			test.That(t, err.Error(), test.ShouldContainSubstring, tc.wantMsg)
		})
	}
}

func TestBuildExamples(t *testing.T) {
	specs, err := filepath.Glob("testdata/examples/*/" + SpecFileName)
	test.That(t, err, test.ShouldBeNil)
	test.That(t, specs, test.ShouldNotBeEmpty)

	for _, path := range specs {
		t.Run(filepath.Base(filepath.Dir(path)), func(t *testing.T) {
			spec, err := LoadSpec(path)
			test.That(t, err, test.ShouldBeNil)

			out, err := Build(spec, os.DirFS(filepath.Dir(path)))
			test.That(t, err, test.ShouldBeNil)

			report := Validate(out.Files[ModelFileName], spec.GetName())
			test.That(t, report.GetFailures(), test.ShouldBeEmpty)
			test.That(t, report.GetLinks(), test.ShouldHaveLength, len(spec.GetLinks()))
		})
	}
}
