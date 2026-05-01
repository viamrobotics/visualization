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
	// Proto is the drawv1.Drawing payload for this chunk; the first chunk carries
	// the full entity shape, while later chunks carry only the additional data
	// to append.
	Proto *drawv1.Drawing
	// Start is the index of the first element in this chunk relative to the full
	// entity (0 for the first chunk, ChunkSize for the second, and so on).
	Start uint32
	// IsFirst is true only for the first chunk in the stream and signals to
	// senders that the entity should be created (AddEntity) rather than appended
	// to (UpdateEntity).
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

// ChunkProgress reports the progress of a chunked entity upload after each chunk
// has been sent.
type ChunkProgress struct {
	// Index is the zero-based position of the chunk that was just sent.
	Index int
	// Sent is the cumulative number of entity elements (points, vertices, etc.)
	// sent across all chunks so far.
	Sent uint32
	// Total is the total number of elements expected across the entire entity,
	// taken from the Chunks metadata supplied to NewChunkSender.
	Total uint32
	// Done is true once Sent has reached Total.
	Done bool
}

// ChunkSender drives the upload of a chunked entity to a draw service. Iteration
// is caller-paced: each call to Next sends exactly one chunk and returns control
// to the caller, allowing the caller to throttle, retry, or interleave other work
// between chunks.
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

// NewChunkSender returns a ChunkSender that ferries the given chunker's output to
// the supplied draw service client. metadata supplies the chunk-size, total
// element count, and stride attached to the first chunk. onProgress is invoked
// after each successful chunk send; pass nil to skip progress reporting.
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

// Next sends the next chunk to the draw service. The first call issues an
// AddEntity RPC to create the entity (and records the server-assigned UUID for
// retrieval via UUID); subsequent calls issue UpdateEntity RPCs against that UUID.
// After each successful send, the configured progress callback (if any) is invoked.
// Returns io.EOF when every chunk has been sent, or a wrapped RPC error if a send
// fails.
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

// UUID returns the entity UUID assigned by the server after the first chunk has
// been sent. Returns nil if Next has not been called yet, or if the first send
// failed.
func (s *ChunkSender) UUID() []byte {
	return s.uuid
}

// Done reports whether the sender has exhausted its chunk channel; once true,
// subsequent calls to Next return io.EOF without making any RPCs.
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
