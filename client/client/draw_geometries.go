package client

import (
	"encoding/json"

	"github.com/viam-labs/motion-tools/client/colorutil"
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
	geometries := make([]json.RawMessage, len(geometriesInFrame.Geometries()))

	for i, geo := range geometriesInFrame.Geometries() {
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
			continue
		}

		data, err := protojson.Marshal(geo.ToProtobuf())
		if err != nil {
			return err
		}
		geometries[i] = json.RawMessage(data)
	}

	result, err := json.Marshal(map[string]interface{}{
		"geometries": geometries,
		"colors":     colorutil.NamedColorsToHexes(colors),
		"parent":     geometriesInFrame.Parent(),
	})

	if err != nil {
		return err
	}

	return postHTTP(result, "json", "geometries")
}
