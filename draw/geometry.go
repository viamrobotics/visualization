package draw

import (
	drawv1 "github.com/viam-labs/motion-tools/gen/draw/v1"
	commonv1 "go.viam.com/api/common/v1"
	"go.viam.com/rdk/referenceframe"
	"go.viam.com/rdk/spatialmath"
)

// DrawGeometry draws a geometry
func DrawGeometry(
	id string,
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

	return NewTransform(id, label, parent, pose, geometry, metadataStruct)
}

func DrawGeometries(geometries *referenceframe.GeometriesInFrame, colors []Color) (*drawv1.Transforms, error) {
	geos := geometries.Geometries()
	transforms := &drawv1.Transforms{
		Transforms: make([]*commonv1.Transform, len(geos)),
	}

	for i, geometry := range geos {
		transform, err := DrawGeometry("", geometry, geometry.Pose(), geometries.Parent(), colors[i])
		if err != nil {
			return nil, err
		}

		transforms.Transforms[i] = transform
	}

	return transforms, nil
}
