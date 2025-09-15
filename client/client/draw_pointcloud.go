package client

import (
	"bytes"
	"encoding/binary"
	"image/color"

	"github.com/golang/geo/r3"

	"go.viam.com/rdk/pointcloud"
)

// DrawPointCloud draws a PointCloud in the visualizer.
//
// Parameters:
//   - label: an identifier string used for reference in the treeview
//   - pc: a PointCloud
//   - color: an optional override color [R, G, B] (0–255); use nil for original color.
func DrawPointCloud(label string, pc pointcloud.PointCloud, overrideColor *[3]uint8) error {
	labelError := isASCIIPrintable(label)
	if labelError != nil {
		return labelError
	}

	labelBytes := []byte(label)
	labelLen := len(labelBytes)

	nPoints := pc.Size()
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
	countColors := 0

	// Iterate points
	pc.Iterate(0, 0, func(p r3.Vector, d pointcloud.Data) bool {
		data = append(data,
			float32(p.X)/1000.0,
			float32(p.Y)/1000.0,
			float32(p.Z)/1000.0,
		)

		if hasColor && d.HasColor() {
			col := d.Color()
			nrgba := color.NRGBAModel.Convert(col).(color.NRGBA)

			colors = append(colors,
				float32(nrgba.R)/255.0,
				float32(nrgba.G)/255.0,
				float32(nrgba.B)/255.0,
			)
			countColors++
		}
		return true
	})

	data = append(data, colors...)

	// Correct the colors length if some points don't have colors
	data[3+labelLen] = float32(countColors)

	// Binary write
	buf := new(bytes.Buffer)
	if err := binary.Write(buf, binary.LittleEndian, data); err != nil {
		return err
	}

	return postHTTP(buf.Bytes(), "octet-stream", "points")
}
