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
