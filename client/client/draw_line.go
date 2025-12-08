package client

import (
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

	buf, err := line.ToBytes(label, lineType)
	if err != nil {
		return err
	}

	return postHTTP(buf, "octet-stream", "line")
}
