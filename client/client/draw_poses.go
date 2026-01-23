package client

import (
	"encoding/binary"
	"math"

	"github.com/viam-labs/motion-tools/client/colorutil"
	"github.com/viam-labs/motion-tools/draw"
	"go.viam.com/rdk/spatialmath"
)

// DrawPoses draws a list of poses in the visualizer as arrows.
//
// Parameters:
//   - poses: a list of poses
//   - colors: Individual arrow color
//   - arrowHeadAtPose: whether the tip of the cone of the arrow will be at the pose. default is false
func DrawPoses(poses []spatialmath.Pose, colors []string, arrowHeadAtPose bool) error {
	drawColors := make([]draw.Color, len(colors))
	for i, color := range colors {
		rgbColor, err := colorutil.NamedColorToRGB(color)
		if err != nil {
			return err
		}
		drawColors[i] = draw.NewColor(draw.WithRGB(rgbColor[0], rgbColor[1], rgbColor[2]))
	}
	var arrows *draw.Arrows
	var err error
	if len(drawColors) == 1 {
		arrows, err = draw.NewArrows(poses, draw.WithSingleArrowColor(drawColors[0]))
	} else if len(drawColors) == len(poses) {
		arrows, err = draw.NewArrows(poses, draw.WithPerArrowColors(drawColors...))
	} else {
		arrows, err = draw.NewArrows(poses, draw.WithColorPalette(drawColors, len(poses)))
	}

	if err != nil {
		return err
	}

	buf, err := posesToBytes(arrows, arrowHeadAtPose)
	if err != nil {
		return err
	}

	return postHTTP(buf, "octet-stream", "poses")
}

func posesToBytes(arrows *draw.Arrows, arrowHeadAtPose bool) ([]byte, error) {
	nPoses := len(arrows.Poses)
	nColors := len(arrows.Colors)

	// Header (type + nPoses + nColors + arrowHeadAtPose) = 4 float32 = 16 bytes
	// Pose payload = nPoses * 6 float32 = nPoses * 24 bytes
	// Color payload = nColors * 3 uint8 = nColors * 3 bytes
	floatCount := 4 + nPoses*6
	totalBytes := floatCount*4 + nColors*3

	out := make([]byte, totalBytes)
	off := 0

	putF32 := func(v float32) {
		binary.LittleEndian.PutUint32(out[off:], math.Float32bits(v))
		off += 4
	}

	// Header (keep your existing "float header structure")
	a := float32(0)
	if arrowHeadAtPose {
		a = 1
	}
	putF32(float32(posesType))
	putF32(float32(nPoses))
	putF32(float32(nColors))
	putF32(a)

	// Poses (same as before, still float32s)
	for _, pose := range arrows.Poses {
		p := pose.Point()
		o := pose.Orientation().OrientationVectorDegrees()

		putF32(float32(p.X))
		putF32(float32(p.Y))
		putF32(float32(p.Z))
		putF32(float32(o.OX))
		putF32(float32(o.OY))
		putF32(float32(o.OZ))
	}

	// Colors as raw bytes (0..255)
	for _, c := range arrows.Colors {
		out[off+0] = uint8(c.R)
		out[off+1] = uint8(c.G)
		out[off+2] = uint8(c.B)
		off += 3
	}

	return out, nil
}
