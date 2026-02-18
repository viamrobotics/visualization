package draw

import (
	"fmt"
	"maps"
	"slices"

	commonv1 "go.viam.com/api/common/v1"
	"go.viam.com/rdk/referenceframe"
)

type DrawnFrameSystem struct {
	FrameSystem *referenceframe.FrameSystem
	Inputs      referenceframe.FrameSystemInputs
	Colors      map[string]Color
}

type drawnFrameSystemConfig struct {
	colors map[string]Color
}

func newDrawnFrameSystemConfig(frameSystem *referenceframe.FrameSystem) *drawnFrameSystemConfig {
	names := frameSystem.FrameNames()
	colors := make(map[string]Color)
	for _, name := range names {
		colors[name] = NewColor(WithName("magenta"))
	}

	return &drawnFrameSystemConfig{
		colors: colors,
	}
}

// DrawFrameSystemOption is a functional option for configuring a DrawFrameSystem.
type DrawFrameSystemOption func(*drawnFrameSystemConfig)

// WithFrameSystemColors sets the colors for all frames.
func WithFrameSystemColors(colors map[string]Color) DrawFrameSystemOption {
	return func(config *drawnFrameSystemConfig) {
		config.colors = colors
	}
}

// WithFrameSystemColor sets the color for a specific frame.
func WithFrameSystemColor(frameName string, color Color) DrawFrameSystemOption {
	return func(config *drawnFrameSystemConfig) {
		config.colors[frameName] = color
	}
}

// NewDrawnFrameSystem creates a new DrawnFrameSystem object from the given frame system and inputs.
func NewDrawnFrameSystem(frameSystem *referenceframe.FrameSystem, inputs referenceframe.FrameSystemInputs, options ...DrawFrameSystemOption) *DrawnFrameSystem {
	config := newDrawnFrameSystemConfig(frameSystem)
	for _, option := range options {
		option(config)
	}

	return &DrawnFrameSystem{FrameSystem: frameSystem, Inputs: inputs, Colors: config.colors}
}

// Draw draws the frame system to a list of transforms.
// The name is used to create the UUID for each frame along with its label and parent.
// Options are passed to each geometry in the frame system, but the ID is derived from the frame name and the geometry label.
// If the name is not empty, it is used as the prefix for the frame name.
func (drawnFrameSystem *DrawnFrameSystem) Draw(name string, options ...drawableOption) ([]*commonv1.Transform, error) {
	config := NewDrawConfig(name, options...)

	frameMap, err := referenceframe.FrameSystemGeometries(drawnFrameSystem.FrameSystem, drawnFrameSystem.Inputs)
	if err != nil {
		return nil, err
	}

	transforms := make([]*commonv1.Transform, 0)
	for _, frameName := range slices.Sorted(maps.Keys(frameMap)) {
		geometries := frameMap[frameName]
		color := getFrameColor(frameName, drawnFrameSystem.Colors, drawnFrameSystem.FrameSystem)
		drawing, err := NewDrawnGeometriesInFrame(geometries, WithSingleGeometriesColor(color))
		if err != nil {
			return nil, err
		}

		label := frameName
		if config.Name != "" {
			label = fmt.Sprintf("%s:%s", config.Name, label)
		}

		id := fmt.Sprintf("%s:%s", label, config.Parent)
		opts := append(options, WithID(id))
		drawings, err := drawing.Draw(frameName, opts...)
		if err != nil {
			return nil, err
		}

		transforms = append(transforms, drawings...)
	}

	return transforms, nil
}

// getFrameColor retrieves the color for a given frame by name. If the frame has no assigned color,
// it recursively searches parent frames for a color. Defaults to magenta if no color is found.
func getFrameColor(frameName string, colors map[string]Color, frameSystem *referenceframe.FrameSystem) Color {
	// If the frame has a color, return it
	if color, ok := colors[frameName]; ok {
		return color
	}

	frame := frameSystem.Frame(frameName)
	if frame != nil {
		parent, err := frameSystem.Parent(frame)
		if err == nil && parent != nil {
			inheritedColor := getFrameColor(parent.Name(), colors, frameSystem)
			colors[frameName] = inheritedColor
			return inheritedColor
		}
	}

	return NewColor(WithName("magenta"))
}
