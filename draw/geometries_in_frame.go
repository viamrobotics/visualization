package draw

import (
	"fmt"

	commonv1 "go.viam.com/api/common/v1"
	"go.viam.com/rdk/referenceframe"
)

// DrawnGeometriesInFrame is a collection of geometries that have been drawn from a referenceframe.GeometriesInFrame.
type DrawnGeometriesInFrame struct {
	// The parent frame of the geometries.
	Parent string

	// The geometries to draw.
	DrawnGeometries []*DrawnGeometry
}

type drawnGeometriesInFrameConfig struct {
	drawColorsConfig

	// The threshold in millimeters for downscaling, defaults to 0.
	// Currently only supported for point clouds.
	downscalingThreshold float64
}

// newDrawnGeometriesInFrameConfig creates a new draw geometries in frame configuration
func newDrawnGeometriesInFrameConfig() *drawnGeometriesInFrameConfig {
	return &drawnGeometriesInFrameConfig{
		drawColorsConfig:     newDrawColorsConfig(),
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

// Draw creates a list of transforms from this DrawnGeometriesInFrame object.
// The name is used to create the UUID for each geometry along with its label and parent.
// If the name is not empty, it is used as the prefix for the geometry label.
func (drawnGeometriesInFrame *DrawnGeometriesInFrame) Draw(name string, options ...drawableOption) ([]*commonv1.Transform, error) {
	config := NewDrawConfig(name, options...)
	transforms := make([]*commonv1.Transform, len(drawnGeometriesInFrame.DrawnGeometries))
	for i, drawnGeometry := range drawnGeometriesInFrame.DrawnGeometries {
		label := drawnGeometry.Geometry.Label()
		if config.Name != "" {
			label = fmt.Sprintf("%s:%s", config.Name, label)
		}
		id := fmt.Sprintf("%s:%s", label, config.Parent)
		transform, err := drawnGeometry.Draw(label, WithParent(config.Parent), WithID(id))
		if err != nil {
			return nil, err
		}

		transforms[i] = transform
	}

	return transforms, nil
}
