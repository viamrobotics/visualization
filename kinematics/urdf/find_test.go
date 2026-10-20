package urdf

import (
	"testing"
	"testing/fstest"
)

func TestFindURDFReturnsTheOnlyURDFAnywhere(t *testing.T) {
	got, err := FindURDF(fstest.MapFS{"a/b/Robot.URDF": {Data: []byte("<robot/>")}, "a/readme.md": {}})
	if err != nil || got != "a/b/Robot.URDF" {
		t.Fatalf("FindURDF = %q, %v", got, err)
	}
}

func TestFindURDFFailsListingSeveral(t *testing.T) {
	_, err := FindURDF(fstest.MapFS{"one.urdf": {}, "dir/two.urdf": {}})
	requireError(t, err, "one.urdf", "dir/two.urdf")
}

func TestFindURDFFailsOnAnEmptyTree(t *testing.T) {
	_, err := FindURDF(fstest.MapFS{"readme.md": {}})
	requireError(t, err, "no .urdf")
}

const xacroNS = `xmlns:xacro="http://www.ros.org/wiki/xacro"`

func xacroFile(body string) *fstest.MapFile {
	return &fstest.MapFile{Data: []byte(`<robot ` + xacroNS + `>` + body + `</robot>`)}
}

func TestFindURDFPrefersAURDFOverXacro(t *testing.T) {
	got, err := FindURDF(fstest.MapFS{"a.urdf": {}, "b.urdf.xacro": xacroFile(`<link name="x"/>`)})
	if err != nil || got != "a.urdf" {
		t.Fatalf("FindURDF = %q, %v", got, err)
	}
}

func TestFindURDFReturnsTheXacroNoOtherXacroIncludes(t *testing.T) {
	got, err := FindURDF(fstest.MapFS{
		"urdf/arm.urdf.xacro": xacroFile(`<xacro:include filename="$(find pkg)/urdf/parts.xacro"/><xacro:arm/>`),
		"urdf/parts.xacro":    xacroFile(`<xacro:macro name="arm"><link name="a"/></xacro:macro><link name="loose"/>`),
	})
	if err != nil || got != "urdf/arm.urdf.xacro" {
		t.Fatalf("FindURDF = %q, %v", got, err)
	}
}

func TestFindURDFSkipsAXacroHoldingOnlyDefinitions(t *testing.T) {
	got, err := FindURDF(fstest.MapFS{
		"main.xacro": xacroFile(`<link name="x"/>`),
		"lib.xacro":  xacroFile(`<xacro:property name="a" value="1"/><xacro:arg name="b" default="2"/><xacro:macro name="m"/>`),
	})
	if err != nil || got != "main.xacro" {
		t.Fatalf("FindURDF = %q, %v", got, err)
	}
}

func TestFindURDFFailsListingSeveralXacroEntries(t *testing.T) {
	_, err := FindURDF(fstest.MapFS{"one.xacro": xacroFile(`<link name="a"/>`), "dir/two.xacro": xacroFile(`<link name="b"/>`)})
	requireError(t, err, "found 2 xacro entry files, pick one", "one.xacro", "dir/two.xacro")
}

func TestFindURDFFailsWhenNoXacroIsAnEntry(t *testing.T) {
	_, err := FindURDF(fstest.MapFS{"lib.xacro": xacroFile(`<xacro:macro name="m"/>`)})
	requireError(t, err, "no entry file", "lib.xacro")
}

func TestConvertUsesTheOptionPathOverTheOnlyURDF(t *testing.T) {
	files := fstest.MapFS{
		"a.urdf": {Data: []byte(robotXML(boxLink("from_a")))},
		"b.urdf": {Data: []byte(robotXML(boxLink("from_b")))},
	}
	imported, err := Convert(files, Options{URDFPath: "b.urdf"})
	if err != nil {
		t.Fatalf("Convert: %v", err)
	}
	if got := linkIDs(imported.Spec); len(got) != 1 || got[0] != "from_b" || imported.Report.GetUrdfPath() != "b.urdf" {
		t.Fatalf("links = %v, urdf_path = %q", got, imported.Report.GetUrdfPath())
	}
}
