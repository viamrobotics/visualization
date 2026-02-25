package api

import (
	"testing"

	"github.com/golang/geo/r3"
	"github.com/viam-labs/motion-tools/draw"
	"go.viam.com/rdk/referenceframe"
	"go.viam.com/rdk/spatialmath"
	"go.viam.com/test"
)

func TestDrawFrames(t *testing.T) {
	startTestServer(t)
	defer stopTestServer()

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
			"Capsule",
		)
		test.That(t, err, test.ShouldBeNil)

		capsuleFrame, err := referenceframe.NewStaticFrameWithGeometry("DrawFrames Capsule", spatialmath.NewPose(
			r3.Vector{X: 2002, Y: 3, Z: 200},
			&spatialmath.OrientationVectorDegrees{Theta: 90, OX: 1, OY: 0, OZ: 1},
		), capsule)
		test.That(t, err, test.ShouldBeNil)

		frames := []referenceframe.Frame{axesFrame, sphereFrame, capsuleFrame}
		uuids, err := DrawFrames(DrawFramesOptions{
			Frames: frames,
		})
		test.That(t, err, test.ShouldBeNil)
		test.That(t, len(uuids), test.ShouldEqual, 3)
	})

	t.Run("DrawFramesWithColors", func(t *testing.T) {
		box, err := spatialmath.NewBox(spatialmath.NewZeroPose(), r3.Vector{X: 100, Y: 100, Z: 100}, "Box")
		test.That(t, err, test.ShouldBeNil)
		redFrame, err := referenceframe.NewStaticFrameWithGeometry(
			"DrawFrames Red",
			spatialmath.NewPose(r3.Vector{X: 500, Y: 0, Z: 0}, &spatialmath.OrientationVectorDegrees{OZ: 1}),
			box,
		)
		test.That(t, err, test.ShouldBeNil)

		sphere, err := spatialmath.NewSphere(spatialmath.NewZeroPose(), 75, "Sphere")
		test.That(t, err, test.ShouldBeNil)
		blueFrame, err := referenceframe.NewStaticFrameWithGeometry(
			"DrawFrames Blue",
			spatialmath.NewPose(r3.Vector{X: -500, Y: 0, Z: 0}, &spatialmath.OrientationVectorDegrees{OZ: 1}),
			sphere,
		)
		test.That(t, err, test.ShouldBeNil)

		// noColorFrame has no entry in Colors and should default to magenta.
		noColorFrame, err := referenceframe.NewStaticFrame(
			"DrawFrames Default",
			spatialmath.NewPose(r3.Vector{X: 0, Y: 500, Z: 0}, &spatialmath.OrientationVectorDegrees{OZ: 1}),
		)
		test.That(t, err, test.ShouldBeNil)

		uuids, err := DrawFrames(DrawFramesOptions{
			Frames: []referenceframe.Frame{redFrame, blueFrame, noColorFrame},
			Colors: map[string]draw.Color{
				"DrawFrames Red":  draw.ColorFromName("red"),
				"DrawFrames Blue": draw.ColorFromName("blue"),
			},
		})
		test.That(t, err, test.ShouldBeNil)
		test.That(t, len(uuids), test.ShouldEqual, 3)
	})
}
