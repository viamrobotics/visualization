package client

import (
	"bytes"
	"encoding/binary"

	"go.viam.com/rdk/spatialmath"
)

// DrawLine draws a line in the visualizer.
//
// Parameters:
//   - label: an identifier string used for reference in the treeview.
//   - points: a list of poses, each representing a point in the line
//   - color: An optional color of the line
//   - dotColor: An optional color for dots for each vertex in the line
func DrawLine(label string, points []spatialmath.Pose, color *[3]uint8, dotColor *[3]uint8) error {
	labelError := isASCIIPrintable(label)
	if labelError != nil {
		return labelError
	}

	labelBytes := []byte(label)
	labelLen := len(labelBytes)

	nPoints := len(points)

	// total floats:
	// 1 (type) + 1 (label length) + labelLen + 1 (nPoints) + 3 (default color)
	// + 3 (default dot color) + 3*nPoints (positions)
	total := 1 + 1 + labelLen + 1 + 3 + 3 + nPoints*3
	data := make([]float32, 0, total)

	data = append(data, float32(lineType), float32(labelLen))
	for _, b := range labelBytes {
		data = append(data, float32(b))
	}

	// Set to -1 by default to communicate intentionally no color
	// Allows users to set default colors in the web app.
	finalColor := [3]float32{-255., -255., -255.}
	if color != nil {
		finalColor[0] = float32(color[0])
		finalColor[1] = float32(color[1])
		finalColor[2] = float32(color[2])
	}

	finalDotColor := [3]float32{-255., -255., -255.}
	if dotColor != nil {
		finalDotColor[0] = float32(dotColor[0])
		finalDotColor[1] = float32(dotColor[1])
		finalDotColor[2] = float32(dotColor[2])
	}

	data = append(data,
		float32(nPoints),
		finalColor[0]/255.0,
		finalColor[1]/255.0,
		finalColor[2]/255.0,
		finalDotColor[0]/255.0,
		finalDotColor[1]/255.0,
		finalDotColor[2]/255.0,
	)

	for _, pose := range points {
		point := pose.Point()
		data = append(data,
			float32(point.X)/1000.0,
			float32(point.Y)/1000.0,
			float32(point.Z)/1000.0,
		)
	}

	buf := new(bytes.Buffer)
	if err := binary.Write(buf, binary.LittleEndian, data); err != nil {
		return err
	}

	return postHTTP(buf.Bytes(), "octet-stream", "line")
}
