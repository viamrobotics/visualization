package draw

import (
	"fmt"
	"image/color"
	"log"

	"github.com/golang/geo/r3"
	drawv1 "github.com/viam-labs/motion-tools/draw/v1"
	"go.viam.com/rdk/pointcloud"
)

// PointCloudChunker is a DrawableChunker that splits a DrawnPointCloud into
// chunks of points for progressive upload to the draw service. It is the
// streaming counterpart to DrawnPointCloud.Draw, useful when a cloud is too large
// to send in a single RPC.
type PointCloudChunker struct {
	baseChunker
	pointCloud *DrawnPointCloud
}

// NewPointCloudChunker returns a PointCloudChunker that streams pointCloud as a
// series of chunks. name labels the resulting entity in the visualizer.
// chunkSize sets the maximum number of points per chunk; pass 0 (or any
// non-positive value) to use the package default. opts apply to the resulting
// entity as a whole — see DrawableOption for the supported set.
func NewPointCloudChunker(pointCloud *DrawnPointCloud, name string, chunkSize int, opts ...DrawableOption) *PointCloudChunker {
	return &PointCloudChunker{
		baseChunker: newBaseChunker(name, chunkSize, opts),
		pointCloud:  pointCloud,
	}
}

// TotalElements returns the total number of points in the underlying cloud.
func (chunker *PointCloudChunker) TotalElements() uint32 {
	return uint32(chunker.pointCloud.PointCloud.Size())
}

// NumChunks returns the number of chunks that will be produced.
func (chunker *PointCloudChunker) NumChunks() int {
	return chunker.numChunks(chunker.TotalElements())
}

// Chunks returns a channel that yields each chunk in order. The channel is
// closed when all chunks have been produced; chunk-generation errors are logged
// and cause the channel to close early.
func (chunker *PointCloudChunker) Chunks() <-chan Chunk {
	ch := make(chan Chunk)
	go func() {
		defer close(ch)
		if err := chunker.generateChunks(func(chunk Chunk) error {
			ch <- chunk
			return nil
		}); err != nil {
			log.Printf("draw: point cloud chunk generation failed: %v", err)
		}
	}()
	return ch
}

func (chunker *PointCloudChunker) generateChunks(send func(Chunk) error) error {
	pointCloud := chunker.pointCloud.PointCloud
	totalPoints := pointCloud.Size()
	if totalPoints == 0 {
		return fmt.Errorf("point cloud is empty")
	}

	config := NewDrawConfig(chunker.name, chunker.opts...)
	colors := chunker.pointCloud.Colors
	hasCustomColors := len(colors) > 0
	hasEmbeddedColor := pointCloud.MetaData().HasColor
	posBuf := NewBufferPacker[float32](chunker.chunkSize, 3)
	var colorBuf *BufferPacker[uint8]
	var alphaBuf *BufferPacker[uint8]
	if hasCustomColors || hasEmbeddedColor {
		colorBuf = NewBufferPacker[uint8](chunker.chunkSize, 3)
		alphaBuf = NewBufferPacker[uint8](chunker.chunkSize, 1)
	}

	pointSize := DefaultPointSize
	offset := 0
	start := uint32(0)
	size := 0
	isFirst := true
	flush := func() error {
		if size == 0 {
			return nil
		}

		metadata := Metadata{}
		if colorBuf != nil {
			colorBytes := colorBuf.Read()[:size*3]
			alphaBytes := alphaBuf.Read()[:size]
			metadata.Colors = unpackColors(colorBytes, alphaBytes)
		}

		proto := newChunkDrawing(config, &drawv1.Shape{
			GeometryType: &drawv1.Shape_Points{
				Points: &drawv1.Points{
					Positions: posBuf.Read()[:size*3*4],
					PointSize: &pointSize,
				},
			},
		}, metadata.ToProto())

		err := send(Chunk{
			Proto:   proto,
			Start:   start,
			IsFirst: isFirst,
		})
		if err != nil {
			return fmt.Errorf("failed to send chunk at start=%d: %w", start, err)
		}

		isFirst = false
		start += uint32(size)
		size = 0
		posBuf = NewBufferPacker[float32](chunker.chunkSize, 3)
		if colorBuf != nil {
			colorBuf = NewBufferPacker[uint8](chunker.chunkSize, 3)
			alphaBuf = NewBufferPacker[uint8](chunker.chunkSize, 1)
		}
		return nil
	}

	pointCloud.Iterate(0, 0, func(p r3.Vector, d pointcloud.Data) bool {
		posBuf.Write(float32(p.X), float32(p.Y), float32(p.Z))

		if colorBuf != nil {
			if hasCustomColors && offset < len(colors) {
				c := colors[offset]
				colorBuf.Write(c.R, c.G, c.B)
				alphaBuf.Write(c.A)
			} else if hasCustomColors && len(colors) == 1 {
				// Single-element Colors means uniform: repeat the one color for all points past index 0.
				c := colors[0]
				colorBuf.Write(c.R, c.G, c.B)
				alphaBuf.Write(c.A)
			} else if hasEmbeddedColor && d.HasColor() {
				nrgba := color.NRGBAModel.Convert(d.Color()).(color.NRGBA)
				colorBuf.Write(nrgba.R, nrgba.G, nrgba.B)
				alphaBuf.Write(nrgba.A)
			} else {
				colorBuf.Write(128, 128, 128)
				alphaBuf.Write(DefaultOpacity)
			}
		}

		offset++
		size++

		if size >= chunker.chunkSize {
			if err := flush(); err != nil {
				return false
			}
		}
		return true
	})

	return flush()
}
