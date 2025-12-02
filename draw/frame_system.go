package draw

import (
	"maps"
	"slices"

	"github.com/google/uuid"
	drawv1 "github.com/viam-labs/motion-tools/gen/draw/v1"
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
	colors map[string]*Color,
	units Units,
) (*drawv1.Transforms, error) {
	transforms := &drawv1.Transforms{
		Transforms: make([]*commonv1.Transform, 0),
	}

	// Create transforms for all frames (including parent frames without geometries)
	frameNames := frameSystem.FrameNames()
	for _, frameName := range frameNames {
		if frameName == referenceframe.World {
			continue
		}

		frame := frameSystem.Frame(frameName)
		if frame == nil {
			continue
		}

		parent, err := frameSystem.Parent(frame)
		if err != nil {
			continue
		}

		parentName := referenceframe.World
		if parent != nil {
			parentName = parent.Name()
		}

		pose := spatialmath.NewZeroPose()

		color := getFrameColor(frameName, colors, frameSystem)
		metadata := NewMetadata([]*Color{color})
		metadataStruct, err := MetadataToStruct(metadata)
		if err != nil {
			return nil, err
		}

		transform, err := NewTransform(uuid.New().String(), frameName, parentName, pose, nil, metadataStruct, units)
		if err != nil {
			return nil, err
		}

		transforms.Transforms = append(transforms.Transforms, transform)
	}

	// Then, create transforms for all geometries
	frameMap, err := referenceframe.FrameSystemGeometries(frameSystem, inputs)
	if err != nil {
		return nil, err
	}

	for _, frameName := range slices.Sorted(maps.Keys(frameMap)) {
		geometries := frameMap[frameName]
		color := getFrameColor(frameName, colors, frameSystem)

		for _, geometry := range geometries.Geometries() {
			label := geometry.Label()
			parent := geometries.Parent()
			pose := spatialmath.NewZeroPose()

			if color != nil {
				metadata := NewMetadata([]*Color{color})
				metadataStruct, err := MetadataToStruct(metadata)
				if err != nil {
					return nil, err
				}

				transform, err := NewTransform(uuid.New().String(), label, parent, pose, geometry, metadataStruct, units)
				if err != nil {
					return nil, err
				}

				transforms.Transforms = append(transforms.Transforms, transform)
			}
		}
	}

	return transforms, nil
}

func getFrameColor(frameName string, colors map[string]*Color, frameSystem *referenceframe.FrameSystem) *Color {
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

	return NewColor().ByName("magenta").SetAlpha(0.7)
}
