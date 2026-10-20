package kinematics

import (
	"encoding/json"
	"math"
	"testing"
	"testing/fstest"

	"github.com/golang/geo/r3"
	commonpb "go.viam.com/api/common/v1"
	"go.viam.com/rdk/spatialmath"
	"go.viam.com/test"

	kinematicsv1 "github.com/viamrobotics/visualization/kinematics/v1"
)

func cylinderPrimitive(radius, length float64) *kinematicsv1.Primitive {
	return &kinematicsv1.Primitive{Shape: &kinematicsv1.Primitive_Cylinder_{
		Cylinder: &kinematicsv1.Primitive_Cylinder{Radius: radius, Length: length},
	}}
}

func TestSpecNamedLikeALinkBuilds(t *testing.T) {
	spec := &kinematicsv1.KinematicsSpec{
		Name:  "frame",
		Links: []*kinematicsv1.Link{{Id: "frame", Primitive: boxPrimitive(10, 10, 10)}},
		Joints: []*kinematicsv1.Joint{{
			Id: "joint", Type: kinematicsv1.JointType_JOINT_TYPE_PRISMATIC, Axis: &commonpb.Vector3{Z: 1}, Upper: 10,
		}},
	}
	out, err := Build(spec, fstest.MapFS{})
	test.That(t, err, test.ShouldBeNil)
	report := ValidateSpec(out.Files[ModelFileName], spec)
	test.That(t, report.GetFailures(), test.ShouldBeEmpty)
	test.That(t, linkByID(t, report, "frame").GetPrimitive(), test.ShouldNotBeNil)
}

// A cylinder primitive is emitted as a closed mesh that circumscribes the cylinder, because RDK's own
// cylinder panics in ToProtobuf. The report still says cylinder.
func TestCylinderEmitsCircumscribingClosedMesh(t *testing.T) {
	const radius, length = 10.0, 80.0
	spec := primitiveSpec(&kinematicsv1.Link{Id: "c", Primitive: cylinderPrimitive(radius, length)})
	out, err := Build(spec, fstest.MapFS{})
	test.That(t, err, test.ShouldBeNil)

	var model struct {
		Links []struct {
			ID       string `json:"id"`
			Geometry *struct {
				Type string `json:"type"`
			} `json:"geometry"`
		} `json:"links"`
	}
	test.That(t, json.Unmarshal(out.Files[ModelFileName], &model), test.ShouldBeNil)
	for _, link := range model.Links {
		if link.ID == "c" {
			test.That(t, link.Geometry.Type, test.ShouldEqual, string(spatialmath.MeshType))
		}
	}

	report := ValidateSpec(out.Files[ModelFileName], spec)
	test.That(t, report.GetFailures(), test.ShouldBeEmpty)
	got := linkByID(t, report, "c")
	test.That(t, got.GetPrimitive().GetCylinder().GetRadius(), test.ShouldEqual, radius)
	test.That(t, got.GetTriangles(), test.ShouldEqual, 0)
	test.That(t, got.GetExtent().GetZ(), test.ShouldAlmostEqual, length, 1e-9)

	mesh := cylinderMesh(radius, length, "c")
	test.That(t, len(mesh.Triangles()), test.ShouldEqual, 4*cylinderSegments)

	// Closed: every undirected edge is shared by exactly two triangles.
	type edge [2]r3.Vector
	edges := map[edge]int{}
	for _, tri := range mesh.Triangles() {
		p := tri.Points()
		for i := range 3 {
			a, b := p[i], p[(i+1)%3]
			if lessVector(b, a) {
				a, b = b, a
			}
			edges[edge{a, b}]++
		}
	}
	for e, count := range edges {
		test.That(t, count, test.ShouldEqual, 2)
		_ = e
	}

	// Circumscribing: vertices sit at r/cos(pi/n), and the side edges' midpoints land on the true circle,
	// so no point of the circle is outside the mesh. An inscribed polygon would put the vertices at r
	// and the midpoints under it.
	circumradius := radius / math.Cos(math.Pi/cylinderSegments)
	minMid := math.Inf(1)
	for e := range edges {
		for _, v := range e {
			if v.Z == length/2 || v.Z == -length/2 {
				if math.Hypot(v.X, v.Y) > 0 {
					test.That(t, math.Hypot(v.X, v.Y), test.ShouldAlmostEqual, circumradius, 1e-9)
				}
			}
		}
		if e[0].Z == e[1].Z && math.Hypot(e[0].X, e[0].Y) > 0 && math.Hypot(e[1].X, e[1].Y) > 0 {
			mid := e[0].Add(e[1]).Mul(0.5)
			minMid = math.Min(minMid, math.Hypot(mid.X, mid.Y))
		}
	}
	test.That(t, minMid, test.ShouldAlmostEqual, radius, 1e-9)
	test.That(t, circumradius, test.ShouldBeGreaterThan, radius)
}

func lessVector(a, b r3.Vector) bool {
	if a.X != b.X {
		return a.X < b.X
	}
	if a.Y != b.Y {
		return a.Y < b.Y
	}
	return a.Z < b.Z
}

// A model that carries RDK's own cylinder, bypassing the emitter, fails validation with the link named
// instead of panicking the caller.
func TestValidateRecoversFromUnserializableGeometry(t *testing.T) {
	spec := primitiveSpec(&kinematicsv1.Link{Id: "pin", Primitive: boxPrimitive(10, 10, 10)})
	out, err := Build(spec, fstest.MapFS{})
	test.That(t, err, test.ShouldBeNil)

	var model map[string]any
	test.That(t, json.Unmarshal(out.Files[ModelFileName], &model), test.ShouldBeNil)
	for _, raw := range model["links"].([]any) {
		link := raw.(map[string]any)
		if link["id"] == "pin" {
			link["geometry"] = map[string]any{"type": "cylinder", "r": 10.0, "l": 80.0}
		}
	}
	injected, err := json.Marshal(model)
	test.That(t, err, test.ShouldBeNil)

	// Confirm the premise: RDK's cylinder does panic on the wire.
	cylinder, err := spatialmath.NewCylinder(spatialmath.NewZeroPose(), 10, 80, "c")
	test.That(t, err, test.ShouldBeNil)
	test.That(t, func() { cylinder.ToProtobuf() }, test.ShouldPanic)

	var report *kinematicsv1.ValidationReport
	test.That(t, func() { report = ValidateSpec(injected, spec) }, test.ShouldNotPanic)
	test.That(t, len(report.GetFailures()), test.ShouldBeGreaterThan, 0)
	test.That(t, report.GetFailures()[0], test.ShouldContainSubstring, `link "pin"`)

	// The emitter's own model passes the same check.
	test.That(t, ValidateSpec(out.Files[ModelFileName], spec).GetFailures(), test.ShouldBeEmpty)
}
