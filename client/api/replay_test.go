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

// Shared recording file path for E2E test coordination
const replayTestFile = "/tmp/replay_e2e_test.recording"

func TestReplay(t *testing.T) {
	startTestServer(t)

	t.Run("ReplayRecord", func(t *testing.T) {
		// Start recording to a shared file
		err := Record(replayTestFile)
		test.That(t, err, test.ShouldBeNil)

		// Create a rising ball animation (moves from bottom to top)
		// Use 30 frames for a quick test - ball rises from z=0 to z=3000
		for i := 0; i < 30; i++ {
			// Linear upward motion - starts at 0, ends at 1500mm
			height := float64(i) * 50.0 // 0, 50, 100, ..., 1450mm

			sphere, err := spatialmath.NewSphere(
				spatialmath.NewPoseFromPoint(r3.Vector{X: 0, Y: 0, Z: height}),
				200.0, // 200mm radius
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

			// Sleep to simulate animation timing (16ms ≈ 60fps)
			time.Sleep(16 * time.Millisecond)
		}

		// Stop recording - leave the final frame visible for E2E screenshot
		// Final position is z=2900mm, clearly different from starting z=0
		StopRecord()
	})

	t.Run("ReplayPlayback", func(t *testing.T) {
		// Replay the previously recorded animation at 10x speed
		err := Replay(replayTestFile, 10.0)
		test.That(t, err, test.ShouldBeNil)

		// Clean up the recording file after playback
		os.Remove(replayTestFile)
	})

	t.Run("ReplayHelper", func(t *testing.T) {
		// Helper test that just verifies basic replay functionality
		tmpfile, err := os.CreateTemp("", "replay_helper_*.recording")
		test.That(t, err, test.ShouldBeNil)
		defer os.Remove(tmpfile.Name())
		tmpfile.Close()

		// Record a single draw operation
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

		// Replay at normal speed
		err = Replay(tmpfile.Name(), 1.0)
		test.That(t, err, test.ShouldBeNil)
	})
}
