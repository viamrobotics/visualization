package draw

import (
	"fmt"

	commonv1 "go.viam.com/api/common/v1"
	"go.viam.com/rdk/pointcloud"
	"go.viam.com/rdk/spatialmath"
)

// DrawnGeometry pairs a spatialmath.Geometry with the colors used to render it. It
// is the input to NewTransform via DrawnGeometry.Draw, which makes the geometry
// participate in the frame system as a physical entity.
type DrawnGeometry struct {
	// Geometry is the underlying spatial geometry to render.
	Geometry spatialmath.Geometry
	// Colors are the colors used to render the geometry. For simple geometries
	// (boxes, spheres, capsules) supply a single color; for complex geometries
	// such as point clouds, supply either a single color or one color per vertex.
	Colors []Color
}

// DrawnGeometryConfig is the resolved option state used internally by NewDrawnGeometry.
// Most callers do not construct it directly; build a DrawnGeometry by passing
// DrawGeometryOption values to NewDrawnGeometry instead.
type DrawnGeometryConfig struct {
	drawColorsConfig

	// downscalingThreshold is the minimum spacing (in millimeters) between retained
	// point-cloud points; 0 disables downscaling. Only consulted for point-cloud
	// geometries.
	downscalingThreshold float64
}

func newDrawGeometryConfig() *DrawnGeometryConfig {
	config := &DrawnGeometryConfig{
		drawColorsConfig:     newDrawColorsConfig(),
		downscalingThreshold: 0,
	}

	config.SetColors([]Color{ColorFromName("red")})
	return config
}

// DrawGeometryOption configures a DrawnGeometry produced by NewDrawnGeometry. When
// multiple options touch the same field, the last option in the argument list wins.
type DrawGeometryOption func(*DrawnGeometryConfig)

// WithGeometryColor renders the geometry with a single shared color.
func WithGeometryColor(color Color) DrawGeometryOption {
	return withColors[*DrawnGeometryConfig]([]Color{color})
}

// WithGeometryColors assigns multiple colors to the geometry. Most simple geometries
// only honor the first color; point clouds may use one color per vertex when the
// length matches the point count.
func WithGeometryColors(colors ...Color) DrawGeometryOption {
	return withColors[*DrawnGeometryConfig](colors)
}

// WithGeometryDownscaling reduces the number of rendered points by keeping only
// points whose mutual distance exceeds threshold (millimeters). A threshold of 0
// (the default) disables downscaling. The option is only honored when the geometry
// is a point cloud; it is ignored for other geometry types.
//
// Note: the underlying algorithm is O(n^2) in the input point count, so large
// thresholds (which retain more points) on dense clouds can be slow.
func WithGeometryDownscaling(threshold float64) DrawGeometryOption {
	return func(config *DrawnGeometryConfig) {
		config.downscalingThreshold = threshold
	}
}

// NewDrawnGeometry returns a DrawnGeometry wrapping the given geometry. For
// non-point-cloud geometries, options other than colors are ignored. For point
// clouds, a positive WithGeometryDownscaling threshold downsamples the cloud and
// converts it to a basic octree before storage. Returns an error if the threshold
// is negative or if octree conversion fails.
func NewDrawnGeometry(geometry spatialmath.Geometry, options ...DrawGeometryOption) (*DrawnGeometry, error) {
	proto := geometry.ToProtobuf()
	isPointCloud := proto.GetPointcloud() != nil

	config := newDrawGeometryConfig()
	for _, option := range options {
		option(config)
	}

	if !isPointCloud {
		return &DrawnGeometry{Geometry: geometry, Colors: config.colors}, nil
	}

	if config.downscalingThreshold < 0 {
		return nil, fmt.Errorf("downscaling threshold must be greater than or equal to 0 for point clouds")
	}

	if config.downscalingThreshold == 0 {
		return &DrawnGeometry{Geometry: geometry, Colors: config.colors}, nil
	}

	pc, err := pointcloud.NewPointCloudFromProto(proto.GetPointcloud(), proto.GetLabel())
	if err != nil {
		return nil, err
	}

	downscaled, err := downscalePointCloud(pc, config.downscalingThreshold)
	if err != nil {
		return nil, err
	}
	drawnGeometry, err := pointcloud.ToBasicOctree(downscaled, 0)
	if err != nil {
		return nil, err
	}

	drawnGeometry.SetLabel(proto.GetLabel())

	return &DrawnGeometry{Geometry: drawnGeometry, Colors: config.colors}, nil
}

// Draw wraps the DrawnGeometry in a Transform identified by name. If name is empty,
// the geometry's existing label is used. The DrawableOptions control placement
// (parent frame, pose, center), identity (UUID), and visibility — see
// DrawableOption for the full set.
//
// The error return is currently always nil; it is kept for symmetry with
// DrawnPointCloud.Draw, where octree conversion can fail.
func (drawnGeometry *DrawnGeometry) Draw(name string, options ...DrawableOption) (*commonv1.Transform, error) {
	if name == "" {
		name = drawnGeometry.Geometry.Label()
	}

	config := NewDrawConfig(name, options...)

	if len(drawnGeometry.Colors) > 0 {
		return NewTransform(config, drawnGeometry.Geometry, WithMetadataColors(drawnGeometry.Colors...)), nil
	}

	return NewTransform(config, drawnGeometry.Geometry), nil
}
