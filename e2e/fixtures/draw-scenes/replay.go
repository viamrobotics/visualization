package main

import (
	"fmt"
	"os"
	"time"

	"github.com/golang/geo/r3"
	"github.com/viam-labs/motion-tools/client/api"
	"github.com/viam-labs/motion-tools/draw"
	"go.viam.com/rdk/spatialmath"
)

const (
	replayFrames   = 30
	replayRiseStep = 50.0
	replaySpeed    = 10.0
)

// replayRecord animates a ball rising from the origin while recording, so the
// playback scene has a sequence with motion in it rather than a single frame.
func replayRecord(env sceneEnv) error {
	if err := api.Record(env.replayPath); err != nil {
		return fmt.Errorf("starting the recording: %w", err)
	}
	defer api.StopRecord()

	for i := range replayFrames {
		sphere, err := spatialmath.NewSphere(
			spatialmath.NewPoseFromPoint(r3.Vector{X: 0, Y: 0, Z: float64(i) * replayRiseStep}),
			200.0,
			"bouncing_ball",
		)
		if err != nil {
			return fmt.Errorf("building frame %d: %w", i, err)
		}

		if _, err := api.DrawGeometry(api.DrawGeometryOptions{
			ID:       "ball",
			Geometry: sphere,
			Color:    draw.ColorFromName("orange"),
		}); err != nil {
			return fmt.Errorf("drawing frame %d: %w", i, err)
		}

		time.Sleep(16 * time.Millisecond)
	}

	return nil
}

// replayPlayback replays what the record scene wrote, then deletes it. The two
// run as separate processes, which is why the path comes from a flag rather
// than a package variable.
func replayPlayback(env sceneEnv) error {
	if err := api.Replay(env.replayPath, replaySpeed); err != nil {
		return fmt.Errorf("replaying %s: %w", env.replayPath, err)
	}

	if err := os.Remove(env.replayPath); err != nil {
		return fmt.Errorf("removing %s: %w", env.replayPath, err)
	}

	return nil
}
