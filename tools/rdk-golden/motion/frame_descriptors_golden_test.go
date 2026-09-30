package rdkmotion

import (
	"encoding/json"
	"os"
	"path/filepath"
	"testing"

	"github.com/golang/geo/r3"
	"go.viam.com/test"
	"google.golang.org/protobuf/encoding/protojson"

	"go.viam.com/rdk/referenceframe"
	"go.viam.com/rdk/spatialmath"

	"rdk-golden/goldenfile"
)

// frameDescriptorsGoldenName is read by src/lib/motion/__tests__/frameDescriptorsGolden.spec.ts.
const frameDescriptorsGoldenName = "frame_descriptors_golden.json"

// frameDescriptorsGoldenProbe records where RDK puts every frame and geometry at one set of inputs.
type frameDescriptorsGoldenProbe struct {
	Inputs     map[string][]float64  `json:"inputs"`
	Frames     map[string]goldenPose `json:"frames"`
	Geometries map[string]goldenPose `json:"geometries"`
}

// frameDescriptorsGoldenCase carries the scene twice: as FrameSystem.MarshalJSON writes it, the JSON
// buildFrameDescriptors reads out of a plan dump, and as the FrameSystemConfig protos a robot's
// FrameSystemConfig RPC returns, the input frameSystemToPlanFrames reads.
type frameDescriptorsGoldenCase struct {
	Name        string                        `json:"name"`
	FrameSystem json.RawMessage               `json:"frameSystem"`
	Parts       []json.RawMessage             `json:"parts"`
	Probes      []frameDescriptorsGoldenProbe `json:"probes"`
}

type frameDescriptorsGoldenFile struct {
	Source string                       `json:"source"`
	Cases  []frameDescriptorsGoldenCase `json:"cases"`
}

// sceneCase is a frame system built from parts, the way the motion service builds one.
type sceneCase struct {
	name  string
	parts func(t *testing.T) []*referenceframe.FrameSystemPart
}

// TestFrameDescriptorsGolden is a hand port of: FrameSystem.MarshalJSON, the input
// buildFrameDescriptors reads, FrameSystemPart.ToProtobuf, the input frameSystemToPlanFrames reads,
// and FrameSystem.Transform plus FrameSystemGeometries, the world poses both have to compose to.
//
// ToProtobuf is what robot/server builds each entry of the FrameSystemConfig response with.
//
// Model frames are recorded like any other, though buildFrameDescriptors emits no descriptor for
// them. Their pose is only observable in TypeScript through the frames parented to them.
func TestFrameDescriptorsGolden(t *testing.T) {
	golden := frameDescriptorsGoldenFile{
		Source: "go.viam.com/rdk referenceframe NewFrameSystem, FrameSystem.MarshalJSON, FrameSystem.Transform and FrameSystemGeometries",
	}

	for _, testCase := range sceneCases() {
		t.Run(testCase.name, func(t *testing.T) {
			parts := testCase.parts(t)
			fs, err := referenceframe.NewFrameSystem("golden", parts, nil)
			test.That(t, err, test.ShouldBeNil)

			marshaled, err := json.Marshal(fs)
			test.That(t, err, test.ShouldBeNil)

			var names struct {
				Frames map[string]json.RawMessage `json:"frames"`
			}
			test.That(t, json.Unmarshal(marshaled, &names), test.ShouldBeNil)

			probes := []frameDescriptorsGoldenProbe{}
			for _, inputs := range sceneInputs(fs) {
				probes = append(probes, frameDescriptorsGoldenProbe{
					Inputs:     inputs,
					Frames:     framePoses(t, fs, names.Frames, inputs),
					Geometries: geometryPoses(t, fs, inputs),
				})
			}

			golden.Cases = append(golden.Cases, frameDescriptorsGoldenCase{
				Name:        testCase.name,
				FrameSystem: marshaled,
				Parts:       partsJSON(t, parts),
				Probes:      probes,
			})
		})
	}

	goldenfile.Write(t, frameDescriptorsGoldenName, golden)
}

// sceneInputs is every joint at zero, then two configurations that move every joint at once, so a
// frame composed through the wrong parent lands somewhere measurably different.
func sceneInputs(fs *referenceframe.FrameSystem) []map[string][]float64 {
	patterns := []func(index int) float64{
		func(int) float64 { return 0 },
		func(index int) float64 { return probeStep * float64(index+1) },
		func(index int) float64 {
			if index%2 == 0 {
				return 0.35
			}
			return -0.6
		},
	}

	probes := make([]map[string][]float64, 0, len(patterns))
	for _, pattern := range patterns {
		inputs := map[string][]float64{}
		for _, name := range fs.FrameNames() {
			dof := len(fs.Frame(name).DoF())
			if dof == 0 {
				continue
			}
			values := make([]float64, dof)
			for index := range values {
				values[index] = pattern(index)
			}
			inputs[name] = values
		}
		probes = append(probes, inputs)
	}
	return probes
}

func partsJSON(t *testing.T, parts []*referenceframe.FrameSystemPart) []json.RawMessage {
	t.Helper()

	encoded := make([]json.RawMessage, 0, len(parts))
	for _, part := range parts {
		config, err := part.ToProtobuf()
		test.That(t, err, test.ShouldBeNil)

		raw, err := protojson.Marshal(config)
		test.That(t, err, test.ShouldBeNil)
		encoded = append(encoded, raw)
	}
	return encoded
}

func framePoses(
	t *testing.T, fs *referenceframe.FrameSystem, frames map[string]json.RawMessage, inputs map[string][]float64,
) map[string]goldenPose {
	t.Helper()

	linear := referenceframe.FrameSystemInputs(inputs).ToLinearInputs()

	poses := make(map[string]goldenPose, len(frames))
	for name := range frames {
		world, err := fs.Transform(linear, referenceframe.NewZeroPoseInFrame(name), referenceframe.World)
		test.That(t, err, test.ShouldBeNil)
		poses[name] = poseOf(world.(*referenceframe.PoseInFrame).Pose())
	}
	return poses
}

// geometryPoses is keyed by label, which RDK sets to the name of the frame that owns the geometry:
// `arm:upper_arm` for a model link, `cam_origin` for a part's configured geometry. A label the part
// config set is overwritten.
func geometryPoses(t *testing.T, fs *referenceframe.FrameSystem, inputs map[string][]float64) map[string]goldenPose {
	t.Helper()

	geometries, err := referenceframe.FrameSystemGeometries(fs, inputs)
	test.That(t, err, test.ShouldBeNil)

	poses := map[string]goldenPose{}
	for _, inFrame := range geometries {
		for _, geometry := range inFrame.Geometries() {
			_, duplicate := poses[geometry.Label()]
			test.That(t, duplicate, test.ShouldBeFalse)
			poses[geometry.Label()] = poseOf(geometry.Pose())
		}
	}
	return poses
}

func loadModel(t *testing.T, fixture, name string) referenceframe.Model {
	t.Helper()

	raw, err := os.ReadFile(filepath.Join("data", fixture))
	test.That(t, err, test.ShouldBeNil)

	model, err := referenceframe.UnmarshalModelJSON(raw, name)
	test.That(t, err, test.ShouldBeNil)
	return model
}

func box(t *testing.T, center spatialmath.Pose, dims r3.Vector, label string) spatialmath.Geometry {
	t.Helper()

	geometry, err := spatialmath.NewBox(center, dims, label)
	test.That(t, err, test.ShouldBeNil)
	return geometry
}

func sphere(t *testing.T, center spatialmath.Pose, radius float64, label string) spatialmath.Geometry {
	t.Helper()

	geometry, err := spatialmath.NewSphere(center, radius, label)
	test.That(t, err, test.ShouldBeNil)
	return geometry
}

func poseAt(x, y, z float64, orientation spatialmath.Orientation) spatialmath.Pose {
	return spatialmath.NewPose(r3.Vector{X: x, Y: y, Z: z}, orientation)
}

func sceneCases() []sceneCase {
	return []sceneCase{
		{
			name: "an xArm6 on a table, with a camera and a mimic gripper holding a tool on its end effector",
			parts: func(t *testing.T) []*referenceframe.FrameSystemPart {
				return []*referenceframe.FrameSystemPart{
					{
						FrameConfig: referenceframe.NewLinkInFrame(
							referenceframe.World,
							poseAt(500, -200, 0, &spatialmath.OrientationVectorDegrees{OZ: 1, Theta: 30}),
							"table",
							box(t, poseAt(0, 0, -10, nil), r3.Vector{X: 800, Y: 600, Z: 20}, ""),
						),
					},
					{
						FrameConfig: referenceframe.NewLinkInFrame(
							"table",
							poseAt(-100, 50, 0, &spatialmath.OrientationVectorDegrees{OZ: 1, Theta: -90}),
							"arm",
							nil,
						),
						ModelFrame: loadModel(t, "xarm6.json", "arm"),
					},
					{
						FrameConfig: referenceframe.NewLinkInFrame(
							"arm",
							poseAt(0, 60, 40, &spatialmath.OrientationVectorDegrees{OX: 1, Theta: 15}),
							"cam",
							sphere(t, poseAt(0, 0, 25, nil), 20, ""),
						),
					},
					{
						FrameConfig: referenceframe.NewLinkInFrame(
							"arm",
							poseAt(0, 0, 10, nil),
							"gripper",
							nil,
						),
						ModelFrame: loadModel(t, "test_mimic_gripper.json", "gripper"),
					},
					// The gripper declares `tcp` as its output frame, which is not the child of its last
					// joint in the walk. Only a part parented to the gripper can tell the two apart.
					{
						FrameConfig: referenceframe.NewLinkInFrame(
							"gripper",
							poseAt(0, 0, 15, &spatialmath.OrientationVectorDegrees{OY: 1, Theta: 45}),
							"tool",
							sphere(t, poseAt(0, 0, 5, nil), 8, ""),
						),
					},
				}
			},
		},
		{
			name: "a UR5e riding a gantry carriage",
			parts: func(t *testing.T) []*referenceframe.FrameSystemPart {
				return []*referenceframe.FrameSystemPart{
					{
						FrameConfig: referenceframe.NewLinkInFrame(
							referenceframe.World,
							poseAt(0, 0, 1200, &spatialmath.OrientationVectorDegrees{OZ: -1}),
							"gantry",
							nil,
						),
						ModelFrame: loadModel(t, "example_gantry.json", "gantry"),
					},
					{
						FrameConfig: referenceframe.NewLinkInFrame(
							"gantry",
							poseAt(0, 0, 30, nil),
							"ur",
							nil,
						),
						ModelFrame: loadModel(t, "ur5e.json", "ur"),
					},
				}
			},
		},
	}
}
