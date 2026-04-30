package draw

import (
	"context"
	"fmt"
	"io"

	"connectrpc.com/connect"
	drawv1 "github.com/viam-labs/motion-tools/draw/v1"
	"github.com/viam-labs/motion-tools/draw/v1/drawv1connect"
)

const defaultChunkSize = 500_000

type baseChunker struct {
	name      string
	chunkSize int
	opts      []DrawableOption
}

func newBaseChunker(name string, chunkSize int, opts []DrawableOption) baseChunker {
	if chunkSize <= 0 {
		chunkSize = defaultChunkSize
	}
	return baseChunker{name: name, chunkSize: chunkSize, opts: opts}
}

// ChunkSize returns the number of elements per chunk.
func (b *baseChunker) ChunkSize() uint32 { return uint32(b.chunkSize) }

func (b *baseChunker) numChunks(total uint32) int {
	cs := uint32(b.chunkSize)
	return int((total + cs - 1) / cs)
}

// Chunk holds a single chunk of data as a ready-to-send proto.
type Chunk struct {
	Proto   *drawv1.Drawing
	Start   uint32
	IsFirst bool
}

// DrawableChunker is implemented by any drawable type that can produce its data
// as a series of chunks for progressive delivery.
type DrawableChunker interface {
	// ChunkSize returns the number of elements per chunk.
	ChunkSize() uint32
	// TotalElements returns the total number of elements across all chunks.
	TotalElements() uint32
	// NumChunks returns the number of chunks that will be produced.
	NumChunks() int
	// Chunks returns a channel that yields each chunk. The channel is closed
	// when all chunks have been sent.
	Chunks() <-chan Chunk
}

// ChunkProgress reports the progress of a chunked entity upload.
type ChunkProgress struct {
	Index int
	Sent  uint32
	Total uint32
	Done  bool
}

// ChunkSender provides caller-paced iteration over streamed entity chunks.
type ChunkSender struct {
	streamed   <-chan Chunk
	client     drawv1connect.DrawServiceClient
	uuid       []byte
	metadata   *drawv1.Chunks
	index      int
	sent       uint32
	done       bool
	onProgress func(ChunkProgress)
}

// NewChunkSender creates a ChunkSender from a DrawableChunker and a client.
func NewChunkSender(
	chunker DrawableChunker,
	client drawv1connect.DrawServiceClient,
	metadata *drawv1.Chunks,
	onProgress func(ChunkProgress),
) *ChunkSender {
	return &ChunkSender{
		streamed:   chunker.Chunks(),
		client:     client,
		metadata:   metadata,
		onProgress: onProgress,
	}
}

// Next sends the next chunk to the draw service.
// Returns io.EOF when all chunks have been sent.
func (s *ChunkSender) Next() error {
	if s.done {
		return io.EOF
	}

	chunk, ok := <-s.streamed
	if !ok {
		s.done = true
		return io.EOF
	}

	if chunk.IsFirst {
		cm := &drawv1.Chunks{
			ChunkSize: s.metadata.GetChunkSize(),
			Total:     s.metadata.GetTotal(),
			Stride:    s.metadata.Stride,
		}
		chunk.Proto.Metadata.Chunks = cm
		req := connect.NewRequest(&drawv1.AddEntityRequest{
			Entity: &drawv1.AddEntityRequest_Drawing{Drawing: chunk.Proto},
		})
		resp, err := s.client.AddEntity(context.Background(), req)
		if err != nil {
			return fmt.Errorf("AddEntity RPC failed for first chunk: %w", err)
		}
		s.uuid = resp.Msg.Uuid
	} else {
		req := connect.NewRequest(&drawv1.UpdateEntityRequest{
			Uuid:   s.uuid,
			Entity: &drawv1.UpdateEntityRequest_Drawing{Drawing: chunk.Proto},
		})
		_, err := s.client.UpdateEntity(context.Background(), req)
		if err != nil {
			return fmt.Errorf("UpdateEntity RPC failed at start=%d: %w", chunk.Start, err)
		}
	}

	chunkElements := uint32(0)
	if data, ok := extractShapeData(chunk.Proto); ok && s.metadata.Stride > 0 {
		chunkElements = uint32(len(data)) / s.metadata.Stride
	}
	s.sent += chunkElements
	s.index++

	if s.onProgress != nil {
		s.onProgress(ChunkProgress{
			Index: s.index - 1,
			Sent:  s.sent,
			Total: s.metadata.GetTotal(),
			Done:  s.sent >= s.metadata.GetTotal(),
		})
	}

	return nil
}

// UUID returns the entity UUID assigned by the server after the first chunk.
// Returns nil if Next has not been called yet.
func (s *ChunkSender) UUID() []byte {
	return s.uuid
}

// Done returns true when all chunks have been sent.
func (s *ChunkSender) Done() bool {
	return s.done
}

func sliceColors(allColors []Color, offset, end int) []Color {
	if len(allColors) == 1 {
		return allColors
	}
	return allColors[offset:end]
}

func newChunkDrawing(config *DrawConfig, shape *drawv1.Shape, metadata *drawv1.Metadata) *drawv1.Drawing {
	shape.Label = config.Name
	shape.Center = poseToProtobuf(config.Center)
	return &drawv1.Drawing{
		ReferenceFrame:      config.Name,
		PoseInObserverFrame: poseInFrameToProtobuf(config.Pose, config.Parent),
		PhysicalObject:      shape,
		Uuid:                config.UUID,
		Metadata:            metadata,
	}
}
