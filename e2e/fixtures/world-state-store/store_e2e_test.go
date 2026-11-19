package main

import (
	"context"
	"encoding/json"
	"fmt"
	"os"
	"testing"
	"time"

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

func TestPointCloudUpdate(t *testing.T) {
	ws := getWSClient(t)
	ctx := context.Background()

	t.Run("AddPointCloud", func(t *testing.T) {
		_, err := ws.DoCommand(ctx, map[string]any{
			"command": "add_pointcloud",
			"name":    "updating-pointcloud",
		})
		test.That(t, err, test.ShouldBeNil)
	})

	t.Run("UpdatePointCloud", func(t *testing.T) {
		_, err := ws.DoCommand(ctx, map[string]any{
			"command": "update_pointcloud",
			"name":    "updating-pointcloud",
		})
		test.That(t, err, test.ShouldBeNil)
	})

	t.Run("Cleanup", func(t *testing.T) {
		_, err := ws.DoCommand(ctx, map[string]any{
			"command": "remove",
			"name":    "updating-pointcloud",
		})
		test.That(t, err, test.ShouldBeNil)
	})
}

// TestBurstScenario runs the store's synthetic "burst" producer against five
// transforms and reports each one's final pose.x as a single BURST_FINAL JSON
// line, so the Playwright suite can compare it against what the rendered
// store shows without racing the burst's own background ticker.
func TestBurstScenario(t *testing.T) {
	if os.Getenv("VIAM_E2E_HOST") == "" || os.Getenv("VIAM_E2E_API_KEY_ID") == "" ||
		os.Getenv("VIAM_E2E_API_KEY") == "" {
		t.Skip("Missing VIAM_E2E_HOST, VIAM_E2E_API_KEY_ID, or VIAM_E2E_API_KEY")
	}

	ws := getWSClient(t)
	ctx := context.Background()

	burstBoxNames := []string{
		"burst-box-0",
		"burst-box-1",
		"burst-box-2",
		"burst-box-3",
		"burst-box-4",
	}

	const (
		burstEventsPerTick  = 200
		burstPeriodMs       = 100
		burstTicks          = 10
		burstSettleMarginMs = 500
	)

	t.Run("Setup", func(t *testing.T) {
		for _, name := range burstBoxNames {
			_, err := ws.DoCommand(ctx, map[string]any{
				"command": "add_sphere",
				"name":    name,
			})
			test.That(t, err, test.ShouldBeNil)
		}
	})

	t.Run("Burst", func(t *testing.T) {
		_, err := ws.DoCommand(ctx, map[string]any{
			"command":   "burst",
			"count":     float64(burstEventsPerTick),
			"period_ms": float64(burstPeriodMs),
			"ticks":     float64(burstTicks),
		})
		test.That(t, err, test.ShouldBeNil)

		settleTime := time.Duration(burstPeriodMs*burstTicks+burstSettleMarginMs) * time.Millisecond
		time.Sleep(settleTime)

		uuids, err := ws.ListUUIDs(ctx, nil)
		test.That(t, err, test.ShouldBeNil)

		finalX := make(map[string]float64, len(burstBoxNames))
		for _, uuid := range uuids {
			transform, err := ws.GetTransform(ctx, uuid, nil)
			test.That(t, err, test.ShouldBeNil)

			for _, name := range burstBoxNames {
				if transform.ReferenceFrame == name {
					finalX[name] = transform.PoseInObserverFrame.Pose.X
				}
			}
		}
		test.That(t, finalX, test.ShouldHaveLength, len(burstBoxNames))

		payload, err := json.Marshal(finalX)
		test.That(t, err, test.ShouldBeNil)
		fmt.Printf("BURST_FINAL %s\n", payload)
	})

	t.Run("Cleanup", func(t *testing.T) {
		for _, name := range burstBoxNames {
			_, err := ws.DoCommand(ctx, map[string]any{
				"command": "remove",
				"name":    name,
			})
			test.That(t, err, test.ShouldBeNil)
		}
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
