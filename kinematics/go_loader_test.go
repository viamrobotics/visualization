package kinematics

import (
	"go/format"
	"os"
	"path/filepath"
	"regexp"
	"strings"
	"testing"

	"go.viam.com/test"
)

func fixtureOutput(t *testing.T) *Output {
	t.Helper()
	spec, err := LoadSpec("testdata/kinematics.json")
	test.That(t, err, test.ShouldBeNil)
	out, err := Build(spec, os.DirFS("testdata"))
	test.That(t, err, test.ShouldBeNil)
	return out
}

func TestAddGoLoaderPackageName(t *testing.T) {
	for name, wantErr := range map[string]bool{
		"func": true, "1abc": true, "my-pkg": true, "": true,
		"kinematics": false, "tool_v2": false,
	} {
		t.Run(name, func(t *testing.T) {
			out := &Output{Files: map[string][]byte{ModelFileName: []byte("{}")}}
			err := out.AddGoLoader(name, "cmd")
			if wantErr {
				test.That(t, err, test.ShouldNotBeNil)
				_, has := out.Files[GoLoaderFileName]
				test.That(t, has, test.ShouldBeFalse)
			} else {
				test.That(t, err, test.ShouldBeNil)
			}
		})
	}
}

func TestAddGoLoaderRejectsNewline(t *testing.T) {
	out := &Output{Files: map[string][]byte{ModelFileName: []byte("{}")}}
	test.That(t, out.AddGoLoader("kinematics", "go run x\nrm -rf /"), test.ShouldNotBeNil)
}

func TestAddGoLoaderRequiresModel(t *testing.T) {
	out := &Output{Files: map[string][]byte{}}
	test.That(t, out.AddGoLoader("kinematics", "cmd"), test.ShouldNotBeNil)
}

func TestAddGoLoaderRendersFormattedFile(t *testing.T) {
	out := fixtureOutput(t)
	regen := RegenerateCommand("kinematics.json", "kinematics")
	test.That(t, out.AddGoLoader("kinematics", regen), test.ShouldBeNil)
	src := out.Files[GoLoaderFileName]

	first, _, _ := strings.Cut(string(src), "\n")
	test.That(t, regexp.MustCompile(`^// Code generated .* DO NOT EDIT\.$`).MatchString(first), test.ShouldBeTrue)
	test.That(t, string(src), test.ShouldContainSubstring, "// Regenerate: "+regen+"\n")
	test.That(t, string(src), test.ShouldContainSubstring, "//go:embed model.json")

	formatted, err := format.Source(src)
	test.That(t, err, test.ShouldBeNil)
	test.That(t, string(formatted), test.ShouldEqual, string(src))
}

const loaderModelTest = `package kinematics_test

import (
	"math"
	"testing"

	"example.com/tool/kinematics"
	"go.viam.com/rdk/referenceframe"
)

func TestModel(t *testing.T) {
	model, err := kinematics.Model("tool")
	if err != nil {
		t.Fatal(err)
	}
	if n := len(model.DoF()); n != 0 {
		t.Fatalf("DoF = %d, want 0", n)
	}
	pose, err := model.Transform([]referenceframe.Input{})
	if err != nil {
		t.Fatal(err)
	}
	if z := pose.Point().Z; math.Abs(z-400) > 1e-6 {
		t.Fatalf("output z = %v, want 400", z)
	}
	geoms, err := model.Geometries([]referenceframe.Input{})
	if err != nil {
		t.Fatal(err)
	}
	if n := len(geoms.Geometries()); n < 2 {
		t.Fatalf("geometries = %d, want at least 2", n)
	}
}
`

func TestGoLoaderCompiles(t *testing.T) {
	out := fixtureOutput(t)
	test.That(t, out.AddGoLoader("kinematics", RegenerateCommand("kinematics.json", "kinematics")), test.ShouldBeNil)

	root := t.TempDir()
	pkgDir := filepath.Join(root, "kinematics")
	test.That(t, out.WriteDir(pkgDir), test.ShouldBeNil)
	test.That(t, os.WriteFile(filepath.Join(pkgDir, "model_test.go"), []byte(loaderModelTest), 0o644), test.ShouldBeNil)

	runGoInOfflineModule(t, root, "example.com/tool", "test", "./...")
}
