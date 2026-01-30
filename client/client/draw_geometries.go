package client

import (
	"encoding/json"
	"log"

	"github.com/golang/geo/r3"
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
			downscaled, err := drawPointCloudDownscaled(geo.Label(), pc, 25)
			if err != nil {
				return err
			}

			if err := DrawPointCloud(geo.Label(), downscaled, &[3]uint8{200, 0, 0}); err != nil {
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

func drawPointCloudDownscaled(label string, pc pointcloud.PointCloud, minDistance float64) (pointcloud.PointCloud, error) {
	labelError := isASCIIPrintable(label)
	if labelError != nil {
		return nil, labelError
	}

	addedPoints := make([]struct {
		point r3.Vector
		data  pointcloud.Data
	}, 0)
	pc.Iterate(0, 0, func(p r3.Vector, d pointcloud.Data) bool {
		for idx := range addedPoints {
			// Dan: In lieu of a geo index for these distance/collision lookups, we use a O(n^2)
			// algorithm. Given the below details with a `minDistance` of 25 "distance units", this
			// takes ~20 seconds on a work machine. Keeping a total of ~8000 points. Fifty "distance
			// units" took ~7 seconds. Keeping a total of ~2000 points. For this use-case I'd like
			// to drop the distance down to between 2->10. But I expect the current quadratic
			// algorithm to be prohibitively slow there.
			if addedPoints[idx].point.Distance(p) < minDistance {
				// Too close to a point we've added. Move on to the next candidate.
				//
				// Dan: If it's useful for tuning an indexing data structure, I've found:
				// - a 3.5 million point pointcloud
				// - representing a ~1 square meter surface
				// - that results in 56MB http payload
				// Has neighboring points that are as small as 1 "distance unit" apart
				return true
			}
		}
		addedPoints = append(addedPoints, struct {
			point r3.Vector
			data  pointcloud.Data
		}{p, d})
		return true
	})

	downscaled := pointcloud.NewBasicPointCloud(len(addedPoints))
	for _, point := range addedPoints {
		downscaled.Set(point.point, point.data)
	}

	return downscaled, nil
}
