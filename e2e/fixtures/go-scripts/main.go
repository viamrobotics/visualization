package main

import (
	"context"
	"fmt"
	"math"
	"os"

	"go.viam.com/rdk/components/arm"
	"go.viam.com/rdk/logging"
	"go.viam.com/rdk/robot/client"
	"go.viam.com/utils/rpc"
)

func main() {
	if len(os.Args) < 2 {
		fmt.Println("Please provide a function name to run.")
		os.Exit(1)
	}

	host := os.Getenv("VIAM_E2E_HOST")
	apiKeyID := os.Getenv("VIAM_E2E_API_KEY_ID")
	apiKey := os.Getenv("VIAM_E2E_API_KEY")

	if host == "" || apiKeyID == "" || apiKey == "" {
		fmt.Println("Missing required environment variables: VIAM_E2E_HOST, VIAM_E2E_API_KEY_ID, VIAM_E2E_API_KEY")
		os.Exit(1)
	}

	logger := logging.NewDebugLogger("client")
	machine, err := client.New(
		context.Background(),
		host,
		logger,
		client.WithDialOptions(rpc.WithEntityCredentials(
			apiKeyID,
			rpc.Credentials{
				Type:    rpc.CredentialsTypeAPIKey,
				Payload: apiKey,
			})),
	)
	if err != nil {
		logger.Fatal(err)
	}

	defer machine.Close(context.Background())

	funcName := os.Args[1]
	switch funcName {
	case "moveArmJointPositions":
		err = moveArmJointPositions(context.Background(), machine)
		if err != nil {
			logger.Fatal(err)
		}
	default:
		fmt.Printf("Unknown function: %s\n", funcName)
		os.Exit(1)
	}
}

func degToRad(deg float64) float64 {
	return deg * math.Pi / 180
}

func moveArmJointPositions(ctx context.Context, robot *client.RobotClient) error {
	arm1, err := arm.FromProvider(robot, "arm-1")
	if err != nil {
		return err
	}

	inputs := []float64{0, degToRad(-90), degToRad(90), degToRad(-180), degToRad(-90), 0}
	err = arm1.MoveToJointPositions(ctx, inputs, map[string]any{})
	if err != nil {
		return err
	}
	return nil
}
