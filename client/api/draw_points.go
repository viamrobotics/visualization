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
	// A unique identifier for the entity. If set, drawing with the same ID updates the existing entity.
	ID string

	// The name of the entity.
	Name string

	// The parent frame name. If empty, defaults to "world".
	Parent string

	// The positions of the points.
	Positions []r3.Vector

	// Colors is the list of colors to use for the points.
	// Can be a single color for all points, per-point colors, or a color palette to cycle through.
	Colors []draw.Color

	// PointSize is the size of each point in millimeters. If 0, uses the default.
	PointSize float32

	// ChunkSize controls chunked delivery.
	// - When > 0, points are sent in chunks of this size.
	// - Otherwise, all points are sent in a single call.
	ChunkSize int

	// OnProgress is called after each chunk is sent during chunked delivery.
	OnProgress func(draw.ChunkProgress)

	// Attrs holds optional entity attributes (e.g. visibility).
	Attrs *Attrs
}

// DrawPoints draws a set of points in the visualizer.
// Returns the UUID of the drawn points, or an error if the server is not running or the drawing fails.
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
