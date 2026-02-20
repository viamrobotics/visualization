package draw

import (
	"fmt"

	"github.com/google/uuid"
	commonv1 "go.viam.com/api/common/v1"
	"go.viam.com/rdk/referenceframe"
	"go.viam.com/rdk/spatialmath"
)

var uuidNamespace = uuid.MustParse("6ba7b810-9dad-11d1-80b4-00c04fd430c8")

// DrawConfig holds the resolved configuration for a Draw call: the name used as the
// reference frame (and geometry/shape label), the parent frame, the pose of the Drawing/Transform
// in the parent frame, the local center of the Shape, and a stable UUID.
type DrawConfig struct {
	UUID   []byte
	Name   string
	Parent string
	Pose   spatialmath.Pose
	Center spatialmath.Pose
}

type drawableDrawing interface {
	Draw(name string, options ...DrawableOption) *Drawing
}

type drawableTransform interface {
	Draw(name string, options ...DrawableOption) (*commonv1.Transform, error)
}

// Compile-time interface conformance checks.
var (
	_ drawableDrawing   = Arrows{}
	_ drawableDrawing   = Line{}
	_ drawableDrawing   = Points{}
	_ drawableDrawing   = Nurbs{}
	_ drawableDrawing   = Model{}
	_ drawableTransform = &DrawnGeometry{}
	_ drawableTransform = &DrawnPointCloud{}
)

type drawableConfig struct {
	uuid   []byte
	parent string
	pose   spatialmath.Pose
	center spatialmath.Pose
}

type DrawableOption func(*drawableConfig)

// WithParent sets the parent reference frame for the Drawing or Transform.
func WithParent(parent string) DrawableOption {
	return func(config *drawableConfig) {
		config.parent = parent
	}
}

// WithPose sets the pose of the Drawing or Transform in the parent reference frame.
func WithPose(pose spatialmath.Pose) DrawableOption {
	return func(config *drawableConfig) {
		config.pose = pose
	}
}

// WithCenter sets the local center of the Shape within the Drawing's own frame.
func WithCenter(center spatialmath.Pose) DrawableOption {
	return func(config *drawableConfig) {
		config.center = center
	}
}

// WithUUID overrides the auto-generated UUID with an explicit byte slice.
func WithUUID(id []byte) DrawableOption {
	return func(config *drawableConfig) {
		config.uuid = id
	}
}

// WithID overrides the auto-generated UUID by deriving one deterministically from the given string.
func WithID(id string) DrawableOption {
	derived := uuid.NewSHA1(uuidNamespace, []byte(id))
	return func(config *drawableConfig) {
		config.uuid = derived[:]
	}
}

// NewDrawConfig resolves all options into a DrawConfig. UUID is derived from name:parent
// after options are applied unless explicitly set via WithUUID or WithID.
func NewDrawConfig(name string, options ...DrawableOption) *DrawConfig {
	config := &drawableConfig{
		parent: referenceframe.World,
		pose:   spatialmath.NewZeroPose(),
		center: spatialmath.NewZeroPose(),
	}

	for _, option := range options {
		option(config)
	}

	if config.uuid == nil {
		key := fmt.Sprintf("%s:%s", name, config.parent)
		id := uuid.NewSHA1(uuidNamespace, []byte(key))
		config.uuid = id[:]
	}

	return &DrawConfig{
		UUID:   config.uuid,
		Name:   name,
		Parent: config.parent,
		Pose:   config.pose,
		Center: config.center,
	}
}
