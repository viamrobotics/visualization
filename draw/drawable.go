package draw

import (
	"fmt"

	"github.com/google/uuid"
	drawv1 "github.com/viam-labs/motion-tools/draw/v1"
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

// drawable is implemented by any type that can produce a T (Drawing or Transform) from a name
// and optional configuration. name is used as both the reference frame identifier and the shape label.
type drawable[T commonv1.Transform | drawv1.Drawing] interface {
	Draw(name string, options ...drawableOption) *T
}

// drawableConfig holds option state accumulated before NewDrawConfig resolves it.
// uuid is nil until explicitly set via WithUUID or WithID; if still nil after all options
// are applied, a deterministic UUID is derived from name:parent.
type drawableConfig struct {
	uuid   []byte
	parent string
	pose   spatialmath.Pose
	center spatialmath.Pose
}

type drawableOption func(*drawableConfig)

// WithParent sets the parent reference frame for the Drawing or Transform.
func WithParent(parent string) drawableOption {
	return func(config *drawableConfig) {
		config.parent = parent
	}
}

// WithPose sets the pose of the Drawing or Transform in the parent reference frame.
func WithPose(pose spatialmath.Pose) drawableOption {
	return func(config *drawableConfig) {
		config.pose = pose
	}
}

// WithCenter sets the local center of the Shape within the Drawing's own frame.
func WithCenter(center spatialmath.Pose) drawableOption {
	return func(config *drawableConfig) {
		config.center = center
	}
}

// WithUUID overrides the auto-generated UUID with an explicit byte slice.
func WithUUID(id []byte) drawableOption {
	return func(config *drawableConfig) {
		config.uuid = id
	}
}

// WithID overrides the auto-generated UUID by deriving one deterministically from the given string.
func WithID(id string) drawableOption {
	derived := uuid.NewSHA1(uuidNamespace, []byte(id))
	return func(config *drawableConfig) {
		config.uuid = derived[:]
	}
}

// NewDrawConfig resolves all options into a DrawConfig. UUID is derived from name:parent
// after options are applied unless explicitly set via WithUUID or WithID.
func NewDrawConfig(name string, options ...drawableOption) *DrawConfig {
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
