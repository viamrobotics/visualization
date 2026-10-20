package api

import (
	"fmt"

	"github.com/viamrobotics/visualization/client/server"
	"github.com/viamrobotics/visualization/draw"
	"go.viam.com/rdk/referenceframe"
)

// DrawFramesOptions configures a DrawFrames call.
type DrawFramesOptions struct {
	// ID is an optional identifier prefix for this batch. When non-empty,
	// each emitted transform's identity is derived from
	// "ID:frameName:parent" (or "ID:geometryLabel:parent" for the inner
	// geometry transforms) rather than the default form, which prevents
	// collisions between batches that share frame or geometry names.
	// Calling DrawFrames again with the same ID and matching frames
	// updates the previous batch in place. A fresh ID creates a new,
	// independent set of entities.
	ID string
	// Frames are the reference frames to render. A frame with no geometry
	// is rendered as bare coordinate axes. A frame with geometry is
	// rendered as one transform per geometry.
	Frames []referenceframe.Frame
	// Colors maps frame names to render colors. Frames not present in the
	// map fall back to draw.DefaultFrameColor (red).
	Colors map[string]draw.Color
}

// DrawFrames sends a batch of reference frames to the visualizer as
// transforms. A frame with no geometry contributes a single bare-axes
// transform. A frame with geometry contributes one transform per geometry,
// labelled "frameName:geometryLabel". Identities are namespaced by ID when
// set, so calling DrawFrames again with the same ID and matching frames
// updates the previous batch in place. Returns one UUID per emitted
// transform.
//
// Returns ErrVisualizerNotRunning if no visualizer is reachable, the
// underlying error if any frame's transform or geometries cannot be
// resolved, or a wrapped RPC error if the AddEntities call fails.
func DrawFrames(options DrawFramesOptions) ([][]byte, error) {
	client := server.GetClient()
	if client == nil {
		return nil, ErrVisualizerNotRunning
	}

	drawnFrames := draw.NewDrawnFrames(options.Frames, draw.WithFramesColors(options.Colors))
	drawnFrames.ID = options.ID
	transforms, err := drawnFrames.ToTransforms()
	if err != nil {
		return nil, fmt.Errorf("failed to create frame transforms: %w", err)
	}

	return addTransforms(client, transforms)
}
