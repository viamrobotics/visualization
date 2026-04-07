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
	dpc *DrawnPointCloud
}

// NewPointCloudChunker creates a DrawableChunker for the given point cloud.
func NewPointCloudChunker(dpc *DrawnPointCloud, name string, chunkSize int, opts ...DrawableOption) *PointCloudChunker {
	return &PointCloudChunker{
		baseChunker: newBaseChunker(name, chunkSize, opts),
		dpc:         dpc,
	}
}

func (c *PointCloudChunker) TotalElements() uint32 { return uint32(c.dpc.PointCloud.Size()) }
func (c *PointCloudChunker) NumChunks() int        { return c.numChunks(c.TotalElements()) }

func (c *PointCloudChunker) Chunks() <-chan Chunk {
	ch := make(chan Chunk)
	go func() {
		defer close(ch)
		if err := c.generateChunks(func(chunk Chunk) error {
			ch <- chunk
			return nil
		}); err != nil {
			log.Printf("draw: point cloud chunk generation failed: %v", err)
		}
	}()
	return ch
}

func (c *PointCloudChunker) generateChunks(send func(Chunk) error) error {
	dpc := c.dpc
	pc := dpc.PointCloud
	totalPoints := pc.Size()
	if totalPoints == 0 {
		return fmt.Errorf("point cloud is empty")
	}

	config := NewDrawConfig(c.name, c.opts...)
	hasCustomColors := len(dpc.Colors) > 0
	hasEmbeddedColor := pc.MetaData().HasColor

	posBuf := NewBufferPacker[float32](c.chunkSize, 3)
	var colorBuf *BufferPacker[uint8]
	if hasCustomColors || hasEmbeddedColor {
		colorBuf = NewBufferPacker[uint8](c.chunkSize, 3)
	}

	pointSize := DefaultPointSize

	offset := 0
	chunkStart := uint32(0)
	pointsInChunk := 0
	isFirst := true

	flush := func() error {
		if pointsInChunk == 0 {
			return nil
		}

		metadata := Metadata{}
		if colorBuf != nil {
			colorBytes := colorBuf.Read()[:pointsInChunk*3]
			metadata.Colors = unpackColors(colorBytes, nil)
		}

		drawingProto := newChunkDrawing(config, &drawv1.Shape{
			GeometryType: &drawv1.Shape_Points{
				Points: &drawv1.Points{
					Positions: posBuf.Read()[:pointsInChunk*3*4],
					PointSize: &pointSize,
				},
			},
		}, metadata.ToProto())

		err := send(Chunk{
			Proto:   drawingProto,
			Start:   chunkStart,
			IsFirst: isFirst,
		})
		if err != nil {
			return fmt.Errorf("failed to send chunk at start=%d: %w", chunkStart, err)
		}

		isFirst = false
		chunkStart += uint32(pointsInChunk)
		pointsInChunk = 0
		posBuf = NewBufferPacker[float32](c.chunkSize, 3)
		if colorBuf != nil {
			colorBuf = NewBufferPacker[uint8](c.chunkSize, 3)
		}
		return nil
	}

	pc.Iterate(0, 0, func(p r3.Vector, d pointcloud.Data) bool {
		posBuf.Write(float32(p.X), float32(p.Y), float32(p.Z))

		if colorBuf != nil {
			if hasCustomColors && offset < len(dpc.Colors) {
				c := dpc.Colors[offset]
				colorBuf.Write(c.R, c.G, c.B)
			} else if hasCustomColors && len(dpc.Colors) == 1 {
				c := dpc.Colors[0]
				colorBuf.Write(c.R, c.G, c.B)
			} else if hasEmbeddedColor && d.HasColor() {
				nrgba := color.NRGBAModel.Convert(d.Color()).(color.NRGBA)
				colorBuf.Write(nrgba.R, nrgba.G, nrgba.B)
			} else {
				colorBuf.Write(128, 128, 128)
			}
		}

		offset++
		pointsInChunk++

		if pointsInChunk >= c.chunkSize {
			if err := flush(); err != nil {
				return false
			}
		}
		return true
	})

	return flush()
}
