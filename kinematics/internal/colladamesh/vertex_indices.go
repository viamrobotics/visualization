package colladamesh

import (
	"fmt"
	"strconv"
	"strings"

	"github.com/golang/geo/r3"
)

// vertexPositions returns the positions the primitive's VERTEX input addresses and, for every
// vertex of p, its index into them. Other inputs share the index stride and are skipped.
func (m *mesh) vertexPositions(geometryID, element string, prim *primitive, p string) ([]r3.Vector, []int, error) {
	stride, vertexOffset, verticesID := 0, -1, ""
	for _, in := range prim.Inputs {
		offset, err := strconv.Atoi(strings.TrimSpace(in.Offset))
		if err != nil || offset < 0 {
			return nil, nil, fmt.Errorf("colladamesh: <%s> of <geometry id=%q> has <input semantic=%q> with malformed offset %q", element, geometryID, in.Semantic, in.Offset)
		}
		stride = max(stride, offset+1)
		if in.Semantic == "VERTEX" {
			vertexOffset, verticesID = offset, referencedID(in.Source)
		}
	}
	if vertexOffset < 0 {
		return nil, nil, fmt.Errorf("colladamesh: <%s> of <geometry id=%q> has no VERTEX input", element, geometryID)
	}

	source, err := m.positionSource(verticesID)
	if err != nil {
		return nil, nil, err
	}
	positions, err := source.positions()
	if err != nil {
		return nil, nil, err
	}

	flat, err := parseIntegers(p, "p", geometryID)
	if err != nil {
		return nil, nil, err
	}
	if len(flat)%stride != 0 {
		return nil, nil, fmt.Errorf("colladamesh: <p> of <%s> in <geometry id=%q> has %d indices, not a multiple of the stride %d", element, geometryID, len(flat), stride)
	}
	indices := make([]int, 0, len(flat)/stride)
	for base := vertexOffset; base < len(flat); base += stride {
		index := flat[base]
		if index < 0 || index >= len(positions) {
			return nil, nil, fmt.Errorf("colladamesh: <%s> of <geometry id=%q> has index %d outside its %d positions", element, geometryID, index, len(positions))
		}
		indices = append(indices, index)
	}
	return positions, indices, nil
}

func parseIntegers(text, element, geometryID string) ([]int, error) {
	fields := strings.Fields(text)
	values := make([]int, len(fields))
	for i, field := range fields {
		value, err := strconv.Atoi(field)
		if err != nil {
			return nil, fmt.Errorf("colladamesh: <%s> of <geometry id=%q> has malformed integer %q", element, geometryID, field)
		}
		values[i] = value
	}
	return values, nil
}
