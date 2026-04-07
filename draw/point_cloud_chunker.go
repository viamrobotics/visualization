package draw

import (
	"fmt"
	"image/color"
	"log"

	"github.com/golang/geo/r3"
	drawv1 "github.com/viam-labs/motion-tools/draw/v1"
	"go.viam.com/rdk/pointcloud"
)

// PointCloudChunker implements DrawableChunker for point clouds.
type PointCloudChunker struct {
	baseChunker
	pointCloud *DrawnPointCloud
}

// NewPointCloudChunker creates a DrawableChunker for the given point cloud.
func NewPointCloudChunker(pointCloud *DrawnPointCloud, name string, chunkSize int, opts ...DrawableOption) *PointCloudChunker {
	return &PointCloudChunker{
		baseChunker: newBaseChunker(name, chunkSize, opts),
		pointCloud:  pointCloud,
	}
}

func (chunker *PointCloudChunker) TotalElements() uint32 {
	return uint32(chunker.pointCloud.PointCloud.Size())
}

func (chunker *PointCloudChunker) NumChunks() int { return chunker.numChunks(chunker.TotalElements()) }

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
	if hasCustomColors || hasEmbeddedColor {
		colorBuf = NewBufferPacker[uint8](chunker.chunkSize, 3)
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
			metadata.Colors = unpackColors(colorBytes, nil)
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
		}
		return nil
	}

	pointCloud.Iterate(0, 0, func(p r3.Vector, d pointcloud.Data) bool {
		posBuf.Write(float32(p.X), float32(p.Y), float32(p.Z))

		if colorBuf != nil {
			if hasCustomColors && offset < len(colors) {
				c := colors[offset]
				colorBuf.Write(c.R, c.G, c.B)
			} else if hasCustomColors && len(colors) == 1 {
				c := colors[0]
				colorBuf.Write(c.R, c.G, c.B)
			} else if hasEmbeddedColor && d.HasColor() {
				nrgba := color.NRGBAModel.Convert(d.Color()).(color.NRGBA)
				colorBuf.Write(nrgba.R, nrgba.G, nrgba.B)
			} else {
				colorBuf.Write(128, 128, 128)
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
