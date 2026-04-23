package main

import (
	"context"
	"os"
	"testing"

	"go.viam.com/rdk/logging"
	robotclient "go.viam.com/rdk/robot/client"
	"go.viam.com/rdk/services/worldstatestore"
	"go.viam.com/test"
	"go.viam.com/utils/rpc"
)

func connectRobot(t *testing.T) *robotclient.RobotClient {
	t.Helper()

	host := os.Getenv("VIAM_E2E_HOST")
	apiKeyID := os.Getenv("VIAM_E2E_API_KEY_ID")
	apiKey := os.Getenv("VIAM_E2E_API_KEY")

	if host == "" || apiKeyID == "" || apiKey == "" {
		t.Fatal("Missing VIAM_E2E_HOST, VIAM_E2E_API_KEY_ID, or VIAM_E2E_API_KEY")
	}

	logger := logging.NewDebugLogger("wss-e2e-test")
	robot, err := robotclient.New(
		context.Background(),
		host,
		logger,
		robotclient.WithDialOptions(rpc.WithEntityCredentials(
			apiKeyID,
			rpc.Credentials{
				Type:    rpc.CredentialsTypeAPIKey,
				Payload: apiKey,
			},
		)),
	)
	test.That(t, err, test.ShouldBeNil)
	t.Cleanup(func() { robot.Close(context.Background()) })
	return robot
}

func getWSClient(t *testing.T) worldstatestore.Service {
	t.Helper()
	robot := connectRobot(t)
	ws, err := worldstatestore.FromProvider(robot, "world-state-store")
	test.That(t, err, test.ShouldBeNil)
	return ws
}

func TestTransformUpdate(t *testing.T) {
	ws := getWSClient(t)
	ctx := context.Background()

	t.Run("AddTransform", func(t *testing.T) {
		_, err := ws.DoCommand(ctx, map[string]any{
			"command": "add_sphere",
			"name":    "dynamic-sphere",
		})
		test.That(t, err, test.ShouldBeNil)
	})

	t.Run("MoveTransform", func(t *testing.T) {
		_, err := ws.DoCommand(ctx, map[string]any{
			"command": "update",
			"name":    "dynamic-sphere",
			"pose":    map[string]any{"x": -300.0, "y": 0.0, "z": 300.0},
		})
		test.That(t, err, test.ShouldBeNil)
	})

	t.Run("RotateTransform", func(t *testing.T) {
		_, err := ws.DoCommand(ctx, map[string]any{
			"command": "update",
			"name":    "dynamic-sphere",
			"pose":    map[string]any{"ox": 1.0, "oy": 0.0, "oz": 0.0, "theta": 45.0},
		})
		test.That(t, err, test.ShouldBeNil)
	})

	t.Run("UpdateColor", func(t *testing.T) {
		_, err := ws.DoCommand(ctx, map[string]any{
			"command": "update",
			"name":    "dynamic-sphere",
			"metadata": map[string]any{
				"colors": []any{
					map[string]any{"r": 30.0, "g": 144.0, "b": 255.0},
				},
			},
		})
		test.That(t, err, test.ShouldBeNil)
	})

	t.Run("UpdateOpacity", func(t *testing.T) {
		_, err := ws.DoCommand(ctx, map[string]any{
			"command": "update",
			"name":    "dynamic-sphere",
			"metadata": map[string]any{
				"opacity": 96.0,
			},
		})
		test.That(t, err, test.ShouldBeNil)
	})

	t.Run("ToggleAxesHelper", func(t *testing.T) {
		_, err := ws.DoCommand(ctx, map[string]any{
			"command": "update",
			"name":    "dynamic-sphere",
			"metadata": map[string]any{
				"showAxesHelper": false,
			},
		})
		test.That(t, err, test.ShouldBeNil)
	})

	t.Run("ToggleInvisibility", func(t *testing.T) {
		_, err := ws.DoCommand(ctx, map[string]any{
			"command": "update",
			"name":    "dynamic-sphere",
			"metadata": map[string]any{
				"invisible": true,
			},
		})
		test.That(t, err, test.ShouldBeNil)
	})

	t.Run("Cleanup", func(t *testing.T) {
		_, err := ws.DoCommand(ctx, map[string]any{
			"command": "remove",
			"name":    "dynamic-sphere",
		})
		test.That(t, err, test.ShouldBeNil)
	})
}

func TestTransformRemoval(t *testing.T) {
	ws := getWSClient(t)
	ctx := context.Background()

	t.Run("AddTransform", func(t *testing.T) {
		_, err := ws.DoCommand(ctx, map[string]any{
			"command": "add_sphere",
			"name":    "removable-sphere",
		})
		test.That(t, err, test.ShouldBeNil)
	})

	t.Run("RemoveTransform", func(t *testing.T) {
		_, err := ws.DoCommand(ctx, map[string]any{
			"command": "remove",
			"name":    "removable-sphere",
		})
		test.That(t, err, test.ShouldBeNil)
	})
}

func TestPointCloudChunking(t *testing.T) {
	ws := getWSClient(t)
	ctx := context.Background()

	t.Run("AddChunkedPointCloud", func(t *testing.T) {
		_, err := ws.DoCommand(ctx, map[string]any{
			"command":    "add_chunked",
			"name":       "chunked-cloud",
			"chunk_size": 500.0,
		})
		test.That(t, err, test.ShouldBeNil)
	})

	t.Run("Cleanup", func(t *testing.T) {
		_, err := ws.DoCommand(ctx, map[string]any{
			"command": "remove",
			"name":    "chunked-cloud",
		})
		test.That(t, err, test.ShouldBeNil)
	})
}
