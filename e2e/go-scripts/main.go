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

	logger := logging.NewDebugLogger("client")
	machine, err := client.New(
		context.Background(),
		"motion-tools-e2e-main.l6j4r7m65g.viam.cloud",
		logger,
		client.WithDialOptions(rpc.WithEntityCredentials(

			"5450f99a-c7f9-4677-aa1d-8f2e77707a39",
			rpc.Credentials{
				Type: rpc.CredentialsTypeAPIKey,

				Payload: "ag5vx3ginkwvubcp1w18gfue099i9zoz",
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
	arm1, err := arm.FromRobot(robot, "arm-1")
	if err != nil {
		return err
	}

	inputs := []float64{0, degToRad(-90), degToRad(90), degToRad(-180), degToRad(-90), 0}

	err = arm1.MoveToJointPositions(ctx, inputs, map[string]interface{}{})
	if err != nil {
		return err
	}
	return nil
}
