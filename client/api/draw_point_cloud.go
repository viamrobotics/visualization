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

// DrawPointCloudOptions configures a DrawPointCloud or StreamEntity call.
type DrawPointCloudOptions struct {
	// A unique identifier for the entity. If set, drawing with the same ID updates the existing entity.
	ID string

	// The name of the entity.
	Name string

	// The point cloud to draw.
	PointCloud pointcloud.PointCloud

	// The name of the parent frame. If empty, the point cloud will be parented to the "world" frame.
	Parent string

	// The downscaling threshold for point clouds in millimeters.
	DownscalingThreshold float64

	// The colors to draw the point cloud with.
	// Can be a single color, one color per point, or a color palette.
	// If not provided, the point cloud's color data will be used.
	Colors []draw.Color

	// ChunkSize controls streaming.
	// - When > 0, the point cloud is streamed in chunks of this size.
	// - Otherwise, the point cloud is sent in a single call.
	ChunkSize int

	// OnProgress is called after each chunk is sent during chunked delivery.
	OnProgress func(draw.ChunkProgress)

	// Attrs holds optional entity attributes (e.g. visibility).
	Attrs *Attrs
}

// DrawPointCloud draws a PointCloud in the visualizer.
// Returns the UUID of the drawn point cloud, or an error if the server is not running or the drawing fails.
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
