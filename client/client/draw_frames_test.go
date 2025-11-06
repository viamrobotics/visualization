package client

import (
	"testing"

	"github.com/golang/geo/r3"
	"go.viam.com/rdk/referenceframe"
	"go.viam.com/rdk/spatialmath"
	"go.viam.com/test"
)

func TestDrawFrames(t *testing.T) {
	t.Run("DrawFrames", func(t *testing.T) {
		axesFrame, err := referenceframe.NewStaticFrame("DrawFrames Axes", spatialmath.NewPose(
			r3.Vector{X: 1001, Y: 1, Z: 1},
			&spatialmath.OrientationVectorDegrees{Theta: 45, OX: 0, OY: 0, OZ: 1},
		))

		test.That(t, err, test.ShouldBeNil)

		sphere, err := spatialmath.NewSphere(
			spatialmath.NewPose(
				r3.Vector{X: 0, Y: 0, Z: 0},
				&spatialmath.OrientationVectorDegrees{Theta: 0, OX: 0, OY: 0, OZ: 1},
			),
			100,
			"",
		)
		test.That(t, err, test.ShouldBeNil)

		sphereFrame, err := referenceframe.NewStaticFrameWithGeometry(
			"DrawFrames Sphere",
			spatialmath.NewPose(
				r3.Vector{X: 1501, Y: 0, Z: 0},
				&spatialmath.OrientationVectorDegrees{Theta: 0, OX: 0, OY: 0, OZ: 1},
			),
			sphere,
		)
		test.That(t, err, test.ShouldBeNil)

		capsule, err := spatialmath.NewCapsule(
			spatialmath.NewPose(
				r3.Vector{X: 0, Y: 0, Z: 0},
				&spatialmath.OrientationVectorDegrees{Theta: 0, OX: 0, OY: 0, OZ: 1},
			),

			102,
			300,
			"DrawGeometries Capsule",
		)
		capsuleFrame, err := referenceframe.NewStaticFrameWithGeometry("DrawFrames Capsule", spatialmath.NewPose(
			r3.Vector{X: 2002, Y: 3, Z: 200},
			&spatialmath.OrientationVectorDegrees{Theta: 90, OX: 1, OY: 0, OZ: 1},
		), capsule)
		test.That(t, err, test.ShouldBeNil)

		frames := []referenceframe.Frame{axesFrame, sphereFrame, capsuleFrame}

		test.That(t, DrawFrames(frames), test.ShouldBeNil)
	})
}
