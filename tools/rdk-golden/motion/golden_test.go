package rdkmotion

import (
	"testing"

	"go.viam.com/test"

	"go.viam.com/rdk/spatialmath"
)

// RDK's results come back through float arithmetic, so "equal to the RDK test's own
// expectation" means equal to this many places.
const rdkTolerance = 1e-9

// goldenQuaternion spells out a quaternion's components by name. Three.js orders them (x, y, z, w)
// and RDK writes the scalar first, so neither positional order is safe to assume.
type goldenQuaternion struct {
	W float64 `json:"w"`
	X float64 `json:"x"`
	Y float64 `json:"y"`
	Z float64 `json:"z"`
}

type goldenPoint struct {
	X float64 `json:"x"`
	Y float64 `json:"y"`
	Z float64 `json:"z"`
}

// goldenPose is a spatialmath.Pose in millimetres, with its orientation as a quaternion because
// that is the one encoding both sides can compare without a convention to agree on first.
type goldenPose struct {
	Point      goldenPoint      `json:"point"`
	Quaternion goldenQuaternion `json:"quaternion"`
}

func poseOf(pose spatialmath.Pose) goldenPose {
	point := pose.Point()
	q := pose.Orientation().Quaternion()

	return goldenPose{
		Point:      goldenPoint{X: point.X, Y: point.Y, Z: point.Z},
		Quaternion: goldenQuaternion{W: q.Real, X: q.Imag, Y: q.Jmag, Z: q.Kmag},
	}
}

func assertPose(t *testing.T, actual, expected spatialmath.Pose) {
	t.Helper()

	test.That(t, spatialmath.PoseAlmostEqualEps(actual, expected, rdkTolerance), test.ShouldBeTrue)
}
