// Package colladamesh reads the geometry of a COLLADA 1.4.1 document.
package colladamesh

import (
	"encoding/xml"
	"errors"
	"fmt"

	"go.viam.com/rdk/spatialmath"
)

// Read parses a COLLADA document into triangles in metres, in the document's own axes. Every
// `<instance_geometry>` reachable from the scene's visual scene is placed by the transforms of the
// nodes above it and scaled by `<asset><unit meter>`. `<up_axis>` is ignored, as RViz and MoveIt
// ignore it, because ROS meshes are Z up whatever the tag says. Materials, textures, normals, and
// texture coordinates are ignored.
func Read(data []byte) ([]*spatialmath.Triangle, error) {
	var doc document
	if err := xml.Unmarshal(data, &doc); err != nil {
		return nil, fmt.Errorf("colladamesh: parse document: %w", err)
	}
	unit, err := doc.unitMeters()
	if err != nil {
		return nil, err
	}
	placed, err := newScene(&doc).placedTriangles()
	if err != nil {
		return nil, err
	}
	if len(placed) == 0 {
		return nil, errors.New("colladamesh: document contains no triangles")
	}
	triangles := make([]*spatialmath.Triangle, 0, len(placed))
	for _, corners := range placed {
		triangles = append(triangles, spatialmath.NewTriangle(
			corners[0].Mul(unit), corners[1].Mul(unit), corners[2].Mul(unit)))
	}
	return triangles, nil
}
