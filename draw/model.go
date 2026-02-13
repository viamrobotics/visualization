package draw

import (
	"fmt"

	"github.com/golang/geo/r3"
	"go.viam.com/rdk/spatialmath"
)

var (
	// DefaultModelScale is the default model scale (1.0, 1.0, 1.0 - no scaling).
	DefaultModelScale = r3.Vector{X: 1.0, Y: 1.0, Z: 1.0}

	// DefaultModelAnimationName is the default animation name (empty string means no animation).
	DefaultModelAnimationName = ""
)

// ModelAsset represents a 3D model asset that can be loaded from either a URL or binary data.
// Common formats include GLB, GLTF, PLY, and PCD files.
type ModelAsset struct {
	MimeType    string
	SizeBytes   *uint64
	URLContent  *string
	DataContent *[]byte
}

// drawModelAssetConfig is a configuration for drawing a model asset
type drawModelAssetConfig struct {
	sizeBytes   *uint64
	urlContent  *string
	dataContent *[]byte
}

// newDrawModelAssetConfig creates a new draw model asset configuration
func newDrawModelAssetConfig() *drawModelAssetConfig {
	return &drawModelAssetConfig{
		sizeBytes:   nil,
		urlContent:  nil,
		dataContent: nil,
	}
}

// drawModelAssetOption is a function that configures a draw model asset configuration
type drawModelAssetOption func(*drawModelAssetConfig)

// WithModelAssetSizeBytes creates a model asset option that sets the file size in bytes.
func WithModelAssetSizeBytes(sizeBytes uint64) drawModelAssetOption {
	return func(config *drawModelAssetConfig) {
		config.sizeBytes = &sizeBytes
	}
}

// NewURLModelAsset creates a ModelAsset that references a 3D model from a URL.
// Common MIME types include "model/gltf-binary" for GLB files. Returns an error if the URL is empty.
func NewURLModelAsset(mimeType string, url string, options ...drawModelAssetOption) (*ModelAsset, error) {
	if url == "" {
		return nil, fmt.Errorf("url cannot be empty")
	}

	config := newDrawModelAssetConfig()
	for _, option := range options {
		option(config)
	}

	return &ModelAsset{
		MimeType:   mimeType,
		SizeBytes:  config.sizeBytes,
		URLContent: &url,
	}, nil
}

// NewBinaryModelAsset creates a ModelAsset from binary data (e.g., an embedded file or loaded file).
// Common MIME types include "model/gltf-binary" for GLB files. Returns an error if the binary content is empty.
func NewBinaryModelAsset(mimeType string, binaryContent []byte, options ...drawModelAssetOption) (*ModelAsset, error) {
	if len(binaryContent) == 0 {
		return nil, fmt.Errorf("binary content cannot be empty")
	}

	config := newDrawModelAssetConfig()
	for _, option := range options {
		option(config)
	}

	return &ModelAsset{
		MimeType:    mimeType,
		SizeBytes:   config.sizeBytes,
		DataContent: &binaryContent,
	}, nil
}

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

// drawModelOption is a function that configures a draw model configuration
type drawModelOption func(*drawModelConfig)

// WithModelAssets creates a model option that adds one or more assets to the model.
func WithModelAssets(assets ...*ModelAsset) drawModelOption {
	return func(config *drawModelConfig) {
		config.assets = assets
	}
}

// WithModelScale creates a model option that sets the scaling factors for each axis.
func WithModelScale(scale r3.Vector) drawModelOption {
	return func(config *drawModelConfig) {
		config.scale = scale
	}
}

// WithModelAnimationName creates a model option that specifies which animation to play.
func WithModelAnimationName(animationName string) drawModelOption {
	return func(config *drawModelConfig) {
		config.animationName = animationName
	}
}

// NewModel creates a new Model with the given options. Returns an error if no assets are provided
// or if the scale values are non-positive.
func NewModel(options ...drawModelOption) (*Model, error) {
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

// Draw creates a Drawing from this Model object, positioned at the given pose within the specified
// reference frame. The name identifies this drawing and parent specifies the reference frame it's attached to.
func (model Model) Draw(name string, parent string, pose spatialmath.Pose) *Drawing {
	shape := NewShape(pose, name, WithModel(model))
	drawing := NewDrawing(name, parent, pose, shape, NewMetadata())
	return drawing
}
