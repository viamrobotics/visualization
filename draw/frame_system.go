package draw

import (
	"maps"
	"slices"

	"github.com/google/uuid"
	drawv1 "github.com/viam-labs/motion-tools/draw/v1"
	commonv1 "go.viam.com/api/common/v1"
	"go.viam.com/rdk/referenceframe"
	"go.viam.com/rdk/spatialmath"
)

// DrawFrameSystemGeometries draws a frame system's geometries in the world frame
// Colors are mapped by frame name
// Returns the transforms that were drawn
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

			transform, err := NewTransform(uuid.New().String(), label, referenceframe.World, pose, geometry, metadataStruct)
			if err != nil {
				return nil, err
			}

			transforms.Transforms = append(transforms.Transforms, transform)
		}
	}

	return transforms, nil
}

func getFrameColor(frameName string, colors map[string]Color, frameSystem *referenceframe.FrameSystem) Color {
	if color, ok := colors[frameName]; ok {
		return color
	}

	frame := frameSystem.Frame(frameName)
	if frame != nil {
		parent, err := frameSystem.Parent(frame)
		if err == nil && parent != nil {
			return getFrameColor(parent.Name(), colors, frameSystem)
		}
	}

	return NewColor(WithName("magenta"))
}
