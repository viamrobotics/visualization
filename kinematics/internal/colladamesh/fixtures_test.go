package colladamesh

import (
	"math"
	"os"
	"testing"

	"github.com/golang/geo/r3"
	commonpb "go.viam.com/api/common/v1"
	"go.viam.com/rdk/spatialmath"
	"go.viam.com/test"
)

const (
	metresToMillimetres = 1000
	// RDK reads STL values as metres, so a millimetre STL comes back a thousand times too large.
	stlMillimetreCorrection    = 0.001
	fingerToleranceMillimetres = 1e-6
)

func boundsOf(points []r3.Vector) (lowest, highest r3.Vector) {
	lowest = r3.Vector{X: math.Inf(1), Y: math.Inf(1), Z: math.Inf(1)}
	highest = r3.Vector{X: math.Inf(-1), Y: math.Inf(-1), Z: math.Inf(-1)}
	for _, point := range points {
		lowest = r3.Vector{X: math.Min(lowest.X, point.X), Y: math.Min(lowest.Y, point.Y), Z: math.Min(lowest.Z, point.Z)}
		highest = r3.Vector{X: math.Max(highest.X, point.X), Y: math.Max(highest.Y, point.Y), Z: math.Max(highest.Z, point.Z)}
	}
	return lowest, highest
}

func requireWithin(t *testing.T, got, want r3.Vector, tolerance float64) {
	t.Helper()
	test.That(t, math.Abs(got.X-want.X), test.ShouldBeLessThanOrEqualTo, tolerance)
	test.That(t, math.Abs(got.Y-want.Y), test.ShouldBeLessThanOrEqualTo, tolerance)
	test.That(t, math.Abs(got.Z-want.Z), test.ShouldBeLessThanOrEqualTo, tolerance)
}

func TestFingerColladaReadsLikeItsSTL(t *testing.T) {
	stl, err := os.ReadFile("../../testdata/finger-20x20x80mm.stl")
	test.That(t, err, test.ShouldBeNil)
	want, err := spatialmath.NewMeshFromProto(spatialmath.NewZeroPose(), &commonpb.Mesh{Mesh: stl, ContentType: "stl"}, "stl")
	test.That(t, err, test.ShouldBeNil)

	dae, err := os.ReadFile("../../testdata/finger-20x20x80mm.dae")
	test.That(t, err, test.ShouldBeNil)
	triangles, err := Read(dae)
	test.That(t, err, test.ShouldBeNil)

	test.That(t, len(triangles), test.ShouldEqual, 12)
	test.That(t, len(triangles), test.ShouldEqual, len(want.Triangles()))
	gotMin, gotMax := boundsOf(allPoints(triangles))
	wantMin, wantMax := boundsOf(allPoints(want.Triangles()))
	requireWithin(t, gotMin.Mul(metresToMillimetres), wantMin.Mul(stlMillimetreCorrection), fingerToleranceMillimetres)
	requireWithin(t, gotMax.Mul(metresToMillimetres), wantMax.Mul(stlMillimetreCorrection), fingerToleranceMillimetres)
	// The rotate in the fixture turns a 80 mm Z extent into Y when ignored, so this pins its use.
	test.That(t, gotMax.Y-gotMin.Y, test.ShouldAlmostEqual, 0.020, 1e-9)
}

func TestMeshLabExportParses(t *testing.T) {
	data, err := os.ReadFile("testdata/robotiq_arg2f_85_inner_finger.dae")
	test.That(t, err, test.ShouldBeNil)
	triangles, err := Read(data)
	test.That(t, err, test.ShouldBeNil)

	// The export is tagged Y_UP and has no <unit>. Bounds come from its positions float_array.
	test.That(t, len(triangles), test.ShouldEqual, 368)
	lowest, highest := boundsOf(allPoints(triangles))
	requireWithin(t, lowest, r3.Vector{X: -7.5, Y: -23.9018, Z: -5.99635}, 1e-9)
	requireWithin(t, highest, r3.Vector{X: 7.5, Y: 5.99635, Z: 44.5149}, 1e-9)
}
