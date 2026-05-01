package draw

import (
	"maps"
	"slices"

	commonv1 "go.viam.com/api/common/v1"
	"go.viam.com/rdk/referenceframe"
)

// DrawnFrameSystem renders an entire reference frame system — every frame and the
// geometries attached to each — as a flat list of transforms. Frames inherit their
// render color from a parent frame when no explicit color is provided; the root
// fallback is magenta.
type DrawnFrameSystem struct {
	// ID is an optional identity prefix included in each emitted transform's
	// UUID derivation. When non-empty, identities are derived from
	// "ID:label:parent" rather than the default "label:parent", which
	// namespaces transforms across batches that share frame or geometry names
	// (e.g., two robots in the same scene). ID does not affect visible labels.
	ID string
	// FrameSystem is the reference frame system to render.
	FrameSystem *referenceframe.FrameSystem
	// Inputs are the frame system inputs (joint positions and similar) used to
	// resolve each frame's geometry pose.
	Inputs referenceframe.FrameSystemInputs
	// Colors maps frame names to their render color. Frames not present in the map
	// inherit from their parent frame, falling back to magenta at the root.
	Colors map[string]Color
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

// DrawFrameSystemOption configures color overrides for a DrawnFrameSystem.
type DrawFrameSystemOption func(*drawnFrameSystemConfig)

// WithFrameSystemColors replaces the entire frame-to-color map. Any earlier
// per-frame entries set via WithFrameSystemColor are discarded; combine the two by
// listing WithFrameSystemColors first, then WithFrameSystemColor.
func WithFrameSystemColors(colors map[string]Color) DrawFrameSystemOption {
	return func(config *drawnFrameSystemConfig) {
		config.colors = colors
	}
}

// WithFrameSystemColor sets or overrides the color for a single frame, leaving
// other frames' entries untouched.
func WithFrameSystemColor(frameName string, color Color) DrawFrameSystemOption {
	return func(config *drawnFrameSystemConfig) {
		config.colors[frameName] = color
	}
}

// NewDrawnFrameSystem returns a DrawnFrameSystem that will render frameSystem at
// the configuration described by inputs. Every frame is initially assigned magenta
// as its color; pass WithFrameSystemColors or WithFrameSystemColor to override.
func NewDrawnFrameSystem(frameSystem *referenceframe.FrameSystem, inputs referenceframe.FrameSystemInputs, options ...DrawFrameSystemOption) *DrawnFrameSystem {
	config := newDrawnFrameSystemConfig(frameSystem)
	for _, option := range options {
		option(config)
	}

	return &DrawnFrameSystem{FrameSystem: frameSystem, Inputs: inputs, Colors: config.colors}
}

// ToTransforms returns a flat slice of transforms covering every geometry attached
// to every frame in the frame system, sorted by frame name. Each emitted transform
// is labelled "frameName:geometryLabel". Of the supplied DrawableOptions, only
// WithParent is honored (it sets the parent reference frame for every emitted
// transform; defaults to referenceframe.World). Returns an error if frame system
// resolution or per-frame transform construction fails.
func (drawnFrameSystem *DrawnFrameSystem) ToTransforms(options ...DrawableOption) ([]*commonv1.Transform, error) {
	config := NewDrawConfig("", options...)
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

		drawing.ID = drawnFrameSystem.ID
		drawing.Name = frameName
		frameTransforms, err := drawing.ToTransforms(WithParent(config.Parent))
		if err != nil {
			return nil, err
		}

		transforms = append(transforms, frameTransforms...)
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
