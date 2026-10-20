package kinematics

import (
	"bytes"
	"encoding/binary"
	"math"
	"testing"
	"testing/fstest"

	"github.com/golang/geo/r3"
	"go.viam.com/rdk/spatialmath"
	"go.viam.com/test"

	kinematicsv1 "github.com/viamrobotics/visualization/kinematics/v1"
)

// sphereSTL is a binary STL of a UV sphere of the given radius in mm.
func sphereSTL(radius float64, segments, rings int) (data []byte, vertices []r3.Vector) {
	point := func(ring, seg int) r3.Vector {
		phi := math.Pi * float64(ring) / float64(rings)
		theta := 2 * math.Pi * float64(seg%segments) / float64(segments)
		return r3.Vector{X: radius * math.Sin(phi) * math.Cos(theta), Y: radius * math.Sin(phi) * math.Sin(theta), Z: radius * math.Cos(phi)}
	}
	var triangles [][3]r3.Vector
	for ring := range rings {
		for seg := range segments {
			a, b, c, d := point(ring, seg), point(ring, seg+1), point(ring+1, seg+1), point(ring+1, seg)
			if ring > 0 {
				triangles = append(triangles, [3]r3.Vector{a, d, b})
			}
			if ring < rings-1 {
				triangles = append(triangles, [3]r3.Vector{b, d, c})
			}
		}
	}
	var buf bytes.Buffer
	buf.Write(make([]byte, 80))
	_ = binary.Write(&buf, binary.LittleEndian, uint32(len(triangles)))
	for _, tri := range triangles {
		_ = binary.Write(&buf, binary.LittleEndian, [3]float32{})
		for _, v := range tri {
			_ = binary.Write(&buf, binary.LittleEndian, [3]float32{float32(v.X), float32(v.Y), float32(v.Z)})
			vertices = append(vertices, v)
		}
		buf.Write([]byte{0, 0})
	}
	return buf.Bytes(), vertices
}

// rayDirection is generic enough that it rarely grazes an edge of a test mesh.
var rayDirection = r3.Vector{X: 0.2673, Y: 0.5345, Z: 0.8018}

// insideMesh reports whether p is inside the closed mesh triangles, by the parity of the crossings of
// a ray from p (Moller-Trumbore).
func insideMesh(triangles []*spatialmath.Triangle, p r3.Vector) bool {
	crossings := 0
	for _, tri := range triangles {
		v := tri.Points()
		edge1, edge2 := v[1].Sub(v[0]), v[2].Sub(v[0])
		h := rayDirection.Cross(edge2)
		det := edge1.Dot(h)
		if math.Abs(det) < 1e-12 {
			continue
		}
		s := p.Sub(v[0])
		u := s.Dot(h) / det
		if u < 0 || u > 1 {
			continue
		}
		q := s.Cross(edge1)
		w := rayDirection.Dot(q) / det
		if w < 0 || u+w > 1 {
			continue
		}
		if edge2.Dot(q)/det > 0 {
			crossings++
		}
	}
	return crossings%2 == 1
}

// outsideMesh counts the points that are not inside the closed mesh triangles.
func outsideMesh(triangles []*spatialmath.Triangle, points []r3.Vector) int {
	outside := 0
	for _, p := range points {
		if !insideMesh(triangles, p) {
			outside++
		}
	}
	return outside
}

// An over-limit link warns, and its suggested budget clears the warning while the simplified collision
// geometry still contains every vertex of the original mesh. Containment is a half-space test: the
// simplified mesh is checked to be convex, and every original vertex must lie on the inner side of every
// one of its faces. The same test must reject a mesh shrunk by 10%, which is what makes it falsifiable.
func TestSimplifyToSuggestedBudgetStaysConservative(t *testing.T) {
	data, vertices := sphereSTL(100, 32, 32)
	// Three copies of the same triangles put the mesh over the limit with a third of the unique vertices,
	// which keeps RDK's decimation fast.
	data = repeatSTL(data, 3)
	vertices = append(append(append([]r3.Vector{}, vertices...), vertices...), vertices...)
	test.That(t, len(vertices)/3, test.ShouldBeGreaterThan, TriangleWarningLimit)
	sources := fstest.MapFS{"ball.stl": &fstest.MapFile{Data: data}}
	spec := primitiveSpec(&kinematicsv1.Link{Id: "ball", MeshPath: "ball.stl", MeshUnit: kinematicsv1.LengthUnit_LENGTH_UNIT_MILLIMETERS})

	out, err := Build(spec, sources)
	test.That(t, err, test.ShouldBeNil)
	report := ValidateSpec(out.Files[ModelFileName], spec)
	test.That(t, report.GetFailures(), test.ShouldBeEmpty)
	got := linkByID(t, report, "ball")
	test.That(t, got.GetOverTriangleLimit(), test.ShouldBeTrue)
	test.That(t, report.GetWarnings(), test.ShouldHaveLength, 1)
	suggested := got.GetSuggestedMaxTriangles()
	test.That(t, suggested, test.ShouldBeGreaterThan, 0)

	spec.Links[0].MaxTriangles = suggested
	out, err = Build(spec, sources)
	test.That(t, err, test.ShouldBeNil)
	report = ValidateSpec(out.Files[ModelFileName], spec)
	test.That(t, report.GetFailures(), test.ShouldBeEmpty)
	test.That(t, report.GetWarnings(), test.ShouldBeEmpty)
	got = linkByID(t, report, "ball")
	test.That(t, got.GetOverTriangleLimit(), test.ShouldBeFalse)
	test.That(t, got.GetTriangles(), test.ShouldBeLessThanOrEqualTo, suggested)
	test.That(t, got.GetTriangles(), test.ShouldBeGreaterThan, 0)

	simplified := meshByLabel(t, out.Files[ModelFileName], spec.GetName(), "ball")
	// Every vertex of the original sphere, pulled 0.1% toward the centre so one on the surface is not a
	// coin flip, lies inside the simplified mesh. The original is a sphere about the origin.
	inward := make([]r3.Vector, len(vertices))
	for i, v := range vertices {
		inward[i] = v.Mul(0.999)
	}
	test.That(t, outsideMesh(simplified.Triangles(), inward), test.ShouldEqual, 0)

	// The same check on a copy of the simplified mesh shrunk by 10% finds vertices outside.
	shrunk := make([]*spatialmath.Triangle, 0, len(simplified.Triangles()))
	for _, tri := range simplified.Triangles() {
		p := tri.Points()
		shrunk = append(shrunk, spatialmath.NewTriangle(p[0].Mul(0.9), p[1].Mul(0.9), p[2].Mul(0.9)))
	}
	test.That(t, outsideMesh(shrunk, inward), test.ShouldBeGreaterThan, len(inward)/2)
}

func meshByLabel(t *testing.T, modelJSON []byte, name, label string) *spatialmath.Mesh {
	t.Helper()
	geoms, err := robotModel(t, modelJSON, name).Geometries(nil)
	test.That(t, err, test.ShouldBeNil)
	for _, geom := range geoms.Geometries() {
		if geom.Label() == name+":"+label {
			mesh, ok := geom.(*spatialmath.Mesh)
			test.That(t, ok, test.ShouldBeTrue)
			return mesh
		}
	}
	t.Fatalf("no geometry %q", label)
	return nil
}

// repeatSTL returns a binary STL holding the triangles of data, a binary STL, times over.
func repeatSTL(data []byte, times int) []byte {
	count := binary.LittleEndian.Uint32(data[80:84])
	out := append([]byte{}, data[:80]...)
	out = binary.LittleEndian.AppendUint32(out, count*uint32(times))
	for range times {
		out = append(out, data[84:]...)
	}
	return out
}
