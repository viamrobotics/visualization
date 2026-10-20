package main

import (
	"archive/zip"
	"encoding/binary"
	"io/fs"
	"math"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"go.viam.com/test"
	"google.golang.org/protobuf/encoding/protojson"

	kinematicsv1 "github.com/viamrobotics/visualization/kinematics/v1"
)

const (
	vendorPackageDir = "../../kinematics/urdf/testdata/two-finger-gripper"
	vendorSerialURDF = "../../kinematics/urdf/testdata/serial-chain.urdf"
	vendorXacroEntry = "../../kinematics/urdf/testdata/two-finger-gripper-xacro/urdf/two_finger_gripper.urdf.xacro"
)

func jsonReport(t *testing.T, stdout string) *kinematicsv1.ValidationReport {
	t.Helper()
	report := &kinematicsv1.ValidationReport{}
	test.That(t, protojson.Unmarshal([]byte(stdout), report), test.ShouldBeNil)
	return report
}

func linkTriangles(report *kinematicsv1.ValidationReport, id string) uint32 {
	for _, link := range report.GetLinks() {
		if link.GetId() == id {
			return link.GetTriangles()
		}
	}
	return 0
}

func zipDir(t *testing.T, src, dest string) {
	t.Helper()
	out, err := os.Create(dest)
	test.That(t, err, test.ShouldBeNil)
	defer func() { _ = out.Close() }()
	writer := zip.NewWriter(out)
	err = filepath.WalkDir(src, func(path string, entry fs.DirEntry, err error) error {
		if err != nil || entry.IsDir() {
			return err
		}
		rel, err := filepath.Rel(src, path)
		if err != nil {
			return err
		}
		data, err := os.ReadFile(path)
		if err != nil {
			return err
		}
		file, err := writer.Create(filepath.ToSlash(rel))
		if err != nil {
			return err
		}
		_, err = file.Write(data)
		return err
	})
	test.That(t, err, test.ShouldBeNil)
	test.That(t, writer.Close(), test.ShouldBeNil)
}

func TestImportWritesBuildableSpec(t *testing.T) {
	out := filepath.Join(t.TempDir(), "project")
	code, stdout, stderr := exec("import", vendorPackageDir, "-o", out)
	test.That(t, code, test.ShouldEqual, 0)
	test.That(t, stderr, test.ShouldEqual, "")
	test.That(t, stdout, test.ShouldContainSubstring, "TCP link: tool0")
	test.That(t, stdout, test.ShouldContainSubstring, "URDF: urdf/two_finger_gripper.urdf")
	_, err := os.Stat(filepath.Join(out, "kinematics.json"))
	test.That(t, err, test.ShouldBeNil)

	code, stdout, stderr = exec("build", filepath.Join(out, "kinematics.json"), "-lang", "none")
	test.That(t, stderr, test.ShouldEqual, "")
	test.That(t, code, test.ShouldEqual, 0)
	test.That(t, stdout, test.ShouldContainSubstring, "ok")
}

func TestImportNoTCPMatchListsCandidates(t *testing.T) {
	out := filepath.Join(t.TempDir(), "project")
	code, stdout, _ := exec("import", vendorSerialURDF, "-o", out)
	test.That(t, code, test.ShouldEqual, 0)
	test.That(t, stdout, test.ShouldContainSubstring, "none matched")
	test.That(t, stdout, test.ShouldContainSubstring, "re-run with -tcp <link>")
}

func TestImportErrors(t *testing.T) {
	out := filepath.Join(t.TempDir(), "project")
	code, _, stderr := exec("import", vendorPackageDir, "-o", out, "-tcp", "nope")
	test.That(t, code, test.ShouldEqual, exitUsage)
	test.That(t, stderr, test.ShouldContainSubstring, `TCP link "nope" is not a link`)

	code, _, stderr = exec("import", vendorPackageDir)
	test.That(t, code, test.ShouldEqual, exitUsage)
	test.That(t, stderr, test.ShouldContainSubstring, "-o is required")
}

func TestBuildFromVendorSources(t *testing.T) {
	zipPath := filepath.Join(t.TempDir(), "gripper.zip")
	zipDir(t, vendorPackageDir, zipPath)
	serialDir := t.TempDir()
	data, err := os.ReadFile(vendorSerialURDF)
	test.That(t, err, test.ShouldBeNil)
	urdfPath := filepath.Join(serialDir, "serial-chain.urdf")
	test.That(t, os.WriteFile(urdfPath, data, 0o644), test.ShouldBeNil)

	for _, args := range map[string][]string{
		"directory": {vendorPackageDir},
		"zip":       {zipPath},
		"urdf":      {urdfPath, "-tcp", "link4"},
	} {
		out := filepath.Join(t.TempDir(), "out")
		code, stdout, stderr := exec(append([]string{"build", "-o", out}, args...)...)
		test.That(t, stderr, test.ShouldEqual, "")
		test.That(t, code, test.ShouldEqual, 0)
		test.That(t, stdout, test.ShouldContainSubstring, "ok")
		_, err := os.Stat(filepath.Join(out, "model.json"))
		test.That(t, err, test.ShouldBeNil)
	}
}

func TestBuildVendorWithoutTCPMatchFails(t *testing.T) {
	code, _, stderr := exec("build", vendorSerialURDF, "-o", filepath.Join(t.TempDir(), "out"))
	test.That(t, code, test.ShouldEqual, exitUsage)
	test.That(t, stderr, test.ShouldContainSubstring, "re-run with -tcp <link>")
}

func TestBuildTCPMissingLinkFails(t *testing.T) {
	out := filepath.Join(t.TempDir(), "out")
	code, _, stderr := exec("build", vendorPackageDir, "-o", out, "-tcp", "nope")
	test.That(t, code, test.ShouldEqual, exitUsage)
	test.That(t, stderr, test.ShouldContainSubstring, `TCP link "nope"`)
	_, err := os.Stat(out)
	test.That(t, os.IsNotExist(err), test.ShouldBeTrue)
}

func TestBuildMaxTrianglesCapsOverLimitLinkOnly(t *testing.T) {
	out := filepath.Join(t.TempDir(), "out")
	_, base, _ := exec("build", vendorPackageDir, "-o", out, "-lang", "none", "-json")
	_, capped, stderr := exec("build", vendorPackageDir, "-o", out, "-lang", "none", "-json", "-max-triangles", "100")
	test.That(t, stderr, test.ShouldEqual, "")
	before := jsonReport(t, base[strings.Index(base, "{"):])
	after := jsonReport(t, capped[strings.Index(capped, "{"):])

	test.That(t, linkTriangles(before, "marker_link"), test.ShouldBeGreaterThan, 100)
	test.That(t, linkTriangles(after, "marker_link"), test.ShouldBeLessThan, linkTriangles(before, "marker_link"))
	for _, id := range []string{"palm", "left_finger"} {
		test.That(t, linkTriangles(after, id), test.ShouldEqual, linkTriangles(before, id))
	}
}

func TestBuildPrintsWarnings(t *testing.T) {
	dir := t.TempDir()
	const triangles = 5200
	stl := make([]byte, 84, 84+50*triangles)
	binary.LittleEndian.PutUint32(stl[80:], triangles)
	for i := range triangles {
		x := float32(i) * 0.01
		facet := make([]byte, 50)
		for j, value := range []float32{0, 0, 1, x, 0, 0, x + 0.005, 1, 0, x, 0, 1} {
			binary.LittleEndian.PutUint32(facet[j*4:], math.Float32bits(value))
		}
		stl = append(stl, facet...)
	}
	test.That(t, os.WriteFile(filepath.Join(dir, "big.stl"), stl, 0o644), test.ShouldBeNil)
	spec := `{"name":"big","links":[{"id":"body","mesh_path":"big.stl","mesh_unit":"LENGTH_UNIT_METERS"}]}`
	test.That(t, os.WriteFile(filepath.Join(dir, "kinematics.json"), []byte(spec), 0o644), test.ShouldBeNil)

	code, stdout, stderr := exec("build", filepath.Join(dir, "kinematics.json"), "-lang", "none")
	test.That(t, stderr, test.ShouldEqual, "")
	test.That(t, code, test.ShouldEqual, 0)
	test.That(t, stdout, test.ShouldContainSubstring, "Warnings:")
	test.That(t, stdout, test.ShouldContainSubstring, "over the limit")
}

func TestBuildVendorRegenerateLine(t *testing.T) {
	out := filepath.Join(t.TempDir(), "out")
	code, _, stderr := exec("build", vendorPackageDir, "-o", out, "-tcp", "tool0", "-max-triangles", "500")
	test.That(t, stderr, test.ShouldEqual, "")
	test.That(t, code, test.ShouldEqual, 0)
	loader, err := os.ReadFile(filepath.Join(out, "kinematics.go"))
	test.That(t, err, test.ShouldBeNil)
	test.That(t, string(loader), test.ShouldContainSubstring, "build "+vendorPackageDir)
	test.That(t, string(loader), test.ShouldContainSubstring, "-tcp tool0 -max-triangles 500")
}

func TestBuildUnsupportedXacroFails(t *testing.T) {
	dir := t.TempDir()
	entry := `<robot xmlns:xacro="http://www.ros.org/wiki/xacro"><link name="${xacro.load_yaml('a.yaml')}"/></robot>`
	test.That(t, os.WriteFile(filepath.Join(dir, "arm.urdf.xacro"), []byte(entry), 0o644), test.ShouldBeNil)
	code, _, stderr := exec("build", dir, "-o", filepath.Join(t.TempDir(), "out"))
	test.That(t, code, test.ShouldEqual, exitUsage)
	test.That(t, stderr, test.ShouldContainSubstring, "xacro.load_yaml")
	test.That(t, stderr, test.ShouldContainSubstring, "xacro arm.urdf.xacro -o arm.urdf")
}

func TestImportXacroEntryFileByPath(t *testing.T) {
	out := filepath.Join(t.TempDir(), "project")
	code, stdout, stderr := exec("import", vendorXacroEntry, "-o", out)
	test.That(t, stderr, test.ShouldEqual, "")
	test.That(t, code, test.ShouldEqual, 0)
	test.That(t, stdout, test.ShouldContainSubstring, "TCP link: tool0")
	test.That(t, stdout, test.ShouldContainSubstring, "URDF: urdf/two_finger_gripper.urdf.xacro")
	_, err := os.Stat(filepath.Join(out, "meshes", "collision", "palm.stl"))
	test.That(t, err, test.ShouldBeNil)
}
