package api

import (
	"os"
	"testing"
	"time"

	"github.com/golang/geo/r3"
	"github.com/viam-labs/motion-tools/draw"
	"go.viam.com/rdk/spatialmath"
	"go.viam.com/test"
)

// replayTestFile is a shared path used for the record→playback sub-tests.
const replayTestFile = "/tmp/replay_e2e_test.recording"

func TestReplay(t *testing.T) {
	startTestServer(t)

	t.Run("ReplayRecord", func(t *testing.T) {
		err := Record(replayTestFile)
		test.That(t, err, test.ShouldBeNil)

		// Animate a rising ball (30 frames, z=0 → 1450mm).
		for i := 0; i < 30; i++ {
			height := float64(i) * 50.0

			sphere, err := spatialmath.NewSphere(
				spatialmath.NewPoseFromPoint(r3.Vector{X: 0, Y: 0, Z: height}),
				200.0,
				"bouncing_ball",
			)
			test.That(t, err, test.ShouldBeNil)

			uuid, err := DrawGeometry(DrawGeometryOptions{
				ID:       "ball",
				Geometry: sphere,
				Color:    draw.ColorFromName("orange"),
			})
			test.That(t, err, test.ShouldBeNil)
			test.That(t, uuid, test.ShouldNotBeNil)

			time.Sleep(16 * time.Millisecond)
		}

		StopRecord()
	})

	t.Run("ReplayPlayback", func(t *testing.T) {
		err := Replay(replayTestFile, 10.0)
		test.That(t, err, test.ShouldBeNil)

		os.Remove(replayTestFile)
	})

	t.Run("ReplayHelper", func(t *testing.T) {
		tmpfile, err := os.CreateTemp("", "replay_helper_*.recording")
		test.That(t, err, test.ShouldBeNil)
		defer os.Remove(tmpfile.Name())
		tmpfile.Close()

		err = Record(tmpfile.Name())
		test.That(t, err, test.ShouldBeNil)

		sphere, err := spatialmath.NewSphere(
			spatialmath.NewPoseFromPoint(r3.Vector{X: 0, Y: 0, Z: 500}),
			100.0,
			"helper_ball",
		)
		test.That(t, err, test.ShouldBeNil)

		_, err = DrawGeometry(DrawGeometryOptions{
			ID:       "helper",
			Geometry: sphere,
			Color:    draw.ColorFromName("green"),
		})
		test.That(t, err, test.ShouldBeNil)

		StopRecord()

		err = Replay(tmpfile.Name(), 1.0)
		test.That(t, err, test.ShouldBeNil)
	})
}
