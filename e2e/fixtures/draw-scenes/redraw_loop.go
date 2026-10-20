package main

import (
	"fmt"

	"github.com/golang/geo/r3"
	"github.com/viam-labs/motion-tools/client/api"
	"github.com/viam-labs/motion-tools/draw"
	"go.viam.com/rdk/referenceframe"
	"go.viam.com/rdk/spatialmath"
)

// The boxes form a 6x4 grid so a dropped entity shows up as a hole in the
// rendered scene. Volume-wise this is well short of what it takes to overflow
// a subscriber. The burst case is covered server-side by
// TestDrawService_NoChangesLostUnderBurst. What this exercises is the browser
// reconciling a clear against the redraw that immediately follows it, which
// goes wrong at any size if the two land in the same animation frame.
const (
	redrawLoopColumns  = 6
	redrawLoopRows     = 4
	redrawLoopBoxCount = redrawLoopColumns * redrawLoopRows
	redrawLoopSpacing  = 150.0
	redrawLoopID       = "redraw-loop"
	redrawLoopPasses   = 5
)

func redrawLoopGeometries() (*referenceframe.GeometriesInFrame, error) {
	dims := r3.Vector{X: 80, Y: 80, Z: 80}
	geometries := make([]spatialmath.Geometry, 0, redrawLoopBoxCount)

	for i := range redrawLoopBoxCount {
		pose := spatialmath.NewPoseFromPoint(r3.Vector{
			X: float64(i%redrawLoopColumns) * redrawLoopSpacing,
			Y: float64(i/redrawLoopColumns) * redrawLoopSpacing,
		})
		box, err := spatialmath.NewBox(pose, dims, fmt.Sprintf("redraw-box-%02d", i))
		if err != nil {
			return nil, fmt.Errorf("building box %d: %w", i, err)
		}
		geometries = append(geometries, box)
	}

	return referenceframe.NewGeometriesInFrame(referenceframe.World, geometries), nil
}

// A palette rather than one flat color, so a box drawn at the wrong index is
// visible too.
func redrawLoopColors() []draw.Color {
	return []draw.Color{
		draw.ColorFromName("red"),
		draw.ColorFromName("orange"),
		draw.ColorFromName("yellow"),
		draw.ColorFromName("green"),
		draw.ColorFromName("blue"),
		draw.ColorFromName("magenta"),
	}
}

func drawRedrawLoopGrid(geometries *referenceframe.GeometriesInFrame) error {
	uuids, err := api.DrawGeometriesInFrame(api.DrawGeometriesInFrameOptions{
		ID:         redrawLoopID,
		Geometries: geometries,
		Colors:     redrawLoopColors(),
	})
	if err != nil {
		return fmt.Errorf("drawing the grid: %w", err)
	}
	if len(uuids) != redrawLoopBoxCount {
		return fmt.Errorf("expected %d boxes, drew %d", redrawLoopBoxCount, len(uuids))
	}
	return nil
}

// redrawLoopWithClear reproduces the reported failure: a producer that clears
// the scene and redraws it on every tick. Identities are stable across passes,
// so the scene should end up exactly as it started, with every entity present.
func redrawLoopWithClear(sceneEnv) error {
	geometries, err := redrawLoopGeometries()
	if err != nil {
		return err
	}

	for range redrawLoopPasses {
		if _, err := api.RemoveAll(); err != nil {
			return fmt.Errorf("clearing the scene: %w", err)
		}
		if err := drawRedrawLoopGrid(geometries); err != nil {
			return err
		}
	}

	return nil
}

// The same loop without the clear. This is the pattern we recommend:
// identities are deterministic, so redrawing upserts in place and the service
// never sees a removal.
func redrawLoopWithoutClear(sceneEnv) error {
	geometries, err := redrawLoopGeometries()
	if err != nil {
		return err
	}

	for range redrawLoopPasses {
		if err := drawRedrawLoopGrid(geometries); err != nil {
			return err
		}
	}

	return nil
}
