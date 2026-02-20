package draw

import "fmt"

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

// DrawModelAssetOption is a function that configures a draw model asset configuration
type DrawModelAssetOption func(*drawModelAssetConfig)

// WithModelAssetSizeBytes creates a model asset option that sets the file size in bytes.
func WithModelAssetSizeBytes(sizeBytes uint64) DrawModelAssetOption {
	return func(config *drawModelAssetConfig) {
		config.sizeBytes = &sizeBytes
	}
}

// NewURLModelAsset creates a ModelAsset that references a 3D model from a URL.
// Common MIME types include "model/gltf-binary" for GLB files. Returns an error if the URL is empty.
func NewURLModelAsset(mimeType string, url string, options ...DrawModelAssetOption) (*ModelAsset, error) {
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
func NewBinaryModelAsset(mimeType string, binaryContent []byte, options ...DrawModelAssetOption) (*ModelAsset, error) {
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
