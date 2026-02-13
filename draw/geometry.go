package draw

import (
	"fmt"

	commonv1 "go.viam.com/api/common/v1"
	"go.viam.com/rdk/pointcloud"
	"go.viam.com/rdk/referenceframe"
	"go.viam.com/rdk/spatialmath"
)

// DrawnGeometry is a geometry that has been drawn.
type DrawnGeometry struct {
	// The geometry to draw.
	Geometry spatialmath.Geometry

	// The color to draw the geometry with.
	// For point clouds, this acts as a single-color override to the point cloud's color data.
	// For more complex pointcloud rendering, use the DrawnPointCloud.
	Color *Color
}

// DrawnGeometryConfig holds configuration options for drawing a geometry.
type DrawnGeometryConfig struct {
	color *Color

	// The threshold in millimeters for downscaling, defaults to 0.
	// Currently only supported for point clouds.
	downscalingThreshold float64
}

// newDrawGeometryConfig creates a new draw geometry configuration
func newDrawGeometryConfig(isPointCloud bool) *DrawnGeometryConfig {
	config := &DrawnGeometryConfig{
		color:                nil,
		downscalingThreshold: 0,
	}

	if !isPointCloud {
		red := NewColor(WithName("red"))
		config.color = &red
	}

	return config
}

// DrawGeometryOption is a functional option for configuring a Geometry
type DrawGeometryOption func(*DrawnGeometryConfig)

// WithGeometryColor creates a geometry option that sets the color for the geometry.
func WithGeometryColor(color Color) DrawGeometryOption {
	return func(config *DrawnGeometryConfig) {
		config.color = &color
	}
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
		return &DrawnGeometry{Geometry: geometry, Color: config.color}, nil
	}

	if config.downscalingThreshold < 0 {
		return nil, fmt.Errorf("downscaling threshold must be greater than or equal to 0 for point clouds")
	}

	if config.downscalingThreshold == 0 {
		return &DrawnGeometry{Geometry: geometry, Color: config.color}, nil
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

	return &DrawnGeometry{Geometry: drawnGeometry, Color: config.color}, nil
}

// Draw creates a Transform from this DrawnGeometry object, positioned at the given pose within the specified reference frame.
func (drawnGeometry *DrawnGeometry) Draw(id string, name string, parent string, pose spatialmath.Pose) (*commonv1.Transform, error) {
	if drawnGeometry.Color != nil {
		metadata := NewMetadata(WithMetadataColors(*drawnGeometry.Color))
		metadataStruct, err := MetadataToStruct(metadata)
		if err != nil {
			return nil, fmt.Errorf("failed to create metadata: %w", err)
		}
		return NewTransform(id, name, parent, pose, drawnGeometry.Geometry, metadataStruct), nil
	}

	return NewTransform(id, name, parent, pose, drawnGeometry.Geometry, nil), nil
}

type DrawnGeometriesInFrame struct {
	// The parent frame of the geometries.
	Parent string

	// The geometries to draw.
	DrawnGeometries []*DrawnGeometry
}

type drawnGeometriesInFrameConfig struct {
	DrawColorsConfig

	// The threshold in millimeters for downscaling, defaults to 0.
	// Currently only supported for point clouds.
	downscalingThreshold float64
}

// newDrawnGeometriesInFrameConfig creates a new draw geometries in frame configuration
func newDrawnGeometriesInFrameConfig() *drawnGeometriesInFrameConfig {
	return &drawnGeometriesInFrameConfig{
		DrawColorsConfig:     NewDrawColorsConfig(),
		downscalingThreshold: 0,
	}
}

// DrawGeometriesInFrameOption is a functional option for configuring a DrawGeometriesInFrame
type DrawGeometriesInFrameOption func(*drawnGeometriesInFrameConfig)

// WithSingleGeometriesColor creates a geometries in frame option that sets the color for all geometries.
func WithSingleGeometriesColor(color Color) DrawGeometriesInFrameOption {
	return withColors[*drawnGeometriesInFrameConfig]([]Color{color})
}

// WithPerGeometriesColors creates a geometries in frame option that sets the colors for each geometry.
func WithPerGeometriesColors(colors ...Color) DrawGeometriesInFrameOption {
	return withColors[*drawnGeometriesInFrameConfig](colors)
}

// WithGeometriesColorPalette creates a geometries in frame option that iterates through colors for geometries.
func WithGeometriesColorPalette(palette []Color, numGeometries int) DrawGeometriesInFrameOption {
	finalColors := make([]Color, numGeometries)
	for i := range numGeometries {
		finalColors[i] = palette[i%len(palette)]
	}
	return withColors[*drawnGeometriesInFrameConfig](finalColors)
}

// WithGeometriesDownscalingThreshold creates a geometries in frame option that sets the threshold in millimeters for downscaling.
func WithGeometriesDownscalingThreshold(threshold float64) DrawGeometriesInFrameOption {
	return func(config *drawnGeometriesInFrameConfig) {
		config.downscalingThreshold = threshold
	}
}

// NewDrawnGeometriesInFrame creates a new DrawnGeometriesInFrame object from the given geometries and options.
// Returns an error if the number of colors doesn't match the number of geometries.
func NewDrawnGeometriesInFrame(geometriesInFrame *referenceframe.GeometriesInFrame, options ...DrawGeometriesInFrameOption) (*DrawnGeometriesInFrame, error) {
	geometries := geometriesInFrame.Geometries()
	config := newDrawnGeometriesInFrameConfig()
	for _, option := range options {
		option(config)
	}

	if !(len(config.colors) == 1 || len(config.colors) == len(geometries)) {
		return nil, fmt.Errorf("colors must have length 1 (single color) or %d (per-geometry colors), got %d", len(geometries), len(config.colors))
	}

	drawnGeometries := make([]*DrawnGeometry, len(geometries))
	for i, geometry := range geometries {
		// Use single color for all geometries, or per-geometry color
		colorIndex := 0
		if len(config.colors) > 1 {
			colorIndex = i
		}

		// Apply downscaling threshold if configured
		var drawnGeometry *DrawnGeometry
		var err error
		if config.downscalingThreshold > 0 {
			drawnGeometry, err = NewDrawnGeometry(geometry, WithGeometryColor(config.colors[colorIndex]), WithGeometryDownscaling(config.downscalingThreshold))
		} else {
			drawnGeometry, err = NewDrawnGeometry(geometry, WithGeometryColor(config.colors[colorIndex]))
		}
		if err != nil {
			return nil, err
		}

		drawnGeometries[i] = drawnGeometry
	}

	return &DrawnGeometriesInFrame{Parent: geometriesInFrame.Parent(), DrawnGeometries: drawnGeometries}, nil
}

// Draw creates a list of transforms from this DrawnGeometriesInFrame object, positioned at the given pose within the specified reference frame.
// The id can be any string, it will be used to generate a UUID for each geometry along with its name and parent.
func (drawnGeometriesInFrame *DrawnGeometriesInFrame) Draw(id string) ([]*commonv1.Transform, error) {
	transforms := make([]*commonv1.Transform, len(drawnGeometriesInFrame.DrawnGeometries))
	for i, drawnGeometry := range drawnGeometriesInFrame.DrawnGeometries {

		// Generate a UUID based on the id, name, and parent
		key := fmt.Sprintf("%s%s:%s", id, drawnGeometry.Geometry.Label(), drawnGeometriesInFrame.Parent)
		transform, err := drawnGeometry.Draw(key, drawnGeometry.Geometry.Label(), drawnGeometriesInFrame.Parent, spatialmath.NewZeroPose())
		if err != nil {
			return nil, err
		}

		transforms[i] = transform
	}

	return transforms, nil
}
