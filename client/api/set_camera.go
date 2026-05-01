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
	// Position is the camera location in millimeters, expressed in world
	// coordinates.
	Position r3.Vector
	// LookAt is the point in millimeters, expressed in world coordinates, that
	// the camera is aimed at.
	LookAt r3.Vector
	// Animate, when true, smoothly animates the camera from its current pose
	// rather than snapping to the new one.
	Animate bool
}

// SetCamera repositions the visualizer's camera to the given pose. The camera
// type (perspective or orthographic) is left untouched. Returns
// ErrVisualizerNotRunning if no visualizer is reachable, or a wrapped RPC error
// if the SetScene call fails.
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

// ResetCamera moves the visualizer's camera back to the package-default pose
// (draw.DefaultSceneCamera: an isometric view from [3000, 3000, 3000]mm looking
// at the origin), without animation. Returns ErrVisualizerNotRunning if no
// visualizer is reachable, or a wrapped RPC error if the SetScene call fails.
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
