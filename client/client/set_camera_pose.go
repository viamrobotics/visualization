package client

import (
	"encoding/json"

	"github.com/golang/geo/r3"
	"github.com/viam-labs/motion-tools/draw"
)

// SetCameraPose will set the visualizer's camera pose.
// Parameters:
//   - position: The camera position
//   - lookAt: The direction the camera should look at
//   - animate: Whether or not to animate to this pose
func SetCameraPose(position r3.Vector, lookAt r3.Vector, animate bool) error {
	sceneCamera := draw.NewSceneCamera(r3.Vector{X: position.X / 1000.0, Y: position.Y / 1000.0, Z: position.Z / 1000.0}, r3.Vector{X: lookAt.X / 1000.0, Y: lookAt.Y / 1000.0, Z: lookAt.Z / 1000.0}, draw.WithAnimated(animate))

	json, err := sceneCameraToJSON(sceneCamera)
	if err != nil {
		return err
	}

	return postHTTP(json, "json", "camera")
}

func sceneCameraToJSON(sceneCamera draw.SceneCamera) ([]byte, error) {
	data := map[string]interface{}{
		"setCameraPose": true,
		"Position":      sceneCamera.Position,
		"LookAt":        sceneCamera.LookAt,
		"Animate":       sceneCamera.Animated,
	}

	return json.Marshal(data)
}
