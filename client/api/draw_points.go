package api

import (
	"context"
	"fmt"

	"connectrpc.com/connect"
	"github.com/golang/geo/r3"
	"github.com/viam-labs/motion-tools/client/server"
	"github.com/viam-labs/motion-tools/draw"
	drawv1 "github.com/viam-labs/motion-tools/draw/v1"
)

// DrawPointsOptions configures a DrawPoints call.
type DrawPointsOptions struct {
	// ID is a stable identifier for the entity. When set, calling DrawPoints
	// again with the same ID updates the existing entity in place; when empty,
	// each call creates a new entity with a freshly generated UUID.
	ID string
	// Name labels the entity in the visualizer. Must be ASCII printable and at
	// most 100 characters.
	Name string
	// Parent is the reference frame the points are attached to. Defaults to
	// "world" when empty.
	Parent string
	// Positions are the locations of each point. Must contain at least one
	// position.
	Positions []r3.Vector
	// Colors controls how the points are colored. With no colors, every point
	// uses draw.DefaultPointColor (gray). Pass one color to share it across all
	// points; pass exactly len(Positions) colors for per-point colors; pass any
	// other count to cycle through the slice as a palette.
	Colors []draw.Color
	// PointSize is the rendered diameter of each point in millimeters. 0 (the
	// default) uses draw.DefaultPointSize (10mm).
	PointSize float32
	// ChunkSize, when > 0, splits the positions into chunks of this size and
	// delivers them progressively over multiple RPCs (one AddEntity call
	// followed by UpdateEntity calls). When 0, the entire payload is sent in a
	// single AddEntity call.
	ChunkSize int
	// OnProgress is invoked after each chunk is sent during chunked delivery.
	// Ignored when ChunkSize is 0. Pass nil to skip progress reporting.
	OnProgress func(draw.ChunkProgress)
	// Attrs carries optional shared display attributes (axes helper, default
	// visibility). Nil leaves all attributes at their defaults.
	Attrs *Attrs
}

// DrawPoints sends a set of points to the visualizer as a drawing. Passing an
// ID that already exists updates the previously drawn entity in place;
// otherwise a new entity is created. When ChunkSize > 0, the positions are
// streamed over multiple RPCs and OnProgress (if provided) is invoked after
// each chunk. Returns the UUID assigned by the server.
//
// Returns an error when Name is not ASCII printable or exceeds 100 characters,
// ErrVisualizerNotRunning if no visualizer is reachable, the underlying
// validation error if the points cannot be constructed (see draw.NewPoints —
// empty positions, mismatched color count, etc.), or a wrapped RPC error if a
// network call fails.
func DrawPoints(options DrawPointsOptions) ([]byte, error) {
	if err := isASCIIPrintable(options.Name); err != nil {
		return nil, err
	}

	client := server.GetClient()
	if client == nil {
		return nil, ErrVisualizerNotRunning
	}

	if options.ChunkSize > 0 {
		chunks, err := chunkPoints(options)
		if err != nil {
			return nil, err
		}
		return server.DrainChunks(chunks)
	}

	points, drawOpts, err := buildPoints(options)
	if err != nil {
		return nil, err
	}

	drawing := points.Draw(options.Name, drawOpts...)
	req := connect.NewRequest(&drawv1.AddEntityRequest{Entity: &drawv1.AddEntityRequest_Drawing{Drawing: drawing.ToProto()}})
	resp, err := client.AddEntity(context.Background(), req)
	if err != nil {
		return nil, fmt.Errorf("AddEntity RPC failed: %w", err)
	}

	return resp.Msg.Uuid, nil
}

func buildPoints(options DrawPointsOptions) (*draw.Points, []draw.DrawableOption, error) {
	colorCount := len(options.Colors)
	posCount := len(options.Positions)

	var pointOptions []draw.DrawPointsOption
	switch colorCount {
	case 0:
		pointOptions = append(pointOptions, draw.WithSinglePointColor(draw.DefaultPointColor))
	case 1:
		pointOptions = append(pointOptions, draw.WithSinglePointColor(options.Colors[0]))
	case posCount:
		pointOptions = append(pointOptions, draw.WithPerPointColors(options.Colors...))
	default:
		pointOptions = append(pointOptions, draw.WithPointColorPalette(options.Colors, posCount))
	}

	if options.PointSize > 0 {
		pointOptions = append(pointOptions, draw.WithPointsSize(options.PointSize))
	}

	points, err := draw.NewPoints(options.Positions, pointOptions...)
	if err != nil {
		return nil, nil, fmt.Errorf("failed to create points: %w", err)
	}

	return points, entityAttributes(options.ID, options.Parent, options.Attrs), nil
}

func chunkPoints(options DrawPointsOptions) (*draw.ChunkSender, error) {
	client := server.GetClient()

	points, drawOpts, err := buildPoints(options)
	if err != nil {
		return nil, err
	}

	chunker := draw.NewPointsChunker(points, options.Name, options.ChunkSize, drawOpts...)
	metadata := &drawv1.Chunks{
		ChunkSize: uint32(options.ChunkSize),
		Total:     uint32(len(points.Positions)),
		Stride:    3 * 4, // float32 xyz = 12 bytes per point
	}
	return draw.NewChunkSender(chunker, client, metadata, options.OnProgress), nil
}
