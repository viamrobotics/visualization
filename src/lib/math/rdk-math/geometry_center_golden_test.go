package rdkmath

import (
	"encoding/json"
	"testing"

	"github.com/golang/geo/r3"
	"go.viam.com/test"

	sm "go.viam.com/rdk/spatialmath"
)

// geometryCenterGoldenName is read by src/lib/math/__tests__/spatialJsonGolden.spec.ts.
const geometryCenterGoldenName = "geometry_center_golden.json"

type goldenVec3 struct {
	X float64 `json:"X"`
	Y float64 `json:"Y"`
	Z float64 `json:"Z"`
}

// goldenPose is a Pose as src/lib/math/pose.ts carries one: millimetres with theta in degrees.
type goldenPose struct {
	X     float64 `json:"x"`
	Y     float64 `json:"y"`
	Z     float64 `json:"z"`
	OX    float64 `json:"oX"`
	OY    float64 `json:"oY"`
	OZ    float64 `json:"oZ"`
	Theta float64 `json:"theta"`
}

// A translation or orientation the wire leaves out is an omitted key, not a null, so the fields
// that can be absent are omitempty. That keeps the golden a faithful record of the shape the port
// actually receives, and keeps the reader from having to bridge null to undefined.
type geometryCenterGoldenCase struct {
	Name                string          `json:"name"`
	GeometryTranslation *goldenVec3     `json:"geometryTranslation,omitempty"`
	GeometryOrientation json.RawMessage `json:"geometryOrientation,omitempty"`
	FrameTranslation    *goldenVec3     `json:"frameTranslation,omitempty"`
	FrameOrientation    json.RawMessage `json:"frameOrientation,omitempty"`
	Center              *goldenPose     `json:"center"`
}

type geometryCenterGoldenFile struct {
	Source string                     `json:"source"`
	Cases  []geometryCenterGoldenCase `json:"cases"`
}

type posedInput struct {
	translation *goldenVec3
	orientation json.RawMessage
}

type geometryCenterCase struct {
	name     string
	frame    posedInput
	geometry posedInput
	expected *goldenPose
}

// TestGeometryCenterGolden pins spatialmath.PoseBetween, which is what geometryCenterInFrame in
// src/lib/math/spatialJson.ts computes: the geometry's pose expressed in its frame's coordinates,
// undoing the frame's own pose so a scene graph can re-apply it without doubling.
//
// PoseBetween is documented as "if PoseBetween(a, b) = c, then Compose(a, c) = b", so every case
// asserts that round trip as well as its literal. The round trip is RDK's own stated contract and
// holds independently of whether a case's expectation was copied from a test or frozen.
//
// RDK checks equalities based on the Point positions. The frame system tests that state
// these values compare with PoseAlmostCoincident, which is R3VectorAlmostEqual on the points alone,
// so the orientations they write down are never asserted and are not evidence of anything. One of
// them, TestFrameTransform, in fact records a rotation PoseBetween does not produce.

func TestGeometryCenterGolden(t *testing.T) {
	testCases := geometryCenterCases()

	golden := geometryCenterGoldenFile{
		Source: "go.viam.com/rdk spatialmath.PoseBetween",
		Cases:  make([]geometryCenterGoldenCase, 0, len(testCases)),
	}

	for _, testCase := range testCases {
		t.Run(testCase.name, func(t *testing.T) {
			framePose := poseOf(t, testCase.frame)
			geometryPose := poseOf(t, testCase.geometry)

			between := sm.PoseBetween(framePose, geometryPose)
			center := snapshotPose(between)

			assertPose(t, center, testCase.expected)
			test.That(t, sm.PoseAlmostEqual(sm.Compose(framePose, between), geometryPose), test.ShouldBeTrue)

			golden.Cases = append(golden.Cases, geometryCenterGoldenCase{
				Name:                testCase.name,
				GeometryTranslation: testCase.geometry.translation,
				GeometryOrientation: testCase.geometry.orientation,
				FrameTranslation:    testCase.frame.translation,
				FrameOrientation:    testCase.frame.orientation,
				Center:              center,
			})
		})
	}

	writeGolden(t, geometryCenterGoldenName, golden)
}

func geometryCenterCases() []geometryCenterCase {
	return []geometryCenterCase{
		{
			name:     "both poses left entirely unset",
			frame:    posedInput{},
			geometry: posedInput{},
			// nothing to undo, so the geometry stays at its frame's origin
			expected: poseAt(0, 0, 0, 0, 0, 1, 0),
		},
		{
			name:     "a geometry coincident with its frame, both rotated the same way",
			frame:    posedInput{translation: vec3(7, -2, 11), orientation: raw(`{"type":"ov_degrees","value":{"th":35,"x":0,"y":1,"z":0}}`)},
			geometry: posedInput{translation: vec3(7, -2, 11), orientation: raw(`{"type":"ov_degrees","value":{"th":35,"x":0,"y":1,"z":0}}`)},
			// the frame's pose cancels exactly, which is the invariant the whole function exists for
			expected: poseAt(0, 0, 0, 0, 0, 1, 0),
		},
		{
			name:     "a frame turned half a circle about +Z, from TestSimpleFrameTranslationWithRotation",
			frame:    posedInput{translation: vec3(0, 3, 0), orientation: raw(`{"type":"axis_angles","value":{"th":3.141592653589793,"x":0,"y":0,"z":1}}`)},
			geometry: posedInput{translation: vec3(1, 3, 0)},
			expected: poseAt(-1, -6.123233995736757e-17, 0, 0, 0, 1, -180),
		},
		{
			name:     "a static frame offset along +Y, from TestGeometries",
			frame:    posedInput{translation: vec3(0, 10, 0)},
			geometry: posedInput{},
			expected: poseAt(0, -10, 0, 0, 0, 1, 0),
		},
		{
			name:     "a frame parked far away to prove its pose is undone, from TestGeomtriesTransform",
			frame:    posedInput{translation: vec3(1000, 1000, 1000)},
			geometry: posedInput{translation: vec3(5, 0, 0)},
			expected: poseAt(-995, -1000, -1000, 0, 0, 1, 0),
		},
		{
			name:     "a frame turned a quarter circle about +Z, from TestFrameTransform",
			frame:    posedInput{translation: vec3(5, 1, 0), orientation: raw(`{"type":"axis_angles","value":{"th":1.5707963267948966,"x":0,"y":0,"z":1}}`)},
			geometry: posedInput{translation: vec3(5, 7, 0)},
			expected: poseAt(5.999999999999999, 1.7517292719762014e-15, 0, 0, 0, 1, -89.99999999999999),
		},
		{
			name:     "a frame pointing along +Y, from TestBasicPoseConstruction",
			frame:    posedInput{translation: vec3(1, 2, 3), orientation: raw(`{"type":"ov_radians","value":{"th":1.5707963267948966,"x":0,"y":1,"z":0}}`)},
			geometry: posedInput{translation: vec3(2, 3, 4)},
			expected: poseAt(-0.9999999999999999, 0.9999999999999998, 1, -1.2449156634005058e-16, 1, 1.9967346175427393e-16, 90.00000000000001),
		},

		{
			name:     "both halves rotated, so neither the offset nor the rotation cancels",
			frame:    posedInput{translation: vec3(1, 2, 3), orientation: raw(`{"type":"ov_degrees","value":{"th":30,"x":0,"y":0,"z":1}}`)},
			geometry: posedInput{translation: vec3(4, 5, 6), orientation: raw(`{"type":"ov_degrees","value":{"th":45,"x":1,"y":0,"z":0}}`)},
			expected: poseAt(4.098076211353316, 1.0980762113533156, 2.9999999999999996, 0.8660254037844386, -0.4999999999999999, 1.4431117214752078e-16, 45.00000000000001),
		},
		{
			name:     "a rotation with no offset at all, isolating the orientation half",
			frame:    posedInput{orientation: raw(`{"type":"ov_degrees","value":{"th":-60,"x":1,"y":2,"z":3}}`)},
			geometry: posedInput{orientation: raw(`{"type":"ov_degrees","value":{"th":25,"x":0,"y":-1,"z":0}}`)},
			expected: poseAt(0, 0, 0, 0.02872975182042368, -0.844665801158098, -0.5345224838248485, 43.43494882292202),
		},
		{
			name:     "an offset with no rotation at all, isolating the translation half",
			frame:    posedInput{translation: vec3(-4, 8, 16)},
			geometry: posedInput{translation: vec3(1, -1, 2)},
			expected: poseAt(5, -9, -14, 0, 0, 1, 0),
		},
		{
			name:     "a frame given euler angles, which the port reads through a different arm",
			frame:    posedInput{translation: vec3(2, 0, -3), orientation: raw(`{"type":"euler_angles","value":{"roll":0.3,"pitch":-0.2,"yaw":1.1}}`)},
			geometry: posedInput{translation: vec3(5, 5, 5), orientation: raw(`{"type":"euler_angles","value":{"roll":0,"pitch":0,"yaw":0.5}}`)},
			expected: poseAt(7.29023057931506, 1.5880012515651192, 6.506211656981909, 0.19866933079506124, 0.28962947762551555, 0.9362933635841995, -91.66710860682863),
		},
		{
			name:     "a frame given a quaternion, which the port reads through a different arm",
			frame:    posedInput{translation: vec3(0, 1, 0), orientation: raw(`{"type":"quaternion","value":{"w":0.4,"x":0.1,"y":0.2,"z":0.3}}`)},
			geometry: posedInput{translation: vec3(0, 2, 0), orientation: raw(`{"type":"quaternion","value":{"w":0.7071067811865476,"x":0.7071067811865476,"y":0,"z":0}}`)},
			expected: poseAt(0.9333333333333333, 0.33333333333333326, 0.13333333333333325, -0.9333333333333332, -0.3333333333333333, -0.13333333333333328, 137.72631099390628),
		},
		{
			name:     "a geometry whose orientation is absent while its frame carries one",
			frame:    posedInput{translation: vec3(3, 3, 3), orientation: raw(`{"type":"ov_degrees","value":{"th":90,"x":0,"y":0,"z":-1}}`)},
			geometry: posedInput{translation: vec3(6, 0, 0)},
			expected: poseAt(-3, 2.999999999999999, 3.0000000000000004, -1.7849983108897483e-32, 1.2246467991473515e-16, -1, 89.99999999999999),
		},
	}
}

// poseOf builds the RDK pose a translation plus orientation config describes, the same way
// referenceframe.LinkConfig.Pose does: NewPose when an orientation is given, NewPoseFromPoint when
// it is absent.
func poseOf(t *testing.T, input posedInput) sm.Pose {
	t.Helper()

	point := r3.Vector{}
	if input.translation != nil {
		point = r3.Vector{X: input.translation.X, Y: input.translation.Y, Z: input.translation.Z}
	}

	if input.orientation == nil {
		return sm.NewPoseFromPoint(point)
	}

	config := sm.OrientationConfig{}
	err := json.Unmarshal(input.orientation, &config)
	test.That(t, err, test.ShouldBeNil)

	orientation, err := config.ParseConfig()
	test.That(t, err, test.ShouldBeNil)

	return sm.NewPose(point, orientation)
}

func snapshotPose(p sm.Pose) *goldenPose {
	point := p.Point()
	ovd := p.Orientation().OrientationVectorDegrees()

	return &goldenPose{X: point.X, Y: point.Y, Z: point.Z, OX: ovd.OX, OY: ovd.OY, OZ: ovd.OZ, Theta: ovd.Theta}
}

func assertPose(t *testing.T, actual, expected *goldenPose) {
	t.Helper()

	test.That(t, expected, test.ShouldNotBeNil)
	test.That(t, actual.X, test.ShouldAlmostEqual, expected.X, quaternionTolerance)
	test.That(t, actual.Y, test.ShouldAlmostEqual, expected.Y, quaternionTolerance)
	test.That(t, actual.Z, test.ShouldAlmostEqual, expected.Z, quaternionTolerance)
	test.That(t, actual.OX, test.ShouldAlmostEqual, expected.OX, quaternionTolerance)
	test.That(t, actual.OY, test.ShouldAlmostEqual, expected.OY, quaternionTolerance)
	test.That(t, actual.OZ, test.ShouldAlmostEqual, expected.OZ, quaternionTolerance)
	test.That(t, actual.Theta, test.ShouldAlmostEqual, expected.Theta, quaternionTolerance)
}

func vec3(x, y, z float64) *goldenVec3 {
	return &goldenVec3{X: x, Y: y, Z: z}
}

func poseAt(x, y, z, oX, oY, oZ, theta float64) *goldenPose {
	return &goldenPose{X: x, Y: y, Z: z, OX: oX, OY: oY, OZ: oZ, Theta: theta}
}
