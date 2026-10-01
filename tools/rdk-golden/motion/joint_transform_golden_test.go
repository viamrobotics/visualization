package rdkmotion

import (
	"math"
	"testing"

	"github.com/golang/geo/r3"
	"go.viam.com/test"

	"go.viam.com/rdk/referenceframe"
	"go.viam.com/rdk/spatialmath"

	"rdk-golden/goldenfile"
)

// jointTransformGoldenName is read by src/lib/motion/__tests__/jointPoseGolden.spec.ts.
const jointTransformGoldenName = "joint_transform_golden.json"

// goldenAxis is capitalized to match JointConfig's untagged `axis` field, which is the shape a
// JointFrameDescriptor carries it in.
type goldenAxis struct {
	X float64 `json:"X"`
	Y float64 `json:"Y"`
	Z float64 `json:"Z"`
}

// jointTransformGoldenCase records the pose RDK gives one joint at one input: radians for a
// revolute joint, millimetres for a prismatic one.
type jointTransformGoldenCase struct {
	Name  string     `json:"name"`
	Axis  goldenAxis `json:"axis"`
	Value float64    `json:"value"`
	Pose  goldenPose `json:"pose"`
}

type jointTransformGoldenFile struct {
	Source        string                     `json:"source"`
	Rotational    []jointTransformGoldenCase `json:"rotational"`
	Translational []jointTransformGoldenCase `json:"translational"`
}

// jointCase is one joint at one input. expected is the pose the RDK test the case came from
// asserts, and nil for a case added here with no RDK expectation to check against.
type jointCase struct {
	name     string
	axis     r3.Vector
	value    float64
	expected spatialmath.Pose
}

// Transform never reads a joint's limits, so every case gets the same unbounded one.
var unbounded = referenceframe.Limit{Min: math.Inf(-1), Max: math.Inf(1)}

// TestJointTransformGolden is a hand port of: rotationalFrame.Transform and
// translationalFrame.Transform, built through NewRotationalFrame and NewTranslationalFrame, the
// constructors JointConfig.ToFrame calls.
//
// Cases naming an RDK test take their values from referenceframe/frame_test.go.
func TestJointTransformGolden(t *testing.T) {
	golden := jointTransformGoldenFile{
		Source: "go.viam.com/rdk referenceframe NewRotationalFrame and NewTranslationalFrame, Transform",
	}

	for _, testCase := range rotationalCases() {
		t.Run("rotational/"+testCase.name, func(t *testing.T) {
			axis := testCase.axis
			frame, err := referenceframe.NewRotationalFrame(
				"joint", spatialmath.R4AA{RX: axis.X, RY: axis.Y, RZ: axis.Z}, unbounded,
			)
			test.That(t, err, test.ShouldBeNil)

			golden.Rotational = append(golden.Rotational, transformCase(t, frame, testCase))
		})
	}

	for _, testCase := range translationalCases() {
		t.Run("translational/"+testCase.name, func(t *testing.T) {
			frame, err := referenceframe.NewTranslationalFrame("joint", testCase.axis, unbounded)
			test.That(t, err, test.ShouldBeNil)

			golden.Translational = append(golden.Translational, transformCase(t, frame, testCase))
		})
	}

	goldenfile.Write(t, jointTransformGoldenName, golden)
}

func transformCase(t *testing.T, frame referenceframe.Frame, testCase jointCase) jointTransformGoldenCase {
	t.Helper()

	pose, err := frame.Transform([]referenceframe.Input{testCase.value})
	test.That(t, err, test.ShouldBeNil)

	if testCase.expected != nil {
		assertPose(t, pose, testCase.expected)
	}

	return jointTransformGoldenCase{
		Name:  testCase.name,
		Axis:  goldenAxis{X: testCase.axis.X, Y: testCase.axis.Y, Z: testCase.axis.Z},
		Value: testCase.value,
		Pose:  poseOf(pose),
	}
}

func rotationalCases() []jointCase {
	return []jointCase{
		{
			name:     "45 degrees about +X, from TestRevoluteFrame",
			axis:     r3.Vector{X: 1},
			value:    math.Pi / 4,
			expected: spatialmath.NewPoseFromOrientation(&spatialmath.R4AA{Theta: math.Pi / 4, RX: 1}),
		},
		{
			name:  "a quarter turn about +Z",
			axis:  r3.Vector{Z: 1},
			value: math.Pi / 2,
		},
		{
			name:  "a negative angle about +Y",
			axis:  r3.Vector{Y: 1},
			value: -math.Pi / 3,
		},
		{
			name:  "past a half turn about +Z",
			axis:  r3.Vector{Z: 1},
			value: 3 * math.Pi / 2,
		},
		{
			name:  "about TestGeometries' non-unit axis",
			axis:  r3.Vector{X: 2.1, Y: 3.1, Z: 4.1},
			value: 5.5,
		},
		{
			name:  "about a negative axis",
			axis:  r3.Vector{X: 0, Y: -1, Z: 0},
			value: 1.2,
		},
		{
			name:     "at zero",
			axis:     r3.Vector{X: 1, Y: 1},
			value:    0,
			expected: spatialmath.NewZeroPose(),
		},
	}
}

func translationalCases() []jointCase {
	return []jointCase{
		{
			name:     "along a non-unit axis, from TestPrismaticFrame",
			axis:     r3.Vector{X: 3, Y: 4},
			value:    5,
			expected: spatialmath.NewPoseFromPoint(r3.Vector{X: 3, Y: 4}),
		},
		{
			name:     "backwards along +Y",
			axis:     r3.Vector{Y: 1},
			value:    -20,
			expected: spatialmath.NewPoseFromPoint(r3.Vector{Y: -20}),
		},
		{
			name:  "along a long axis, 40 mm",
			axis:  r3.Vector{Z: 10},
			value: 40,
		},
		{
			name:  "along a diagonal",
			axis:  r3.Vector{X: 1, Y: -1, Z: 1},
			value: 12.5,
		},
		{
			name:     "at zero",
			axis:     r3.Vector{X: 1},
			value:    0,
			expected: spatialmath.NewZeroPose(),
		},
	}
}
