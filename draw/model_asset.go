package draw

import "fmt"

// ModelAsset represents a 3D model asset sourced from either a URL or inline binary
// data. Use NewURLModelAsset or NewBinaryModelAsset to construct one; that path
// guarantees exactly one of URLContent or DataContent is populated. Common formats
// include GLB, GLTF, PLY, and PCD.
type ModelAsset struct {
	// MimeType is the IANA media type of the asset (e.g., "model/gltf-binary").
	MimeType string
	// SizeBytes is the expected payload size in bytes; the visualizer uses it for
	// progress reporting during asset loading. Optional.
	SizeBytes *uint64
	// URLContent is the URL the visualizer should fetch the asset from. Mutually
	// exclusive with DataContent.
	URLContent *string
	// DataContent is the inline binary payload. Mutually exclusive with URLContent.
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

// DrawModelAssetOption configures optional fields on a ModelAsset constructed via
// NewURLModelAsset or NewBinaryModelAsset.
type DrawModelAssetOption func(*drawModelAssetConfig)

// WithModelAssetSizeBytes records the expected payload size of the asset. The
// visualizer uses this value for progress reporting while the asset loads; it does
// not validate the payload against the size.
func WithModelAssetSizeBytes(sizeBytes uint64) DrawModelAssetOption {
	return func(config *drawModelAssetConfig) {
		config.sizeBytes = &sizeBytes
	}
}

// NewURLModelAsset returns a ModelAsset that points at a 3D model fetched from url.
// mimeType should be the asset's IANA media type (e.g., "model/gltf-binary" for GLB).
// Returns an error if url is empty.
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

// NewBinaryModelAsset returns a ModelAsset that carries the given inline binary
// payload (e.g., an embedded file or a file read from disk). mimeType should be the
// asset's IANA media type (e.g., "model/gltf-binary" for GLB). Returns an error if
// binaryContent is empty.
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
