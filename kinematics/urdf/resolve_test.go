package urdf

import (
	"testing"
	"testing/fstest"
)

func packageMeshURDF(filename string) string {
	return robotXML(meshLink("part", filename, ""))
}

func TestPackageURIResolvesThroughPackageXMLName(t *testing.T) {
	files := fstest.MapFS{
		"vendor/desc_pkg/package.xml":      {Data: []byte(`<package><name>real_name</name></package>`)},
		"vendor/desc_pkg/meshes/part.stl":  {Data: []byte("by-manifest")},
		"vendor/real_name/meshes/part.stl": {Data: []byte("by-directory")},
		"vendor/desc_pkg/urdf/robot.urdf":  {Data: []byte(packageMeshURDF("package://real_name/meshes/part.stl"))},
	}
	imported, err := Convert(files, Options{})
	if err != nil {
		t.Fatalf("Convert: %v", err)
	}
	if got := linkByID(t, imported.Spec, "part").GetMeshPath(); got != "vendor/desc_pkg/meshes/part.stl" {
		t.Fatalf("mesh_path = %q, want the package.xml directory to win", got)
	}
}

func TestPackageURIFallsBackToADirectoryNamedAfterThePackage(t *testing.T) {
	files := fstest.MapFS{
		"robot.urdf":                  {Data: []byte(packageMeshURDF("package://my_pkg/meshes/part.stl"))},
		"deep/my_pkg/meshes/part.stl": {Data: []byte("solid")},
	}
	imported, err := Convert(files, Options{})
	if err != nil {
		t.Fatalf("Convert: %v", err)
	}
	if got := linkByID(t, imported.Spec, "part").GetMeshPath(); got != "deep/my_pkg/meshes/part.stl" {
		t.Fatalf("mesh_path = %q", got)
	}
}

func TestUnknownPackageFails(t *testing.T) {
	_, err := convertInline(t, packageMeshURDF("package://nowhere/part.stl"), map[string]string{"part.stl": "x"}, Options{})
	requireError(t, err, "nowhere")
}

func TestRelativeMeshResolvesAgainstTheURDFDirectory(t *testing.T) {
	for _, filename := range []string{"../meshes/part.stl", "file://../meshes/part.stl"} {
		files := fstest.MapFS{
			"urdf/robot.urdf": {Data: []byte(packageMeshURDF(filename))},
			"meshes/part.stl": {Data: []byte("solid")},
		}
		imported, err := Convert(files, Options{})
		if err != nil {
			t.Fatalf("%s: %v", filename, err)
		}
		if got := linkByID(t, imported.Spec, "part").GetMeshPath(); got != "meshes/part.stl" {
			t.Errorf("%s: mesh_path = %q, want meshes/part.stl", filename, got)
		}
		if _, ok := imported.Meshes["meshes/part.stl"]; !ok {
			t.Errorf("%s: meshes = %v", filename, imported.Meshes)
		}
	}
}

func TestAbsoluteFileURIFailsNamingIt(t *testing.T) {
	_, err := convertInline(t, packageMeshURDF("file:///opt/robot/part.stl"), nil, Options{})
	requireError(t, err, "file:///opt/robot/part.stl")
}

func TestMissingMeshFileFailsNamingIt(t *testing.T) {
	_, err := convertInline(t, packageMeshURDF("gone.stl"), nil, Options{})
	requireError(t, err, "gone.stl")
}

func TestXacroAbsoluteMeshPathsResolveFromTheRootOfTheFiles(t *testing.T) {
	for _, filename := range []string{"/pkg/meshes/part.stl", "file:///pkg/meshes/part.stl"} {
		files := fstest.MapFS{
			"urdf/robot.urdf.xacro": {Data: []byte(`<robot xmlns:xacro="http://www.ros.org/wiki/xacro">` +
				`<link name="part"><collision><geometry><mesh filename="` + filename + `"/></geometry></collision></link></robot>`)},
			"pkg/meshes/part.stl": {Data: []byte("solid")},
		}
		imported, err := Convert(files, Options{})
		if err != nil {
			t.Fatalf("%s: %v", filename, err)
		}
		if got := linkByID(t, imported.Spec, "part").GetMeshPath(); got != "pkg/meshes/part.stl" {
			t.Errorf("%s: mesh_path = %q, want pkg/meshes/part.stl", filename, got)
		}
	}
}

func TestPlainURDFStillRejectsAbsoluteMeshPaths(t *testing.T) {
	files := map[string]string{"pkg/meshes/part.stl": "solid"}
	for _, filename := range []string{"/pkg/meshes/part.stl", "file:///pkg/meshes/part.stl"} {
		_, err := convertInline(t, packageMeshURDF(filename), files, Options{})
		requireError(t, err, filename, "absolute")
	}
}
