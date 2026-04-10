package draw

import (
	"fmt"

	commonv1 "go.viam.com/api/common/v1"
	"go.viam.com/rdk/referenceframe"
	"go.viam.com/rdk/spatialmath"
)

var DefaultFrameColor = NewColor(WithName("red"))

// DrawnFrames is a collection of frames that can be rendered as transforms in the visualizer.
// Frames with no geometry are rendered as coordinate axes. Frames with geometry render each
// geometry as a transform, with the frame name prefixed to the geometry label.
type DrawnFrames struct {
	Frames []referenceframe.Frame
	Colors map[string]Color
}

type drawnFramesConfig struct {
	colors map[string]Color
}

// DrawFramesOption is a functional option for configuring a DrawnFrames.
type DrawFramesOption func(*drawnFramesConfig)

// WithFramesColors sets per-frame geometry colors keyed by frame name.
// Frames not present in the map default to DefaultFrameColor.
func WithFramesColors(colors map[string]Color) DrawFramesOption {
	return func(config *drawnFramesConfig) {
		config.colors = colors
	}
}

// NewDrawnFrames creates a new DrawnFrames from the given frames.
// Frames without an explicit color in the Colors map default to DefaultFrameColor.
func NewDrawnFrames(frames []referenceframe.Frame, options ...DrawFramesOption) *DrawnFrames {
	config := &drawnFramesConfig{
		colors: make(map[string]Color),
	}
	for _, option := range options {
		option(config)
	}
	return &DrawnFrames{Frames: frames, Colors: config.colors}
}

// ToTransforms produces a flat []*commonv1.Transform for every frame.
// Frames with no geometry produce a single bare-axes transform named after the frame.
// Frames with geometry produce one transform per geometry, named "frameName:geoLabel"
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
			drawing.Name = frame.Name()
			frameTransforms, err := drawing.ToTransforms(WithParent(parent), WithPose(pose))
			if err != nil {
				return nil, fmt.Errorf("failed to create transforms for frame %s: %w", frame.Name(), err)
			}
			transforms = append(transforms, frameTransforms...)
		} else {
			frameConfig := NewDrawConfig(frame.Name(), WithParent(parent), WithPose(pose))
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
