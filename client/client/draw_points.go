package client

import (
	"encoding/binary"
	"math"

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

	// Ensure defaultColor is always valid (avoid nil panic)
	dc := [3]uint8{0, 0, 0}
	if defaultColor != nil {
		dc = *defaultColor
	}

	nPoints := len(points.Positions)
	nColors := len(points.Colors)

	// Float32 section layout (unchanged from your existing protocol):
	// [type, labelLen]                       -> 2 floats
	// [label bytes as floats]                -> labelLen floats
	// [nPoints, nColors]                     -> 2 floats
	// [defaultColor normalized rgb floats]   -> 3 floats
	// [positions xyz floats]                 -> nPoints*3 floats
	floatCount := 2 + labelLen + 2 + 3 + nPoints*3

	// Total bytes:
	// float payload: floatCount * 4 bytes
	// color payload: nColors * 3 bytes (raw uint8)
	totalBytes := floatCount*4 + nColors*3

	out := make([]byte, totalBytes)
	off := 0

	putF32 := func(v float32) {
		binary.LittleEndian.PutUint32(out[off:], math.Float32bits(v))
		off += 4
	}

	// Header
	putF32(float32(pointsType))
	putF32(float32(labelLen))

	// Label bytes as float32s (kept exactly as your current encoding)
	for _, b := range labelBytes {
		putF32(float32(b))
	}

	putF32(float32(nPoints))
	putF32(float32(nColors))

	// Default color stays normalized floats (kept exactly as your current encoding)
	putF32(float32(dc[0]) / 255.0)
	putF32(float32(dc[1]) / 255.0)
	putF32(float32(dc[2]) / 255.0)

	// Positions (kept exactly as your current encoding)
	for _, p := range points.Positions {
		putF32(float32(p.X) / 1000.0)
		putF32(float32(p.Y) / 1000.0)
		putF32(float32(p.Z) / 1000.0)
	}

	// Colors as raw bytes (0..255), same idea as posesToBytes
	for _, c := range points.Colors {
		out[off+0] = uint8(c.R)
		out[off+1] = uint8(c.G)
		out[off+2] = uint8(c.B)
		off += 3
	}

	return out, nil
}
