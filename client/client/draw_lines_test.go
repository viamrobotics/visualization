package client

import (
	"bytes"
	"encoding/binary"
	"testing"

	"math"

	"github.com/golang/geo/r3"
	"github.com/viam-labs/motion-tools/draw"
	"go.viam.com/rdk/spatialmath"
	"go.viam.com/test"
)

func TestDrawLines(t *testing.T) {
	offset := r3.Vector{X: 0, Y: 0, Z: 0}

	t.Run("DrawLine", func(t *testing.T) {
		nTurns := 5.0    // Number of spiral turns
		radius := 1000.0 // Radius of spiral
		height := 4000.0 // Total height of spiral
		nPath := 50      // Number of points along spiral

		points := make([]spatialmath.Pose, 0, nPath)

		maxT := 2 * math.Pi * nTurns

		for i := range nPath {
			t := maxT * float64(i) / float64(nPath)

			x := radius*math.Cos(t) + offset.X
			y := radius*math.Sin(t) + offset.Y
			z := height*float64(i)/float64(nPath) + offset.Z // Linear vertical rise

			points = append(points, spatialmath.NewPoseFromPoint(r3.Vector{
				X: x,
				Y: y,
				Z: z,
			}))
		}

		err := DrawLine("upwardSpiral", points, nil, nil)
		test.That(t, err, test.ShouldBeNil)
	})

	t.Run("ToBytes", func(t *testing.T) {
		positions := []r3.Vector{
			{X: 0, Y: 0, Z: 0},
			{X: 1, Y: 0, Z: 0},
			{X: 0, Y: 1, Z: 0},
		}
		dotColor := draw.NewColor(draw.WithName("blue"))
		line, err := draw.NewLine(positions, draw.WithSingleLineColor(draw.NewColor(draw.WithName("red"))), draw.WithSingleDotColor(dotColor))
		test.That(t, err, test.ShouldBeNil)
		test.That(t, line, test.ShouldNotBeNil)

		buf, err := lineToBytes(line, "test")
		test.That(t, err, test.ShouldBeNil)
		test.That(t, buf, test.ShouldNotBeNil)

		lineColor := line.Colors[0]
		lineDotColor := line.DotColors[0]

		expected := []float32{
			float32(2),
			float32(len("test")),
			float32('t'),
			float32('e'),
			float32('s'),
			float32('t'),
			float32(len(positions)),
			float32(lineColor.R) / 255.0,
			float32(lineColor.G) / 255.0,
			float32(lineColor.B) / 255.0,
			float32(lineDotColor.R) / 255.0,
			float32(lineDotColor.G) / 255.0,
			float32(lineDotColor.B) / 255.0,
			float32(positions[0].X) / 1000.0,
			float32(positions[0].Y) / 1000.0,
			float32(positions[0].Z) / 1000.0,
			float32(positions[1].X) / 1000.0,
			float32(positions[1].Y) / 1000.0,
			float32(positions[1].Z) / 1000.0,
			float32(positions[2].X) / 1000.0,
			float32(positions[2].Y) / 1000.0,
			float32(positions[2].Z) / 1000.0,
		}
		expectedBuf := new(bytes.Buffer)
		err = binary.Write(expectedBuf, binary.LittleEndian, expected)
		test.That(t, err, test.ShouldBeNil)
		test.That(t, expectedBuf.Bytes(), test.ShouldResemble, buf)
	})
}
