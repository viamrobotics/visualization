package draw

import (
	"encoding/binary"
	"math"

	"github.com/golang/geo/r3"
	"go.viam.com/rdk/spatialmath"
)

// BufferPacker provides efficient direct buffer writing without map allocations.
// This eliminates heap allocations and GC pressure compared to map-based approaches.
type BufferPacker struct {
	buffer []float32
	offset int
}

// NewBufferPacker creates a new packer with pre-allocated capacity.
// elementCount is the number of elements, fieldsPerElement is the number of fields per element.
func NewBufferPacker(elementCount, fieldsPerElement int) *BufferPacker {
	return &BufferPacker{
		buffer: make([]float32, elementCount*fieldsPerElement),
		offset: 0,
	}
}

// Write appends float32 values directly to the buffer.
func (packer *BufferPacker) Write(values ...float32) {
	copy(packer.buffer[packer.offset:], values)
	packer.offset += len(values)
}

// Bytes returns the packed buffer as little-endian bytes.
func (packer *BufferPacker) Read() []byte {
	bytes := make([]byte, len(packer.buffer)*4)
	for i, f := range packer.buffer {
		binary.LittleEndian.PutUint32(bytes[i*4:], math.Float32bits(f))
	}
	return bytes
}

// packFloats packs a slice of float64 values into a Float32Array byte representation
func packFloats(floats []float64) []byte {
	packer := NewBufferPacker(len(floats), 1)
	for _, f := range floats {
		packer.Write(float32(f))
	}
	return packer.Read()
}

// packPoints packs a slice of 3D points into a Float32Array byte representation
func packPoints(dots []r3.Vector, units *Units) []byte {
	packer := NewBufferPacker(len(dots), 3) // 3 fields: x, y, z

	for _, dot := range dots {
		if units != nil && *units == UnitsM {
			packer.Write(float32(float64ToMeters(dot.X)), float32(float64ToMeters(dot.Y)), float32(float64ToMeters(dot.Z)))
		} else {
			packer.Write(float32(dot.X), float32(dot.Y), float32(dot.Z))
		}
	}

	return packer.Read()
}

// packPoses packs a slice of 3D poses into a Float32Array byte representation
func packPoses(poses []spatialmath.Pose, units *Units) []byte {
	packer := NewBufferPacker(len(poses), 6) // 6 fields: x, y, z, ox, oy, oz

	for _, pose := range poses {
		point := pose.Point()
		ov := pose.Orientation().OrientationVectorDegrees()
		if units != nil && *units == UnitsM {
			packer.Write(
				float32(float64ToMeters(point.X)), float32(float64ToMeters(point.Y)), float32(float64ToMeters(point.Z)),
				float32(ov.OX), float32(ov.OY), float32(ov.OZ),
			)
		} else {
			packer.Write(
				float32(point.X), float32(point.Y), float32(point.Z),
				float32(ov.OX), float32(ov.OY), float32(ov.OZ),
			)
		}
	}

	return packer.Read()
}

// packColors packs a slice of Color values into a Float32Array byte representation
func packColors(colors []*Color) []byte {
	packer := NewBufferPacker(len(colors), 4) // 4 fields: r, g, b, a

	for _, rgba := range colors {
		packer.Write(rgba.R, rgba.G, rgba.B, rgba.A)
	}

	return packer.Read()
}
