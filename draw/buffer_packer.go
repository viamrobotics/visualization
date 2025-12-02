package draw

import (
	"encoding/binary"
	"math"

	"github.com/golang/geo/r3"
	"go.viam.com/rdk/spatialmath"
)

// BufferPacker provides efficient direct buffer writing
type BufferPacker struct {
	buffer []float32
	offset int
}

// NewBufferPacker creates a new packer with pre-allocated capacity.
//   - elementCount is the number of elements
//   - fieldsPerElement is the number of fields per element
func NewBufferPacker(elementCount, fieldsPerElement int) *BufferPacker {
	return &BufferPacker{
		buffer: make([]float32, elementCount*fieldsPerElement),
		offset: 0,
	}
}

// Write appends float32 values directly to the buffer
//   - values are the values to write
func (packer *BufferPacker) Write(values ...float32) {
	copy(packer.buffer[packer.offset:], values)
	packer.offset += len(values)
}

// Read returns the packed buffer as little-endian bytes
func (packer *BufferPacker) Read() []byte {
	bytes := make([]byte, len(packer.buffer)*4)
	for i, f := range packer.buffer {
		binary.LittleEndian.PutUint32(bytes[i*4:], math.Float32bits(f))
	}
	return bytes
}

// packFloats packs a slice of float64 values into a Float32Array byte representation
//   - floats are the values to pack
func packFloats(floats []float64) []byte {
	packer := NewBufferPacker(len(floats), 1)
	for _, f := range floats {
		packer.Write(float32(f))
	}
	return packer.Read()
}

// packPoints packs a slice of 3D points into a Float32Array byte representation
//   - dots are the points to pack: [x, y, z]
func packPoints(dots []r3.Vector) []byte {
	packer := NewBufferPacker(len(dots), 3)

	for _, dot := range dots {
		packer.Write(float32(dot.X), float32(dot.Y), float32(dot.Z))
	}

	return packer.Read()
}

// packPoses packs a slice of 3D poses into a Float32Array byte representation
//   - poses are the poses to pack: [x, y, z, ox, oy, oz, theta (if theta is true)]
//   - theta is whether to include the theta value
func packPoses(poses []spatialmath.Pose, theta bool) []byte {
	fields := 6
	if theta {
		fields = 7
	}

	packer := NewBufferPacker(len(poses), fields)

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

// packColors packs a slice of Color values into a Float32Array byte representation
//   - colors are the colors to pack: [r, g, b, a]
func packColors(colors []Color) []byte {
	packer := NewBufferPacker(len(colors), 4)

	for _, rgba := range colors {
		packer.Write(rgba.R, rgba.G, rgba.B, rgba.A)
	}

	return packer.Read()
}
