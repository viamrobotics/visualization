// Package mutils provides helper functions for working with Viam robot frame systems.
package mutils

import (
	"context"
	"fmt"

	"go.viam.com/rdk/referenceframe"
	"go.viam.com/rdk/robot"
	"go.viam.com/rdk/robot/framesystem"
)

// GetInputs reads current joint positions from each frame's component on the robot
// and returns them as FrameSystemInputs suitable for frame system transformations.
func GetInputs(ctx context.Context, fs *referenceframe.FrameSystem, myRobot robot.Robot) (referenceframe.FrameSystemInputs, error) {
	input := referenceframe.NewZeroInputs(fs)

	for name, original := range input {
		// skip frames with no input
		if len(original) == 0 {
			continue
		}

		// add component to map
		components := robot.AllResourcesByName(myRobot, name)
		if len(components) != 1 {
			return nil, fmt.Errorf("wrong # of components for %s : %d", name, len(components))
		}

		inputEnabled, ok := components[0].(framesystem.InputEnabled)
		if !ok {
			return nil, framesystem.NotInputEnabledError(components[0])
		}

		// add input to map
		pos, err := inputEnabled.CurrentInputs(ctx)
		if err != nil {
			return nil, err
		}
		input[name] = pos
	}
	return input, nil
}
