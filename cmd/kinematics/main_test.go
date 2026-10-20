package main

import (
	"bytes"
	"os"
	"path/filepath"
	"testing"

	"go.viam.com/test"
	"google.golang.org/protobuf/encoding/protojson"

	kinematicsv1 "github.com/viamrobotics/visualization/kinematics/v1"
)

const fixtureDir = "../../kinematics/testdata"

func stageFixtures(t *testing.T, files ...string) string {
	t.Helper()
	dir := t.TempDir()
	for _, name := range files {
		data, err := os.ReadFile(filepath.Join(fixtureDir, name))
		test.That(t, err, test.ShouldBeNil)
		test.That(t, os.WriteFile(filepath.Join(dir, name), data, 0o644), test.ShouldBeNil)
	}
	return dir
}

func stageAll(t *testing.T) string {
	return stageFixtures(t, "kinematics.json", "cube-300mm.stl", "sphere-100mm.stl")
}

func exec(args ...string) (int, string, string) {
	var stdout, stderr bytes.Buffer
	code := run(args, &stdout, &stderr)
	return code, stdout.String(), stderr.String()
}

func TestBuild(t *testing.T) {
	dir := stageAll(t)
	code, stdout, stderr := exec("build", filepath.Join(dir, "kinematics.json"))
	test.That(t, code, test.ShouldEqual, 0)
	test.That(t, stderr, test.ShouldEqual, "")
	_, err := os.Stat(filepath.Join(dir, "kinematics", "model.json"))
	test.That(t, err, test.ShouldBeNil)
	test.That(t, stdout, test.ShouldContainSubstring, "frame")
	test.That(t, stdout, test.ShouldContainSubstring, "cup")
	test.That(t, stdout, test.ShouldContainSubstring, "ok")
}

func TestBuildFlagPosition(t *testing.T) {
	for _, before := range []bool{true, false} {
		dir := stageAll(t)
		spec := filepath.Join(dir, "kinematics.json")
		out := filepath.Join(dir, "custom")
		args := []string{"build", "-o", out, spec}
		if !before {
			args = []string{"build", spec, "-o", out}
		}
		code, _, stderr := exec(args...)
		test.That(t, code, test.ShouldEqual, 0)
		test.That(t, stderr, test.ShouldEqual, "")
		_, err := os.Stat(filepath.Join(out, "model.json"))
		test.That(t, err, test.ShouldBeNil)
	}
}

func TestBuildJSON(t *testing.T) {
	dir := stageAll(t)
	code, stdout, _ := exec("build", "-json", filepath.Join(dir, "kinematics.json"))
	test.That(t, code, test.ShouldEqual, 0)
	report := &kinematicsv1.ValidationReport{}
	test.That(t, protojson.Unmarshal([]byte(stdout), report), test.ShouldBeNil)
	test.That(t, report.GetFailures(), test.ShouldBeEmpty)
	test.That(t, report.GetLinks(), test.ShouldHaveLength, 2)
}

func TestBuildMissingSource(t *testing.T) {
	dir := stageFixtures(t, "kinematics.json", "cube-300mm.stl")
	code, _, stderr := exec("build", filepath.Join(dir, "kinematics.json"))
	test.That(t, code, test.ShouldEqual, 2)
	test.That(t, stderr, test.ShouldContainSubstring, "sphere-100mm.stl")
	_, err := os.Stat(filepath.Join(dir, "kinematics"))
	test.That(t, os.IsNotExist(err), test.ShouldBeTrue)
}

func TestValidate(t *testing.T) {
	dir := stageAll(t)
	code, _, _ := exec("build", filepath.Join(dir, "kinematics.json"))
	test.That(t, code, test.ShouldEqual, 0)
	out := filepath.Join(dir, "kinematics")

	code, stdout, _ := exec("validate", out)
	test.That(t, code, test.ShouldEqual, 0)
	test.That(t, stdout, test.ShouldContainSubstring, "ok")
	code, _, _ = exec("validate", filepath.Join(out, "model.json"))
	test.That(t, code, test.ShouldEqual, 0)
}

func TestValidateCorrupt(t *testing.T) {
	dir := stageAll(t)
	exec("build", filepath.Join(dir, "kinematics.json"))
	data, err := os.ReadFile(filepath.Join(dir, "kinematics", "model.json"))
	test.That(t, err, test.ShouldBeNil)
	bad := filepath.Join(dir, "bad.json")
	test.That(t, os.WriteFile(bad, data[:len(data)/2], 0o644), test.ShouldBeNil)

	code, stdout, _ := exec("validate", bad)
	test.That(t, code, test.ShouldEqual, 1)
	test.That(t, stdout, test.ShouldContainSubstring, "FAIL:")
	test.That(t, stdout, test.ShouldContainSubstring, "parse")
}

func TestValidateMissingPath(t *testing.T) {
	code, _, stderr := exec("validate", filepath.Join(t.TempDir(), "nope"))
	test.That(t, code, test.ShouldEqual, 2)
	test.That(t, stderr, test.ShouldNotBeEmpty)
}

func TestUsage(t *testing.T) {
	for _, args := range [][]string{{}, {"help"}, {"bogus"}} {
		code, stdout, stderr := exec(args...)
		test.That(t, code, test.ShouldEqual, 2)
		test.That(t, stdout, test.ShouldEqual, "")
		test.That(t, stderr, test.ShouldContainSubstring, "usage:")
	}
}

func TestBuildArticulatedPrintsInputs(t *testing.T) {
	dir := stageFixtures(t, "parallel-gripper.kinematics.json", "cube-300mm.stl", "finger-20x20x80mm.stl")

	code, stdout, stderr := exec("build", "-lang", "none", filepath.Join(dir, "parallel-gripper.kinematics.json"))

	test.That(t, code, test.ShouldEqual, 0)
	test.That(t, stderr, test.ShouldEqual, "")
	test.That(t, stdout, test.ShouldContainSubstring, "dof: 1")
	test.That(t, stdout, test.ShouldContainSubstring, "input left-slide      prismatic  0.0 to 40.0 mm")
}
