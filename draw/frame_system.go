package draw

import (
	"fmt"
	"maps"
	"slices"

	drawv1 "github.com/viam-labs/motion-tools/draw/v1"
	commonv1 "go.viam.com/api/common/v1"
	"go.viam.com/rdk/referenceframe"
	"go.viam.com/rdk/spatialmath"
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

type DrawFrameSystemOption func(*drawnFrameSystemConfig)

func WithFrameSystemColors(colors map[string]Color) DrawFrameSystemOption {
	return func(config *drawnFrameSystemConfig) {
		config.colors = colors
	}
}

func WithFrameSystemColor(frameName string, color Color) DrawFrameSystemOption {
	return func(config *drawnFrameSystemConfig) {
		config.colors[frameName] = color
	}
}

func NewDrawnFrameSystem(frameSystem *referenceframe.FrameSystem, inputs referenceframe.FrameSystemInputs, options ...DrawFrameSystemOption) *DrawnFrameSystem {
	config := newDrawnFrameSystemConfig(frameSystem)
	for _, option := range options {
		option(config)
	}

	return &DrawnFrameSystem{FrameSystem: frameSystem, Inputs: inputs, Colors: config.colors}
}

func (drawnFrameSystem *DrawnFrameSystem) Draw(id string) (*drawv1.Transforms, error) {
	transforms := &drawv1.Transforms{
		Transforms: make([]*commonv1.Transform, 0),
	}

	frameMap, err := referenceframe.FrameSystemGeometries(drawnFrameSystem.FrameSystem, drawnFrameSystem.Inputs)
	if err != nil {
		return nil, err
	}

	for _, frameName := range slices.Sorted(maps.Keys(frameMap)) {
		geometries := frameMap[frameName]
		color := getFrameColor(frameName, drawnFrameSystem.Colors, drawnFrameSystem.FrameSystem)

		for _, geometry := range geometries.Geometries() {
			drawnGeometry, err := NewDrawnGeometry(geometry, WithGeometryColor(color))
			if err != nil {
				return nil, err
			}

			transform, err := drawnGeometry.Draw(id, fmt.Sprintf("%s:%s", frameName, geometry.Label()), referenceframe.World, spatialmath.NewZeroPose())
			if err != nil {
				return nil, err
			}

			transforms.Transforms = append(transforms.Transforms, transform)
		}
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
