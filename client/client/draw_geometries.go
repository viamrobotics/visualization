package client

import (
	"bytes"
	"encoding/binary"
	"encoding/json"
	"image/color"
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
			buf, err := drawPointCloudDownscaled(geo.Label(), pc, 25, &[3]uint8{200, 0, 0})
			if err != nil {
				return err
			}

			if err := postHTTP(buf, "octet-stream", "points"); err != nil {
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

func drawPointCloudDownscaled(label string, pc pointcloud.PointCloud, minDistance float64, overrideColor *[3]uint8) ([]byte, error) {
	labelError := isASCIIPrintable(label)
	if labelError != nil {
		return nil, labelError
	}

	labelBytes := []byte(label)
	labelLen := len(labelBytes)

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

	nPoints := len(addedPoints)
	hasColor := pc.MetaData().HasColor && overrideColor == nil
	nColors := 0
	if hasColor {
		nColors = nPoints
	}

	// total floats:
	// 1 (type) + 1 (label length) + labelLen + 2 (nPoints, nColors) + 3 (default color)
	// + 3*nPoints (positions) + 3*nColors (colors)
	total := 1 + 1 + labelLen + 2 + 3 + nPoints*3 + nColors*3
	data := make([]float32, 0, total)

	data = append(data, float32(pointsType), float32(labelLen))
	for _, b := range labelBytes {
		data = append(data, float32(b))
	}

	// Set to -1 by default to communicate intentionally no color
	// Allows users to set default colors in the web app.
	finalColor := [3]float32{-255., -255., -255.}
	if overrideColor != nil {
		finalColor[0] = float32(overrideColor[0])
		finalColor[1] = float32(overrideColor[1])
		finalColor[2] = float32(overrideColor[2])
	}

	// Header: nPoints, nColors, color
	data = append(data,
		float32(nPoints),
		float32(nColors),
		float32(finalColor[0])/255.0,
		float32(finalColor[1])/255.0,
		float32(finalColor[2])/255.0,
	)

	colors := make([]float32, 0, nColors*3)

	for idx := range addedPoints {
		p := &addedPoints[idx]

		data = append(data,
			float32(p.point.X)/1000.0,
			float32(p.point.Y)/1000.0,
			float32(p.point.Z)/1000.0,
		)

		if hasColor && p.data.HasColor() {
			col := p.data.Color()
			nrgba := color.NRGBAModel.Convert(col).(color.NRGBA)

			colors = append(colors,
				float32(nrgba.R)/255.0,
				float32(nrgba.G)/255.0,
				float32(nrgba.B)/255.0,
			)
		}
	}

	data = append(data, colors...)

	// Binary write
	buf := new(bytes.Buffer)
	if err := binary.Write(buf, binary.LittleEndian, data); err != nil {
		return nil, err
	}

	return buf.Bytes(), nil
}
