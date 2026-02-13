package draw

import (
	"image/color"
	"testing"

	"go.viam.com/test"
)

func TestColor(t *testing.T) {
	t.Run("RGB", func(t *testing.T) {
		color := NewColor(WithRGB(255, 0, 0))
		test.That(t, color.R, test.ShouldEqual, 255)
		test.That(t, color.G, test.ShouldEqual, 0)
		test.That(t, color.B, test.ShouldEqual, 0)
		test.That(t, color.A, test.ShouldEqual, 255)
	})

	t.Run("Named Color", func(t *testing.T) {
		color := NewColor(WithName("red"))
		test.That(t, color.R, test.ShouldEqual, 255)
		test.That(t, color.G, test.ShouldEqual, 0)
		test.That(t, color.B, test.ShouldEqual, 0)
		test.That(t, color.A, test.ShouldEqual, 255)
	})

	t.Run("RGBA", func(t *testing.T) {
		color := NewColor(WithRGBA(255, 255, 0, 120))
		test.That(t, color.R, test.ShouldEqual, 255)
		test.That(t, color.G, test.ShouldEqual, 255)
		test.That(t, color.B, test.ShouldEqual, 0)
		test.That(t, color.A, test.ShouldEqual, 120)
	})

	t.Run("Color RGBA", func(t *testing.T) {
		color := NewColor(WithColorRGBA(color.RGBA{R: 255, G: 255, B: 0, A: 120}))
		test.That(t, color.R, test.ShouldEqual, 255)
		test.That(t, color.G, test.ShouldEqual, 255)
		test.That(t, color.B, test.ShouldEqual, 0)
		test.That(t, color.A, test.ShouldEqual, 120)
	})

	t.Run("HSV", func(t *testing.T) {
		color := NewColor(WithHSV(0.5, 1.0, 1.0))
		test.That(t, color.R, test.ShouldEqual, 0)
		test.That(t, color.G, test.ShouldEqual, 255)
		test.That(t, color.B, test.ShouldEqual, 255)
		test.That(t, color.A, test.ShouldEqual, 255)
	})

	t.Run("Hex", func(t *testing.T) {
		color := NewColor(WithHex("#FF0000"))
		test.That(t, color.R, test.ShouldEqual, 255)
		test.That(t, color.G, test.ShouldEqual, 0)
		test.That(t, color.B, test.ShouldEqual, 0)
		test.That(t, color.A, test.ShouldEqual, 255)
	})
}
