package draw

import (
	"fmt"

	"github.com/google/uuid"
	"go.viam.com/rdk/spatialmath"
)

var (
	// DefaultModelScale is the default scale of a model, defaults to 1.0
	DefaultModelScale float32 = 1.0

	// DefaultModelAnimate is the default animate value of a model, defaults to false
	DefaultModelAnimate bool = false
)

// Model represents a 3D Model in various formats
// Metadata:
// - colors: defaults to [] (no colors)
type Model struct {
	// The cache key of the model
	CacheKey string

	// The size of the model in bytes
	SizeBytes uint64

	// The Scale of the model, defaults to 1.0
	Scale float32

	// The boolean to indicate if the model should Animate
	Animate bool

	// The URL of the model
	URL *string

	// The GLB data of the model
	GLB *[]byte
}

func NewModelFromURL(url string, cacheKey *string, sizeBytes *uint64, scale *float32, animate *bool) (*Model, error) {
	if url == "" {
		return nil, fmt.Errorf("url cannot be empty")
	}

	if cacheKey == nil {
		cacheKey = &url
	}

	if sizeBytes != nil && *sizeBytes <= 0 {
		return nil, fmt.Errorf("size bytes must be greater than 0, got %d", *sizeBytes)
	}

	if scale == nil {
		scale = &DefaultModelScale
	} else if *scale <= 0 {
		return nil, fmt.Errorf("scale must be greater than 0, got %f", *scale)
	}

	if animate == nil {
		animate = &DefaultModelAnimate
	}

	return &Model{CacheKey: *cacheKey, SizeBytes: *sizeBytes, Scale: *scale, Animate: *animate, URL: &url}, nil
}

func NewModelFromGLB(glb []byte, cacheKey *string, sizeBytes *uint64, scale *float32, animate *bool) (*Model, error) {
	if len(glb) == 0 {
		return nil, fmt.Errorf("glb data cannot be empty")
	}

	if cacheKey == nil {
		key := uuid.New().String()
		cacheKey = &key
	}

	if sizeBytes == nil {
		size := uint64(len(glb))
		sizeBytes = &size
	} else if *sizeBytes <= 0 {
		return nil, fmt.Errorf("size bytes must be greater than 0, got %d", *sizeBytes)
	}

	if scale == nil {
		scale = &DefaultModelScale
	} else if *scale <= 0 {
		return nil, fmt.Errorf("scale must be greater than 0, got %f", *scale)
	}

	if animate == nil {
		animate = &DefaultModelAnimate
	}

	return &Model{CacheKey: *cacheKey, SizeBytes: *sizeBytes, Scale: *scale, Animate: *animate, GLB: &glb}, nil
}

// Draw draws a model from a URL or GLB bytes
func (model *Model) Draw(name string, parent string, pose spatialmath.Pose, units Units) *Drawing {
	shape := NewShape(pose, name, units).WithModel(model)
	drawing := NewDrawing(name, parent, pose, shape, NewMetadata([]*Color{}))
	return drawing
}
