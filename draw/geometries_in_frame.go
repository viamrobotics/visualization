package draw

import (
	"fmt"

	commonv1 "go.viam.com/api/common/v1"
	"go.viam.com/rdk/referenceframe"
)

// DrawnGeometriesInFrame wraps a referenceframe.GeometriesInFrame as a set of
// DrawnGeometry values that share a common parent frame, ready to be emitted as
// transforms.
type DrawnGeometriesInFrame struct {
	// ID is an optional identity prefix included in each emitted transform's
	// UUID derivation. When non-empty, each transform's identity is derived
	// from "ID:label:parent" rather than the default "label:parent", which
	// namespaces transforms across batches that share geometry labels and a
	// parent frame (e.g., two robots whose link geometries collide on label).
	// ID does not affect visible labels.
	ID string
	// Name is an optional prefix applied to each emitted transform's label. When
	// non-empty, each transform is labelled "Name:geometryLabel"; when empty, the
	// raw geometry label is used.
	Name string
	// Parent is the parent reference frame the geometries are expressed in.
	Parent string
	// DrawnGeometries holds the individual geometries plus their per-geometry
	// render colors.
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

// DrawGeometriesInFrameOption configures color and downscaling settings for a
// DrawnGeometriesInFrame produced by NewDrawnGeometriesInFrame. When multiple
// options touch the same field, the last option in the argument list wins.
type DrawGeometriesInFrameOption func(*drawnGeometriesInFrameConfig)

// WithSingleGeometriesColor renders every geometry in the collection with the
// given shared color.
func WithSingleGeometriesColor(color Color) DrawGeometriesInFrameOption {
	return withColors[*drawnGeometriesInFrameConfig]([]Color{color})
}

// WithPerGeometriesColors assigns one color per geometry. The number of colors
// must equal the number of geometries in the GeometriesInFrame passed to
// NewDrawnGeometriesInFrame.
func WithPerGeometriesColors(colors ...Color) DrawGeometriesInFrameOption {
	return withColors[*drawnGeometriesInFrameConfig](colors)
}

// WithGeometriesColorPalette generates numGeometries per-geometry colors by
// cycling through the given palette. Pass numGeometries equal to the number of
// geometries in the GeometriesInFrame.
func WithGeometriesColorPalette(palette []Color, numGeometries int) DrawGeometriesInFrameOption {
	return withColorPalette[*drawnGeometriesInFrameConfig](palette, numGeometries)
}

// WithGeometriesDownscalingThreshold reduces the number of rendered points in any
// point-cloud geometries in the collection by keeping only points whose mutual
// distance exceeds threshold (millimeters). A threshold of 0 (the default)
// disables downscaling. Has no effect on non-point-cloud geometries.
func WithGeometriesDownscalingThreshold(threshold float64) DrawGeometriesInFrameOption {
	return func(config *drawnGeometriesInFrameConfig) {
		config.downscalingThreshold = threshold
	}
}

// NewDrawnGeometriesInFrame returns a DrawnGeometriesInFrame wrapping every
// geometry in geometriesInFrame as a colored DrawnGeometry. Returns an error if
// the configured color count is neither 1 (shared color) nor equal to the number
// of geometries, or if any per-geometry construction fails (e.g., point-cloud
// downscaling errors).
func NewDrawnGeometriesInFrame(geometriesInFrame *referenceframe.GeometriesInFrame, options ...DrawGeometriesInFrameOption) (*DrawnGeometriesInFrame, error) {
	geometries := geometriesInFrame.Geometries()
	config := newDrawnGeometriesInFrameConfig()
	for _, option := range options {
		option(config)
	}

	if len(config.colors) != 1 && len(config.colors) != len(geometries) {
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

// ToTransforms returns one transform per geometry in the collection. Each
// transform's label is the geometry label, optionally prefixed with the
// receiver's Name field — see DrawnGeometriesInFrame.Name for the prefixing
// rules. Each transform's identity is derived from "label:parent", or
// "ID:label:parent" when DrawnGeometriesInFrame.ID is non-empty. The supplied
// DrawableOptions configure the parent frame and pose used as the basis for
// every emitted transform; per-call UUID overrides on the options have no
// effect. Returns an error if any geometry's transform construction fails.
func (drawnGeometriesInFrame *DrawnGeometriesInFrame) ToTransforms(options ...DrawableOption) ([]*commonv1.Transform, error) {
	config := NewDrawConfig("", options...)
	parent := config.Parent
	pose := config.Pose
	transforms := make([]*commonv1.Transform, len(drawnGeometriesInFrame.DrawnGeometries))

	for i, drawnGeometry := range drawnGeometriesInFrame.DrawnGeometries {
		label := drawnGeometry.Geometry.Label()
		if drawnGeometriesInFrame.Name != "" {
			if label == "" || label == drawnGeometriesInFrame.Name {
				label = drawnGeometriesInFrame.Name
			} else {
				label = fmt.Sprintf("%s:%s", drawnGeometriesInFrame.Name, label)
			}
		}

		id := fmt.Sprintf("%s:%s", label, parent)
		if drawnGeometriesInFrame.ID != "" {
			id = fmt.Sprintf("%s:%s", drawnGeometriesInFrame.ID, id)
		}
		transform, err := drawnGeometry.Draw(label, WithParent(parent), WithPose(pose), WithID(id))
		if err != nil {
			return nil, err
		}

		transforms[i] = transform
	}

	return transforms, nil
}
