package draw

import (
	"testing"

	fixtures "github.com/viam-labs/motion-tools/draw/fixtures"
	"go.viam.com/test"
)

func TestBufferPacker(t *testing.T) {
	t.Run("Float32", func(t *testing.T) {
		packer := NewBufferPacker[float32](3, 1)
		packer.Write(1.0, 2.0, 3.0)
		test.That(t, packer.Read(), test.ShouldResemble, fixtures.Float32SliceToBytes([]float32{1.0, 2.0, 3.0}))
	})

	t.Run("Uint8", func(t *testing.T) {
		packer := NewBufferPacker[uint8](3, 1)
		packer.Write(1, 2, 3)
		test.That(t, packer.Read(), test.ShouldResemble, fixtures.Uint8SliceToBytes([]uint8{1, 2, 3}))
	})
}

func TestPackColors(t *testing.T) {
	t.Run("AllOpaque_PacksAsRGB", func(t *testing.T) {
		colors := []Color{
			{R: 255, G: 0, B: 0, A: 255},
			{R: 0, G: 0, B: 255, A: 255},
		}
		packed := packColors(colors)
		// Expect 3 bytes per color (RGB, no alpha channel).
		test.That(t, len(packed), test.ShouldEqual, 6)
		test.That(t, packed, test.ShouldResemble, []byte{255, 0, 0, 0, 0, 255})
	})

	t.Run("AnyTransparent_PacksAsRGBA", func(t *testing.T) {
		colors := []Color{
			{R: 255, G: 0, B: 0, A: 255},
			{R: 0, G: 255, B: 0, A: 128},
		}
		packed := packColors(colors)
		// Expect 4 bytes per color (RGBA) because one color has non-255 alpha.
		test.That(t, len(packed), test.ShouldEqual, 8)
		test.That(t, packed, test.ShouldResemble, []byte{255, 0, 0, 255, 0, 255, 0, 128})
	})

	t.Run("RoundTrip_RGB", func(t *testing.T) {
		original := []Color{
			{R: 255, G: 0, B: 0, A: 255},
			{R: 0, G: 128, B: 255, A: 255},
			{R: 10, G: 20, B: 30, A: 255},
		}
		roundtripped := unpackColors(packColors(original))
		test.That(t, roundtripped, test.ShouldResemble, original)
	})

	t.Run("RoundTrip_RGBA", func(t *testing.T) {
		original := []Color{
			{R: 255, G: 0, B: 0, A: 200},
			{R: 0, G: 128, B: 255, A: 50},
		}
		roundtripped := unpackColors(packColors(original))
		test.That(t, roundtripped, test.ShouldResemble, original)
	})
}
