package client

import (
	"encoding/json"

	"go.viam.com/rdk/referenceframe"
)

// DrawFrames draws Frames in the visualizer.
//
// Parameters:
//   - frames: a slice of frames
func DrawFrames(frames []referenceframe.Frame) error {
	result, err := json.Marshal(map[string]interface{}{
		"frames": frames,
	})

	if err != nil {
		return err
	}

	return postHTTP(result, "json", "frames")
}
