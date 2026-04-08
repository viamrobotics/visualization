package draw

import (
	"testing"

	"github.com/golang/geo/r3"
	"go.viam.com/rdk/referenceframe"
	"go.viam.com/rdk/spatialmath"
	"go.viam.com/test"
)

var twoPositions = []r3.Vector{{X: 0, Y: 0, Z: 0}, {X: 1, Y: 0, Z: 0}}
var threePositions = []r3.Vector{{X: 0, Y: 0, Z: 0}, {X: 1, Y: 0, Z: 0}, {X: 0, Y: 1, Z: 0}}

func TestNewLine(t *testing.T) {
	t.Run("Defaults", func(t *testing.T) {
		line, err := NewLine(twoPositions)
		test.That(t, err, test.ShouldBeNil)
		test.That(t, line.LineWidth, test.ShouldEqual, DefaultLineWidth)
		test.That(t, line.DotSize, test.ShouldEqual, DefaultLineDotSize)
		test.That(t, line.Colors, test.ShouldResemble, []Color{DefaultLineColor})
		test.That(t, line.DotColors, test.ShouldResemble, []Color{DefaultLineDotColor})
	})

	t.Run("WithLineWidth", func(t *testing.T) {
		line, err := NewLine(twoPositions, WithLineWidth(20))
		test.That(t, err, test.ShouldBeNil)
		test.That(t, line.LineWidth, test.ShouldEqual, float32(20))
	})

	t.Run("WithDotSize", func(t *testing.T) {
		line, err := NewLine(twoPositions, WithDotSize(15))
		test.That(t, err, test.ShouldBeNil)
		test.That(t, line.DotSize, test.ShouldEqual, float32(15))
	})

	t.Run("WithSingleLineColor", func(t *testing.T) {
		red := NewColor(WithName("red"))
		line, err := NewLine(twoPositions, WithSingleLineColor(red))
		test.That(t, err, test.ShouldBeNil)
		test.That(t, line.Colors, test.ShouldResemble, []Color{red})
	})

	t.Run("WithSingleDotColor", func(t *testing.T) {
		blue := NewColor(WithName("blue"))
		line, err := NewLine(twoPositions, WithSingleDotColor(blue))
		test.That(t, err, test.ShouldBeNil)
		test.That(t, line.DotColors, test.ShouldResemble, []Color{blue})
	})

	t.Run("WithSingleLineColor_and_WithSingleDotColor", func(t *testing.T) {
		red := NewColor(WithName("red"))
		blue := NewColor(WithName("blue"))
		line, err := NewLine(twoPositions, WithSingleLineColor(red), WithSingleDotColor(blue))
		test.That(t, err, test.ShouldBeNil)
		test.That(t, line.Colors, test.ShouldResemble, []Color{red})
		test.That(t, line.DotColors, test.ShouldResemble, []Color{blue})
	})

	t.Run("WithPerLineColors", func(t *testing.T) {
		red := NewColor(WithName("red"))
		green := NewColor(WithName("green"))
		line, err := NewLine(twoPositions, WithPerLineColors(red, green))
		test.That(t, err, test.ShouldBeNil)
		test.That(t, line.Colors, test.ShouldResemble, []Color{red, green})
	})

	t.Run("WithPerDotColors", func(t *testing.T) {
		red := NewColor(WithName("red"))
		green := NewColor(WithName("green"))
		line, err := NewLine(twoPositions, WithPerDotColors(red, green))
		test.That(t, err, test.ShouldBeNil)
		test.That(t, line.DotColors, test.ShouldResemble, []Color{red, green})
	})

	t.Run("WithLineColorPalette", func(t *testing.T) {
		red := NewColor(WithName("red"))
		blue := NewColor(WithName("blue"))
		line, err := NewLine(threePositions, WithLineColorPalette([]Color{red, blue}, 3))
		test.That(t, err, test.ShouldBeNil)
		test.That(t, line.Colors, test.ShouldResemble, []Color{red, blue, red})
	})

	t.Run("WithDotColorPalette", func(t *testing.T) {
		red := NewColor(WithName("red"))
		blue := NewColor(WithName("blue"))
		line, err := NewLine(threePositions, WithDotColorPalette([]Color{red, blue}, 3))
		test.That(t, err, test.ShouldBeNil)
		test.That(t, line.DotColors, test.ShouldResemble, []Color{red, blue, red})
	})

	t.Run("ErrorFewerThanTwoPositions", func(t *testing.T) {
		_, err := NewLine([]r3.Vector{{X: 0, Y: 0, Z: 0}})
		test.That(t, err, test.ShouldNotBeNil)
		test.That(t, err.Error(), test.ShouldContainSubstring, "line must have at least 2 positions, got 1")
	})

	t.Run("ErrorZeroPositions", func(t *testing.T) {
		_, err := NewLine([]r3.Vector{})
		test.That(t, err, test.ShouldNotBeNil)
		test.That(t, err.Error(), test.ShouldContainSubstring, "line must have at least 2 positions, got 0")
	})

	t.Run("ErrorNonPositiveDotSize", func(t *testing.T) {
		_, err := NewLine(twoPositions, WithDotSize(0))
		test.That(t, err, test.ShouldNotBeNil)
		test.That(t, err.Error(), test.ShouldContainSubstring, "dot size must be greater than 0")
	})

	t.Run("ErrorNonPositiveLineWidth", func(t *testing.T) {
		_, err := NewLine(twoPositions, WithLineWidth(-1))
		test.That(t, err, test.ShouldNotBeNil)
		test.That(t, err.Error(), test.ShouldContainSubstring, "line width must be greater than 0")
	})

	t.Run("ErrorInvalidLineColorCount", func(t *testing.T) {
		red := NewColor(WithName("red"))
		blue := NewColor(WithName("blue"))
		// Three positions but only two line colors: invalid
		_, err := NewLine(threePositions, WithPerLineColors(red, blue))
		test.That(t, err, test.ShouldNotBeNil)
		test.That(t, err.Error(), test.ShouldContainSubstring, "line colors must have length 1")
	})

	t.Run("ErrorInvalidDotColorCount", func(t *testing.T) {
		red := NewColor(WithName("red"))
		blue := NewColor(WithName("blue"))
		// Three positions but only two dot colors: invalid
		_, err := NewLine(threePositions, WithPerDotColors(red, blue))
		test.That(t, err, test.ShouldNotBeNil)
		test.That(t, err.Error(), test.ShouldContainSubstring, "dot colors must have length 1")
	})
}

func TestLine_Draw(t *testing.T) {
	red := NewColor(WithName("red"))
	blue := NewColor(WithName("blue"))
	line, err := NewLine(threePositions, WithSingleLineColor(red), WithSingleDotColor(blue), WithLineWidth(10), WithDotSize(5))
	test.That(t, err, test.ShouldBeNil)

	t.Run("DrawingDefaults", func(t *testing.T) {
		drawing := line.Draw("test-line")
		test.That(t, drawing.Name, test.ShouldEqual, "test-line")
		test.That(t, drawing.Parent, test.ShouldEqual, referenceframe.World)
		test.That(t, drawing.Pose, test.ShouldResemble, spatialmath.NewZeroPose())
		test.That(t, drawing.Shape.Center, test.ShouldResemble, spatialmath.NewZeroPose())
		test.That(t, drawing.Shape.Label, test.ShouldEqual, "test-line")
		test.That(t, drawing.Shape.Line, test.ShouldNotBeNil)
	})

	t.Run("DrawWithPose", func(t *testing.T) {
		pose := spatialmath.NewPose(r3.Vector{X: 10, Y: 0, Z: 0}, &spatialmath.OrientationVectorDegrees{OX: 0, OY: 0, OZ: 1, Theta: 0})
		drawing := line.Draw("test-line", WithPose(pose))
		test.That(t, drawing.Pose, test.ShouldResemble, pose)
		test.That(t, drawing.Shape.Center, test.ShouldResemble, spatialmath.NewZeroPose())
	})

	t.Run("DrawWithParent", func(t *testing.T) {
		drawing := line.Draw("test-line", WithParent("robot-base"))
		test.That(t, drawing.Parent, test.ShouldEqual, "robot-base")
	})

	t.Run("ProtoOutput", func(t *testing.T) {
		drawing := line.Draw("test-line")
		proto := drawing.ToProto()
		test.That(t, proto.ReferenceFrame, test.ShouldEqual, "test-line")
		test.That(t, proto.PoseInObserverFrame.ReferenceFrame, test.ShouldEqual, referenceframe.World)
		test.That(t, proto.PhysicalObject, test.ShouldNotBeNil)
		test.That(t, proto.PhysicalObject.Label, test.ShouldEqual, "test-line")
		protoLine := proto.PhysicalObject.GetLine()
		test.That(t, protoLine, test.ShouldNotBeNil)
		test.That(t, *protoLine.LineWidth, test.ShouldEqual, float32(10))
		test.That(t, *protoLine.DotSize, test.ShouldEqual, float32(5))
		// dot colors: blue (0, 0, 255) packed as [r, g, b]
		test.That(t, protoLine.DotColors, test.ShouldResemble, []byte{0x00, 0x00, 0xff})
		// line colors: red (255, 0, 0) in metadata
		test.That(t, proto.Metadata.Colors, test.ShouldResemble, []byte{0xff, 0x00, 0x00})
		// default alpha (255) — single uniform byte
		test.That(t, proto.Metadata.Opacities, test.ShouldResemble, []byte{0xff})
	})
}
