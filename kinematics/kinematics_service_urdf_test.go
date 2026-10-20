package kinematics

import (
	"context"
	"io/fs"
	"os"
	"path/filepath"
	"testing"

	"connectrpc.com/connect"
	"go.viam.com/rdk/spatialmath"
	"go.viam.com/test"
	"google.golang.org/protobuf/proto"

	kinematicsv1 "github.com/viamrobotics/visualization/kinematics/v1"
)

const (
	twoFingerDir     = "urdf/testdata/two-finger-gripper"
	twoFingerXacro   = "urdf/testdata/two-finger-gripper-xacro"
	serialChainURDF  = "urdf/testdata/serial-chain.urdf"
	twoFingerURDFRel = "urdf/two_finger_gripper.urdf"
)

// dirFiles reads every file under dir into a map keyed by path relative to dir.
func dirFiles(t *testing.T, dir string) map[string][]byte {
	t.Helper()
	files := map[string][]byte{}
	test.That(t, fs.WalkDir(os.DirFS(dir), ".", func(name string, entry fs.DirEntry, err error) error {
		if err != nil || entry.IsDir() {
			return err
		}
		data, err := os.ReadFile(filepath.Join(dir, filepath.FromSlash(name)))
		files[name] = data
		return err
	}), test.ShouldBeNil)
	return files
}

func TestImportURDFThenBuildTwoFingerGripper(t *testing.T) {
	client := newKinematicsClient(t)
	files := dirFiles(t, twoFingerDir)
	zipped := mustZip(t, files)

	for name, req := range map[string]*kinematicsv1.ImportURDFRequest{
		"files":              {Files: files},
		"zip":                {Zip: zipped},
		"explicit path":      {Files: files, UrdfPath: twoFingerURDFRel},
		"explicit tcp":       {Files: files, TcpLink: "tool0"},
		"explicit zip + tcp": {Zip: zipped, UrdfPath: twoFingerURDFRel, TcpLink: "tool0"},
	} {
		t.Run(name, func(t *testing.T) {
			imported, err := client.ImportURDF(context.Background(), connect.NewRequest(req))
			test.That(t, err, test.ShouldBeNil)
			test.That(t, imported.Msg.GetReport().GetTcpLink(), test.ShouldEqual, "tool0")
			test.That(t, imported.Msg.GetReport().GetUrdfPath(), test.ShouldEqual, twoFingerURDFRel)
			test.That(t, imported.Msg.GetSources(), test.ShouldNotBeEmpty)

			built, err := client.Build(context.Background(), connect.NewRequest(&kinematicsv1.BuildRequest{
				Spec: imported.Msg.GetSpec(), Sources: imported.Msg.GetSources(),
			}))
			test.That(t, err, test.ShouldBeNil)
			report := built.Msg.GetReport()
			test.That(t, report.GetFailures(), test.ShouldBeEmpty)
			test.That(t, report.GetDof(), test.ShouldEqual, 1)

			// tool0 sits 0.01 + 0.15 m above the base on the palm, which does not move.
			want := spatialmath.NewPoseFromProtobuf(imported.Msg.GetSpec().GetTcpPose())
			test.That(t, report.GetTcpPose().GetX(), test.ShouldAlmostEqual, want.Point().X, 1e-9)
			test.That(t, report.GetTcpPose().GetY(), test.ShouldAlmostEqual, want.Point().Y, 1e-9)
			test.That(t, report.GetTcpPose().GetZ(), test.ShouldAlmostEqual, 160, 1e-9)
		})
	}
}

func TestImportURDFRejectsInputProblems(t *testing.T) {
	client := newKinematicsClient(t)
	files := dirFiles(t, twoFingerDir)
	xacro := map[string][]byte{"robot.urdf.xacro": []byte("<robot/>")}
	unsupported := map[string][]byte{"robot.urdf.xacro": []byte(
		`<robot xmlns:xacro="http://www.ros.org/wiki/xacro"><link name="${xacro.load_yaml('a.yaml')}"/></robot>`)}

	for name, req := range map[string]*kinematicsv1.ImportURDFRequest{
		"empty":        {},
		"both":         {Files: files, Zip: mustZip(t, files)},
		"bad zip":      {Zip: []byte("not a zip")},
		"bad key":      {Files: map[string][]byte{"../escape.urdf": []byte("<robot/>")}},
		"xacro":        {Files: xacro},
		"unsupported":  {Files: unsupported},
		"no urdf":      {Files: map[string][]byte{"notes.txt": []byte("x")}},
		"missing urdf": {Files: files, UrdfPath: "nope.urdf"},
		"missing tcp":  {Files: files, TcpLink: "no_such_link"},
		"bad urdf":     {Files: map[string][]byte{"a.urdf": []byte("<robot")}},
	} {
		t.Run(name, func(t *testing.T) {
			_, err := client.ImportURDF(context.Background(), connect.NewRequest(req))
			test.That(t, connect.CodeOf(err), test.ShouldEqual, connect.CodeInvalidArgument)
		})
	}

	_, err := client.ImportURDF(context.Background(), connect.NewRequest(&kinematicsv1.ImportURDFRequest{Files: unsupported}))
	test.That(t, connect.CodeOf(err), test.ShouldEqual, connect.CodeInvalidArgument)
	test.That(t, err.Error(), test.ShouldContainSubstring, "xacro.load_yaml")
	test.That(t, err.Error(), test.ShouldContainSubstring, "xacro robot.urdf.xacro -o robot.urdf")
}

func TestImportURDFExpandsXacroToTheSameSpecAsURDF(t *testing.T) {
	client := newKinematicsClient(t)
	fromURDF, err := client.ImportURDF(context.Background(), connect.NewRequest(&kinematicsv1.ImportURDFRequest{Files: dirFiles(t, twoFingerDir)}))
	test.That(t, err, test.ShouldBeNil)
	fromXacro, err := client.ImportURDF(context.Background(), connect.NewRequest(&kinematicsv1.ImportURDFRequest{Files: dirFiles(t, twoFingerXacro)}))
	test.That(t, err, test.ShouldBeNil)

	test.That(t, fromXacro.Msg.GetReport().GetUrdfPath(), test.ShouldEqual, "urdf/two_finger_gripper.urdf.xacro")
	test.That(t, proto.Equal(fromXacro.Msg.GetSpec(), fromURDF.Msg.GetSpec()), test.ShouldBeTrue)
	test.That(t, fromXacro.Msg.GetSources(), test.ShouldResemble, fromURDF.Msg.GetSources())
}

func TestImportURDFSerialChainBuilds(t *testing.T) {
	client := newKinematicsClient(t)
	data, err := os.ReadFile(serialChainURDF)
	test.That(t, err, test.ShouldBeNil)
	imported, err := client.ImportURDF(context.Background(), connect.NewRequest(&kinematicsv1.ImportURDFRequest{
		Files: map[string][]byte{"serial-chain.urdf": data},
	}))
	test.That(t, err, test.ShouldBeNil)
	test.That(t, proto.Size(imported.Msg.GetSpec()), test.ShouldBeGreaterThan, 0)
	sources, err := sourcesFS(imported.Msg.GetSources())
	test.That(t, err, test.ShouldBeNil)
	out, err := Build(imported.Msg.GetSpec(), sources)
	test.That(t, err, test.ShouldBeNil)
	test.That(t, ValidateSpec(out.Files[ModelFileName], imported.Msg.GetSpec()).GetFailures(), test.ShouldBeEmpty)
}
