package client

import (
	"encoding/json"
	"log"

	"google.golang.org/protobuf/encoding/protojson"

	"go.viam.com/rdk/pointcloud"
	"go.viam.com/rdk/referenceframe"
)

// DrawGeometries draws a list of geometries in the visualizer.
//
// Labels must be unique within a world. Calling DrawGeometries with labels that
// already exist will instead update the pose of that geometry. Only poses can be updated,
// geometries must be cleared if their shape is to change.
//
// Parameters:
//   - geometriesInFrame: a list of geometries
//   - colors: a list of corresponding colors for each geometry
func DrawGeometries(geometriesInFrame *referenceframe.GeometriesInFrame, colors []string) error {
	var geometries []json.RawMessage

	numPointclouds := 0

	for _, geo := range geometriesInFrame.Geometries() {
		pc, isPc := geo.(pointcloud.PointCloud)
		if isPc {
			// Dan: This is maybe in the wrong spot. The pointcloud is getting here from
			// `DrawWorldState` method (`DrawFrameSystem` presumably has a similar behavior). Those
			// methods just pass a list of geometries in bulk to this API. I put this here as it's
			// convenient to not rewrite those (or any other) methods that passthrough a bunch of
			// geometries in one swoop.
			//
			// Another caveat from that is this hard-coded downscaling. Necessary for performance on
			// the experiments where running now with real-world data. But obviously not immediately
			// flexible for other use-cases.
			if err := DrawPointCloudDownscaled(geo.Label(), pc, 25, &[3]uint8{200, 0, 0}); err != nil {
				return err
			}

			numPointclouds += 1

			continue
		}

		pb := geo.ToProtobuf()
		if pb == nil {
			log.Printf("DrawGeometries: geometry %q has nil protobuf, skipping", geo.Label())
			continue
		}

		data, err := protojson.Marshal(pb)
		if err != nil {
			return err
		}

		geometries = append(geometries, json.RawMessage(data))
	}

	if len(geometries) == 0 {
		if numPointclouds == 0 {
			log.Printf("DrawGeometries: no valid geometries to draw.")
		}

		return nil
	}

	result, err := json.Marshal(map[string]interface{}{
		"geometries": geometries,
		"colors":     colors,
		"parent":     geometriesInFrame.Parent(),
	})

	if err != nil {
		return err
	}

	return postHTTP(result, "json", "geometries")
}
