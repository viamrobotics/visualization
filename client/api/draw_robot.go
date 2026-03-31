package api

import (
	"context"
	"fmt"

	"github.com/viam-labs/motion-tools/client/mutils"
	"github.com/viam-labs/motion-tools/client/server"
	"github.com/viam-labs/motion-tools/draw"
	"go.viam.com/rdk/referenceframe"
	"go.viam.com/rdk/robot"
	"go.viam.com/rdk/spatialmath"
)

// defaultColorPalette is a list of sensible colors to cycle between.
var defaultColorPalette = []draw.Color{
	draw.ColorFromHex("#E41A1C"),
	draw.ColorFromHex("#377EB8"),
	draw.ColorFromHex("#4DAF4A"),
	draw.ColorFromHex("#984EA3"),
	draw.ColorFromHex("#FF7F00"),
	draw.ColorFromHex("#FFFF33"),
	draw.ColorFromHex("#A65628"),
	draw.ColorFromHex("#F781BF"),
	draw.ColorFromHex("#999999"),
}

// DrawRobotOptions configures a DrawRobot call.
type DrawRobotOptions struct {
	// Context for the robot operations.
	Ctx context.Context

	// Robot to draw.
	Robot robot.Robot

	// WorldState is an optional world state to draw along with the robot.
	WorldState *referenceframe.WorldState

	// Colors is an optional list of colors to use for geometries. If empty, uses defaultColorPalette.
	Colors []draw.Color

	// ID is an optional unique identifier prefix for all drawn elements.
	ID string
}

// DrawRobot draws a robot in the visualizer, including its frame system geometries
// and optionally a world state with obstacles.
// Returns a list of all UUIDs created, or an error if the server is not running or drawing fails.
func DrawRobot(options DrawRobotOptions) ([][]byte, error) {
	client := server.GetClient()
	if client == nil {
		return nil, ErrVisualizerNotRunning
	}

	fsCfg, err := options.Robot.FrameSystemConfig(options.Ctx)
	if err != nil {
		return nil, fmt.Errorf("failed to get frame system config: %w", err)
	}

	rf, err := referenceframe.NewFrameSystem("robot", fsCfg.Parts, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to create frame system: %w", err)
	}

	inputs, err := mutils.GetInputs(options.Ctx, rf, options.Robot)
	if err != nil {
		return nil, fmt.Errorf("failed to get inputs: %w", err)
	}

	colors := options.Colors
	if len(colors) == 0 {
		colors = defaultColorPalette
	}

	var allUUIDs [][]byte

	if options.WorldState != nil {
		wsUUIDs, err := DrawWorldState(DrawWorldStateOptions{
			ID:          options.ID + "_worldstate",
			WorldState:  options.WorldState,
			FrameSystem: rf,
			Inputs:      inputs,
			Colors:      colors,
		})
		if err != nil {
			return nil, fmt.Errorf("failed to draw world state: %w", err)
		}
		allUUIDs = append(allUUIDs, wsUUIDs...)

		for transformIdx, lif := range options.WorldState.Transforms() {
			gifUUIDs, err := DrawGeometriesInFrame(DrawGeometriesInFrameOptions{
				ID: fmt.Sprintf("%s_ws_transform_%d", options.ID, transformIdx),
				Geometries: referenceframe.NewGeometriesInFrame(
					lif.Parent(),
					[]spatialmath.Geometry{lif.Geometry()},
				),
				Colors: colors,
			})
			if err != nil {
				return nil, fmt.Errorf("failed to draw world state transform: %w", err)
			}
			allUUIDs = append(allUUIDs, gifUUIDs...)
		}
	}

	gifs, err := referenceframe.FrameSystemGeometries(rf, inputs)
	if err != nil {
		return nil, fmt.Errorf("failed to get frame system geometries: %w", err)
	}

	gifsIdx := 0
	for _, gif := range gifs {
		gifUUIDs, err := DrawGeometriesInFrame(DrawGeometriesInFrameOptions{
			ID:         fmt.Sprintf("%s_fs_%d", options.ID, gifsIdx),
			Geometries: gif,
			Colors:     colors,
		})
		gifsIdx++
		if err != nil {
			return nil, fmt.Errorf("failed to draw frame system geometries: %w", err)
		}
		allUUIDs = append(allUUIDs, gifUUIDs...)
	}

	return allUUIDs, nil
}
