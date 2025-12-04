package client

import (
	"maps"
	"slices"

	"go.viam.com/rdk/referenceframe"
)

// DrawFrameSystem will draw a frame system in the visualizer.
// Parameters:
//   - fs: A frame system
//   - inputs: Frame system inputs
func DrawFrameSystem(fs *referenceframe.FrameSystem, inputs referenceframe.FrameSystemInputs) error {
	frameGeomMap, err := referenceframe.FrameSystemGeometries(fs, inputs)
	if err != nil {
		return err
	}

	i := 0
	// We iterate the map of frame labels in a consistent order. Consider the case where a user
	// wants to visualize a plan by writing:
	//
	// for each `FrameSystemInputs` in the plan {
	//   RemoveAllSpatialObjects()
	//   DrawFrameSystem(fs, currentInputs)
	// }
	//
	// In this case, the set of figures in the visualization are the same. With just a few figures
	// moving from one image to the next. It's distracting to see what's happening when the colors
	// are changing with each image. Hence sorting on the label names allows us to enforce a
	// consistent color scheme for each figure when the geometry labels remain the same.
	for _, geomLabel := range slices.Sorted(maps.Keys(frameGeomMap)) {
		geoms := frameGeomMap[geomLabel]
		geometries := geoms.Geometries()
		colors := make([]string, len(geometries))
		for j := range geometries {
			colors[j] = DefaultColorMap[i%len(DefaultColorMap)]
		}
		if err = DrawGeometries(geoms, colors); err != nil {
			return err
		}
		i++
	}
	return nil
}
