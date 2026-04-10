package api

import (
	"context"
	"fmt"

	"connectrpc.com/connect"
	"github.com/viam-labs/motion-tools/client/server"
	"github.com/viam-labs/motion-tools/draw"
	drawv1 "github.com/viam-labs/motion-tools/draw/v1"
	"go.viam.com/rdk/pointcloud"
)

// DrawPointCloudOptions configures a DrawPointCloud call.
type DrawPointCloudOptions struct {
	// A unique identifier for the entity. If set, drawing with the same ID updates the existing entity.
	ID string

	// The name of the entity.
	Name string

	// The parent frame name. If empty, defaults to "world".
	Parent string

	// The point cloud to draw.
	PointCloud pointcloud.PointCloud

	// The downscaling threshold for point clouds in millimeters.
	DownscalingThreshold float64

	// The colors to draw the point cloud with.
	// Can be a single color, one color per point, or a color palette.
	// If not provided, the point cloud's color data will be used.
	Colors []draw.Color

	// Metadata holds optional metadata overrides (e.g. visibility).
	Metadata *MetadataOptions
}

// DrawPointCloud draws a PointCloud in the visualizer.
// Calling DrawPointCloud with an ID that already exists will instead update the point cloud.
// Returns the UUID of the drawn point cloud, or an error if the server is not running or the drawing fails.
func DrawPointCloud(options DrawPointCloudOptions) ([]byte, error) {
	if err := isASCIIPrintable(options.Name); err != nil {
		return nil, err
	}

	client := server.GetClient()
	if client == nil {
		return nil, ErrVisualizerNotRunning
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

	drawnPointCloud, err := draw.NewDrawnPointCloud(options.PointCloud, drawOptions...)
	if err != nil {
		return nil, fmt.Errorf("failed to create drawn point cloud: %w", err)
	}

	transform, err := drawnPointCloud.Draw(options.Name, entityOptions(options.ID, options.Parent, options.Metadata)...)
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
