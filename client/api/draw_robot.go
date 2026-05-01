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
	// Ctx is the context used for inputs collection and the robot's
	// FrameSystemConfig RPC.
	Ctx context.Context
	// Robot is the robot whose frame system and joint positions are
	// snapshotted and drawn. Required.
	Robot robot.Robot
	// WorldState, when non-nil, is also drawn alongside the robot's frame
	// system geometries.
	WorldState *referenceframe.WorldState
	// Colors is the palette used to color obstacles and frame-system
	// geometries. When empty, a curated nine-color palette is used.
	Colors []draw.Color
	// ID is an optional identifier prefix used to namespace every entity
	// produced by this call. The prefix is composed with internal suffixes
	// to derive unique IDs for the world state ("ID_worldstate"), each
	// world-state transform ("ID_ws_transform_N"), and each frame-system
	// geometry batch ("ID_fs_N"). Reuse the same ID across calls to update
	// a previously drawn robot in place; pass distinct IDs to draw multiple
	// robots in the same scene without identity collisions.
	ID string
}

// DrawRobot snapshots a robot at its current joint positions and renders
// every frame-system geometry as a transform, optionally drawing a world
// state with obstacles alongside it. It is a composite of three lower-level
// calls — DrawWorldState (when WorldState is non-nil), one
// DrawGeometriesInFrame per WorldState transform, and one
// DrawGeometriesInFrame per frame-system geometry group — each invoked with
// an ID derived from the supplied ID prefix. Returns a flat list of UUIDs in
// the order they were created.
//
// Returns ErrVisualizerNotRunning if no visualizer is reachable, a wrapped
// error if the robot's frame system or inputs cannot be obtained, or any of
// the underlying Draw* errors if a sub-call fails.
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
