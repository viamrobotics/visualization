package colladamesh

import (
	"fmt"

	"github.com/golang/geo/r3"
)

type corners [3]r3.Vector

// triangles returns every surface of g as triangles, in the geometry's own coordinates.
func (g *geometry) triangles() ([]corners, error) {
	if g.Mesh == nil {
		return nil, fmt.Errorf("colladamesh: <geometry id=%q> has no <mesh>", g.ID)
	}
	m := g.Mesh
	if len(m.Tristrips) > 0 {
		return nil, fmt.Errorf("colladamesh: <geometry id=%q> uses <tristrips>, which is not supported", g.ID)
	}
	if len(m.Trifans) > 0 {
		return nil, fmt.Errorf("colladamesh: <geometry id=%q> uses <trifans>, which is not supported", g.ID)
	}

	var result []corners
	for i := range m.Triangles {
		for _, p := range m.Triangles[i].P {
			part, err := m.surface(g.ID, "triangles", &m.Triangles[i], p, trianglePolygons)
			if err != nil {
				return nil, err
			}
			result = append(result, part...)
		}
	}
	for i := range m.Polylists {
		prim := &m.Polylists[i]
		if len(prim.P) != 1 {
			return nil, fmt.Errorf("colladamesh: <polylist> of <geometry id=%q> needs exactly one <p>", g.ID)
		}
		counts, err := parseIntegers(prim.VCount, "vcount", g.ID)
		if err != nil {
			return nil, err
		}
		part, err := m.surface(g.ID, "polylist", prim, prim.P[0], func(int) ([]int, error) { return counts, nil })
		if err != nil {
			return nil, err
		}
		result = append(result, part...)
	}
	for i := range m.Polygons {
		for _, p := range m.Polygons[i].P {
			part, err := m.surface(g.ID, "polygons", &m.Polygons[i], p, func(vertexCount int) ([]int, error) {
				return []int{vertexCount}, nil
			})
			if err != nil {
				return nil, err
			}
			result = append(result, part...)
		}
	}
	return result, nil
}

func trianglePolygons(vertexCount int) ([]int, error) {
	if vertexCount%3 != 0 {
		return nil, fmt.Errorf("%d vertices is not a multiple of 3", vertexCount)
	}
	counts := make([]int, vertexCount/3)
	for i := range counts {
		counts[i] = 3
	}
	return counts, nil
}

// surface fan-triangulates the polygons that one `<p>` lists. polygonSizes maps the number of
// vertices in the `<p>` to the vertex count of each polygon in it.
func (m *mesh) surface(
	geometryID, element string, prim *primitive, p string, polygonSizes func(vertexCount int) ([]int, error),
) ([]corners, error) {
	positions, indices, err := m.vertexPositions(geometryID, element, prim, p)
	if err != nil {
		return nil, err
	}
	sizes, err := polygonSizes(len(indices))
	if err != nil {
		return nil, fmt.Errorf("colladamesh: <%s> of <geometry id=%q>: %w", element, geometryID, err)
	}

	var result []corners
	next := 0
	for _, size := range sizes {
		if size < 3 || next+size > len(indices) {
			return nil, fmt.Errorf("colladamesh: <%s> of <geometry id=%q> has a polygon of %d vertices that does not fit its indices", element, geometryID, size)
		}
		for i := 1; i < size-1; i++ {
			result = append(result, corners{
				positions[indices[next]], positions[indices[next+i]], positions[indices[next+i+1]],
			})
		}
		next += size
	}
	if next != len(indices) {
		return nil, fmt.Errorf("colladamesh: <%s> of <geometry id=%q> has %d vertices no polygon uses", element, geometryID, len(indices)-next)
	}
	return result, nil
}
