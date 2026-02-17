package draw

import (
	"fmt"

	drawv1 "github.com/viam-labs/motion-tools/draw/v1"
	commonv1 "go.viam.com/api/common/v1"
	"go.viam.com/rdk/referenceframe"
	"go.viam.com/rdk/spatialmath"
)

// DrawGeometry creates a transform for rendering a single geometry with the specified id, pose,
// parent reference frame, and color. Returns an error if the metadata cannot be converted to a struct.
func DrawGeometry(
	geometry spatialmath.Geometry,
	pose spatialmath.Pose,
	parent string,
	color Color,
) (*commonv1.Transform, error) {
	label := geometry.Label()
	metadata := NewMetadata(WithMetadataColors(color))
	metadataStruct, err := MetadataToStruct(metadata)
	if err != nil {
		return nil, err
	}

	return NewTransform(label, parent, pose, geometry, metadataStruct), nil
}

// DrawGeometries creates transforms for rendering multiple geometries, each with its own color.
// Returns an error if the number of colors doesn't match the number of geometries.
func DrawGeometries(geometriesInFrame *referenceframe.GeometriesInFrame, colors []Color) (*drawv1.Transforms, error) {
	geometries := geometriesInFrame.Geometries()
	if len(colors) != len(geometries) {
		return nil, fmt.Errorf("number of colors must match number of geometries")
	}

	transforms := &drawv1.Transforms{
		Transforms: make([]*commonv1.Transform, len(geometries)),
	}

	for i, geometry := range geometries {
		transform, err := DrawGeometry(geometry, geometry.Pose(), geometriesInFrame.Parent(), colors[i])
		if err != nil {
			return nil, err
		}

		transforms.Transforms[i] = transform
	}

	return transforms, nil
}
