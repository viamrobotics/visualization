package kinematics

import (
	"io/fs"
	"math"
	"os"
	"path/filepath"
	"testing"
	"testing/fstest"

	"github.com/golang/geo/r3"
	"go.viam.com/test"
	"google.golang.org/protobuf/proto"

	kinematicsv1 "github.com/viamrobotics/visualization/kinematics/v1"
)

// meshFormatTolerance is the largest difference, in millimetres, allowed between a mesh read from
// an OBJ or COLLADA fixture and the STL export of the same part.
const meshFormatTolerance = 1e-6

func TestOBJMeshMatchesItsSTLExport(t *testing.T) {
	t.Run("finger", func(t *testing.T) {
		requireSameMesh(t, "finger-20x20x80mm.obj", kinematicsv1.LengthUnit_LENGTH_UNIT_MILLIMETERS)
	})

	t.Run("vacuum frame with an OBJ cup", func(t *testing.T) {
		example := filepath.Join("testdata", "examples", "vacuum-frame")
		spec, err := LoadSpec(filepath.Join(example, SpecFileName))
		test.That(t, err, test.ShouldBeNil)
		stlBuild, err := Build(spec, os.DirFS(example))
		test.That(t, err, test.ShouldBeNil)

		objSpec := proto.Clone(spec).(*kinematicsv1.KinematicsSpec)
		swapped := 0
		for _, link := range objSpec.GetLinks() {
			if link.GetMeshPath() == "suction-cup.stl" {
				link.MeshPath = "suction-cup.obj"
				swapped++
			}
		}
		test.That(t, swapped, test.ShouldEqual, 4)
		sources := copyDir(t, os.DirFS(example))
		cup, err := os.ReadFile(filepath.Join("testdata", "suction-cup.obj"))
		test.That(t, err, test.ShouldBeNil)
		sources["suction-cup.obj"] = &fstest.MapFile{Data: cup}
		objBuild, err := Build(objSpec, sources)
		test.That(t, err, test.ShouldBeNil)

		stlLinks := ValidateSpec(stlBuild.Files[ModelFileName], spec).GetLinks()
		objLinks := ValidateSpec(objBuild.Files[ModelFileName], objSpec).GetLinks()
		test.That(t, len(objLinks), test.ShouldEqual, len(stlLinks))
		for i, want := range stlLinks {
			got := objLinks[i]
			test.That(t, got.GetId(), test.ShouldEqual, want.GetId())
			test.That(t, got.GetTriangles(), test.ShouldEqual, want.GetTriangles())
			test.That(t, got.GetExtent().GetX(), test.ShouldAlmostEqual, want.GetExtent().GetX(), meshFormatTolerance)
			test.That(t, got.GetExtent().GetY(), test.ShouldAlmostEqual, want.GetExtent().GetY(), meshFormatTolerance)
			test.That(t, got.GetExtent().GetZ(), test.ShouldAlmostEqual, want.GetExtent().GetZ(), meshFormatTolerance)
		}
	})
}

func TestColladaMeshMatchesItsSTLExport(t *testing.T) {
	// The fixture declares millimetres with <unit meter="0.001">, so the link reads it as metres.
	requireSameMesh(t, "finger-20x20x80mm.dae", kinematicsv1.LengthUnit_LENGTH_UNIT_METERS)
}

// requireSameMesh loads the finger STL and the testdata fixture at path, and requires the same
// triangle count and the same bounds.
func requireSameMesh(t *testing.T, path string, unit kinematicsv1.LengthUnit) {
	t.Helper()
	testdata := os.DirFS("testdata")
	want, err := loadMeshFile(testdata, &kinematicsv1.Link{
		Id: "stl", MeshPath: "finger-20x20x80mm.stl", MeshUnit: kinematicsv1.LengthUnit_LENGTH_UNIT_MILLIMETERS,
	})
	test.That(t, err, test.ShouldBeNil)
	got, err := loadMeshFile(testdata, &kinematicsv1.Link{Id: "fixture", MeshPath: path, MeshUnit: unit})
	test.That(t, err, test.ShouldBeNil)

	test.That(t, len(got.Triangles()), test.ShouldEqual, len(want.Triangles()))
	wantMin, wantMax, ok := meshBounds(want)
	test.That(t, ok, test.ShouldBeTrue)
	gotMin, gotMax, ok := meshBounds(got)
	test.That(t, ok, test.ShouldBeTrue)
	requireNearVector(t, gotMin, wantMin)
	requireNearVector(t, gotMax, wantMax)
}

func requireNearVector(t *testing.T, got, want r3.Vector) {
	t.Helper()
	test.That(t, math.Abs(got.X-want.X), test.ShouldBeLessThanOrEqualTo, meshFormatTolerance)
	test.That(t, math.Abs(got.Y-want.Y), test.ShouldBeLessThanOrEqualTo, meshFormatTolerance)
	test.That(t, math.Abs(got.Z-want.Z), test.ShouldBeLessThanOrEqualTo, meshFormatTolerance)
}

func copyDir(t *testing.T, dir fs.FS) fstest.MapFS {
	t.Helper()
	copied := fstest.MapFS{}
	err := fs.WalkDir(dir, ".", func(name string, entry fs.DirEntry, err error) error {
		if err != nil || entry.IsDir() {
			return err
		}
		data, err := fs.ReadFile(dir, name)
		copied[name] = &fstest.MapFile{Data: data}
		return err
	})
	test.That(t, err, test.ShouldBeNil)
	return copied
}
