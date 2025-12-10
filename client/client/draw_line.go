package client

import (
	"bytes"
	"encoding/binary"

	"github.com/golang/geo/r3"
	"github.com/viam-labs/motion-tools/draw"
	"go.viam.com/rdk/spatialmath"
)

// DrawLine draws a line in the visualizer.
//
// Parameters:
//   - label: an identifier string used for reference in the treeview.
//   - points: a list of poses, each representing a point in the line
//   - color: An optional color of the line
//   - pointColor: An optional color for points for each vertex in the line
func DrawLine(label string, points []spatialmath.Pose, color *[3]uint8, pointColor *[3]uint8) error {
	labelError := isASCIIPrintable(label)
	if labelError != nil {
		return labelError
	}

	var finalColor draw.Color
	if color != nil {
		finalColor = draw.NewColor(draw.WithRGB(color[0], color[1], color[2]))
	}

	var finalPointColor draw.Color
	if pointColor != nil {
		finalPointColor = draw.NewColor(draw.WithRGB(pointColor[0], pointColor[1], pointColor[2]))
	}

	pointsVec := make([]r3.Vector, len(points))
	for i, pose := range points {
		pointsVec[i] = pose.Point()
	}

	line, err := draw.NewLine(pointsVec, draw.WithLineColors(finalColor, &finalPointColor))
	if err != nil {
		return err
	}

	buf, err := lineToBytes(line, label)
	if err != nil {
		return err
	}

	return postHTTP(buf, "octet-stream", "line")
}

func lineToBytes(line *draw.Line, label string) ([]byte, error) {
	labelBytes := []byte(label)
	labelLen := len(labelBytes)

	nPoints := len(line.Positions)

	total := 1 + 1 + labelLen + 1 + 3 + 3 + nPoints*3
	data := make([]float32, 0, total)
	data = append(data, float32(lineType), float32(labelLen))
	for _, b := range labelBytes {
		data = append(data, float32(b))
	}

	data = append(data,
		float32(nPoints),
		float32(line.LineColor.R)/255.0,
		float32(line.LineColor.G)/255.0,
		float32(line.LineColor.B)/255.0,
		float32(line.PointColor.R)/255.0,
		float32(line.PointColor.G)/255.0,
		float32(line.PointColor.B)/255.0,
	)

	for _, position := range line.Positions {
		data = append(data,
			float32(position.X)/1000.0,
			float32(position.Y)/1000.0,
			float32(position.Z)/1000.0,
		)
	}

	buf := new(bytes.Buffer)
	if err := binary.Write(buf, binary.LittleEndian, data); err != nil {
		return nil, err
	}

	return buf.Bytes(), nil
}
