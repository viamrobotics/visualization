package objmesh

import (
	"math"
	"os"
	"testing"

	"github.com/golang/geo/r3"
	commonpb "go.viam.com/api/common/v1"
	"go.viam.com/rdk/spatialmath"
	"go.viam.com/test"
)

func TestRead(t *testing.T) {
	const square = "v 0 0 0\nv 1 0 0\nv 1 1 0\nv 0 1 0\n"
	cases := []struct {
		name string
		obj  string
		want [][3]r3.Vector
	}{
		{
			name: "triangle",
			obj:  "v 0 0 0\nv 1 0 0\nv 0 1 0\nf 1 2 3\n",
			want: [][3]r3.Vector{{{}, {X: 1}, {Y: 1}}},
		},
		{
			name: "quad is fan triangulated from the first ref",
			obj:  square + "f 1 2 3 4\n",
			want: [][3]r3.Vector{{{}, {X: 1}, {X: 1, Y: 1}}, {{}, {X: 1, Y: 1}, {Y: 1}}},
		},
		{
			name: "negative indices count back from the latest vertex",
			obj:  "v 9 9 9\nv 0 0 0\nv 1 0 0\nv 0 1 0\nf -3 -2 -1\n",
			want: [][3]r3.Vector{{{}, {X: 1}, {Y: 1}}},
		},
		{
			name: "texture and normal suffixes are ignored",
			obj:  "v 0 0 0\nv 1 0 0\nv 0 1 0\nf 1/1/1 2//2 3/3\n",
			want: [][3]r3.Vector{{{}, {X: 1}, {Y: 1}}},
		},
		{
			name: "other records, comments, blank lines, and w are ignored",
			obj:  "# header\n\nmtllib a.mtl\no part\ng group\nv 0 0 0 1\nv 1 0 0 0.5\nv 0 1 0\nvn 0 0 1\nvt 0 0\nusemtl m\ns off\nl 1 2\nf 1 2 3\n",
			want: [][3]r3.Vector{{{}, {X: 1}, {Y: 1}}},
		},
		{
			name: "vertices without faces read as no triangles",
			obj:  square,
			want: nil,
		},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			triangles, err := Read([]byte(tc.obj))
			test.That(t, err, test.ShouldBeNil)
			test.That(t, len(triangles), test.ShouldEqual, len(tc.want))
			for i, want := range tc.want {
				got := triangles[i].Points()
				for j := range want {
					test.That(t, got[j].Sub(want[j]).Norm(), test.ShouldBeLessThan, 1e-12)
				}
			}
		})
	}
}

func TestReadErrors(t *testing.T) {
	cases := []struct {
		name string
		obj  string
		line string
	}{
		{"malformed vertex number", "# c\nv 0 0 0\nv 1 x 0\n", "line 3"},
		{"vertex with too few coordinates", "v 0 0\n", "line 1"},
		{"face index of zero", "v 0 0 0\nv 1 0 0\nv 0 1 0\nf 0 1 2\n", "line 4"},
		{"face index out of range", "v 0 0 0\nv 1 0 0\nv 0 1 0\n\nf 1 2 4\n", "line 5"},
		{"negative index out of range", "v 0 0 0\nv 1 0 0\nv 0 1 0\nf -4 1 2\n", "line 4"},
		{"face with two refs", "v 0 0 0\nv 1 0 0\nf 1 2\n", "line 3"},
		{"malformed face index", "v 0 0 0\nv 1 0 0\nv 0 1 0\nf 1 2 a\n", "line 4"},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			_, err := Read([]byte(tc.obj))
			test.That(t, err, test.ShouldNotBeNil)
			test.That(t, err.Error(), test.ShouldContainSubstring, tc.line)
		})
	}
}

func readSTLMillimetres(t *testing.T, path string) []*spatialmath.Triangle {
	t.Helper()
	data, err := os.ReadFile(path)
	test.That(t, err, test.ShouldBeNil)
	geometry, err := spatialmath.NewMeshFromProto(spatialmath.NewZeroPose(), &commonpb.Mesh{Mesh: data, ContentType: "stl"}, "stl")
	test.That(t, err, test.ShouldBeNil)
	return geometry.Triangles()
}

func readOBJMillimetres(t *testing.T, path string) []*spatialmath.Triangle {
	t.Helper()
	data, err := os.ReadFile(path)
	test.That(t, err, test.ShouldBeNil)
	triangles, err := Read(data)
	test.That(t, err, test.ShouldBeNil)
	scaled := make([]*spatialmath.Triangle, len(triangles))
	for i, triangle := range triangles {
		points := triangle.Points()
		scaled[i] = spatialmath.NewTriangle(points[0].Mul(1000), points[1].Mul(1000), points[2].Mul(1000))
	}
	return scaled
}

func bounds(triangles []*spatialmath.Triangle) (r3.Vector, r3.Vector) {
	low := r3.Vector{X: math.Inf(1), Y: math.Inf(1), Z: math.Inf(1)}
	high := r3.Vector{X: math.Inf(-1), Y: math.Inf(-1), Z: math.Inf(-1)}
	for _, triangle := range triangles {
		for _, point := range triangle.Points() {
			low = r3.Vector{X: math.Min(low.X, point.X), Y: math.Min(low.Y, point.Y), Z: math.Min(low.Z, point.Z)}
			high = r3.Vector{X: math.Max(high.X, point.X), Y: math.Max(high.Y, point.Y), Z: math.Max(high.Z, point.Z)}
		}
	}
	return low, high
}

func TestFingerFixtureMatchesSTL(t *testing.T) {
	fromSTL := readSTLMillimetres(t, "../../testdata/finger-20x20x80mm.stl")
	fromOBJ := readOBJMillimetres(t, "../../testdata/finger-20x20x80mm.obj")
	test.That(t, len(fromOBJ), test.ShouldEqual, len(fromSTL))
	stlLow, stlHigh := bounds(fromSTL)
	objLow, objHigh := bounds(fromOBJ)
	test.That(t, objLow.Sub(stlLow).Norm(), test.ShouldBeLessThan, 1e-6)
	test.That(t, objHigh.Sub(stlHigh).Norm(), test.ShouldBeLessThan, 1e-6)
}

func TestSuctionCupFixtureMatchesSTL(t *testing.T) {
	fromSTL := readSTLMillimetres(t, "../../testdata/examples/vacuum-frame/suction-cup.stl")
	fromOBJ := readOBJMillimetres(t, "../../testdata/suction-cup.obj")
	test.That(t, len(fromOBJ), test.ShouldEqual, len(fromSTL))
	for i := range fromSTL {
		want := fromSTL[i].Points()
		got := fromOBJ[i].Points()
		for j := range want {
			test.That(t, got[j].Sub(want[j]).Norm(), test.ShouldBeLessThan, 1e-9)
		}
	}
}
