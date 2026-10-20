package main

import (
	"errors"
	"os"
	osexec "os/exec"
	"path/filepath"
	"strings"
	"testing"

	"go.viam.com/test"
)

func TestBuildWritesGoLoader(t *testing.T) {
	dir := stageAll(t)
	out := filepath.Join(dir, "My-Tool.v2")
	code, stdout, stderr := exec("build", "-o", out, filepath.Join(dir, "kinematics.json"))
	test.That(t, code, test.ShouldEqual, 0)
	test.That(t, stderr, test.ShouldEqual, "")
	test.That(t, stdout, test.ShouldContainSubstring, "wrote "+filepath.Join(out, "kinematics.go"))
	test.That(t, stdout, test.ShouldContainSubstring, "wrote "+filepath.Join(out, "model.json"))
	loader, err := os.ReadFile(filepath.Join(out, "kinematics.go"))
	test.That(t, err, test.ShouldBeNil)
	test.That(t, string(loader), test.ShouldStartWith, "// Code generated")
	test.That(t, string(loader), test.ShouldContainSubstring, "\npackage mytoolv2\n")
	_, err = os.Stat(filepath.Join(out, "model.json"))
	test.That(t, err, test.ShouldBeNil)
}

func TestBuildLangNone(t *testing.T) {
	dir := stageAll(t)
	out := filepath.Join(dir, "out")
	code, _, _ := exec("build", "-lang", "none", "-o", out, filepath.Join(dir, "kinematics.json"))
	test.That(t, code, test.ShouldEqual, 0)
	entries, err := os.ReadDir(out)
	test.That(t, err, test.ShouldBeNil)
	test.That(t, len(entries), test.ShouldEqual, 1)
	test.That(t, entries[0].Name(), test.ShouldEqual, "model.json")
}

func TestBuildCustomPackage(t *testing.T) {
	dir := stageAll(t)
	out := filepath.Join(dir, "out")
	code, _, _ := exec("build", "-package", "custom", "-o", out, filepath.Join(dir, "kinematics.json"))
	test.That(t, code, test.ShouldEqual, 0)
	loader, err := os.ReadFile(filepath.Join(out, "kinematics.go"))
	test.That(t, err, test.ShouldBeNil)
	test.That(t, string(loader), test.ShouldContainSubstring, "\npackage custom\n")
}

func TestBuildUsageErrors(t *testing.T) {
	dir := stageAll(t)
	spec := filepath.Join(dir, "kinematics.json")
	for _, args := range [][]string{
		{"build", "-lang", "rust", spec},
		{"build", "-package", "not-valid", spec},
		{"build", "-package", "func", spec},
	} {
		code, _, _ := exec(args...)
		test.That(t, code, test.ShouldEqual, 2)
	}
}

func TestInitRequiresNamespace(t *testing.T) {
	dir := stageAll(t)
	code, _, stderr := exec("init", "-o", filepath.Join(dir, "m"), filepath.Join(dir, "kinematics.json"))
	test.That(t, code, test.ShouldEqual, 2)
	test.That(t, stderr, test.ShouldContainSubstring, "-namespace")
}

func TestInitNonEmptyTarget(t *testing.T) {
	dir := stageAll(t)
	spec := filepath.Join(dir, "kinematics.json")
	target := t.TempDir()
	test.That(t, os.WriteFile(filepath.Join(target, "keep.txt"), []byte("x"), 0o644), test.ShouldBeNil)

	code, _, stderr := exec("init", "-namespace", "acme", "-o", target, spec)
	test.That(t, code, test.ShouldEqual, 2)
	test.That(t, stderr, test.ShouldContainSubstring, "not empty")
	_, err := os.Stat(filepath.Join(target, "meta.json"))
	test.That(t, os.IsNotExist(err), test.ShouldBeTrue)

	// Scaffold fails under `go test` when build info lacks the RDK version, so only the guard
	// is asserted here. The success path runs against a real binary below.
	code, _, stderr = exec("init", "-force", "-namespace", "acme", "-o", target, spec)
	test.That(t, strings.Contains(stderr, "not empty"), test.ShouldBeFalse)
	_ = code
}

func TestInitBinary(t *testing.T) {
	bin := filepath.Join(t.TempDir(), "kinematics")
	build := osexec.Command("go", "build", "-o", bin, ".")
	out, err := build.CombinedOutput()
	test.That(t, err, test.ShouldBeNil)
	_ = out

	rdkVersion := repoRDKVersion(t)
	dir := stageAll(t)
	spec := filepath.Join(dir, "kinematics.json")
	target := filepath.Join(t.TempDir(), "mod")

	cmd := osexec.Command(bin, "init", "-namespace", "acme", "-o", target, spec)
	combined, err := cmd.CombinedOutput()
	test.That(t, err, test.ShouldBeNil)
	test.That(t, string(combined), test.ShouldContainSubstring, "go mod tidy")

	for _, name := range []string{
		"go.mod", "meta.json", "cmd/module/main.go", "kinematics/model.json",
		"kinematics/kinematics.go", "kinematics.json", "cad/cube-300mm.stl",
	} {
		_, err := os.Stat(filepath.Join(target, filepath.FromSlash(name)))
		test.That(t, err, test.ShouldBeNil)
	}
	gomod, err := os.ReadFile(filepath.Join(target, "go.mod"))
	test.That(t, err, test.ShouldBeNil)
	test.That(t, string(gomod), test.ShouldContainSubstring, "go.viam.com/rdk "+rdkVersion)

	// A second run into the now non-empty target is refused, and -force goes through.
	refused := osexec.Command(bin, "init", "-namespace", "acme", "-o", target, spec)
	err = refused.Run()
	var exitErr *osexec.ExitError
	test.That(t, err, test.ShouldNotBeNil)
	test.That(t, errors.As(err, &exitErr), test.ShouldBeTrue)
	test.That(t, exitErr.ExitCode(), test.ShouldEqual, 2)
	test.That(t, osexec.Command(bin, "init", "-force", "-namespace", "acme", "-o", target, spec).Run(), test.ShouldBeNil)
}

func repoRDKVersion(t *testing.T) string {
	t.Helper()
	data, err := os.ReadFile("../../go.mod")
	test.That(t, err, test.ShouldBeNil)
	for _, line := range strings.Split(string(data), "\n") {
		fields := strings.Fields(line)
		if len(fields) >= 2 && fields[0] == "go.viam.com/rdk" {
			return fields[1]
		}
		if len(fields) >= 3 && fields[0] == "require" && fields[1] == "go.viam.com/rdk" {
			return fields[2]
		}
	}
	t.Fatal("go.viam.com/rdk not found in go.mod")
	return ""
}
