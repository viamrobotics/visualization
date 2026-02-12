package server

import (
	"context"
	"fmt"

	"connectrpc.com/connect"
	"github.com/viam-labs/motion-tools/draw"
	drawv1 "github.com/viam-labs/motion-tools/draw/v1"

	"go.viam.com/rdk/pointcloud"
	"go.viam.com/rdk/spatialmath"
)

type DrawPointCloudOptions struct {
	// A unique identifier for the point cloud. Can be empty.
	ID string

	// The label to use for the point cloud.
	Label string

	// The point cloud to draw.
	PointCloud pointcloud.PointCloud

	// The downscaling threshold for point clouds in millimeters.
	DownscalingThreshold float64

	// The colors to draw the point cloud with.
	// Can be a single color, one color per point, or a color palette.
	// If not provided, the point cloud's color data will be used.
	Colors []draw.Color
}

// DrawPointCloud draws a PointCloud in the visualizer.
// Calling DrawPointCloud with an ID that already exists will instead update the point cloud in the parent frame.
// Returns the UUID of the drawn point cloud, or an error if the server is not running or the drawing fails
func DrawPointCloud(options DrawPointCloudOptions) ([]byte, error) {
	err := isASCIIPrintable(options.Label)
	if err != nil {
		return nil, err
	}

	client := GetClient()
	if client == nil {
		return nil, fmt.Errorf("server is not running; call server.Start() first")
	}

	drawOptions := make([]draw.DrawPointCloudOption, 0)
	if len(options.Colors) == 1 {
		drawOptions = append(drawOptions, draw.WithSinglePointCloudColor(options.Colors[0]))
	} else if len(options.Colors) == options.PointCloud.Size() {
		drawOptions = append(drawOptions, draw.WithPerPointCloudColors(options.Colors...))
	} else if len(options.Colors) > 0 {
		drawOptions = append(drawOptions, draw.WithPointCloudColorPalette(options.Colors, options.PointCloud.Size()))
	}

	if options.DownscalingThreshold > 0 {
		drawOptions = append(drawOptions, draw.WithPointCloudDownscaling(options.DownscalingThreshold))
	}

	octree, err := pointcloud.ToBasicOctree(options.PointCloud, 0)
	if err != nil {
		return nil, fmt.Errorf("failed to create basic octree: %w", err)
	}

	drawnPointCloud, err := draw.NewDrawnPointCloud(octree, drawOptions...)
	if err != nil {
		return nil, fmt.Errorf("failed to create drawn point cloud: %w", err)
	}

	transform, err := drawnPointCloud.Draw(options.ID, options.Label, "world", spatialmath.NewZeroPose())
	if err != nil {
		return nil, fmt.Errorf("failed to create transform: %w", err)
	}

	req := connect.NewRequest(&drawv1.AddTransformRequest{Transform: transform})
	resp, err := client.AddTransform(context.Background(), req)
	if err != nil {
		return nil, fmt.Errorf("AddTransform RPC failed: %w", err)
	}

	return resp.Msg.Uuid, nil
}
