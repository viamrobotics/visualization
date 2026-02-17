package draw

import (
	"fmt"
	"maps"
	"slices"

	"github.com/google/uuid"
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
// The options can be used to configure the UUID generation for the transforms.
func (drawnFrameSystem *DrawnFrameSystem) Draw(options ...TransformOption) ([]*commonv1.Transform, error) {
	config := newTransformConfig(drawnFrameSystem.FrameSystem.Name(), referenceframe.World)
	for _, option := range options {
		option(config)
	}

	frameMap, err := referenceframe.FrameSystemGeometries(drawnFrameSystem.FrameSystem, drawnFrameSystem.Inputs)
	if err != nil {
		return nil, err
	}

	transforms := make([]*commonv1.Transform, 0)
	for _, frameName := range slices.Sorted(maps.Keys(frameMap)) {
		geometries := frameMap[frameName]
		color := getFrameColor(frameName, drawnFrameSystem.Colors, drawnFrameSystem.FrameSystem)

		for _, geometry := range geometries.Geometries() {
			drawnGeometry, err := NewDrawnGeometry(geometry, WithGeometryColor(color))
			if err != nil {
				return nil, err
			}

			key := fmt.Sprintf("%s:%s:%s", config.uuid, frameName, geometry.Label())
			id := uuid.NewSHA1(uuidNamespace, []byte(key))
			transform, err := drawnGeometry.Draw(fmt.Sprintf("%s:%s", frameName, geometry.Label()), referenceframe.World, spatialmath.NewZeroPose(), WithTransformUUID(id[:]))
			if err != nil {
				return nil, err
			}

			transforms = append(transforms, transform)
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
