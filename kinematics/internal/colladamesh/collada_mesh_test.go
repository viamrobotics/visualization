package colladamesh

import (
	"strings"
	"testing"

	"github.com/golang/geo/r3"
	"go.viam.com/test"
)

const nearTolerance = 1e-9

func requirePoints(t *testing.T, got []r3.Vector, want ...r3.Vector) {
	t.Helper()
	test.That(t, len(got), test.ShouldEqual, len(want))
	for i := range want {
		test.That(t, got[i].Sub(want[i]).Norm(), test.ShouldBeLessThan, nearTolerance)
	}
}

func readPoints(t *testing.T, data []byte) []r3.Vector {
	t.Helper()
	triangles, err := Read(data)
	test.That(t, err, test.ShouldBeNil)
	return allPoints(triangles)
}

func requireReadError(t *testing.T, data []byte, fragments ...string) {
	t.Helper()
	_, err := Read(data)
	test.That(t, err, test.ShouldNotBeNil)
	for _, fragment := range fragments {
		test.That(t, err.Error(), test.ShouldContainSubstring, fragment)
	}
}

func TestReadUnit(t *testing.T) {
	origin, unitX, unitY := r3.Vector{}, r3.Vector{X: 1}, r3.Vector{Y: 1}

	t.Run("scales positions by unit meter", func(t *testing.T) {
		points := readPoints(t, triangleScene(`<unit meter="0.001" name="millimeter"/>`, `<instance_geometry url="#tri"/>`))
		requirePoints(t, points, origin, unitX.Mul(0.001), unitY.Mul(0.001))
	})
	t.Run("defaults to metres when the unit is absent", func(t *testing.T) {
		points := readPoints(t, triangleScene(`<up_axis>Z_UP</up_axis>`, `<instance_geometry url="#tri"/>`))
		requirePoints(t, points, origin, unitX, unitY)
	})
	t.Run("scales the placed positions, translation included", func(t *testing.T) {
		points := readPoints(t, triangleScene(`<unit meter="0.01"/>`, `<translate>100 0 0</translate><instance_geometry url="#tri"/>`))
		requirePoints(t, points, r3.Vector{X: 1}, r3.Vector{X: 1.01}, r3.Vector{X: 1, Y: 0.01})
	})
	t.Run("rejects an unusable unit", func(t *testing.T) {
		requireReadError(t, triangleScene(`<unit meter="abc"/>`, `<instance_geometry url="#tri"/>`), "unit")
	})
}

func TestReadIgnoresUpAxis(t *testing.T) {
	for _, upAxis := range []string{"Y_UP", "Z_UP", "X_UP"} {
		points := readPoints(t, triangleScene("<up_axis>"+upAxis+"</up_axis>", `<instance_geometry url="#tri"/>`))
		requirePoints(t, points, r3.Vector{}, r3.Vector{X: 1}, r3.Vector{Y: 1})
	}
}

func TestReadNodeTransforms(t *testing.T) {
	t.Run("composes elements in document order", func(t *testing.T) {
		// Translate then rotate applies the rotation first: (1,0,0) turns to (0,1,0), then moves to (1,3,3).
		points := readPoints(t, triangleScene("", `<translate>1 2 3</translate><rotate>0 0 1 90</rotate><instance_geometry url="#tri"/>`))
		requirePoints(t, points[:2], r3.Vector{X: 1, Y: 2, Z: 3}, r3.Vector{X: 1, Y: 3, Z: 3})
	})
	t.Run("rotate then translate differs", func(t *testing.T) {
		points := readPoints(t, triangleScene("", `<rotate>0 0 1 90</rotate><translate>1 2 3</translate><instance_geometry url="#tri"/>`))
		requirePoints(t, points[:2], r3.Vector{X: -2, Y: 1, Z: 3}, r3.Vector{X: -2, Y: 2, Z: 3})
	})
	t.Run("scale", func(t *testing.T) {
		points := readPoints(t, triangleScene("", `<scale>2 3 4</scale><instance_geometry url="#tri"/>`))
		requirePoints(t, points, r3.Vector{}, r3.Vector{X: 2}, r3.Vector{Y: 3})
	})
	t.Run("matrix is row-major for column vectors", func(t *testing.T) {
		matrix := `<matrix>0 -1 0 5  1 0 0 6  0 0 1 7  0 0 0 1</matrix>`
		points := readPoints(t, triangleScene("", matrix+`<instance_geometry url="#tri"/>`))
		requirePoints(t, points, r3.Vector{X: 5, Y: 6, Z: 7}, r3.Vector{X: 5, Y: 7, Z: 7}, r3.Vector{X: 4, Y: 6, Z: 7})
	})
	t.Run("nested nodes multiply parent by child", func(t *testing.T) {
		data := colladaDocument("", `<library_geometries>`+unitTriangleGeometry+`</library_geometries>
<library_visual_scenes><visual_scene id="vs"><node id="parent"><translate>10 0 0</translate>
<node id="child"><rotate>0 0 1 90</rotate><instance_geometry url="#tri"/></node></node></visual_scene></library_visual_scenes>`)
		requirePoints(t, readPoints(t, data), r3.Vector{X: 10}, r3.Vector{X: 10, Y: 1}, r3.Vector{X: 9})
	})
	t.Run("instance_node resolves against library_nodes", func(t *testing.T) {
		data := colladaDocument("", `<library_geometries>`+unitTriangleGeometry+`</library_geometries>
<library_nodes><node id="part"><translate>0 0 5</translate><instance_geometry url="#tri"/></node></library_nodes>
<library_visual_scenes><visual_scene id="vs"><node id="a"><translate>1 0 0</translate><instance_node url="#part"/></node></visual_scene></library_visual_scenes>`)
		requirePoints(t, readPoints(t, data), r3.Vector{X: 1, Z: 5}, r3.Vector{X: 2, Z: 5}, r3.Vector{X: 1, Y: 1, Z: 5})
	})
	t.Run("a geometry instanced twice yields its triangles twice", func(t *testing.T) {
		data := triangleScene("", `<instance_geometry url="#tri"/><node id="m"><translate>0 0 1</translate><instance_geometry url="#tri"/></node>`)
		triangles, err := Read(data)
		test.That(t, err, test.ShouldBeNil)
		test.That(t, len(triangles), test.ShouldEqual, 2)
	})
	t.Run("lookat and skew are rejected", func(t *testing.T) {
		requireReadError(t, triangleScene("", `<lookat>0 0 0 0 0 1 0 1 0</lookat><instance_geometry url="#tri"/>`), "<lookat>", `"n"`)
		requireReadError(t, triangleScene("", `<skew>0 0 1 0 1 0 0</skew><instance_geometry url="#tri"/>`), "<skew>")
	})
}

func TestReadSceneSelection(t *testing.T) {
	geometries := `<library_geometries>` + unitTriangleGeometry + `</library_geometries>`

	t.Run("instance_visual_scene picks its scene over the first", func(t *testing.T) {
		data := colladaDocument("", geometries+`<library_visual_scenes>
<visual_scene id="first"><node id="a"><instance_geometry url="#tri"/></node></visual_scene>
<visual_scene id="second"><node id="b"><translate>0 0 9</translate><instance_geometry url="#tri"/></node></visual_scene>
</library_visual_scenes><scene><instance_visual_scene url="#second"/></scene>`)
		test.That(t, readPoints(t, data)[0].Z, test.ShouldEqual, 9)
	})
	t.Run("falls back to the first visual scene", func(t *testing.T) {
		data := colladaDocument("", geometries+`<library_visual_scenes>
<visual_scene id="first"><node id="a"><translate>0 0 4</translate><instance_geometry url="#tri"/></node></visual_scene>
<visual_scene id="second"><node id="b"><instance_geometry url="#tri"/></node></visual_scene>
</library_visual_scenes>`)
		triangles, err := Read(data)
		test.That(t, err, test.ShouldBeNil)
		test.That(t, len(triangles), test.ShouldEqual, 1)
		test.That(t, allPoints(triangles)[0].Z, test.ShouldEqual, 4)
	})
	t.Run("falls back to every geometry untransformed", func(t *testing.T) {
		requirePoints(t, readPoints(t, colladaDocument("", geometries)), r3.Vector{}, r3.Vector{X: 1}, r3.Vector{Y: 1})
	})
	t.Run("a geometry no node instances is left out", func(t *testing.T) {
		data := colladaDocument("", `<library_geometries>`+unitTriangleGeometry+strings.ReplaceAll(unitTriangleGeometry, `"tri`, `"other`)+`</library_geometries>
<library_visual_scenes><visual_scene id="vs"><node id="a"><instance_geometry url="#tri"/></node></visual_scene></library_visual_scenes>`)
		triangles, err := Read(data)
		test.That(t, err, test.ShouldBeNil)
		test.That(t, len(triangles), test.ShouldEqual, 1)
	})
}

func TestReadPrimitives(t *testing.T) {
	const quad = `<input semantic="VERTEX" source="#vert" offset="0"/>`
	corners := []r3.Vector{{}, {X: 1}, {X: 1, Y: 1}, {Y: 1}}

	t.Run("polylist splits by vcount and fans a quad", func(t *testing.T) {
		data := geometryWithPrimitive(`<polylist count="2">` + quad + `<vcount>4 3</vcount><p>0 1 2 3 0 2 3</p></polylist>`)
		requirePoints(t, readPoints(t, data),
			corners[0], corners[1], corners[2],
			corners[0], corners[2], corners[3],
			corners[0], corners[2], corners[3])
	})
	t.Run("polygons takes one polygon per p", func(t *testing.T) {
		data := geometryWithPrimitive(`<polygons count="2">` + quad + `<p>0 1 2 3</p><p>3 2 1</p></polygons>`)
		requirePoints(t, readPoints(t, data),
			corners[0], corners[1], corners[2],
			corners[0], corners[2], corners[3],
			corners[3], corners[2], corners[1])
	})
	t.Run("multi-offset p reads the VERTEX input at its own offset", func(t *testing.T) {
		data := geometryWithPrimitive(`<triangles count="1">
<input semantic="NORMAL" source="#nor" offset="0"/><input semantic="TEXCOORD" source="#nor" offset="2" set="0"/>
<input semantic="VERTEX" source="#vert" offset="1"/><p>0 3 0  0 1 0  0 2 0</p></triangles>`)
		requirePoints(t, readPoints(t, data), corners[3], corners[1], corners[2])
	})
	t.Run("lines are ignored", func(t *testing.T) {
		data := geometryWithPrimitive(`<lines count="1">` + quad + `<p>0 1</p></lines><linestrips count="1">` + quad + `<p>0 1 2</p></linestrips>
<triangles count="1">` + quad + `<p>0 1 2</p></triangles>`)
		test.That(t, len(readPoints(t, data)), test.ShouldEqual, 3)
	})
	t.Run("position accessor honours offset and stride", func(t *testing.T) {
		data := colladaDocument("", `<library_geometries><geometry id="g"><mesh>
<source id="pos"><float_array id="pos-array" count="12">9 1 2 3 9 4 5 6 9 7 8 9</float_array>
<technique_common><accessor source="#pos-array" count="3" offset="1" stride="4">
<param name="X" type="float"/><param name="Y" type="float"/><param name="Z" type="float"/></accessor></technique_common></source>
<vertices id="vert"><input semantic="POSITION" source="#pos"/></vertices>
<triangles count="1">`+quad+`<p>0 1 2</p></triangles></mesh></geometry></library_geometries>`)
		requirePoints(t, readPoints(t, data), r3.Vector{X: 1, Y: 2, Z: 3}, r3.Vector{X: 4, Y: 5, Z: 6}, r3.Vector{X: 7, Y: 8, Z: 9})
	})
}

func TestReadErrors(t *testing.T) {
	const quad = `<input semantic="VERTEX" source="#vert" offset="0"/>`

	t.Run("tristrips and trifans name themselves", func(t *testing.T) {
		requireReadError(t, geometryWithPrimitive(`<tristrips count="1">`+quad+`<p>0 1 2 3</p></tristrips>`), "<tristrips>", `"g"`)
		requireReadError(t, geometryWithPrimitive(`<trifans count="1">`+quad+`<p>0 1 2 3</p></trifans>`), "<trifans>", `"g"`)
	})
	t.Run("an unresolved instance_geometry url", func(t *testing.T) {
		requireReadError(t, triangleScene("", `<instance_geometry url="#missing"/>`), "unresolved", "missing", `"n"`)
	})
	t.Run("an unresolved instance_node url", func(t *testing.T) {
		requireReadError(t, triangleScene("", `<instance_node url="#missing"/>`), "unresolved", "missing")
	})
	t.Run("an unresolved instance_visual_scene url", func(t *testing.T) {
		data := colladaDocument("", `<library_geometries>`+unitTriangleGeometry+`</library_geometries><scene><instance_visual_scene url="#nope"/></scene>`)
		requireReadError(t, data, "unresolved", "nope")
	})
	t.Run("an unresolved vertices or source", func(t *testing.T) {
		requireReadError(t, geometryWithPrimitive(`<triangles count="1"><input semantic="VERTEX" source="#nowhere" offset="0"/><p>0 1 2</p></triangles>`), "unresolved", "nowhere")
	})
	t.Run("an index out of range", func(t *testing.T) {
		requireReadError(t, geometryWithPrimitive(`<triangles count="1">`+quad+`<p>0 1 4</p></triangles>`), "index 4", `"g"`)
		requireReadError(t, geometryWithPrimitive(`<triangles count="1">`+quad+`<p>0 1 -1</p></triangles>`), "index -1")
	})
	t.Run("a malformed float", func(t *testing.T) {
		data := strings.Replace(string(geometryWithPrimitive(`<triangles count="1">`+quad+`<p>0 1 2</p></triangles>`)), "1 1 0", "1 x1 0", 1)
		requireReadError(t, []byte(data), "malformed float", `"x1"`, "pos-array")
	})
	t.Run("a malformed transform float", func(t *testing.T) {
		requireReadError(t, triangleScene("", `<translate>1 two 3</translate><instance_geometry url="#tri"/>`), "malformed float", `"two"`, `"n"`)
	})
	t.Run("a malformed index", func(t *testing.T) {
		requireReadError(t, geometryWithPrimitive(`<triangles count="1">`+quad+`<p>0 1 b</p></triangles>`), "malformed integer", `"b"`)
	})
	t.Run("a polylist whose vcount does not cover its indices", func(t *testing.T) {
		requireReadError(t, geometryWithPrimitive(`<polylist count="1">`+quad+`<vcount>4</vcount><p>0 1 2</p></polylist>`), "polylist")
	})
	t.Run("a document with no triangles", func(t *testing.T) {
		requireReadError(t, colladaDocument("", ""), "no triangles")
	})
	t.Run("a node that instances itself", func(t *testing.T) {
		data := colladaDocument("", `<library_nodes><node id="loop"><instance_node url="#loop"/></node></library_nodes>
<library_visual_scenes><visual_scene id="vs"><node id="a"><instance_node url="#loop"/></node></visual_scene></library_visual_scenes>`)
		requireReadError(t, data, "loop")
	})
	t.Run("not XML", func(t *testing.T) {
		requireReadError(t, []byte("<COLLADA><asset>"), "colladamesh")
	})
}
