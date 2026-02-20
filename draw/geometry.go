package draw

import (
	"fmt"

	commonv1 "go.viam.com/api/common/v1"
	"go.viam.com/rdk/pointcloud"
	"go.viam.com/rdk/spatialmath"
)

// DrawnGeometry is a geometry that has been drawn.
type DrawnGeometry struct {
	// The geometry to draw.
	Geometry spatialmath.Geometry

	// The colors to draw the geometry with.
	// Should be a single color for simple geometries.
	// For complex geometries, this can be a single color, a color palette, or a color per vertex.
	Colors []Color
}

// DrawnGeometryConfig holds configuration options for drawing a geometry.
type DrawnGeometryConfig struct {
	drawColorsConfig

	// The threshold in millimeters for downscaling, defaults to 0.
	// Currently only supported for point clouds.
	downscalingThreshold float64
}

// newDrawGeometryConfig creates a new draw geometry configuration
func newDrawGeometryConfig(isPointCloud bool) *DrawnGeometryConfig {
	config := &DrawnGeometryConfig{
		drawColorsConfig:     newDrawColorsConfig(),
		downscalingThreshold: 0,
	}

	config.SetColors([]Color{ColorFromName("red")})
	return config
}

// DrawGeometryOption is a functional option for configuring a Geometry
type DrawGeometryOption func(*DrawnGeometryConfig)

// WithGeometryColor creates a geometry option that sets the color for the geometry.
func WithGeometryColor(color Color) DrawGeometryOption {
	return withColors[*DrawnGeometryConfig]([]Color{color})
}

// WithGeometryColors creates a geometry option that sets the colors for the geometry.
func WithGeometryColors(colors ...Color) DrawGeometryOption {
	return withColors[*DrawnGeometryConfig](colors)
}

// WithPointCloudDownscaling creates a geometry option for point clouds that sets the threshold in millimeters below which points are not rendered from one another.
func WithGeometryDownscaling(threshold float64) DrawGeometryOption {
	return func(config *DrawnGeometryConfig) {
		config.downscalingThreshold = threshold
	}
}

// NewDrawnGeometry creates a new DrawnGeometry object from the given geometry and options.
func NewDrawnGeometry(geometry spatialmath.Geometry, options ...DrawGeometryOption) (*DrawnGeometry, error) {
	proto := geometry.ToProtobuf()
	isPointCloud := proto.GetPointcloud() != nil

	config := newDrawGeometryConfig(isPointCloud)
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

	downscaled := downscalePointCloud(pc, config.downscalingThreshold)
	drawnGeometry, err := pointcloud.ToBasicOctree(downscaled, 0)
	if err != nil {
		return nil, err
	}

	drawnGeometry.SetLabel(proto.GetLabel())

	return &DrawnGeometry{Geometry: drawnGeometry, Colors: config.colors}, nil
}

// Draw creates a Transform from this DrawnGeometry object, positioned at the given pose within the specified reference frame.
// If the name is empty, the geometry label is used as the name.
func (drawnGeometry *DrawnGeometry) Draw(name string, options ...drawableOption) (*commonv1.Transform, error) {
	config := NewDrawConfig(name, options...)
	if config.Name == "" {
		config.Name = drawnGeometry.Geometry.Label()
	}

	if len(drawnGeometry.Colors) > 0 {
		metadata := NewMetadata(WithMetadataColors(drawnGeometry.Colors...))
		metadataStruct, err := MetadataToStruct(metadata)
		if err != nil {
			return nil, fmt.Errorf("failed to create metadata: %w", err)
		}

		return NewTransform(config.UUID, config.Name, config.Parent, config.Pose, drawnGeometry.Geometry, metadataStruct), nil
	}

	return NewTransform(config.UUID, config.Name, config.Parent, config.Pose, drawnGeometry.Geometry, nil), nil
}
