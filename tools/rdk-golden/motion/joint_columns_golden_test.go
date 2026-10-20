package rdkmotion

import (
	"encoding/json"
	"math"
	"os"
	"path/filepath"
	"testing"

	"github.com/golang/geo/r3"
	"go.viam.com/test"

	"go.viam.com/rdk/referenceframe"

	"rdk-golden/goldenfile"
)

// jointColumnsGoldenName is read by src/lib/motion/__tests__/jointColumnsGolden.spec.ts.
const jointColumnsGoldenName = "joint_columns_golden.json"

// componentName is what every model is added to the frame system as, so its internal frames are
// `arm:<id>`.
const componentName = "arm"

// probeStep is how far apart the one-hot probe values sit. Small enough that no mimic multiplier
// below pushes a revolute joint past π, where reading its angle back off a pose would wrap.
const probeStep = 0.1

// jointColumnsGoldenProbe records the value RDK drives every joint with at one input vector.
type jointColumnsGoldenProbe struct {
	Inputs []float64          `json:"inputs"`
	Joints map[string]float64 `json:"joints"`
}

// jointColumnsGoldenCase carries the model config verbatim, so the TypeScript side reads the same
// bytes RDK parsed.
type jointColumnsGoldenCase struct {
	Name   string                    `json:"name"`
	Model  json.RawMessage           `json:"model"`
	DoF    int                       `json:"dof"`
	Probes []jointColumnsGoldenProbe `json:"probes"`
}

type jointColumnsGoldenFile struct {
	Source string                   `json:"source"`
	Cases  []jointColumnsGoldenCase `json:"cases"`
}

// modelCase is a model config, from a fixture copied out of RDK or written inline. expectedDoF
// is what the RDK test that uses the fixture asserts, and 0 where no RDK test says.
type modelCase struct {
	name        string
	fixture     string
	inline      string
	expectedDoF int
}

// TestJointColumnsGolden is a hand port of: the input schema NewModelWithMimics builds by walking
// bfsFrameNames and skipping mimic frames, plus the mimic mappings buildMimicMappings resolves.
// Neither is exported, so the model is flattened into a frame system and each joint's pose is read
// relative to its parent there. That pose is the joint's own Transform at the value RDK derived
// for it, which is read back off.
//
// Fixtures in data/ are byte-identical copies of referenceframe/testfiles and
// components/arm/kinematics.
func TestJointColumnsGolden(t *testing.T) {
	golden := jointColumnsGoldenFile{
		Source: "go.viam.com/rdk referenceframe UnmarshalModelJSON, FrameSystem.AddFrame and FrameSystem.Transform",
	}

	for _, testCase := range modelCases() {
		t.Run(testCase.name, func(t *testing.T) {
			raw := testCase.configBytes(t)

			model, err := referenceframe.UnmarshalModelJSON(raw, componentName)
			test.That(t, err, test.ShouldBeNil)

			dof := len(model.DoF())
			if testCase.expectedDoF != 0 {
				test.That(t, dof, test.ShouldEqual, testCase.expectedDoF)
			}

			fs := referenceframe.NewEmptyFrameSystem("golden")
			err = fs.AddFrame(model, fs.World())
			test.That(t, err, test.ShouldBeNil)

			joints := jointsOf(t, raw)

			probes := make([]jointColumnsGoldenProbe, 0, dof+1)
			for _, inputs := range probeInputs(dof) {
				probes = append(probes, jointColumnsGoldenProbe{
					Inputs: inputs,
					Joints: jointValues(t, fs, joints, inputs),
				})
			}

			golden.Cases = append(golden.Cases, jointColumnsGoldenCase{
				Name:   testCase.name,
				Model:  raw,
				DoF:    dof,
				Probes: probes,
			})
		})
	}

	goldenfile.Write(t, jointColumnsGoldenName, golden)
}

func (c modelCase) configBytes(t *testing.T) []byte {
	t.Helper()

	if c.inline != "" {
		return []byte(c.inline)
	}

	raw, err := os.ReadFile(filepath.Join("data", c.fixture))
	test.That(t, err, test.ShouldBeNil)
	return raw
}

// jointConfig is the part of a JointConfig needed to read a joint's value back off its pose.
type jointConfig struct {
	ID     string `json:"id"`
	Type   string `json:"type"`
	Parent string `json:"parent"`
	Axis   struct {
		X float64 `json:"x"`
		Y float64 `json:"y"`
		Z float64 `json:"z"`
	} `json:"axis"`
}

func jointsOf(t *testing.T, raw []byte) []jointConfig {
	t.Helper()

	var config struct {
		Joints []jointConfig `json:"joints"`
	}
	test.That(t, json.Unmarshal(raw, &config), test.ShouldBeNil)
	return config.Joints
}

// probeInputs is every input at zero, which exposes mimic offsets, then one input vector per
// column with only that column set. A distinct value per column is what tells columns apart.
func probeInputs(dof int) [][]float64 {
	probes := [][]float64{make([]float64, dof)}
	for column := range dof {
		inputs := make([]float64, dof)
		inputs[column] = probeStep * float64(column+1)
		probes = append(probes, inputs)
	}
	return probes
}

// jointValues reads each joint's value off its pose relative to its parent. Only joints whose
// parent is a declared link are read, since that is the only parent with a namespaced name.
func jointValues(
	t *testing.T, fs *referenceframe.FrameSystem, joints []jointConfig, inputs []float64,
) map[string]float64 {
	t.Helper()

	linear := referenceframe.FrameSystemInputs{componentName: inputs}.ToLinearInputs()

	values := make(map[string]float64, len(joints))
	for _, joint := range joints {
		frame := componentName + ":" + joint.ID
		parent := componentName + ":" + joint.Parent

		local, err := fs.Transform(linear, referenceframe.NewZeroPoseInFrame(frame), parent)
		test.That(t, err, test.ShouldBeNil)

		pose := local.(*referenceframe.PoseInFrame).Pose()
		axis := r3.Vector{X: joint.Axis.X, Y: joint.Axis.Y, Z: joint.Axis.Z}.Normalize()

		if joint.Type == referenceframe.PrismaticJoint {
			values[joint.ID] = pose.Point().Dot(axis)
			continue
		}

		// AxisAngles reports a non-negative angle about whichever direction the rotation is, so the
		// sign comes from whether that direction agrees with the joint's own axis.
		rotation := pose.Orientation().AxisAngles()
		direction := r3.Vector{X: rotation.RX, Y: rotation.RY, Z: rotation.RZ}
		values[joint.ID] = math.Copysign(rotation.Theta, direction.Dot(axis))
	}
	return values
}

func modelCases() []modelCase {
	return []modelCase{
		{
			name:        "the mimic gripper, from TestMimicGripperModel",
			fixture:     "test_mimic_gripper.json",
			expectedDoF: 1,
		},
		{
			name:        "the mimic serial arm, from TestMimicSerialModel",
			fixture:     "test_mimic_serial.json",
			expectedDoF: 2,
		},
		{
			name:        "the example gantry",
			fixture:     "example_gantry.json",
			expectedDoF: 1,
		},
		{
			name:        "the xArm6, from TestParseJSONFile",
			fixture:     "xarm6.json",
			expectedDoF: 6,
		},
		{
			name:        "the UR5e, from TestParseJSONFile",
			fixture:     "ur5e.json",
			expectedDoF: 6,
		},
		{
			name:        "mimics with offsets and a unit multiplier left unset or zero",
			inline:      mimicOffsetModel,
			expectedDoF: 2,
		},
		{
			name:        "a mimic of a mimic",
			inline:      mimicChainModel,
			expectedDoF: 1,
		},
		{
			name:        "a branched model declared out of walk order",
			inline:      branchedModel,
			expectedDoF: 3,
		},
	}
}

// mimicOffsetModel's j2 leaves its multiplier unset and j4 sets it to 0, both of which
// EffectiveMultiplier reads as 1. j3 sits below a mimic in the walk, so it takes column 1, not 2.
const mimicOffsetModel = `{
	"name": "mimic_offset",
	"kinematic_param_type": "SVA",
	"links": [
		{"id": "base", "parent": "world"},
		{"id": "l1", "parent": "j1", "translation": {"x": 0, "y": 0, "z": 100}},
		{"id": "l2", "parent": "j2", "translation": {"x": 0, "y": 0, "z": 100}},
		{"id": "l3", "parent": "j3", "translation": {"x": 0, "y": 0, "z": 100}},
		{"id": "tip", "parent": "j4", "translation": {"x": 0, "y": 0, "z": 100}}
	],
	"joints": [
		{"id": "j1", "type": "revolute", "parent": "base", "axis": {"x": 0, "y": 1, "z": 0}, "min": -180, "max": 180},
		{"id": "j2", "type": "revolute", "parent": "l1", "axis": {"x": 0, "y": 1, "z": 0}, "mimic": {"joint": "j1", "offset": 0.25}},
		{"id": "j3", "type": "revolute", "parent": "l2", "axis": {"x": 0, "y": 1, "z": 0}, "min": -180, "max": 180},
		{"id": "j4", "type": "revolute", "parent": "l3", "axis": {"x": 0, "y": 1, "z": 0}, "mimic": {"joint": "j3", "multiplier": 0, "offset": -0.1}}
	]
}`

// mimicChainModel declares j3 before either joint it depends on, so the chain has to be resolved
// rather than read in declaration order.
const mimicChainModel = `{
	"name": "mimic_chain",
	"kinematic_param_type": "SVA",
	"links": [
		{"id": "base", "parent": "world"},
		{"id": "l1", "parent": "j1", "translation": {"x": 0, "y": 0, "z": 100}},
		{"id": "l2", "parent": "j2", "translation": {"x": 0, "y": 0, "z": 100}},
		{"id": "tip", "parent": "j3", "translation": {"x": 0, "y": 0, "z": 100}}
	],
	"joints": [
		{"id": "j3", "type": "revolute", "parent": "l2", "axis": {"x": 1, "y": 0, "z": 0}, "mimic": {"joint": "j2", "multiplier": -0.5, "offset": 0.2}},
		{"id": "j1", "type": "revolute", "parent": "base", "axis": {"x": 1, "y": 0, "z": 0}, "min": -180, "max": 180},
		{"id": "j2", "type": "revolute", "parent": "l1", "axis": {"x": 1, "y": 0, "z": 0}, "mimic": {"joint": "j1", "multiplier": 2, "offset": 0.1}}
	]
}`

// branchedModel declares b before a and the deep a2 first of all. The walk sorts siblings
// alphabetically and finishes each depth before the next, so it numbers them a, b, a2.
const branchedModel = `{
	"name": "branched",
	"kinematic_param_type": "SVA",
	"output_frames": ["a2_tip"],
	"links": [
		{"id": "base", "parent": "world"},
		{"id": "a_link", "parent": "a_joint", "translation": {"x": 0, "y": 0, "z": 50}},
		{"id": "b_tip", "parent": "b_joint", "translation": {"x": 0, "y": 0, "z": 50}},
		{"id": "a2_tip", "parent": "a2_joint", "translation": {"x": 0, "y": 0, "z": 50}}
	],
	"joints": [
		{"id": "a2_joint", "type": "prismatic", "parent": "a_link", "axis": {"x": 0, "y": 0, "z": 1}, "min": -100, "max": 100},
		{"id": "b_joint", "type": "revolute", "parent": "base", "axis": {"x": 0, "y": 0, "z": 1}, "min": -180, "max": 180},
		{"id": "a_joint", "type": "revolute", "parent": "base", "axis": {"x": 1, "y": 0, "z": 0}, "min": -180, "max": 180}
	]
}`
