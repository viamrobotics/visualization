package client

import (
	"bytes"
	"encoding/binary"

	"go.viam.com/rdk/spatialmath"
)

// DrawPoints draws a list of points in the visualizer.
//
// Parameters:
//   - label: an identifier string used for reference in the treeview
//   - points: a list of poses, each representing a point
//   - colors: Individual point color, optional, and will fallback to defaultColor
//   - color: an optional fallback color [R, G, B] (0–255); use nil for black
func DrawPoints(label string, points []spatialmath.Pose, colors [][3]uint8, color *[3]uint8) error {
	labelError := isASCIIPrintable(label)
	if labelError != nil {
		return labelError
	}

	labelBytes := []byte(label)
	labelLen := len(labelBytes)

	nPoints := len(points)
	nColors := len(colors)

	// total floats:
	// 1 (type) + 1 (label length) + labelLen + 2 (nPoints, nColors) + 3 (default color)
	// + 3*nPoints (positions) + 3*nColors (colors)
	total := 1 + 1 + labelLen + 2 + 3 + nPoints*3 + nColors*3
	data := make([]float32, 0, total)

	data = append(data, float32(pointsType), float32(labelLen))
	for _, b := range labelBytes {
		data = append(data, float32(b))
	}

	fallbackColor := [3]uint8{0, 0, 0}
	if color == nil {
		color = &fallbackColor
	}

	data = append(data,
		float32(nPoints),
		float32(nColors),
		float32(color[0])/255.0,
		float32(color[1])/255.0,
		float32(color[2])/255.0,
	)

	for _, pose := range points {
		point := pose.Point()
		data = append(data,
			float32(point.X)/1000.0,
			float32(point.Y)/1000.0,
			float32(point.Z)/1000.0,
		)
	}

	for _, color := range colors {
		data = append(data,
			float32(color[0])/255.0,
			float32(color[1])/255.0,
			float32(color[2])/255.0,
		)
	}

	buf := new(bytes.Buffer)
	if err := binary.Write(buf, binary.LittleEndian, data); err != nil {
		return err
	}

	return postHTTP(buf.Bytes(), "octet-stream", "points")
}
