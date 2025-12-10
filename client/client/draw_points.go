package client

import (
	"bytes"
	"encoding/binary"

	"github.com/golang/geo/r3"
	"github.com/viam-labs/motion-tools/draw"
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

	var fallbackColor draw.Color
	if color != nil {
		fallbackColor = draw.NewColor(draw.WithRGB(color[0], color[1], color[2]))
	} else {
		fallbackColor = draw.NewColor(draw.WithRGB(0, 0, 0))
	}

	pointsVec := make([]r3.Vector, len(points))
	for i, pose := range points {
		pointsVec[i] = pose.Point()
	}

	colorPerPoint := make([]draw.Color, len(colors))
	for i, color := range colors {
		colorPerPoint[i] = draw.NewColor(draw.WithRGB(color[0], color[1], color[2]))
	}

	// fill colorperpoint with fallbackColor if it's less than the number of points
	if len(colorPerPoint) < len(points) {
		needed := len(points) - len(colorPerPoint)
		fallbacks := make([]draw.Color, needed)
		for i := range fallbacks {
			fallbacks[i] = fallbackColor
		}
		colorPerPoint = append(colorPerPoint, fallbacks...)
	}

	drawPoints, err := draw.NewPoints(pointsVec, draw.WithPerPointColors(colorPerPoint...))
	if err != nil {
		return err
	}

	buf, err := pointsToBytes(drawPoints, label, color)
	if err != nil {
		return err
	}

	return postHTTP(buf, "octet-stream", "points")
}

func pointsToBytes(points *draw.Points, label string, defaultColor *[3]uint8) ([]byte, error) {
	labelBytes := []byte(label)
	labelLen := len(labelBytes)

	nPoints := len(points.Positions)
	nColors := len(points.Colors)

	total := 1 + 1 + labelLen + 2 + 3 + nPoints*3 + nColors*3
	data := make([]float32, 0, total)

	data = append(data, float32(pointsType), float32(labelLen))
	for _, b := range labelBytes {
		data = append(data, float32(b))
	}

	data = append(data,
		float32(nPoints),
		float32(nColors),
		float32(defaultColor[0])/255.0,
		float32(defaultColor[1])/255.0,
		float32(defaultColor[2])/255.0,
	)

	for _, position := range points.Positions {
		data = append(data,
			float32(position.X)/1000.0,
			float32(position.Y)/1000.0,
			float32(position.Z)/1000.0,
		)
	}
	for _, color := range points.Colors {
		data = append(data,
			float32(color.R)/255.0,
			float32(color.G)/255.0,
			float32(color.B)/255.0,
		)
	}

	buf := new(bytes.Buffer)
	if err := binary.Write(buf, binary.LittleEndian, data); err != nil {
		return nil, err
	}

	return buf.Bytes(), nil
}
