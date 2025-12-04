package client

import (
	"bytes"
	"encoding/binary"

	"go.viam.com/rdk/spatialmath"
)

// DrawPoses draws a list of poses in the visualizer as arrows.
//
// Parameters:
//   - poses: a list of poses
//   - colors: Individual arrow color
//   - arrowHeadAtPose: whether the tip of the cone of the arrow will be at the pose. default is false
func DrawPoses(poses []spatialmath.Pose, colors []string, arrowHeadAtPose bool) error {
	nPoses := len(poses)
	nColors := len(colors)
	total := 1 + 3 + nPoses*6 + nColors*3

	data := make([]float32, 0, total)

	a := 0.
	if arrowHeadAtPose {
		a = 1.
	}

	// Header
	data = append(data, float32(posesType), float32(nPoses), float32(nColors), float32(a))

	for _, pose := range poses {
		point := pose.Point()
		orientation := pose.Orientation().OrientationVectorDegrees()
		data = append(data,
			float32(point.X),
			float32(point.Y),
			float32(point.Z),
			float32(orientation.OX),
			float32(orientation.OY),
			float32(orientation.OZ))
	}

	for _, c := range colors {
		rgb, err := hexToRGB(c)
		if err != nil {
			return err
		}

		data = append(data,
			float32(rgb[0])/255.0,
			float32(rgb[1])/255.0,
			float32(rgb[2])/255.0,
		)
	}

	buf := new(bytes.Buffer)
	err := binary.Write(buf, binary.LittleEndian, data)
	if err != nil {
		return err
	}

	return postHTTP(buf.Bytes(), "octet-stream", "poses")
}
