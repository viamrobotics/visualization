package api

import (
	"context"
	"fmt"

	"connectrpc.com/connect"
	"github.com/golang/geo/r3"
	"github.com/viam-labs/motion-tools/client/server"
	"github.com/viam-labs/motion-tools/draw"
	drawv1 "github.com/viam-labs/motion-tools/draw/v1"
)

// SetCameraPoseOptions configures a SetCamera call.
type SetCameraPoseOptions struct {
	// The camera position in millimeters (world coordinates).
	Position r3.Vector

	// The point the camera should look at in millimeters (world coordinates).
	LookAt r3.Vector

	// Whether to animate the camera movement to this pose.
	Animate bool
}

// SetCamera sets the visualizer's camera pose.
// The camera position and look-at point are specified in millimeters.
// Returns an error if the server is not running or the RPC fails.
func SetCamera(options SetCameraPoseOptions) error {
	client := server.GetClient()
	if client == nil {
		return ErrVisualizerNotRunning
	}

	sceneCamera := draw.NewSceneCamera(
		options.Position,
		options.LookAt,
		draw.WithAnimated(options.Animate),
	)

	req := connect.NewRequest(&drawv1.SetSceneRequest{
		SceneMetadata: &drawv1.SceneMetadata{
			SceneCamera: sceneCamera.ToProto(),
		},
	})

	_, err := client.SetScene(context.Background(), req)
	if err != nil {
		return fmt.Errorf("SetScene RPC failed: %w", err)
	}

	return nil
}

// ResetCamera resets the visualizer's camera pose to the default.
// Returns an error if the server is not running or the RPC fails.
func ResetCamera() error {
	client := server.GetClient()
	if client == nil {
		return ErrVisualizerNotRunning
	}

	sceneCamera := draw.NewSceneCamera(
		draw.DefaultSceneCamera.Position,
		draw.DefaultSceneCamera.LookAt,
	)

	req := connect.NewRequest(&drawv1.SetSceneRequest{
		SceneMetadata: &drawv1.SceneMetadata{
			SceneCamera: sceneCamera.ToProto(),
		},
	})

	_, err := client.SetScene(context.Background(), req)
	if err != nil {
		return fmt.Errorf("SetScene RPC failed: %w", err)
	}

	return nil
}
