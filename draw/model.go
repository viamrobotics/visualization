package draw

import (
	"fmt"

	"github.com/golang/geo/r3"
	"go.viam.com/rdk/spatialmath"
)

var (
	// DefaultModelScale is the default scale of a model, defaults to 1.0
	DefaultModelScale = r3.Vector{X: 1.0, Y: 1.0, Z: 1.0}

	// DefaultModelAnimationName is the default animation name of a model, defaults to empty string (no animation)
	DefaultModelAnimationName = ""
)

// ModelAsset represents a model asset
type ModelAsset struct {
	MimeType      string
	SizeBytes     *uint64
	URLContent    *string
	BinaryContent *[]byte
}
type drawModelAssetConfig struct {
	sizeBytes     *uint64
	urlContent    *string
	binaryContent *[]byte
}

func newDrawModelAssetConfig() *drawModelAssetConfig {
	return &drawModelAssetConfig{
		sizeBytes:     nil,
		urlContent:    nil,
		binaryContent: nil,
	}
}

type drawModelAssetOption func(*drawModelAssetConfig)

func WithModelAssetSizeBytes(sizeBytes uint64) drawModelAssetOption {
	return func(config *drawModelAssetConfig) {
		config.sizeBytes = &sizeBytes
	}
}

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

func NewBinaryModelAsset(mimeType string, binaryContent []byte, options ...drawModelAssetOption) (*ModelAsset, error) {
	if len(binaryContent) == 0 {
		return nil, fmt.Errorf("binary content cannot be empty")
	}

	config := newDrawModelAssetConfig()
	for _, option := range options {
		option(config)
	}

	return &ModelAsset{
		MimeType:      mimeType,
		SizeBytes:     config.sizeBytes,
		BinaryContent: &binaryContent,
	}, nil
}

// Model represents a 3D Model in various formats
type Model struct {
	// The list of assets that make up the model
	Assets []*ModelAsset

	// The Scale of the model, defaults to [1.0, 1.0, 1.0]
	Scale r3.Vector

	// Name of the animation to play, defaults to empty string (no animation)
	AnimationName string
}

type drawModelConfig struct {
	assets        []*ModelAsset
	scale         r3.Vector
	animationName string
}

func newDrawModelConfig() *drawModelConfig {
	return &drawModelConfig{
		assets:        []*ModelAsset{},
		scale:         DefaultModelScale,
		animationName: DefaultModelAnimationName,
	}
}

type drawModelOption func(*drawModelConfig)

func WithModelAssets(assets ...*ModelAsset) drawModelOption {
	return func(config *drawModelConfig) {
		config.assets = append(config.assets, assets...)
	}
}

func WithModelScale(scale r3.Vector) drawModelOption {
	return func(config *drawModelConfig) {
		config.scale = scale
	}
}

func WithModelAnimationName(animationName string) drawModelOption {
	return func(config *drawModelConfig) {
		config.animationName = animationName
	}
}

func NewModel(options ...drawModelOption) (*Model, error) {
	config := newDrawModelConfig()
	for _, option := range options {
		option(config)
	}

	if len(config.assets) == 0 {
		return nil, fmt.Errorf("model must have at least one asset")
	}

	if config.scale.X <= 0 || config.scale.Y <= 0 || config.scale.Z <= 0 {
		return nil, fmt.Errorf("scale must be positive, got %v", config.scale)
	}

	return &Model{
		Assets:        config.assets,
		Scale:         config.scale,
		AnimationName: config.animationName,
	}, nil
}

// Draw draws a model from a URL or GLB bytes
func (model Model) Draw(name string, parent string, pose spatialmath.Pose) *Drawing {
	shape := NewShape(pose, name, WithModel(model))
	drawing := NewDrawing(name, parent, pose, shape, NewMetadata())
	return drawing
}
