package kinematics

import (
	"bytes"
	"encoding/binary"
	"math"
	"path/filepath"
	"testing"
	"testing/fstest"

	"github.com/google/uuid"
	"go.viam.com/test"

	kinematicsv1 "github.com/viamrobotics/visualization/kinematics/v1"
)

// offCenterCubeSTL is a binary STL of a 300 mm cube spanning z 0..300, so its box center is offset by 150.
func offCenterCubeSTL() []byte {
	corner := func(i int) [3]float32 {
		var c [3]float32
		for axis := range 3 {
			if i>>axis&1 == 1 {
				c[axis] = 300
			}
		}
		return c
	}
	// Two triangles per face, as corner index triples.
	tris := [][3]int{
		{0, 2, 1}, {1, 2, 3}, {4, 5, 6}, {5, 7, 6}, {0, 1, 4}, {1, 5, 4},
		{2, 6, 3}, {3, 6, 7}, {0, 4, 2}, {2, 4, 6}, {1, 3, 5}, {3, 7, 5},
	}
	var buf bytes.Buffer
	buf.Write(make([]byte, 80))
	_ = binary.Write(&buf, binary.LittleEndian, uint32(len(tris)))
	for _, tri := range tris {
		_ = binary.Write(&buf, binary.LittleEndian, [3]float32{})
		for _, idx := range tri {
			_ = binary.Write(&buf, binary.LittleEndian, corner(idx))
		}
		buf.Write([]byte{0, 0})
	}
	return buf.Bytes()
}

func TestStableUUID(t *testing.T) {
	test.That(t, len(stableUUID("a")), test.ShouldEqual, 16)
	test.That(t, bytes.Equal(stableUUID("a"), stableUUID("a")), test.ShouldBeTrue)
	test.That(t, bytes.Equal(stableUUID("a"), stableUUID("b")), test.ShouldBeFalse)
}

func TestSceneFramesBoxCenter(t *testing.T) {
	spec, err := LoadSpec(filepath.Join("testdata", SpecFileName))
	test.That(t, err, test.ShouldBeNil)
	spec.Links = spec.Links[:1]
	spec.Links[0].MeshPath = "corner-cube.stl"
	spec.Links[0].Collision = kinematicsv1.CollisionShape_COLLISION_SHAPE_BOX
	sources := fstest.MapFS{"corner-cube.stl": &fstest.MapFile{Data: offCenterCubeSTL()}}
	collision, _, err := sceneGeometries(spec, sources)
	test.That(t, err, test.ShouldBeNil)
	frames := sceneFrames(spec, collision, nil, jointValues(spec, nil, nil))
	test.That(t, len(frames), test.ShouldEqual, 3)

	part := frames[1]
	test.That(t, part.GetReferenceFrame(), test.ShouldEqual, "frame")
	test.That(t, part.GetPoseInObserverFrame().GetReferenceFrame(), test.ShouldEqual, RootFrameID)
	// The part carries the origin, and the box's own center is its offset within the part.
	test.That(t, part.GetPoseInObserverFrame().GetPose().GetZ(), test.ShouldEqual, 150)
	box := part.GetPhysicalObject().GetBox()
	test.That(t, box, test.ShouldNotBeNil)
	dims := box.GetDimsMm()
	for _, d := range []float64{dims.GetX(), dims.GetY(), dims.GetZ()} {
		test.That(t, math.Abs(d-300), test.ShouldBeLessThan, 1e-3)
	}
	test.That(t, part.GetPhysicalObject().GetCenter().GetZ(), test.ShouldAlmostEqual, 150, 1e-3)
	test.That(t, frames[2].GetReferenceFrame(), test.ShouldEqual, "tcp")
	test.That(t, frames[2].GetPhysicalObject(), test.ShouldBeNil)
}

func TestSceneFramesMeshCenterIsIdentity(t *testing.T) {
	spec, err := LoadSpec(filepath.Join("testdata", SpecFileName))
	test.That(t, err, test.ShouldBeNil)
	collision, _, err := sceneGeometries(spec, testdataFS())
	test.That(t, err, test.ShouldBeNil)
	frames := sceneFrames(spec, collision, nil, nil)
	byFrame := transformsByFrame(frames)
	test.That(t, byFrame["frame"].GetPhysicalObject().GetMesh(), test.ShouldNotBeNil)
	test.That(t, byFrame["frame"].GetPhysicalObject().GetCenter().GetZ(), test.ShouldEqual, 0)
	test.That(t, byFrame["frame"].GetPoseInObserverFrame().GetPose().GetZ(), test.ShouldEqual, 150)
	test.That(t, byFrame["cup"].GetPoseInObserverFrame().GetPose().GetZ(), test.ShouldEqual, 350)
}

// The frontend hardcodes these ids for the root and TCP frames, so they must not drift.
func TestStableUUIDPinsFrontendFrames(t *testing.T) {
	for frame, want := range map[string]string{
		RootFrameID: "6305ff31-7a66-5dd5-b656-75cb312f08d6",
		TCPFrameID:  "f30a312b-6ec2-55ac-9539-3ae21322fe94",
	} {
		id, err := uuid.FromBytes(stableUUID(frame))
		test.That(t, err, test.ShouldBeNil)
		test.That(t, id.String(), test.ShouldEqual, want)
	}
}
