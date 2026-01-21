package client

import (
	"bytes"
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

	// We don't actually know how many colored points we'll see until we iterate,
	// because d.HasColor() can be false per-point even when metadata says HasColor.
	// We'll count as we go.
	countColors := 0

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
	off := 0

	putF32 := func(v float32) {
		binary.LittleEndian.PutUint32(out[off:], math.Float32bits(v))
		off += 4
	}

	// Header
	putF32(float32(pointsType))
	putF32(float32(labelLen))
	for _, b := range labelBytes {
		putF32(float32(b))
	}

	// Placeholder nColors for now; patch later once we know countColors.
	nColorsOffsetBytes := off + 4 // after writing nPoints, the next float is nColors
	putF32(float32(nPoints))
	putF32(0) // nColors placeholder

	putF32(finalColor[0] / 255.0)
	putF32(finalColor[1] / 255.0)
	putF32(finalColor[2] / 255.0)

	// Positions first (float32)
	// Colors appended as bytes after all positions
	colorOff := floatCount * 4

	pc.Iterate(0, 0, func(p r3.Vector, d pointcloud.Data) bool {
		putF32(float32(p.X) / 1000.0)
		putF32(float32(p.Y) / 1000.0)
		putF32(float32(p.Z) / 1000.0)

		if hasColor && d.HasColor() {
			col := d.Color()
			nrgba := color.NRGBAModel.Convert(col).(color.NRGBA)

			out[colorOff+0] = nrgba.R
			out[colorOff+1] = nrgba.G
			out[colorOff+2] = nrgba.B
			colorOff += 3
			countColors++
		}
		return true
	})

	// Patch nColors in the float header
	binary.LittleEndian.PutUint32(out[nColorsOffsetBytes:], math.Float32bits(float32(countColors)))

	// Trim buffer to actual used size
	return postHTTP(out[:colorOff], "octet-stream", "points")
}

func DrawPointCloudDownscaled(label string, pc pointcloud.PointCloud, minDistance float64, overrideColor *[3]uint8) error {
	labelError := isASCIIPrintable(label)
	if labelError != nil {
		return labelError
	}

	labelBytes := []byte(label)
	labelLen := len(labelBytes)

	addedPoints := make([]struct {
		point r3.Vector
		data  pointcloud.Data
	}, 0)
	pc.Iterate(0, 0, func(p r3.Vector, d pointcloud.Data) bool {
		for idx := range addedPoints {
			// Dan: In lieu of a geo index for these distance/collision lookups, we use a O(n^2)
			// algorithm. Given the below details with a `minDistance` of 25 "distance units", this
			// takes ~20 seconds on a work machine. Keeping a total of ~8000 points. Fifty "distance
			// units" took ~7 seconds. Keeping a total of ~2000 points. For this use-case I'd like
			// to drop the distance down to between 2->10. But I expect the current quadratic
			// algorithm to be prohibitively slow there.
			if addedPoints[idx].point.Distance(p) < minDistance {
				// Too close to a point we've added. Move on to the next candidate.
				//
				// Dan: If it's useful for tuning an indexing data structure, I've found:
				// - a 3.5 million point pointcloud
				// - representing a ~1 square meter surface
				// - that results in 56MB http payload
				// Has neighboring points that are as small as 1 "distance unit" apart
				return true
			}
		}
		addedPoints = append(addedPoints, struct {
			point r3.Vector
			data  pointcloud.Data
		}{p, d})
		return true
	})

	nPoints := len(addedPoints)
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

	for idx := range addedPoints {
		p := &addedPoints[idx]

		data = append(data,
			float32(p.point.X)/1000.0,
			float32(p.point.Y)/1000.0,
			float32(p.point.Z)/1000.0,
		)

		if hasColor && p.data.HasColor() {
			col := p.data.Color()
			nrgba := color.NRGBAModel.Convert(col).(color.NRGBA)

			colors = append(colors,
				float32(nrgba.R)/255.0,
				float32(nrgba.G)/255.0,
				float32(nrgba.B)/255.0,
			)
		}
	}

	data = append(data, colors...)

	// Binary write
	buf := new(bytes.Buffer)
	if err := binary.Write(buf, binary.LittleEndian, data); err != nil {
		return err
	}

	return postHTTP(buf.Bytes(), "octet-stream", "points")
}
