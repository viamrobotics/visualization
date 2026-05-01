package draw

import (
	"fmt"

	commonv1 "go.viam.com/api/common/v1"
	"go.viam.com/rdk/referenceframe"
	"go.viam.com/rdk/spatialmath"
)

// DefaultFrameColor is the color used to render frames whose name is not present
// in a DrawnFrames.Colors map (red).
var DefaultFrameColor = NewColor(WithName("red"))

// DrawnFrames is a collection of reference frames rendered as transforms in the
// visualizer. A frame with no geometry renders as a bare coordinate-axes helper at
// the frame's pose; a frame with geometry renders one transform per geometry, with
// the geometry labels prefixed by "frameName:".
type DrawnFrames struct {
	// ID is an optional identity prefix included in each emitted transform's
	// UUID derivation. When non-empty, identities are derived from
	// "ID:frameName:parent" (or "ID:label:parent" for the inner geometry
	// transforms) rather than the default "frameName:parent" /
	// "label:parent", which namespaces transforms across batches that share
	// frame or geometry names. ID does not affect visible labels.
	ID string
	// Frames are the reference frames to render.
	Frames []referenceframe.Frame
	// Colors maps frame names to their render color. Frames not present in the map
	// fall back to DefaultFrameColor.
	Colors map[string]Color
}

type drawnFramesConfig struct {
	colors map[string]Color
}

// DrawFramesOption configures a DrawnFrames produced by NewDrawnFrames. When
// multiple options touch the same field, the last option in the argument list wins.
type DrawFramesOption func(*drawnFramesConfig)

// WithFramesColors sets per-frame render colors keyed by frame name. Frames not
// present in the map fall back to DefaultFrameColor.
func WithFramesColors(colors map[string]Color) DrawFramesOption {
	return func(config *drawnFramesConfig) {
		config.colors = colors
	}
}

// NewDrawnFrames returns a DrawnFrames over the given reference frames. When no
// WithFramesColors option is supplied, every frame renders with DefaultFrameColor.
func NewDrawnFrames(frames []referenceframe.Frame, options ...DrawFramesOption) *DrawnFrames {
	config := &drawnFramesConfig{
		colors: make(map[string]Color),
	}
	for _, option := range options {
		option(config)
	}
	return &DrawnFrames{Frames: frames, Colors: config.colors}
}

// ToTransforms returns a flat slice of transforms covering every frame in the
// collection. A frame with no geometry contributes a single bare-axes transform
// named after the frame; a frame with geometry contributes one transform per
// geometry, each labelled "frameName:geoLabel". Each transform's identity is
// derived from "frameName:parent" (or "label:parent" for the inner geometry
// transforms), with DrawnFrames.ID prepended when non-empty. The supplied
// DrawableOptions configure the parent frame and root pose used as the basis
// for every emitted transform; per-call UUID overrides on the options have no
// effect. Returns an error if any frame's transform or geometry resolution
// fails.
func (drawnFrames *DrawnFrames) ToTransforms(options ...DrawableOption) ([]*commonv1.Transform, error) {
	config := NewDrawConfig("", options...)
	parent := config.Parent
	transforms := make([]*commonv1.Transform, 0, len(drawnFrames.Frames))

	for _, frame := range drawnFrames.Frames {
		framePose, err := frame.Transform(nil)
		if err != nil {
			return nil, fmt.Errorf("failed to get transform for frame %s: %w", frame.Name(), err)
		}
		pose := spatialmath.Compose(config.Pose, framePose)

		geometries, err := frame.Geometries(nil)
		if err != nil {
			return nil, fmt.Errorf("failed to get geometries for frame %s: %w", frame.Name(), err)
		}

		if geometries != nil && len(geometries.Geometries()) > 0 {
			color := getFrameDrawColor(frame.Name(), drawnFrames.Colors)
			drawing, err := NewDrawnGeometriesInFrame(geometries, WithSingleGeometriesColor(color))
			if err != nil {
				return nil, fmt.Errorf("failed to create drawn geometries for frame %s: %w", frame.Name(), err)
			}
			drawing.ID = drawnFrames.ID
			drawing.Name = frame.Name()
			frameTransforms, err := drawing.ToTransforms(WithParent(parent), WithPose(pose))
			if err != nil {
				return nil, fmt.Errorf("failed to create transforms for frame %s: %w", frame.Name(), err)
			}
			transforms = append(transforms, frameTransforms...)
		} else {
			frameConfigOpts := []DrawableOption{WithParent(parent), WithPose(pose)}
			if drawnFrames.ID != "" {
				frameConfigOpts = append(frameConfigOpts, WithID(fmt.Sprintf("%s:%s:%s", drawnFrames.ID, frame.Name(), parent)))
			}
			frameConfig := NewDrawConfig(frame.Name(), frameConfigOpts...)
			transforms = append(transforms, NewTransform(frameConfig, nil))
		}
	}

	return transforms, nil
}

func getFrameDrawColor(frameName string, colors map[string]Color) Color {
	if color, ok := colors[frameName]; ok {
		return color
	}
	return DefaultFrameColor
}
