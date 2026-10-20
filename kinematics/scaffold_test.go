package kinematics

import (
	"encoding/json"
	"os"
	"path/filepath"
	"runtime/debug"
	"sort"
	"testing"
	"testing/fstest"

	"go.viam.com/test"
)

var scaffoldFixtureOptions = ScaffoldOptions{Namespace: "acme", ModuleName: "fixture-tool", ModelName: "vacuum-frame"}

const scaffoldTestRDKVersion = "v1.10.0"

// stubBuildInfo makes Scaffold see rdk at version, since test binaries have no dependency list.
func stubBuildInfo(t *testing.T, deps ...*debug.Module) {
	t.Helper()
	original := readBuildInfo
	readBuildInfo = func() (*debug.BuildInfo, bool) { return &debug.BuildInfo{Deps: deps}, true }
	t.Cleanup(func() { readBuildInfo = original })
}

func stubRDKBuildInfo(t *testing.T) {
	t.Helper()
	stubBuildInfo(t, &debug.Module{Path: "go.viam.com/rdk", Version: scaffoldTestRDKVersion})
}

func scaffoldFixture(t *testing.T) *Output {
	t.Helper()
	stubRDKBuildInfo(t)
	spec, err := LoadSpec(filepath.Join("testdata", SpecFileName))
	test.That(t, err, test.ShouldBeNil)
	out, err := Scaffold(spec, os.DirFS("testdata"), scaffoldFixtureOptions)
	test.That(t, err, test.ShouldBeNil)
	return out
}

func TestScaffoldOptionValidation(t *testing.T) {
	good := scaffoldFixtureOptions
	tests := []struct {
		name   string
		mutate func(*ScaffoldOptions)
		want   string
	}{
		{"empty namespace", func(o *ScaffoldOptions) { o.Namespace = "" }, "namespace is required"},
		{"empty module", func(o *ScaffoldOptions) { o.ModuleName = "" }, "module name is required"},
		{"empty model", func(o *ScaffoldOptions) { o.ModelName = "" }, "model name is required"},
		{"uppercase namespace", func(o *ScaffoldOptions) { o.Namespace = "Acme" }, "namespace"},
		{"leading hyphen module", func(o *ScaffoldOptions) { o.ModuleName = "-tool" }, "module name"},
		{"space in model", func(o *ScaffoldOptions) { o.ModelName = "a b" }, "model name"},
		{"slash in module", func(o *ScaffoldOptions) { o.ModuleName = "a/b" }, "module name"},
	}
	stubRDKBuildInfo(t)
	spec, err := LoadSpec(filepath.Join("testdata", SpecFileName))
	test.That(t, err, test.ShouldBeNil)
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			opts := good
			tc.mutate(&opts)
			_, err := Scaffold(spec, os.DirFS("testdata"), opts)
			test.That(t, err, test.ShouldNotBeNil)
			test.That(t, err.Error(), test.ShouldContainSubstring, tc.want)
		})
	}
}

func TestScaffoldFileSet(t *testing.T) {
	out := scaffoldFixture(t)
	got := make([]string, 0, len(out.Files))
	for name := range out.Files {
		got = append(got, name)
	}
	sort.Strings(got)
	test.That(t, got, test.ShouldResemble, []string{
		".gitignore",
		"Makefile",
		"README.md",
		"cad/cube-300mm.stl",
		"cad/sphere-100mm.stl",
		"cmd/module/main.go",
		"generate.go",
		"go.mod",
		"kinematics.json",
		"kinematics/kinematics.go",
		"kinematics/model.json",
		"meta.json",
		"vacuum_frame.go",
		"vacuum_frame_test.go",
	})
}

func TestScaffoldGoMod(t *testing.T) {
	out := scaffoldFixture(t)
	mod := string(out.Files["go.mod"])
	test.That(t, mod, test.ShouldContainSubstring, "module fixturetool\n")
	test.That(t, mod, test.ShouldContainSubstring, "require go.viam.com/rdk v1.10.0")
}

func TestScaffoldMeta(t *testing.T) {
	out := scaffoldFixture(t)
	var meta struct {
		Entrypoint string `json:"entrypoint"`
		Models     []struct {
			API   string `json:"api"`
			Model string `json:"model"`
		} `json:"models"`
	}
	test.That(t, json.Unmarshal(out.Files["meta.json"], &meta), test.ShouldBeNil)
	test.That(t, meta.Entrypoint, test.ShouldEqual, "bin/fixture-tool")
	test.That(t, len(meta.Models), test.ShouldEqual, 1)
	test.That(t, meta.Models[0].API, test.ShouldEqual, "rdk:component:gripper")
	test.That(t, meta.Models[0].Model, test.ShouldEqual, "acme:fixture-tool:vacuum-frame")
}

func TestScaffoldSpecRebuildsSameModel(t *testing.T) {
	out := scaffoldFixture(t)
	dir := t.TempDir()
	test.That(t, out.WriteDir(dir), test.ShouldBeNil)

	spec, err := LoadSpec(filepath.Join(dir, SpecFileName))
	test.That(t, err, test.ShouldBeNil)
	test.That(t, spec.GetLinks()[0].GetMeshPath(), test.ShouldEqual, "cad/cube-300mm.stl")

	rebuilt, err := Build(spec, os.DirFS(dir))
	test.That(t, err, test.ShouldBeNil)
	test.That(t, string(rebuilt.Files[ModelFileName]), test.ShouldEqual, string(out.Files["kinematics/"+ModelFileName]))
}

func TestScaffoldMeshPathMapping(t *testing.T) {
	test.That(t, cadPath("../../parts/a.stl"), test.ShouldEqual, "cad/parts/a.stl")
	test.That(t, cadPath("./b.stl"), test.ShouldEqual, "cad/b.stl")
}

func TestScaffoldWithoutRDKDependency(t *testing.T) {
	stubBuildInfo(t)
	spec, err := LoadSpec(filepath.Join("testdata", SpecFileName))
	test.That(t, err, test.ShouldBeNil)
	_, err = Scaffold(spec, os.DirFS("testdata"), scaffoldFixtureOptions)
	test.That(t, err, test.ShouldNotBeNil)
	test.That(t, err.Error(), test.ShouldContainSubstring, "go.viam.com/rdk")
}

func TestScaffoldCollidingSources(t *testing.T) {
	stubRDKBuildInfo(t)
	spec, err := LoadSpec(filepath.Join("testdata", SpecFileName))
	test.That(t, err, test.ShouldBeNil)
	spec.Links[0].MeshPath = "cube-300mm.stl"
	spec.Links[1].MeshPath = "../cube-300mm.stl"
	sources := fstest.MapFS{
		"cube-300mm.stl":    &fstest.MapFile{Data: []byte("a")},
		"../cube-300mm.stl": &fstest.MapFile{Data: []byte("b")},
	}
	_, err = Scaffold(spec, sources, scaffoldFixtureOptions)
	test.That(t, err, test.ShouldNotBeNil)
	test.That(t, err.Error(), test.ShouldContainSubstring, "cad/cube-300mm.stl")
}

func TestScaffoldModuleVetsAndTests(t *testing.T) {
	out := scaffoldFixture(t)
	dir := t.TempDir()
	test.That(t, out.WriteDir(dir), test.ShouldBeNil)
	runGoInOfflineModule(t, dir, "fixturetool", "vet", "./...")
	runGoInOfflineModule(t, dir, "fixturetool", "test", "./...", "-count=1")
}

func TestScaffoldArticulatedModuleVetsAndTests(t *testing.T) {
	stubRDKBuildInfo(t)
	spec, err := LoadSpec(filepath.Join("testdata", "parallel-gripper.kinematics.json"))
	test.That(t, err, test.ShouldBeNil)
	out, err := Scaffold(spec, os.DirFS("testdata"), scaffoldFixtureOptions)
	test.That(t, err, test.ShouldBeNil)
	test.That(t, string(out.Files["vacuum_frame_test.go"]), test.ShouldContainSubstring, "expectedDoF   = 1")

	dir := t.TempDir()
	test.That(t, out.WriteDir(dir), test.ShouldBeNil)
	runGoInOfflineModule(t, dir, "fixturetool", "vet", "./...")
	runGoInOfflineModule(t, dir, "fixturetool", "test", "./...", "-count=1")
}
