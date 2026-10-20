package colladamesh

import (
	"fmt"

	"github.com/golang/geo/r3"
	"go.viam.com/rdk/spatialmath"
)

const unitTriangleGeometry = `<geometry id="tri"><mesh>
<source id="tri-pos"><float_array id="tri-pos-array" count="9">0 0 0 1 0 0 0 1 0</float_array>
<technique_common><accessor source="#tri-pos-array" count="3" stride="3"/></technique_common></source>
<vertices id="tri-vert"><input semantic="POSITION" source="#tri-pos"/></vertices>
<triangles count="1"><input semantic="VERTEX" source="#tri-vert" offset="0"/><p>0 1 2</p></triangles>
</mesh></geometry>`

// colladaDocument wraps body in a COLLADA root with the given asset body.
func colladaDocument(asset, body string) []byte {
	return []byte(fmt.Sprintf(`<?xml version="1.0"?>
<COLLADA xmlns="http://www.collada.org/2005/11/COLLADASchema" version="1.4.1">
<asset>%s</asset>%s</COLLADA>`, asset, body))
}

// triangleScene places the unit triangle under a visual scene whose single node holds nodeBody.
func triangleScene(asset, nodeBody string) []byte {
	return colladaDocument(asset, fmt.Sprintf(`<library_geometries>%s</library_geometries>
<library_visual_scenes><visual_scene id="vs"><node id="n">%s</node></visual_scene></library_visual_scenes>`,
		unitTriangleGeometry, nodeBody))
}

// geometryWithPrimitive builds a document that is only a geometry with the given mesh primitives
// and a four-corner position source: (0,0,0), (1,0,0), (1,1,0), (0,1,0).
func geometryWithPrimitive(primitives string) []byte {
	return colladaDocument("", `<library_geometries><geometry id="g"><mesh>
<source id="pos"><float_array id="pos-array" count="12">0 0 0 1 0 0 1 1 0 0 1 0</float_array>
<technique_common><accessor source="#pos-array" count="4" stride="3"/></technique_common></source>
<source id="nor"><float_array id="nor-array" count="3">0 0 1</float_array>
<technique_common><accessor source="#nor-array" count="1" stride="3"/></technique_common></source>
<vertices id="vert"><input semantic="POSITION" source="#pos"/></vertices>`+primitives+`</mesh></geometry></library_geometries>`)
}

func allPoints(triangles []*spatialmath.Triangle) []r3.Vector {
	var points []r3.Vector
	for _, triangle := range triangles {
		points = append(points, triangle.Points()...)
	}
	return points
}
