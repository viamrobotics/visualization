package draw

import (
	"fmt"

	"github.com/golang/geo/r3"
	commonv1 "go.viam.com/api/common/v1"
	"go.viam.com/rdk/pointcloud"
)

// DrawnPointCloud pairs a point cloud with the colors used to render it. It is the
// input to NewTransform via DrawnPointCloud.Draw, which makes the cloud participate
// in the frame system as a physical entity.
type DrawnPointCloud struct {
	// PointCloud is the underlying point cloud to render.
	PointCloud pointcloud.PointCloud
	// Colors are the colors used to render the cloud. Supply either a single color
	// (applied to every point) or one color per point. If empty, the cloud's
	// per-point color data is used by the visualizer.
	Colors []Color
}

// DrawnPointCloudConfig is the resolved option state used internally by
// NewDrawnPointCloud. Most callers do not construct it directly; build a
// DrawnPointCloud by passing DrawPointCloudOption values to NewDrawnPointCloud
// instead.
type DrawnPointCloudConfig struct {
	drawColorsConfig

	// downscalingThreshold is the minimum spacing (in millimeters) between retained
	// points; 0 disables downscaling.
	downscalingThreshold float64
}

func newDrawPointCloudConfig() *DrawnPointCloudConfig {
	return &DrawnPointCloudConfig{
		drawColorsConfig:     newDrawColorsConfig(),
		downscalingThreshold: 0,
	}
}

// DrawPointCloudOption configures a DrawnPointCloud produced by NewDrawnPointCloud.
// When multiple options touch the same field, the last option in the argument list
// wins.
type DrawPointCloudOption func(*DrawnPointCloudConfig)

// WithSinglePointCloudColor renders every point in the cloud with the given color.
func WithSinglePointCloudColor(color Color) DrawPointCloudOption {
	return withColors[*DrawnPointCloudConfig]([]Color{color})
}

// WithPerPointCloudColors assigns one color per point. The number of colors must
// equal the number of points in the cloud passed to NewDrawnPointCloud.
func WithPerPointCloudColors(colors ...Color) DrawPointCloudOption {
	return withColors[*DrawnPointCloudConfig](colors)
}

// WithPointCloudColorPalette generates numPoints per-point colors by cycling
// through the given palette. Pass numPoints equal to the number of points in the
// cloud.
func WithPointCloudColorPalette(palette []Color, numPoints int) DrawPointCloudOption {
	return withColorPalette[*DrawnPointCloudConfig](palette, numPoints)
}

// WithPointCloudDownscaling reduces the number of rendered points by keeping only
// points whose mutual distance exceeds threshold (millimeters). A threshold of 0
// (the default) disables downscaling.
//
// Note: the underlying algorithm is O(n^2) in the input point count, so applying
// downscaling to large clouds can be slow.
func WithPointCloudDownscaling(threshold float64) DrawPointCloudOption {
	return func(config *DrawnPointCloudConfig) {
		config.downscalingThreshold = threshold
	}
}

// NewDrawnPointCloud returns a DrawnPointCloud wrapping the given cloud. A positive
// WithPointCloudDownscaling threshold downsamples the cloud before storage; a
// threshold of 0 stores the input unchanged. Returns an error if the threshold is
// negative or if downscaling fails.
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

	downscaled, err := downscalePointCloud(pointCloud, config.downscalingThreshold)
	if err != nil {
		return nil, err
	}
	return &DrawnPointCloud{PointCloud: downscaled, Colors: config.colors}, nil
}

// Draw wraps the DrawnPointCloud in a Transform identified by name. The point cloud
// is converted to a basic octree before serialization. The DrawableOptions control
// placement (parent frame, pose, center), identity (UUID), and visibility — see
// DrawableOption for the full set. Returns an error if octree conversion fails.
func (drawnPointCloud *DrawnPointCloud) Draw(name string, options ...DrawableOption) (*commonv1.Transform, error) {
	config := NewDrawConfig(name, options...)

	octree, err := pointcloud.ToBasicOctree(drawnPointCloud.PointCloud, 0)
	if err != nil {
		return nil, fmt.Errorf("failed to create basic octree: %w", err)
	}

	return NewTransform(config, octree, WithMetadataColors(drawnPointCloud.Colors...)), nil
}

// downscalePointCloud downscales a point cloud to a given threshold in millimeters.
func downscalePointCloud(pc pointcloud.PointCloud, minDistance float64) (pointcloud.PointCloud, error) {
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
		if err := downscaled.Set(point.point, point.data); err != nil {
			return nil, fmt.Errorf("failed to set point in downscaled point cloud: %w", err)
		}
	}

	return downscaled, nil
}
