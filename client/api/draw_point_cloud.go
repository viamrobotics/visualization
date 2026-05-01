package api

import (
	"context"
	"fmt"

	"connectrpc.com/connect"
	"github.com/viam-labs/motion-tools/client/server"
	"github.com/viam-labs/motion-tools/draw"
	drawv1 "github.com/viam-labs/motion-tools/draw/v1"
	"github.com/viam-labs/motion-tools/draw/v1/drawv1connect"
	"go.viam.com/rdk/pointcloud"
)

// DrawPointCloudOptions configures a DrawPointCloud call.
type DrawPointCloudOptions struct {
	// ID is a stable identifier for the entity. When set, calling
	// DrawPointCloud again with the same ID updates the existing entity in
	// place; when empty, each call creates a new entity with a freshly
	// generated UUID.
	ID string
	// Name labels the entity in the visualizer. Must be ASCII printable and at
	// most 100 characters.
	Name string
	// PointCloud is the underlying cloud to render. Required.
	PointCloud pointcloud.PointCloud
	// Parent is the reference frame the cloud is attached to. Defaults to
	// "world" when empty.
	Parent string
	// DownscalingThreshold reduces the rendered point count by keeping only
	// points whose mutual distance exceeds this threshold (millimeters). 0
	// (the default) disables downscaling. Note: downscaling is O(n^2) in the
	// input point count.
	DownscalingThreshold float64
	// Colors controls how the cloud is colored. With no colors, the cloud's
	// own per-point color data (if any) is used by the visualizer. Pass one
	// color to override with a single shared color; pass exactly
	// PointCloud.Size() colors for per-point colors; pass any other count to
	// cycle through the slice as a palette.
	Colors []draw.Color
	// ChunkSize, when > 0, splits the cloud into chunks of this many points
	// and delivers them progressively over multiple RPCs (one AddEntity call
	// followed by UpdateEntity calls). When 0, the entire cloud is sent in a
	// single AddEntity call. Use chunked delivery for large clouds to avoid
	// oversize payloads and surface progress in the UI.
	ChunkSize int
	// OnProgress is invoked after each chunk is sent during chunked delivery.
	// Ignored when ChunkSize is 0. Pass nil to skip progress reporting.
	OnProgress func(draw.ChunkProgress)
	// Attrs carries optional shared display attributes (axes helper, default
	// visibility). Nil leaves all attributes at their defaults.
	Attrs *Attrs
}

// DrawPointCloud sends a point cloud to the visualizer as a transform. Passing
// an ID that already exists updates the previously drawn entity in place;
// otherwise a new entity is created. When ChunkSize > 0, the cloud is streamed
// over multiple RPCs and OnProgress (if provided) is invoked after each chunk.
// Returns the UUID assigned by the server.
//
// Returns an error when Name is not ASCII printable or exceeds 100 characters,
// ErrVisualizerNotRunning if no visualizer is reachable, the underlying
// validation error if the cloud cannot be constructed (see
// draw.NewDrawnPointCloud — negative downscaling threshold, etc.), or a
// wrapped RPC error if a network call fails.
func DrawPointCloud(options DrawPointCloudOptions) ([]byte, error) {
	if err := isASCIIPrintable(options.Name); err != nil {
		return nil, err
	}

	client := server.GetClient()
	if client == nil {
		return nil, ErrVisualizerNotRunning
	}

	if options.ChunkSize > 0 {
		chunks, err := chunkPointCloud(options)
		if err != nil {
			return nil, err
		}
		return server.DrainChunks(chunks)
	}

	pointCloud, drawOptions, err := buildPointCloud(options)
	if err != nil {
		return nil, err
	}
	return drawPointCloud(client, pointCloud, options, drawOptions)
}

func buildPointCloud(options DrawPointCloudOptions) (*draw.DrawnPointCloud, []draw.DrawableOption, error) {
	var pointcloudOptions []draw.DrawPointCloudOption
	if len(options.Colors) == 1 {
		pointcloudOptions = append(pointcloudOptions, draw.WithSinglePointCloudColor(options.Colors[0]))
	} else if len(options.Colors) == options.PointCloud.Size() {
		pointcloudOptions = append(pointcloudOptions, draw.WithPerPointCloudColors(options.Colors...))
	} else if len(options.Colors) > 0 {
		pointcloudOptions = append(pointcloudOptions, draw.WithPointCloudColorPalette(options.Colors, options.PointCloud.Size()))
	}

	if options.DownscalingThreshold > 0 {
		pointcloudOptions = append(pointcloudOptions, draw.WithPointCloudDownscaling(options.DownscalingThreshold))
	}

	pointCloud, err := draw.NewDrawnPointCloud(options.PointCloud, pointcloudOptions...)
	if err != nil {
		return nil, nil, fmt.Errorf("failed to create drawn point cloud: %w", err)
	}

	return pointCloud, entityAttributes(options.ID, options.Parent, options.Attrs), nil
}

func drawPointCloud(
	client drawv1connect.DrawServiceClient,
	pointCloud *draw.DrawnPointCloud,
	options DrawPointCloudOptions,
	drawOptions []draw.DrawableOption,
) ([]byte, error) {
	transform, err := pointCloud.Draw(options.Name, drawOptions...)
	if err != nil {
		return nil, fmt.Errorf("failed to create transform: %w", err)
	}

	req := connect.NewRequest(&drawv1.AddEntityRequest{Entity: &drawv1.AddEntityRequest_Transform{Transform: transform}})
	resp, err := client.AddEntity(context.Background(), req)
	if err != nil {
		return nil, fmt.Errorf("AddEntity RPC failed: %w", err)
	}

	return resp.Msg.Uuid, nil
}

func chunkPointCloud(options DrawPointCloudOptions) (*draw.ChunkSender, error) {
	client := server.GetClient()

	pointCloud, drawOptions, err := buildPointCloud(options)
	if err != nil {
		return nil, err
	}

	chunker := draw.NewPointCloudChunker(pointCloud, options.Name, options.ChunkSize, drawOptions...)
	metadata := &drawv1.Chunks{
		ChunkSize: uint32(options.ChunkSize),
		Total:     uint32(pointCloud.PointCloud.Size()),
		Stride:    3 * 4, // float32 xyz = 12 bytes per point
	}
	return draw.NewChunkSender(chunker, client, metadata, options.OnProgress), nil
}
