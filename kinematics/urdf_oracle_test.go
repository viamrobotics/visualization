package kinematics

import (
	"encoding/json"
	"math"
	"os"
	"strings"
	"testing"

	"go.viam.com/rdk/referenceframe"
	"go.viam.com/rdk/spatialmath"
	"go.viam.com/test"

	"github.com/viamrobotics/visualization/kinematics/urdf"
)

// oracleTolerance is the agreement, in millimetres, between our model and RDK's URDF loader.
const oracleTolerance = 1e-6

// modelWithOutputFrame reparses config with frame as the model's output frame, so Transform returns
// frame's world pose.
func modelWithOutputFrame(t *testing.T, config referenceframe.ModelConfigJSON, frame string) referenceframe.Model {
	t.Helper()
	config.OutputFrames = []string{frame}
	model, err := config.ParseConfig("oracle")
	test.That(t, err, test.ShouldBeNil)
	return model
}

func requirePosesAgree(t *testing.T, what string, got, want spatialmath.Pose) {
	t.Helper()
	delta := spatialmath.Compose(spatialmath.PoseInverse(want), got)
	if dist := delta.Point().Norm(); dist > oracleTolerance {
		t.Errorf("%s: position differs by %g mm (got %v, want %v)", what, dist, got.Point(), want.Point())
	}
	// The rotation angle between the two orientations. atan2 on the vector part stays accurate near zero,
	// where acos of the scalar part loses half its digits.
	q := delta.Orientation().Quaternion()
	if angle := 2 * math.Atan2(math.Sqrt(q.Imag*q.Imag+q.Jmag*q.Jmag+q.Kmag*q.Kmag), math.Abs(q.Real)); angle > 1e-9 {
		t.Errorf("%s: orientation differs by %g rad", what, angle)
	}
}

// RDK's own URDF loader is the oracle: at each input vector, every joint frame and every link
// geometry of our Build of the Convert output sits where the loader puts it. RDK inputs are radians for
// revolute joints and millimetres for prismatic.
func TestImportedURDFMatchesRDKLoader(t *testing.T) {
	urdfBytes, err := os.ReadFile(serialChainURDF)
	test.That(t, err, test.ShouldBeNil)

	rdkConfig, err := referenceframe.UnmarshalModelXML(urdfBytes, "oracle", nil, nil)
	test.That(t, err, test.ShouldBeNil)

	sources := os.DirFS("urdf/testdata")
	imported, err := urdf.Convert(sources, urdf.Options{URDFPath: "serial-chain.urdf"})
	test.That(t, err, test.ShouldBeNil)
	meshes, err := sourcesFS(imported.Meshes)
	test.That(t, err, test.ShouldBeNil)
	out, err := Build(imported.Spec, meshes)
	test.That(t, err, test.ShouldBeNil)
	var ourConfig referenceframe.ModelConfigJSON
	test.That(t, json.Unmarshal(out.Files[ModelFileName], &ourConfig), test.ShouldBeNil)

	ours, err := ourConfig.ParseConfig("oracle")
	test.That(t, err, test.ShouldBeNil)
	theirs, err := rdkConfig.ParseConfig("oracle")
	test.That(t, err, test.ShouldBeNil)

	joints := []string{"joint1", "joint2", "joint3", "joint4"}
	test.That(t, moveableNames(ours), test.ShouldResemble, joints)
	test.That(t, moveableNames(theirs), test.ShouldResemble, joints)

	vectors := [][]float64{
		{0, 0, 0, 0},
		{0.5, -0.4, 1.1, 40},
		{-1.2, 0.9, -2.0, 150},
		{2.4, 1.7, 2.9, 75},
		{-0.03, -1.4, 0.7, 12.5},
	}
	for i, inputs := range vectors {
		in := inputs
		for _, joint := range joints {
			ourPose, err := modelWithOutputFrame(t, ourConfig, joint).Transform(in)
			test.That(t, err, test.ShouldBeNil)
			theirPose, err := modelWithOutputFrame(t, *rdkConfig, joint).Transform(in)
			test.That(t, err, test.ShouldBeNil)
			requirePosesAgree(t, "vector "+string(rune('0'+i))+" "+joint, ourPose, theirPose)
		}

		ourGeoms := geometriesByLink(t, ours, in)
		theirGeoms := geometriesByLink(t, theirs, in)
		test.That(t, len(ourGeoms), test.ShouldEqual, 5)
		for link, theirGeom := range theirGeoms {
			ourGeom, ok := ourGeoms[link]
			if !ok {
				t.Fatalf("our model has no geometry for link %q", link)
			}
			requirePosesAgree(t, "vector "+string(rune('0'+i))+" link "+link, ourGeom.Pose(), theirGeom.Pose())
		}
	}
}

func moveableNames(model referenceframe.Model) []string {
	names := model.(interface{ MoveableFrameNames() []string }).MoveableFrameNames()
	out := make([]string, len(names))
	for i, name := range names {
		out[i] = strings.TrimPrefix(name, "oracle:")
	}
	return out
}

func geometriesByLink(t *testing.T, model referenceframe.Model, inputs []referenceframe.Input) map[string]spatialmath.Geometry {
	t.Helper()
	geoms, err := model.Geometries(inputs)
	test.That(t, err, test.ShouldBeNil)
	byLink := map[string]spatialmath.Geometry{}
	for _, geom := range geoms.Geometries() {
		byLink[strings.TrimPrefix(geom.Label(), "oracle:")] = geom
	}
	return byLink
}
