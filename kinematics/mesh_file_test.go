package kinematics

import (
	"errors"
	"io/fs"
	"os"
	"testing"
	"testing/fstest"

	"go.viam.com/test"

	kinematicsv1 "github.com/viamrobotics/visualization/kinematics/v1"
)

func TestLoadMeshFile(t *testing.T) {
	testdata := os.DirFS("testdata")
	cubeBytes, err := fs.ReadFile(testdata, "cube-300mm.stl")
	test.That(t, err, test.ShouldBeNil)

	cube, err := loadMeshFile(testdata, &kinematicsv1.Link{
		Id: "cube", MeshPath: "cube-300mm.stl", MeshUnit: kinematicsv1.LengthUnit_LENGTH_UNIT_MILLIMETERS,
	})
	test.That(t, err, test.ShouldBeNil)
	plyFS := fstest.MapFS{"cube.ply": {Data: cube.TrianglesToPLYBytes(false)}}

	mapFS := fstest.MapFS{"CUBE-300MM.STL": {Data: cubeBytes}, "part.glb": {Data: []byte("x")}}

	tests := []struct {
		name      string
		sources   fs.FS
		path      string
		unit      kinematicsv1.LengthUnit
		triangles int
		extent    float64
		wantErr   string
		notExist  bool
	}{
		{name: "cube mm", sources: testdata, path: "cube-300mm.stl", unit: kinematicsv1.LengthUnit_LENGTH_UNIT_MILLIMETERS, triangles: 12, extent: 300},
		{name: "cube meters", sources: testdata, path: "cube-300mm.stl", unit: kinematicsv1.LengthUnit_LENGTH_UNIT_METERS, triangles: 12, extent: 300000},
		{name: "cube inches", sources: testdata, path: "cube-300mm.stl", unit: kinematicsv1.LengthUnit_LENGTH_UNIT_INCHES, triangles: 12, extent: 7620},
		{name: "uppercase extension", sources: mapFS, path: "CUBE-300MM.STL", unit: kinematicsv1.LengthUnit_LENGTH_UNIT_MILLIMETERS, triangles: 12, extent: 300},
		{name: "ply is metres", sources: plyFS, path: "cube.ply", unit: kinematicsv1.LengthUnit_LENGTH_UNIT_METERS, triangles: 12, extent: 300},
		{name: "glb unsupported", sources: mapFS, path: "part.glb", unit: kinematicsv1.LengthUnit_LENGTH_UNIT_MILLIMETERS, wantErr: "part.glb"},
		{name: "unit required", sources: testdata, path: "cube-300mm.stl", unit: kinematicsv1.LengthUnit_LENGTH_UNIT_UNSPECIFIED, wantErr: "mesh_unit is required"},
		{name: "missing", sources: testdata, path: "absent.stl", unit: kinematicsv1.LengthUnit_LENGTH_UNIT_MILLIMETERS, notExist: true},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			mesh, err := loadMeshFile(tc.sources, &kinematicsv1.Link{Id: "link", MeshPath: tc.path, MeshUnit: tc.unit})
			if tc.wantErr != "" {
				test.That(t, err, test.ShouldNotBeNil)
				test.That(t, err.Error(), test.ShouldContainSubstring, tc.wantErr)
				return
			}
			if tc.notExist {
				test.That(t, errors.Is(err, fs.ErrNotExist), test.ShouldBeTrue)
				return
			}
			test.That(t, err, test.ShouldBeNil)
			test.That(t, len(mesh.Triangles()), test.ShouldEqual, tc.triangles)
			test.That(t, mesh.Label(), test.ShouldEqual, "link")
			minPt, maxPt, _ := meshBounds(mesh)
			extent := maxPt.Sub(minPt)
			test.That(t, extent.X, test.ShouldAlmostEqual, tc.extent, 1e-3)
			test.That(t, extent.Y, test.ShouldAlmostEqual, tc.extent, 1e-3)
			test.That(t, extent.Z, test.ShouldAlmostEqual, tc.extent, 1e-3)
		})
	}
}
