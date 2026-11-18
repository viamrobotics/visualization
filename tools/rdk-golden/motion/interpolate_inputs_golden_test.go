package rdkmotion

import (
	"fmt"
	"math"
	"testing"

	"github.com/golang/geo/r3"
	"go.viam.com/test"

	"go.viam.com/rdk/referenceframe"
	"go.viam.com/rdk/spatialmath"

	"rdk-golden/goldenfile"
)

// interpolateInputsGoldenName is read by src/lib/motion/__tests__/interpolateTrajectoryGolden.spec.ts.
const interpolateInputsGoldenName = "interpolate_inputs_golden.json"

// interpolateGoldenCase records the inputs RDK blends one model's joints to at `by`.
type interpolateGoldenCase struct {
	Name         string    `json:"name"`
	From         []float64 `json:"from"`
	To           []float64 `json:"to"`
	By           float64   `json:"by"`
	Interpolated []float64 `json:"interpolated"`
}

type interpolateInputsGoldenFile struct {
	Source string                  `json:"source"`
	Cases  []interpolateGoldenCase `json:"cases"`
}

// interpolateCase blends a serial model built from joints. expected is what the RDK test the case
// came from asserts, and nil for a case added here with no RDK expectation to check against.
type interpolateCase struct {
	name     string
	joints   []jointKind
	from     []float64
	to       []float64
	by       float64
	expected []float64
}

type jointKind int

const (
	revolute jointKind = iota
	prismatic
)

// TestInterpolateInputsGolden is a hand port of: interpolateInputs, reached through
// SimpleModel.Interpolate, which hands each joint's slice of the inputs to that joint's own
// Interpolate. interpolateInputs is unexported, so a serial model is the nearest public caller.
//
// Cases naming an RDK test take their values from referenceframe/input_test.go.
func TestInterpolateInputsGolden(t *testing.T) {
	golden := interpolateInputsGoldenFile{
		Source: "go.viam.com/rdk referenceframe SimpleModel.Interpolate over interpolateInputs",
	}

	for _, testCase := range interpolateCases() {
		t.Run(testCase.name, func(t *testing.T) {
			model := serialModel(t, testCase.joints)

			interpolated, err := model.Interpolate(testCase.from, testCase.to, testCase.by)
			test.That(t, err, test.ShouldBeNil)

			if testCase.expected != nil {
				assertInputs(t, interpolated, testCase.expected)
			}

			golden.Cases = append(golden.Cases, interpolateGoldenCase{
				Name:         testCase.name,
				From:         testCase.from,
				To:           testCase.to,
				By:           testCase.by,
				Interpolated: interpolated,
			})
		})
	}

	goldenfile.Write(t, interpolateInputsGoldenName, golden)
}

// assertInputs compares to a tolerance: `j1+((to-j1)*by)` at by=1 can land an ulp off `to`, as
// "at the end" does.
func assertInputs(t *testing.T, actual, expected []float64) {
	t.Helper()

	test.That(t, actual, test.ShouldHaveLength, len(expected))
	for index, value := range expected {
		test.That(t, actual[index], test.ShouldAlmostEqual, value, rdkTolerance)
	}
}

func serialModel(t *testing.T, joints []jointKind) *referenceframe.SimpleModel {
	t.Helper()

	frames := make([]referenceframe.Frame, 0, len(joints))
	for index, kind := range joints {
		name := fmt.Sprintf("j%d", index)

		var frame referenceframe.Frame
		var err error
		if kind == prismatic {
			frame, err = referenceframe.NewTranslationalFrame(name, r3.Vector{X: 1}, unbounded)
		} else {
			frame, err = referenceframe.NewRotationalFrame(name, spatialmath.R4AA{RZ: 1}, unbounded)
		}
		test.That(t, err, test.ShouldBeNil)

		frames = append(frames, frame)
	}

	model, err := referenceframe.NewSerialModel("arm", frames)
	test.That(t, err, test.ShouldBeNil)

	return model
}

func interpolateCases() []interpolateCase {
	twoRevolute := []jointKind{revolute, revolute}
	sixRevolute := []jointKind{revolute, revolute, revolute, revolute, revolute, revolute}

	return []interpolateCase{
		{
			name:     "halfway, from TestInterpolateValues",
			joints:   twoRevolute,
			from:     []float64{0, 4},
			to:       []float64{8, -8},
			by:       0.5,
			expected: []float64{4, -2},
		},
		{
			name:     "a quarter of the way, from TestInterpolateValues",
			joints:   twoRevolute,
			from:     []float64{0, 4},
			to:       []float64{8, -8},
			by:       0.25,
			expected: []float64{2, 1},
		},
		{
			name:     "at the start",
			joints:   twoRevolute,
			from:     []float64{0.3, -1.1},
			to:       []float64{2.4, 0.9},
			by:       0,
			expected: []float64{0.3, -1.1},
		},
		{
			name:     "at the end",
			joints:   twoRevolute,
			from:     []float64{0.3, -1.1},
			to:       []float64{2.4, 0.9},
			by:       1,
			expected: []float64{2.4, 0.9},
		},
		{
			name:     "straight across ±π, not the short way round",
			joints:   []jointKind{revolute},
			from:     []float64{3},
			to:       []float64{-3},
			by:       0.5,
			expected: []float64{0},
		},
		{
			name:   "a six-joint arm at an uneven fraction",
			joints: sixRevolute,
			from:   []float64{0.1, -0.7, 1.3, -2.9, 0.05, math.Pi},
			to:     []float64{-1.4, 0.2, 0.6, 2.2, -0.35, -math.Pi / 2},
			by:     0.37,
		},
		{
			name:   "a revolute and a prismatic joint in one model",
			joints: []jointKind{revolute, prismatic},
			from:   []float64{0.1, 10},
			to:     []float64{0.5, 50},
			by:     0.3,
		},
		{
			name:   "a joint that does not move",
			joints: twoRevolute,
			from:   []float64{1.25, -0.5},
			to:     []float64{1.25, 0.5},
			by:     0.8,
		},
	}
}
