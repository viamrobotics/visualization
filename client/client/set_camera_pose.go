package client

import (
	"encoding/json"

	"github.com/golang/geo/r3"
)

// SetCameraPose will set the visualizer's camera pose.
// Parameters:
//   - position: The camera position
//   - lookAt: The direction the camera should look at
//   - animate: Whether or not to animate to this pose
func SetCameraPose(position r3.Vector, lookAt r3.Vector, animate bool) error {
	positionM := map[string]interface{}{
		"X": position.X / 1000.0,
		"Y": position.Y / 1000.0,
		"Z": position.Z / 1000.0,
	}

	lookAtM := map[string]interface{}{
		"X": lookAt.X / 1000.0,
		"Y": lookAt.Y / 1000.0,
		"Z": lookAt.Z / 1000.0,
	}

	data := map[string]interface{}{
		"setCameraPose": true,
		"Position":      positionM,
		"LookAt":        lookAtM,
		"Animate":       animate,
	}

	json, err := json.Marshal(data)
	if err != nil {
		return err
	}

	return postHTTP(json, "json", "camera")
}
