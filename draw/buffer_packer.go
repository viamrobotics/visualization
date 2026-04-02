package draw

import (
	"encoding/binary"
	"fmt"
	"math"

	"github.com/golang/geo/r3"
	"go.viam.com/rdk/spatialmath"
)

type BufferPackedEntry interface {
	~float32 | ~uint8
}

// BufferPacker provides efficient direct buffer writing for numeric data.
// The type parameter T must be either float32 or uint8.
type BufferPacker[T BufferPackedEntry] struct {
	buffer []T
	offset int
}

// NewBufferPacker creates a new buffer packer with pre-allocated capacity
// for elementCount items, each with fieldsPerElement fields.
func NewBufferPacker[T BufferPackedEntry](elementCount, fieldsPerElement int) *BufferPacker[T] {
	return &BufferPacker[T]{
		buffer: make([]T, elementCount*fieldsPerElement),
		offset: 0,
	}
}

// Write appends values directly to the buffer at the current offset and advances the offset.
func (packer *BufferPacker[T]) Write(values ...T) {
	copy(packer.buffer[packer.offset:], values)
	packer.offset += len(values)
}

// Read returns the packed buffer as little-endian bytes. For uint8 buffers, returns the buffer directly.
// For float32 buffers, converts each value to its little-endian byte representation.
func (packer *BufferPacker[T]) Read() []byte {
	// Optimization for uint8 (byte)
	if buf, ok := any(packer.buffer).([]uint8); ok {
		return buf
	}

	var bytesPerElement int
	if len(packer.buffer) > 0 {
		switch any(packer.buffer[0]).(type) {
		case float32:
			bytesPerElement = 4
		default:
			panic(fmt.Sprintf("unsupported type: %T", packer.buffer[0]))
		}
	} else {
		return []byte{}
	}

	bytes := make([]byte, len(packer.buffer)*bytesPerElement)
	for i, v := range packer.buffer {
		switch v := any(v).(type) {
		case float32:
			binary.LittleEndian.PutUint32(bytes[i*4:], math.Float32bits(v))
		default:
			panic(fmt.Sprintf("unsupported type: %T", v))
		}
	}
	return bytes
}

// packFloats packs a slice of float64 values into a little-endian Float32Array byte representation.
// Values are converted from float64 to float32 during packing.
func packFloats(floats []float64) []byte {
	packer := NewBufferPacker[float32](len(floats), 1)
	for _, f := range floats {
		packer.Write(float32(f))
	}
	return packer.Read()
}

// packPoints packs a slice of 3D points into a little-endian Float32Array byte representation.
// Each point is packed as [x, y, z] coordinates.
func packPoints(points []r3.Vector) []byte {
	packer := NewBufferPacker[float32](len(points), 3)

	for _, point := range points {
		packer.Write(float32(point.X), float32(point.Y), float32(point.Z))
	}

	return packer.Read()
}

// packPoses packs a slice of 3D poses into a little-endian Float32Array byte representation.
// Each pose is packed as [x, y, z, ox, oy, oz], with theta appended if the theta parameter is true.
// The orientation is represented as an orientation vector in degrees.
func packPoses(poses []spatialmath.Pose, theta bool) []byte {
	fields := 6
	if theta {
		fields = 7
	}

	packer := NewBufferPacker[float32](len(poses), fields)

	for _, pose := range poses {
		point := pose.Point()
		ov := pose.Orientation().OrientationVectorDegrees()
		packer.Write(
			float32(point.X), float32(point.Y), float32(point.Z),
			float32(ov.OX), float32(ov.OY), float32(ov.OZ),
		)
		if theta {
			packer.Write(float32(ov.Theta))
		}
	}

	return packer.Read()
}

// packColors packs a slice of Color values into bytes.
// Each color is packed as [r, g, b] with values in the range 0-255.
func packColors(colors []Color) []byte {
	packer := NewBufferPacker[uint8](len(colors), 3)

	for _, rgb := range colors {
		packer.Write(rgb.R, rgb.G, rgb.B)
	}

	return packer.Read()
}

// packOpacities packs the alpha channel of a slice of Color values into bytes.
// Each opacity is a single byte (0-255).
func packOpacities(colors []Color) []byte {
	packer := NewBufferPacker[uint8](len(colors), 1)

	for _, c := range colors {
		packer.Write(c.A)
	}

	return packer.Read()
}

// unpackColors unpacks a slice of Color values from a uint8 byte representation.
func unpackColors(colorsBytes []byte, opacitiesBytes []byte) []Color {
	bytesPerColor := 3
	colors := make([]Color, len(colorsBytes)/bytesPerColor)
	for i := range colors {
		alpha := DefaultOpacity
		if i < len(opacitiesBytes) {
			alpha = opacitiesBytes[i]
		} else if len(opacitiesBytes) == 1 {
			alpha = opacitiesBytes[0]
		}
		colors[i] = Color{
			R: colorsBytes[i*bytesPerColor],
			G: colorsBytes[i*bytesPerColor+1],
			B: colorsBytes[i*bytesPerColor+2],
			A: alpha,
		}
	}
	return colors
}
