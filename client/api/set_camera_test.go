package api

import (
	"testing"

	"github.com/golang/geo/r3"
	"github.com/viam-labs/motion-tools/draw"
	"go.viam.com/rdk/spatialmath"
	"go.viam.com/test"
)

func TestSetCamera(t *testing.T) {
	startTestServer(t)

	t.Run("SetCamera", func(t *testing.T) {
		position := r3.Vector{X: 3000, Y: 3000, Z: 3000}
		lookAt := r3.Vector{X: 0, Y: 0, Z: 0}

		err := SetCamera(SetCameraPoseOptions{
			Position: position,
			LookAt:   lookAt,
			Animate:  true,
		})
		test.That(t, err, test.ShouldBeNil)
	})

	t.Run("SetCameraTopDown", func(t *testing.T) {
		// Draw a reference box at the origin for the screenshot
		box, err := spatialmath.NewBox(
			spatialmath.NewPoseFromPoint(r3.Vector{X: 0, Y: 0, Z: 0}),
			r3.Vector{X: 1000, Y: 1000, Z: 200},
			"reference_box",
		)
		test.That(t, err, test.ShouldBeNil)

		_, err = DrawGeometry(DrawGeometryOptions{
			Geometry: box,
			Color:    draw.ColorFromName("blue"),
		})
		test.That(t, err, test.ShouldBeNil)

		// Top-down view: camera directly above looking down
		position := r3.Vector{X: 0, Y: 0, Z: 5000}
		lookAt := r3.Vector{X: 0, Y: 0, Z: 0}

		err = SetCamera(SetCameraPoseOptions{
			Position: position,
			LookAt:   lookAt,
			Animate:  false,
		})
		test.That(t, err, test.ShouldBeNil)
	})

	t.Run("ResetCamera", func(t *testing.T) {
		err := ResetCamera()
		test.That(t, err, test.ShouldBeNil)
	})
}
