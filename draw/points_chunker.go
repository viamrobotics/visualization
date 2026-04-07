package draw

import (
	"log"

	drawv1 "github.com/viam-labs/motion-tools/draw/v1"
)

// PointsChunker implements DrawableChunker for Points.
type PointsChunker struct {
	baseChunker
	points *Points
}

// NewPointsChunker creates a DrawableChunker for the given points.
func NewPointsChunker(points *Points, name string, chunkSize int, opts ...DrawableOption) *PointsChunker {
	return &PointsChunker{
		baseChunker: newBaseChunker(name, chunkSize, opts),
		points:      points,
	}
}

func (c *PointsChunker) TotalElements() uint32 { return uint32(len(c.points.Positions)) }
func (c *PointsChunker) NumChunks() int        { return c.numChunks(c.TotalElements()) }

func (c *PointsChunker) Chunks() <-chan Chunk {
	ch := make(chan Chunk)
	go func() {
		defer close(ch)
		if err := c.generateChunks(func(chunk Chunk) error {
			ch <- chunk
			return nil
		}); err != nil {
			log.Printf("draw: points chunk generation failed: %v", err)
		}
	}()
	return ch
}

func (c *PointsChunker) generateChunks(send func(Chunk) error) error {
	totalPoints := len(c.points.Positions)
	if totalPoints == 0 {
		return nil
	}

	config := NewDrawConfig(c.name, c.opts...)
	hasColors := len(c.points.Colors) > 0
	pointSize := c.points.PointSize

	chunkStart := uint32(0)
	isFirst := true

	for offset := 0; offset < totalPoints; offset += c.chunkSize {
		end := offset + c.chunkSize
		if end > totalPoints {
			end = totalPoints
		}
		chunkPositions := c.points.Positions[offset:end]
		positionsBytes := packPoints(chunkPositions)

		metadata := Metadata{}
		if hasColors {
			metadata.Colors = sliceColors(c.points.Colors, offset, end)
		}

		drawingProto := newChunkDrawing(config, &drawv1.Shape{
			GeometryType: &drawv1.Shape_Points{
				Points: &drawv1.Points{
					Positions: positionsBytes,
					PointSize: &pointSize,
				},
			},
		}, metadata.ToProto())

		if err := send(Chunk{
			Proto:   drawingProto,
			Start:   chunkStart,
			IsFirst: isFirst,
		}); err != nil {
			return err
		}

		isFirst = false
		chunkStart += uint32(len(chunkPositions))
	}
	return nil
}
