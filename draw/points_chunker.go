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

func (chunker *PointsChunker) TotalElements() uint32 { return uint32(len(chunker.points.Positions)) }
func (chunker *PointsChunker) NumChunks() int        { return chunker.numChunks(chunker.TotalElements()) }

func (chunker *PointsChunker) Chunks() <-chan Chunk {
	ch := make(chan Chunk)
	go func() {
		defer close(ch)
		if err := chunker.generateChunks(func(chunk Chunk) error {
			ch <- chunk
			return nil
		}); err != nil {
			log.Printf("draw: points chunk generation failed: %v", err)
		}
	}()
	return ch
}

func (chunker *PointsChunker) generateChunks(send func(Chunk) error) error {
	totalPoints := len(chunker.points.Positions)
	if totalPoints == 0 {
		return nil
	}

	config := NewDrawConfig(chunker.name, chunker.opts...)
	hasColors := len(chunker.points.Colors) > 0
	pointSize := chunker.points.PointSize

	start := uint32(0)
	isFirst := true

	for offset := 0; offset < totalPoints; offset += chunker.chunkSize {
		end := offset + chunker.chunkSize
		if end > totalPoints {
			end = totalPoints
		}
		chunkPositions := chunker.points.Positions[offset:end]
		positionsBytes := packPoints(chunkPositions)

		metadata := Metadata{}
		if hasColors {
			metadata.Colors = sliceColors(chunker.points.Colors, offset, end)
		}

		proto := newChunkDrawing(config, &drawv1.Shape{
			GeometryType: &drawv1.Shape_Points{
				Points: &drawv1.Points{
					Positions: positionsBytes,
					PointSize: &pointSize,
				},
			},
		}, metadata.ToProto())

		if err := send(Chunk{
			Proto:   proto,
			Start:   start,
			IsFirst: isFirst,
		}); err != nil {
			return err
		}

		isFirst = false
		start += uint32(len(chunkPositions))
	}
	return nil
}
