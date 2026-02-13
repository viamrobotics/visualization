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

// DrawFrameSystemGeometries renders all geometries in a frame system to the world frame.
// The colors map allows you to specify colors for specific frames by name; frames without
// specified colors inherit their parent's color or default to magenta. Returns the rendered
// transforms or an error if the frame system cannot be converted.
func DrawFrameSystemGeometries(
	frameSystem *referenceframe.FrameSystem,
	inputs referenceframe.FrameSystemInputs,
	colors map[string]Color,
) (*drawv1.Transforms, error) {
	transforms := &drawv1.Transforms{
		Transforms: make([]*commonv1.Transform, 0),
	}

	frameMap, err := referenceframe.FrameSystemGeometries(frameSystem, inputs)
	if err != nil {
		return nil, err
	}

	for _, frameName := range slices.Sorted(maps.Keys(frameMap)) {
		geometries := frameMap[frameName]
		color := getFrameColor(frameName, colors, frameSystem)

		for _, geometry := range geometries.Geometries() {
			label := geometry.Label()
			pose := spatialmath.NewZeroPose()
			metadata := NewMetadata(WithMetadataColors(color))
			metadataStruct, err := MetadataToStruct(metadata)
			if err != nil {
				return nil, err
			}

			transform := NewTransform(fmt.Sprintf("%s:%s", frameName, label), referenceframe.World, pose, geometry, metadataStruct)
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
