package draw

import (
	"fmt"

	"github.com/golang/geo/r3"
)

var (
	// DefaultModelScale is the default model scale (1.0, 1.0, 1.0 - no scaling).
	DefaultModelScale = r3.Vector{X: 1.0, Y: 1.0, Z: 1.0}

	// DefaultModelAnimationName is the default animation name (empty string means no animation).
	DefaultModelAnimationName = ""
)

// Model represents a 3D model in various formats (GLB, GLTF, PLY, PCD, etc.).
// Models can have multiple assets (textures, meshes) and support animations and scaling.
type Model struct {
	// Assets contains the model files and associated resources (textures, etc.).
	Assets []*ModelAsset

	// Scale specifies the scaling factors for each axis (default: [1.0, 1.0, 1.0]).
	Scale r3.Vector

	// AnimationName specifies which animation to play (empty string means no animation).
	AnimationName string
}

// drawModelConfig is a configuration for drawing a model
type drawModelConfig struct {
	assets        []*ModelAsset
	scale         r3.Vector
	animationName string
}

// newDrawModelConfig creates a new draw model configuration
//
// Returns the draw model configuration
func newDrawModelConfig() *drawModelConfig {
	return &drawModelConfig{
		assets:        []*ModelAsset{},
		scale:         DefaultModelScale,
		animationName: DefaultModelAnimationName,
	}
}

// DrawModelOption configures asset, scale, and animation settings for a Model
// constructed via NewModel. When multiple options touch the same field, the last
// option in the argument list wins.
type DrawModelOption func(*drawModelConfig)

// WithModelAssets sets the list of assets to attach to the model. Repeated calls
// replace (not append to) the previous list. NewModel requires at least one asset.
func WithModelAssets(assets ...*ModelAsset) DrawModelOption {
	return func(config *drawModelConfig) {
		config.assets = assets
	}
}

// WithModelScale sets the model's per-axis scaling factor. Defaults to
// DefaultModelScale (1.0 on each axis). NewModel rejects scales with any zero axis.
func WithModelScale(scale r3.Vector) DrawModelOption {
	return func(config *drawModelConfig) {
		config.scale = scale
	}
}

// WithModelAnimationName selects an animation embedded in the model assets to play
// on render. The empty string (the default) disables animation playback.
func WithModelAnimationName(animationName string) DrawModelOption {
	return func(config *drawModelConfig) {
		config.animationName = animationName
	}
}

// NewModel returns a Model assembled from the given options. Defaults: empty asset
// list (which causes NewModel to fail), Scale = DefaultModelScale, AnimationName = "".
// Returns an error if no assets were supplied via WithModelAssets, or if any scale
// axis is zero.
func NewModel(options ...DrawModelOption) (*Model, error) {
	config := newDrawModelConfig()
	for _, option := range options {
		option(config)
	}

	if len(config.assets) == 0 {
		return nil, fmt.Errorf("model must have at least one asset")
	}

	if config.scale.X == 0 || config.scale.Y == 0 || config.scale.Z == 0 {
		return nil, fmt.Errorf("scale cannot be zero, got %v", config.scale)
	}

	return &Model{
		Assets:        config.assets,
		Scale:         config.scale,
		AnimationName: config.animationName,
	}, nil
}

// Draw wraps the Model in a Drawing identified by name. The DrawableOptions control
// placement (parent frame, pose, center), identity (UUID), and visibility — see
// DrawableOption for the full set.
func (model Model) Draw(name string, options ...DrawableOption) *Drawing {
	config := NewDrawConfig(name, options...)
	shape := NewShape(config.Center, config.Name, WithModel(model))
	return NewDrawing(config, shape)
}
