package client

import (
	"github.com/viam-labs/motion-tools/draw"
	"go.viam.com/rdk/referenceframe"
	"go.viam.com/rdk/spatialmath"
)

// DrawFrameSystem will draw a frame system in the visualizer.
// Parameters:
//   - fs: A frame system
//   - inputs: Frame system inputs
func DrawFrameSystem(fs *referenceframe.FrameSystem, inputs referenceframe.FrameSystemInputs) error {

	colorMap := make(map[string]draw.Color)
	transforms, err := draw.DrawFrameSystemGeometries(fs, inputs, colorMap)
	if err != nil {
		return err
	}

	geometries := make([]spatialmath.Geometry, 0)
	colors := make([]string, 0)
	for _, transform := range transforms.Transforms {
		geometry, err := spatialmath.NewGeometryFromProto(transform.GetPhysicalObject())
		if err != nil {
			return err
		}
		geometries = append(geometries, geometry)
		// MATTHEW: decode the colors from the metadata
		colors = append(colors, transform.Metadata.Fields["colors"].GetStringValue())
	}

	geometriesInFrame := referenceframe.NewGeometriesInFrame("world", geometries)
	DrawGeometries(geometriesInFrame, colors)

	return nil
}
