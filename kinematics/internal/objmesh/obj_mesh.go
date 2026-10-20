// Package objmesh reads the geometry of a Wavefront OBJ file.
package objmesh

import (
	"bufio"
	"bytes"
	"fmt"
	"strconv"
	"strings"

	"github.com/golang/geo/r3"
	"go.viam.com/rdk/spatialmath"
)

// initialLineBufferBytes is the scanner's starting buffer. It grows up to the whole file, so one
// line of any length still scans.
const initialLineBufferBytes = 64 * 1024

// Read parses OBJ `v` and `f` records into triangles. Coordinates are the file's vertex values,
// unscaled, because OBJ carries no unit. A face with more than three vertices is fan-triangulated
// from its first vertex. A face index may be negative, counting back from the latest vertex, and
// may carry `/vt/vn` suffixes, which are ignored. Every other record is ignored, including `vn`,
// `vt`, `g`, `o`, `s`, `usemtl`, and `mtllib`. Errors name the 1-based line number.
func Read(data []byte) ([]*spatialmath.Triangle, error) {
	var vertices []r3.Vector
	var triangles []*spatialmath.Triangle

	scanner := bufio.NewScanner(bytes.NewReader(data))
	scanner.Buffer(make([]byte, 0, initialLineBufferBytes), len(data)+1)
	for lineNumber := 1; scanner.Scan(); lineNumber++ {
		fields := strings.Fields(scanner.Text())
		if len(fields) == 0 || strings.HasPrefix(fields[0], "#") {
			continue
		}
		switch fields[0] {
		case "v":
			vertex, err := parseVertex(fields[1:])
			if err != nil {
				return nil, fmt.Errorf("objmesh: line %d: %w", lineNumber, err)
			}
			vertices = append(vertices, vertex)
		case "f":
			face, err := parseFace(fields[1:], vertices)
			if err != nil {
				return nil, fmt.Errorf("objmesh: line %d: %w", lineNumber, err)
			}
			for i := 1; i+1 < len(face); i++ {
				triangles = append(triangles, spatialmath.NewTriangle(face[0], face[i], face[i+1]))
			}
		}
	}
	if err := scanner.Err(); err != nil {
		return nil, fmt.Errorf("objmesh: %w", err)
	}
	return triangles, nil
}

func parseVertex(coordinates []string) (r3.Vector, error) {
	if len(coordinates) < 3 {
		return r3.Vector{}, fmt.Errorf("vertex needs 3 coordinates, got %d", len(coordinates))
	}
	var values [3]float64
	for i := range values {
		value, err := strconv.ParseFloat(coordinates[i], 64)
		if err != nil {
			return r3.Vector{}, fmt.Errorf("malformed vertex coordinate %q", coordinates[i])
		}
		values[i] = value
	}
	return r3.Vector{X: values[0], Y: values[1], Z: values[2]}, nil
}

func parseFace(refs []string, vertices []r3.Vector) ([]r3.Vector, error) {
	if len(refs) < 3 {
		return nil, fmt.Errorf("face needs at least 3 vertices, got %d", len(refs))
	}
	face := make([]r3.Vector, len(refs))
	for i, ref := range refs {
		indexText, _, _ := strings.Cut(ref, "/")
		index, err := strconv.Atoi(indexText)
		if err != nil {
			return nil, fmt.Errorf("malformed face index %q", ref)
		}
		if index < 0 {
			index += len(vertices) + 1
		}
		if index < 1 || index > len(vertices) {
			return nil, fmt.Errorf("face index %q out of range for %d vertices", ref, len(vertices))
		}
		face[i] = vertices[index-1]
	}
	return face, nil
}
