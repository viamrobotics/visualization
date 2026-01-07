package client

import (
	"bytes"
	"encoding/binary"
	"image/color"

	"github.com/golang/geo/r3"

	"go.viam.com/rdk/pointcloud"
)

const pointsPerChunk = 1000

// DrawPointCloud draws a PointCloud in the visualizer.
//
// Parameters:
//   - label: an identifier string used for reference in the treeview
//   - pc: a PointCloud
//   - color: an optional override color [R, G, B] (0–255); use nil for original color.
func DrawPointCloud(label string, pc pointcloud.PointCloud, overrideColor *[3]uint8) error {
	if err := isASCIIPrintable(label); err != nil {
		return err
	}

	labelBytes := []byte(label)
	labelLen := len(labelBytes)

	totalPoints := pc.Size()
	if totalPoints == 0 {
		return nil
	}

	batchCount := (totalPoints + pointsPerChunk - 1) / pointsPerChunk
	hasColor := pc.MetaData().HasColor && overrideColor == nil

	finalColor := [3]float32{-255., -255., -255.}
	if overrideColor != nil {
		finalColor[0] = float32(overrideColor[0]) / 255.0
		finalColor[1] = float32(overrideColor[1]) / 255.0
		finalColor[2] = float32(overrideColor[2]) / 255.0
	}

	batchIndex := 0
	pointCount := 0

	var data []float32
	var colors []float32

	flush := func() error {
		if pointCount == 0 {
			return nil
		}

		headerSize :=
			1 + 1 + labelLen + // type + label
				2 + // batchIndex + batchCount
				2 + 3 // nPoints + nColors + default color

		bufData := make([]float32, 0,
			headerSize+
				pointCount*3+
				len(colors),
		)

		bufData = append(bufData, float32(pointsType), float32(labelLen))
		for _, b := range labelBytes {
			bufData = append(bufData, float32(b))
		}

		bufData = append(bufData,
			float32(batchIndex),
			float32(batchCount),
			float32(pointCount),
			float32(totalPoints),
			float32(pointsPerChunk),
			float32(len(colors)/3),
			finalColor[0],
			finalColor[1],
			finalColor[2],
		)

		bufData = append(bufData, data...)
		bufData = append(bufData, colors...)

		buf := new(bytes.Buffer)
		if err := binary.Write(buf, binary.LittleEndian, bufData); err != nil {
			return err
		}

		if err := postHTTP(buf.Bytes(), "application/octet-stream", "points"); err != nil {
			return err
		}

		batchIndex++
		pointCount = 0
		data = data[:0]
		colors = colors[:0]
		return nil
	}

	pc.Iterate(0, 0, func(p r3.Vector, d pointcloud.Data) bool {
		data = append(data,
			float32(p.X)/1000.0,
			float32(p.Y)/1000.0,
			float32(p.Z)/1000.0,
		)
		pointCount++

		if hasColor && d.HasColor() {
			c := color.NRGBAModel.Convert(d.Color()).(color.NRGBA)
			colors = append(colors,
				float32(c.R)/255.0,
				float32(c.G)/255.0,
				float32(c.B)/255.0,
			)
		}

		if pointCount == pointsPerChunk {
			if err := flush(); err != nil {
				return false
			}
		}

		return true
	})

	return flush()
}

func DrawPointCloudDownscaled(label string, pc pointcloud.PointCloud, minDistance float64, overrideColor *[3]uint8) error {
	labelError := isASCIIPrintable(label)
	if labelError != nil {
		return labelError
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
			float32(p.point.X),
			float32(p.point.Y),
			float32(p.point.Z),
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
		return err
	}

	return postHTTP(buf.Bytes(), "octet-stream", "points")
}
