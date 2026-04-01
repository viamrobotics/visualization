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
//   - dotColor: An optional color for dots at each vertex in the line
func DrawLine(label string, points []spatialmath.Pose, color *[3]uint8, dotColor *[3]uint8) error {
	labelError := isASCIIPrintable(label)
	if labelError != nil {
		return labelError
	}

	var finalColor draw.Color
	if color != nil {
		finalColor = draw.NewColor(draw.WithRGB(color[0], color[1], color[2]))
	}

	var finalDotColor draw.Color
	if dotColor != nil {
		finalDotColor = draw.NewColor(draw.WithRGB(dotColor[0], dotColor[1], dotColor[2]))
	}

	pointsVec := make([]r3.Vector, len(points))
	for i, pose := range points {
		pointsVec[i] = pose.Point()
	}

	lineOpts := []draw.DrawLineOption{}
	if color != nil {
		lineOpts = append(lineOpts, draw.WithSingleLineColor(finalColor))
	}
	if dotColor != nil {
		lineOpts = append(lineOpts, draw.WithSingleDotColor(finalDotColor))
	}

	line, err := draw.NewLine(pointsVec, lineOpts...)
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

	lineColor := line.Colors[0]
	dotColor := line.DotColors[0]

	data = append(data,
		float32(nPoints),
		float32(lineColor.R)/255.0,
		float32(lineColor.G)/255.0,
		float32(lineColor.B)/255.0,
		float32(dotColor.R)/255.0,
		float32(dotColor.G)/255.0,
		float32(dotColor.B)/255.0,
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
