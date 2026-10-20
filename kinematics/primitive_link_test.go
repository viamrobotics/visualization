package kinematics

import (
	"bytes"
	"encoding/binary"
	"fmt"
	"testing"
	"testing/fstest"

	"github.com/golang/geo/r3"
	commonpb "go.viam.com/api/common/v1"
	"go.viam.com/test"

	kinematicsv1 "github.com/viamrobotics/visualization/kinematics/v1"
)

func primitiveSpec(link *kinematicsv1.Link) *kinematicsv1.KinematicsSpec {
	return &kinematicsv1.KinematicsSpec{Name: "prim", Links: []*kinematicsv1.Link{link}}
}

func boxPrimitive(x, y, z float64) *kinematicsv1.Primitive {
	return &kinematicsv1.Primitive{Shape: &kinematicsv1.Primitive_Box_{Box: &kinematicsv1.Primitive_Box{X: x, Y: y, Z: z}}}
}

func capsulePrimitive(radius, length float64) *kinematicsv1.Primitive {
	return &kinematicsv1.Primitive{Shape: &kinematicsv1.Primitive_Capsule_{
		Capsule: &kinematicsv1.Primitive_Capsule{Radius: radius, Length: length},
	}}
}

// denseSTL writes count distinct triangles as a binary STL.
func denseSTL(count int) []byte {
	var b bytes.Buffer
	b.Write(make([]byte, 80))
	_ = binary.Write(&b, binary.LittleEndian, uint32(count))
	for i := range count {
		x := float32(i)
		_ = binary.Write(&b, binary.LittleEndian, [12]float32{0, 0, 1, x, 0, 0, x + 0.5, 0, 0, x, 1, 0})
		b.Write([]byte{0, 0})
	}
	return b.Bytes()
}

func TestRootFrameIsReserved(t *testing.T) {
	test.That(t, RootFrameID, test.ShouldEqual, "root")
	for _, id := range []string{RootFrameID, "wrist_origin"} {
		link := &kinematicsv1.Link{Id: id, MeshPath: "cube-300mm.stl", MeshUnit: kinematicsv1.LengthUnit_LENGTH_UNIT_MILLIMETERS}
		_, err := Build(primitiveSpec(link), testdataFS())
		test.That(t, err, test.ShouldNotBeNil)
		test.That(t, err.Error(), test.ShouldContainSubstring, "reserved")
	}
	spec := &kinematicsv1.KinematicsSpec{
		Name:  "prim",
		Links: []*kinematicsv1.Link{{Id: "a", Primitive: boxPrimitive(1, 1, 1)}},
		Joints: []*kinematicsv1.Joint{{
			Id: RootFrameID, Type: kinematicsv1.JointType_JOINT_TYPE_PRISMATIC, Axis: &commonpb.Vector3{Z: 1},
		}},
	}
	_, err := Build(spec, testdataFS())
	test.That(t, err, test.ShouldNotBeNil)
	test.That(t, err.Error(), test.ShouldContainSubstring, "reserved")
}

func TestPrimitiveLinkRejects(t *testing.T) {
	cases := map[string]*kinematicsv1.Link{
		"neither":       {Id: "a"},
		"both":          {Id: "a", MeshPath: "cube-300mm.stl", Primitive: boxPrimitive(1, 1, 1)},
		"mesh unit":     {Id: "a", Primitive: boxPrimitive(1, 1, 1), MeshUnit: kinematicsv1.LengthUnit_LENGTH_UNIT_METERS},
		"collision":     {Id: "a", Primitive: boxPrimitive(1, 1, 1), Collision: kinematicsv1.CollisionShape_COLLISION_SHAPE_BOX},
		"max triangles": {Id: "a", Primitive: boxPrimitive(1, 1, 1), MaxTriangles: 12},
		"zero box side": {Id: "a", Primitive: boxPrimitive(1, 0, 1)},
		"empty shape":   {Id: "a", Primitive: &kinematicsv1.Primitive{}},
		"short capsule": {Id: "a", Primitive: capsulePrimitive(10, 19)},
		"zero sphere": {Id: "a", Primitive: &kinematicsv1.Primitive{
			Shape: &kinematicsv1.Primitive_Sphere_{Sphere: &kinematicsv1.Primitive_Sphere{}},
		}},
	}
	for name, link := range cases {
		t.Run(name, func(t *testing.T) {
			out, err := Build(primitiveSpec(link), testdataFS())
			test.That(t, err, test.ShouldNotBeNil)
			test.That(t, out, test.ShouldBeNil)
		})
	}
}

func TestPrimitiveLinks(t *testing.T) {
	sphere := &kinematicsv1.Primitive{Shape: &kinematicsv1.Primitive_Sphere_{Sphere: &kinematicsv1.Primitive_Sphere{Radius: 25}}}
	cylinder := &kinematicsv1.Primitive{Shape: &kinematicsv1.Primitive_Cylinder_{Cylinder: &kinematicsv1.Primitive_Cylinder{Radius: 10, Length: 80}}}
	cases := []struct {
		name   string
		prim   *kinematicsv1.Primitive
		extent [3]float64
	}{
		{"box", boxPrimitive(10, 20, 30), [3]float64{10, 20, 30}},
		{"sphere", sphere, [3]float64{50, 50, 50}},
		{"capsule", capsulePrimitive(10, 60), [3]float64{20, 20, 60}},
		{"cylinder", cylinder, [3]float64{20, 20, 80}},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			link := &kinematicsv1.Link{Id: "p", Primitive: tc.prim, Origin: &commonpb.Pose{X: 100, Y: 200, Z: 300}}
			spec := primitiveSpec(link)
			// No sources at all: a primitive link needs no mesh file.
			out, err := Build(spec, fstest.MapFS{})
			test.That(t, err, test.ShouldBeNil)
			report := ValidateSpec(out.Files[ModelFileName], spec)
			test.That(t, report.GetFailures(), test.ShouldBeEmpty)
			test.That(t, report.GetWarnings(), test.ShouldBeEmpty)

			got := linkByID(t, report, "p")
			test.That(t, got.GetShape(), test.ShouldEqual, kinematicsv1.CollisionShape_COLLISION_SHAPE_UNSPECIFIED)
			test.That(t, got.GetTriangles(), test.ShouldEqual, 0)
			test.That(t, got.GetPrimitive().GetShape(), test.ShouldHaveSameTypeAs, tc.prim.GetShape())
			test.That(t, got.GetExtent().GetX(), test.ShouldAlmostEqual, tc.extent[0], 1e-6)
			test.That(t, got.GetExtent().GetY(), test.ShouldAlmostEqual, tc.extent[1], 1e-6)
			test.That(t, got.GetExtent().GetZ(), test.ShouldAlmostEqual, tc.extent[2], 1e-6)

			// Centred on the origin.
			robot := robotModel(t, out.Files[ModelFileName], spec.GetName())
			centers := geometryCenters(t, robot, spec.GetName(), nil)
			assertCenter(t, centers, "p", r3.Vector{X: 100, Y: 200, Z: 300})

			collision, meshes, err := sceneGeometries(spec, fstest.MapFS{})
			test.That(t, err, test.ShouldBeNil)
			frames := sceneFrames(spec, collision, meshes, jointValues(spec, nil, nil))
			test.That(t, len(frames), test.ShouldEqual, 3)
			test.That(t, frames[0].GetReferenceFrame(), test.ShouldEqual, RootFrameID)
			test.That(t, frames[1].GetReferenceFrame(), test.ShouldEqual, "p")
			test.That(t, frames[1].GetPhysicalObject(), test.ShouldNotBeNil)
		})
	}
}

func TestTriangleWarning(t *testing.T) {
	over := TriangleWarningLimit + 10
	sources := fstest.MapFS{"dense.stl": &fstest.MapFile{Data: denseSTL(over)}}
	link := func(maxTriangles uint32) *kinematicsv1.Link {
		return &kinematicsv1.Link{
			Id: "dense", MeshPath: "dense.stl", MeshUnit: kinematicsv1.LengthUnit_LENGTH_UNIT_MILLIMETERS, MaxTriangles: maxTriangles,
		}
	}

	spec := primitiveSpec(link(0))
	out, err := Build(spec, sources)
	test.That(t, err, test.ShouldBeNil)
	report := ValidateSpec(out.Files[ModelFileName], spec)
	test.That(t, report.GetFailures(), test.ShouldBeEmpty)
	got := linkByID(t, report, "dense")
	test.That(t, got.GetTriangles(), test.ShouldEqual, over)
	test.That(t, got.GetOverTriangleLimit(), test.ShouldBeTrue)
	test.That(t, got.GetSuggestedMaxTriangles(), test.ShouldEqual, TriangleWarningLimit)
	test.That(t, report.GetWarnings(), test.ShouldResemble, []string{fmt.Sprintf(
		"link dense: collision mesh has %d triangles, over the limit of %d. Simplify it to %d or fewer.",
		over, TriangleWarningLimit, TriangleWarningLimit)})

	// Decimated to the limit, the link no longer warns.
	spec = primitiveSpec(link(TriangleWarningLimit))
	out, err = Build(spec, sources)
	test.That(t, err, test.ShouldBeNil)
	report = ValidateSpec(out.Files[ModelFileName], spec)
	test.That(t, report.GetFailures(), test.ShouldBeEmpty)
	got = linkByID(t, report, "dense")
	test.That(t, got.GetTriangles(), test.ShouldBeLessThanOrEqualTo, TriangleWarningLimit)
	test.That(t, got.GetOverTriangleLimit(), test.ShouldBeFalse)
	test.That(t, report.GetWarnings(), test.ShouldBeEmpty)
}
