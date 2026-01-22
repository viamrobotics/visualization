package client

import (
	"encoding/binary"
	"image/color"
	"math"

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

	// We don't actually know how many colored points we'll see until we iterate
	nColors := 0

	// Sentinel default color (-255 => -1.0 after /255) means "intentionally no override color"
	finalColor := [3]float32{-255., -255., -255.}
	if overrideColor != nil {
		finalColor[0] = float32(overrideColor[0])
		finalColor[1] = float32(overrideColor[1])
		finalColor[2] = float32(overrideColor[2])
	}

	// Float32 section:
	// type, labelLen, label bytes, nPoints, nColors, defaultColor(3), positions(3*nPoints)
	floatCount := 2 + labelLen + 2 + 3 + nPoints*3

	// We don't know nColors yet; allocate assuming worst-case if hasColor, else 0.
	colorByteCap := 0
	if hasColor {
		colorByteCap = nPoints * 3
	}

	// Total buffer = float section + color bytes (worst-case), then we slice to actual size.
	out := make([]byte, floatCount*4+colorByteCap)
	offset := 0

	putF32 := func(v float32) {
		binary.LittleEndian.PutUint32(out[offset:], math.Float32bits(v))
		offset += 4
	}

	putU32 := func(v uint32) {
		binary.LittleEndian.PutUint32(out[offset:], v)
		offset += 4
	}

	// Header
	putF32(float32(pointsType))
	putF32(float32(labelLen))
	for _, b := range labelBytes {
		putF32(float32(b))
	}

	// Placeholder nColors for now; patch later once we know nColors.
	nColorsOffsetBytes := offset + 4 // after writing nPoints, the next float is nColors
	putU32(uint32(nPoints))
	putU32(0) // nColors placeholder

	putF32(finalColor[0] / 255.0)
	putF32(finalColor[1] / 255.0)
	putF32(finalColor[2] / 255.0)

	// Positions first (float32)
	// Colors appended as bytes after all positions
	colorOffset := floatCount * 4

	pc.Iterate(0, 0, func(p r3.Vector, d pointcloud.Data) bool {
		putF32(float32(p.X) / 1000.0)
		putF32(float32(p.Y) / 1000.0)
		putF32(float32(p.Z) / 1000.0)

		if hasColor && d.HasColor() {
			col := d.Color()
			nrgba := color.NRGBAModel.Convert(col).(color.NRGBA)

			out[colorOffset+0] = nrgba.R
			out[colorOffset+1] = nrgba.G
			out[colorOffset+2] = nrgba.B
			colorOffset += 3
			nColors++
		}
		return true
	})

	// Patch nColors in the float header
	binary.LittleEndian.PutUint32(out[nColorsOffsetBytes:], uint32(nColors))

	// Trim buffer to actual used size
	return postHTTP(out[:colorOffset], "octet-stream", "points")
}
