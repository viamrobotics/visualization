package draw

import (
	"fmt"

	"github.com/golang/geo/r3"
	commonv1 "go.viam.com/api/common/v1"
	"go.viam.com/rdk/pointcloud"
	"go.viam.com/rdk/spatialmath"
)

// DrawnPointCloud is a point cloud that has been drawn.
type DrawnPointCloud struct {
	// The point cloud to draw.
	PointCloud pointcloud.PointCloud

	// The colors to draw the point cloud with.
	// Can be a single color, one color per point, or a color palette.
	// If not provided, the point cloud's color data will be used.
	Colors []Color
}

// DrawnPointCloudConfig holds configuration options for drawing a point cloud.
type DrawnPointCloudConfig struct {
	DrawColorsConfig

	// The threshold in millimeters for downscaling, defaults to 0.
	downscalingThreshold float64
}

// newDrawGeometryConfig creates a new draw geometry configuration
func newDrawPointCloudConfig() *DrawnPointCloudConfig {
	return &DrawnPointCloudConfig{
		DrawColorsConfig:     NewDrawColorsConfig(),
		downscalingThreshold: 0,
	}
}

// DrawPointCloudOption is a functional option for configuring a DrawPointCloud
type DrawPointCloudOption func(*DrawnPointCloudConfig)

// WithSinglePointCloudColor creates a point cloud option that sets the color for the point cloud.
func WithSinglePointCloudColor(color Color) DrawPointCloudOption {
	return withColors[*DrawnPointCloudConfig]([]Color{color})
}

// WithPerPointCloudColors creates a point cloud option that sets the colors for each point.
func WithPerPointCloudColors(colors ...Color) DrawPointCloudOption {
	return withColors[*DrawnPointCloudConfig](colors)
}

// WithPointCloudColorPalette creates a point cloud option that iterates through colors for a point cloud.
func WithPointCloudColorPalette(palette []Color, numPoints int) DrawPointCloudOption {
	finalColors := make([]Color, numPoints)
	for i := range numPoints {
		finalColors[i] = palette[i%len(palette)]
	}
	return withColors[*DrawnPointCloudConfig](finalColors)
}

// WithPointCloudDownscaling creates a point cloud option that sets the threshold in millimeters below which points are not rendered from one another.
func WithPointCloudDownscaling(threshold float64) DrawPointCloudOption {
	return func(config *DrawnPointCloudConfig) {
		config.downscalingThreshold = threshold
	}
}

// NewDrawnPointCloud creates a new DrawnPointCloud object from the given point cloud and options.
func NewDrawnPointCloud(pointCloud pointcloud.PointCloud, options ...DrawPointCloudOption) (*DrawnPointCloud, error) {
	config := newDrawPointCloudConfig()
	for _, option := range options {
		option(config)
	}

	if config.downscalingThreshold < 0 {
		return nil, fmt.Errorf("downscaling threshold must be greater than or equal to 0 for point clouds")
	}

	if config.downscalingThreshold == 0 {
		return &DrawnPointCloud{PointCloud: pointCloud, Colors: config.colors}, nil
	}

	downscaled := downscalePointCloud(pointCloud, config.downscalingThreshold)
	return &DrawnPointCloud{PointCloud: downscaled, Colors: config.colors}, nil
}

// Draw creates a Transform from this DrawnPointCloud object, positioned at the given pose within the specified reference frame.
func (drawnPointCloud *DrawnPointCloud) Draw(id string, name string, parent string, pose spatialmath.Pose) (*commonv1.Transform, error) {
	metadata := NewMetadata(WithMetadataColors(drawnPointCloud.Colors...))
	metadataStruct, err := MetadataToStruct(metadata)
	if err != nil {
		return nil, fmt.Errorf("failed to create metadata: %w", err)
	}

	octree, err := pointcloud.ToBasicOctree(drawnPointCloud.PointCloud, 0)
	if err != nil {
		return nil, fmt.Errorf("failed to create basic octree: %w", err)
	}

	return NewTransform(id, name, parent, pose, octree, metadataStruct), nil
}

// downscalePointCloud downscales a point cloud to a given threshold in millimeters.
func downscalePointCloud(pc pointcloud.PointCloud, minDistance float64) pointcloud.PointCloud {
	addedPoints := make([]struct {
		point r3.Vector
		data  pointcloud.Data
	}, 0)
	pc.Iterate(0, 0, func(p r3.Vector, d pointcloud.Data) bool {
		for idx := range addedPoints {
			// Dan: In lieu of a geo index for these distance/collision lookups, we use a O(n^2)
			// algorithm. Given the below details with a `minDistance` of 25 "distance units", this
			// takes ~20 seconds on a work machine. Keeping a total of ~8000 points. Fifty "distance
			// units" took ~7 seconds. Keeping a total of ~2000 points. For this use-case I'd like
			// to drop the distance down to between 2->10. But I expect the current quadratic
			// algorithm to be prohibitively slow there.
			if addedPoints[idx].point.Distance(p) < minDistance {
				// Too close to a point we've added. Move on to the next candidate.
				//
				// Dan: If it's useful for tuning an indexing data structure, I've found:
				// - a 3.5 million point pointcloud
				// - representing a ~1 square meter surface
				// - that results in 56MB http payload
				// Has neighboring points that are as small as 1 "distance unit" apart
				return true
			}
		}
		addedPoints = append(addedPoints, struct {
			point r3.Vector
			data  pointcloud.Data
		}{p, d})
		return true
	})

	downscaled := pointcloud.NewBasicPointCloud(len(addedPoints))
	for _, point := range addedPoints {
		downscaled.Set(point.point, point.data)
	}

	return downscaled
}
