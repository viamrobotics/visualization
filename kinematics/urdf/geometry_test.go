package urdf

import (
	"fmt"
	"testing"

	kinematicsv1 "github.com/viamrobotics/visualization/kinematics/v1"
)

func meshLink(name, filename, scale string) string {
	return fmt.Sprintf(`<link name=%q><collision><geometry><mesh filename=%q scale=%q/></geometry></collision></link>`, name, filename, scale)
}

func TestEachCollisionBecomesOneSpecLink(t *testing.T) {
	imported := mustConvertInline(t, robotXML(
		`<link name="base"><collision><geometry><box size="1 1 1"/></geometry></collision>`+
			`<collision><geometry><sphere radius="1"/></geometry></collision>`+
			`<collision><geometry><cylinder radius="1" length="2"/></geometry></collision></link>`))

	if got := linkIDs(imported.Spec); len(got) != 3 || got[0] != "base" || got[1] != "base_2" || got[2] != "base_3" {
		t.Fatalf("link ids = %v, want base, base_2, base_3", got)
	}
}

func TestCollisionOriginComposesWithTheLinkFrame(t *testing.T) {
	imported := mustConvertInline(t, robotXML(
		`<link name="base"/>`+
			`<link name="part"><collision><origin xyz="0 0 0.5"/><geometry><box size="1 1 1"/></geometry></collision></link>`+
			joint("mount", "fixed", "base", "part", `<origin xyz="1 0 0"/>`)))

	if got := linkByID(t, imported.Spec, "part").GetOrigin(); got.GetX() != 1000 || got.GetZ() != 500 {
		t.Fatalf("origin = %v, want x 1000 and z 500", got)
	}
}

func TestPrimitivesConvertMetresToMillimetres(t *testing.T) {
	imported := mustConvertInline(t, robotXML(
		`<link name="box"><collision><geometry><box size="0.1 0.2 0.3"/></geometry></collision></link>`+
			`<link name="ball"><collision><geometry><sphere radius="0.05"/></geometry></collision></link>`+
			`<link name="pipe"><collision><geometry><cylinder radius="0.02" length="0.4"/></geometry></collision></link>`+
			joint("j1", "fixed", "box", "ball", "")+joint("j2", "fixed", "ball", "pipe", "")))

	box := linkByID(t, imported.Spec, "box")
	if got := box.GetPrimitive().GetBox(); got.GetX() != 100 || got.GetY() != 200 || got.GetZ() != 300 {
		t.Fatalf("box = %v, want 100 200 300", got)
	}
	if box.GetMeshPath() != "" || box.GetCollision() != kinematicsv1.CollisionShape_COLLISION_SHAPE_UNSPECIFIED {
		t.Fatalf("primitive link carries mesh fields: %v", box)
	}
	if got := linkByID(t, imported.Spec, "ball").GetPrimitive().GetSphere().GetRadius(); got != 50 {
		t.Fatalf("sphere radius = %v, want 50", got)
	}
	pipe := linkByID(t, imported.Spec, "pipe").GetPrimitive().GetCylinder()
	if pipe.GetRadius() != 20 || pipe.GetLength() != 400 {
		t.Fatalf("cylinder = %v, want radius 20 and length 400", pipe)
	}
}

func TestMeshScaleMapsToUnit(t *testing.T) {
	cases := map[string]kinematicsv1.LengthUnit{
		"1 1 1":                       kinematicsv1.LengthUnit_LENGTH_UNIT_METERS,
		"0.001 0.001 0.001":           kinematicsv1.LengthUnit_LENGTH_UNIT_MILLIMETERS,
		"0.0254 0.0254 0.0254":        kinematicsv1.LengthUnit_LENGTH_UNIT_INCHES,
		"0.0010000000001 0.001 0.001": kinematicsv1.LengthUnit_LENGTH_UNIT_MILLIMETERS,
		"":                            kinematicsv1.LengthUnit_LENGTH_UNIT_METERS,
	}
	for scale, want := range cases {
		imported, err := convertInline(t, robotXML(meshLink("part", "part.stl", scale)), map[string]string{"part.stl": "solid"}, Options{})
		if err != nil {
			t.Fatalf("scale %q: %v", scale, err)
		}
		link := linkByID(t, imported.Spec, "part")
		if link.GetMeshUnit() != want || link.GetMeshPath() != "part.stl" ||
			link.GetCollision() != kinematicsv1.CollisionShape_COLLISION_SHAPE_MESH || link.GetMaxTriangles() != 0 {
			t.Errorf("scale %q: link = %v, want unit %v", scale, link, want)
		}
		if string(imported.Meshes["part.stl"]) != "solid" {
			t.Errorf("scale %q: mesh bytes = %q", scale, imported.Meshes["part.stl"])
		}
	}
}

func TestUnsupportedMeshScaleFailsNamingFileAndScale(t *testing.T) {
	for _, scale := range []string{"0.5 0.5 0.5", "1 2 1"} {
		_, err := convertInline(t, robotXML(meshLink("part", "part.stl", scale)), map[string]string{"part.stl": "solid"}, Options{})
		requireError(t, err, "part.stl", scale)
	}
}

func TestVisualIsUsedWhenThereIsNoCollisionAndIsReported(t *testing.T) {
	imported := mustConvertInline(t, robotXML(
		`<link name="base"><visual><geometry><box size="0.1 0.1 0.1"/></geometry></visual></link>`))

	if linkByID(t, imported.Spec, "base").GetPrimitive().GetBox() == nil {
		t.Fatalf("link = %v, want a box from the visual", imported.Spec.GetLinks())
	}
	if !contains(imported.Report.GetVisualFallbacks(), "base") {
		t.Fatalf("visual_fallbacks = %v", imported.Report.GetVisualFallbacks())
	}
}

func TestDAECollisionIsUsedDirectly(t *testing.T) {
	imported, err := convertInline(t, robotXML(
		`<link name="part">`+
			`<visual><geometry><mesh filename="part_visual.STL"/></geometry></visual>`+
			`<collision><geometry><mesh filename="part.DAE"/></geometry></collision></link>`),
		map[string]string{"part.DAE": "dae", "part_visual.STL": "stl"}, Options{})
	if err != nil {
		t.Fatalf("Convert: %v", err)
	}
	if got := linkByID(t, imported.Spec, "part").GetMeshPath(); got != "part.DAE" {
		t.Fatalf("mesh_path = %q, want the DAE collision", got)
	}
	if contains(imported.Report.GetVisualFallbacks(), "part") {
		t.Fatalf("visual_fallbacks = %v, want none", imported.Report.GetVisualFallbacks())
	}
	if !contains(imported.Report.GetDropped(), "<visual> in part") {
		t.Fatalf("dropped = %v, want the unused STL visual", imported.Report.GetDropped())
	}
}

func TestOBJVisualOnlyLinkImportsThroughTheVisualFallback(t *testing.T) {
	imported, err := convertInline(t, robotXML(
		`<link name="part"><visual><geometry><mesh filename="part.obj"/></geometry></visual></link>`),
		map[string]string{"part.obj": "obj"}, Options{})
	if err != nil {
		t.Fatalf("Convert: %v", err)
	}
	if got := linkByID(t, imported.Spec, "part").GetMeshPath(); got != "part.obj" {
		t.Fatalf("mesh_path = %q, want the OBJ visual", got)
	}
	if !contains(imported.Report.GetVisualFallbacks(), "part") {
		t.Fatalf("visual_fallbacks = %v", imported.Report.GetVisualFallbacks())
	}
}

func TestDAECollisionWithMillimetreScaleGetsMillimetreUnit(t *testing.T) {
	imported, err := convertInline(t, robotXML(meshLink("part", "part.dae", "0.001 0.001 0.001")), map[string]string{"part.dae": "dae"}, Options{})
	if err != nil {
		t.Fatalf("Convert: %v", err)
	}
	if got := linkByID(t, imported.Spec, "part").GetMeshUnit(); got != kinematicsv1.LengthUnit_LENGTH_UNIT_MILLIMETERS {
		t.Fatalf("mesh_unit = %v, want millimetres", got)
	}
}

func TestUnsupportedMeshFormatFailsNamingTheFile(t *testing.T) {
	for _, filename := range []string{"part.glb", "part.3MF"} {
		_, err := convertInline(t, robotXML(meshLink("part", filename, "")), map[string]string{filename: "x"}, Options{})
		requireError(t, err, filename)
	}
}

func TestMeshExtensionsAreCaseInsensitive(t *testing.T) {
	imported, err := convertInline(t, robotXML(meshLink("part", "part.PLY", "")), map[string]string{"part.PLY": "ply"}, Options{})
	if err != nil {
		t.Fatalf("Convert: %v", err)
	}
	if linkByID(t, imported.Spec, "part").GetMeshPath() != "part.PLY" {
		t.Fatalf("links = %v", imported.Spec.GetLinks())
	}
}

func TestUnusedVisualsAndOtherElementsAreReportedAsDropped(t *testing.T) {
	imported := mustConvertInline(t, robotXML(
		`<link name="base"><inertial><mass value="1"/></inertial>`+
			`<visual><geometry><box size="1 1 1"/></geometry></visual>`+
			`<collision><geometry><box size="1 1 1"/></geometry></collision></link>`+
			`<joint name="spin" type="fixed"><parent link="base"/><child link="extra"/></joint><link name="extra"/>`+
			`<transmission name="t"><joint name="spin"/></transmission>`+
			`<gazebo reference="base"><material>Grey</material></gazebo>`+
			`<ros2_control name="system"><hardware/></ros2_control>`))

	for _, want := range []string{"<inertial> in base", "<visual> in base", "<transmission> in spin", "<gazebo> in base", "<ros2_control> in system"} {
		if !contains(imported.Report.GetDropped(), want) {
			t.Errorf("dropped = %v, missing %q", imported.Report.GetDropped(), want)
		}
	}
}

func TestLinkWithoutGeometryAddsNoSpecLink(t *testing.T) {
	imported := mustConvertInline(t, robotXML(`<link name="base"/>`+boxLink("a")+joint("j", "fixed", "base", "a", "")))
	if got := linkIDs(imported.Spec); len(got) != 1 || got[0] != "a" {
		t.Fatalf("link ids = %v, want only a", got)
	}
}
