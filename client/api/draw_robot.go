package api

import (
	"context"
	"fmt"

	"github.com/viam-labs/motion-tools/client/server"
	"github.com/viam-labs/motion-tools/draw"
	"github.com/viam-labs/motion-tools/mutils"
	"go.viam.com/rdk/referenceframe"
	"go.viam.com/rdk/robot"
	"go.viam.com/rdk/spatialmath"
)

// defaultColorPalette is a list of sensible colors to cycle between
var defaultColorPalette = []draw.Color{
	draw.NewColor(draw.WithHex("#E41A1C")),
	draw.NewColor(draw.WithHex("#377EB8")),
	draw.NewColor(draw.WithHex("#4DAF4A")),
	draw.NewColor(draw.WithHex("#984EA3")),
	draw.NewColor(draw.WithHex("#FF7F00")),
	draw.NewColor(draw.WithHex("#FFFF33")),
	draw.NewColor(draw.WithHex("#A65628")),
	draw.NewColor(draw.WithHex("#F781BF")),
	draw.NewColor(draw.WithHex("#999999")),
}

// DrawRobotOptions configures a DrawRobot call.
type DrawRobotOptions struct {
	// Context for the robot operations.
	Ctx context.Context

	// Robot to draw.
	Robot robot.Robot

	// WorldState is an optional world state to draw along with the robot.
	WorldState *referenceframe.WorldState

	// Colors is an optional list of colors to use for geometries. If empty, uses DefaultColorPalette.
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
		return nil, fmt.Errorf("server is not running; call server.Start() first")
	}

	// Get frame system configuration from robot
	fsCfg, err := options.Robot.FrameSystemConfig(options.Ctx)
	if err != nil {
		return nil, fmt.Errorf("failed to get frame system config: %w", err)
	}

	// Build frame system
	rf, err := referenceframe.NewFrameSystem("robot", fsCfg.Parts, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to create frame system: %w", err)
	}

	// Get current joint inputs
	inputs, err := mutils.GetInputs(options.Ctx, rf, options.Robot)
	if err != nil {
		return nil, fmt.Errorf("failed to get inputs: %w", err)
	}

	var allUUIDs [][]byte

	// Use provided colors or default palette
	colors := options.Colors
	if len(colors) == 0 {
		colors = defaultColorPalette
	}

	// Draw world state if provided
	if options.WorldState != nil {
		// Draw world state obstacles
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

		// Draw world state transforms
		transformIdx := 0
		for _, lif := range options.WorldState.Transforms() {
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
			transformIdx++
		}
	}

	// Draw frame system geometries
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
		if err != nil {
			return nil, fmt.Errorf("failed to draw frame system geometries: %w", err)
		}
		allUUIDs = append(allUUIDs, gifUUIDs...)
		gifsIdx++
	}

	return allUUIDs, nil
}
