package draw

import (
	"fmt"

	"github.com/google/uuid"
	commonv1 "go.viam.com/api/common/v1"
	"go.viam.com/rdk/referenceframe"
	"go.viam.com/rdk/spatialmath"
)

var uuidNamespace = uuid.MustParse("6ba7b810-9dad-11d1-80b4-00c04fd430c8")

// DrawConfig holds the resolved configuration produced by NewDrawConfig and consumed
// by drawing primitives such as NewDrawing and NewTransform. Most callers obtain a
// DrawConfig via NewDrawConfig rather than constructing one directly.
type DrawConfig struct {
	// UUID is a stable, byte-encoded identifier for the resulting Drawing or Transform.
	UUID []byte
	// Name is the reference-frame name used to identify the Drawing or Transform; it
	// is also used as the geometry/shape label in serialized output.
	Name string
	// Parent is the name of the reference frame this entity is attached to.
	Parent string
	// Pose is the pose of the Drawing or Transform expressed in the parent frame.
	Pose spatialmath.Pose
	// Center is the local center of the Shape within the Drawing's own frame.
	Center spatialmath.Pose
	// ShowAxesHelper requests that the visualizer render an RGB XYZ axes helper at
	// the entity's origin.
	ShowAxesHelper bool
	// Invisible hides the entity from rendering by default; the user can still toggle
	// it on in the visualizer.
	Invisible bool
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
	uuid           []byte
	parent         string
	pose           spatialmath.Pose
	center         spatialmath.Pose
	showAxesHelper bool
	invisible      bool
}

// DrawableOption configures shared identity, placement, and rendering settings for a
// drawable entity. It is accepted by NewDrawConfig and by the Draw method on every
// drawable primitive (Arrows, Line, Points, Nurbs, Model, DrawnGeometry, and
// DrawnPointCloud). When the same field is set by multiple options, the last option
// in the argument list wins.
type DrawableOption func(*drawableConfig)

// WithParent sets the parent reference frame for the Drawing or Transform. Defaults
// to referenceframe.World.
func WithParent(parent string) DrawableOption {
	return func(config *drawableConfig) {
		config.parent = parent
	}
}

// WithPose sets the pose of the Drawing or Transform in the parent reference frame.
// Defaults to the identity pose (origin, no rotation).
func WithPose(pose spatialmath.Pose) DrawableOption {
	return func(config *drawableConfig) {
		config.pose = pose
	}
}

// WithCenter sets the local center of the Shape within the Drawing's own frame.
// Defaults to the identity pose.
func WithCenter(center spatialmath.Pose) DrawableOption {
	return func(config *drawableConfig) {
		config.center = center
	}
}

// WithUUID overrides the auto-generated UUID with an explicit byte slice. If both
// WithUUID and WithID are provided, the last one to appear in the option list wins.
func WithUUID(id []byte) DrawableOption {
	return func(config *drawableConfig) {
		config.uuid = id
	}
}

// WithID overrides the auto-generated UUID with one derived deterministically from
// the given string (UUID v5 over a fixed namespace). The same input always produces
// the same UUID. If both WithUUID and WithID are provided, the last one to appear
// in the option list wins.
func WithID(id string) DrawableOption {
	derived := uuid.NewSHA1(uuidNamespace, []byte(id))
	return func(config *drawableConfig) {
		config.uuid = derived[:]
	}
}

// WithAxesHelper controls whether the visualizer renders an RGB XYZ axes helper at
// the entity's origin. Defaults to true.
func WithAxesHelper(show bool) DrawableOption {
	return func(config *drawableConfig) {
		config.showAxesHelper = show
	}
}

// WithInvisible hides the entity from rendering by default when set to true; the
// user can still toggle visibility on in the visualizer. Defaults to false.
func WithInvisible(invisible bool) DrawableOption {
	return func(config *drawableConfig) {
		config.invisible = invisible
	}
}

// metadataOptions returns options for all universal metadata fields.

func (c *DrawConfig) metadataOptions() []DrawMetadataOption {
	return []DrawMetadataOption{
		WithMetadataAxesHelper(c.ShowAxesHelper),
		WithMetadataInvisible(c.Invisible),
	}
}

// BuildMetadata returns Metadata seeded with the universal fields carried by the
// DrawConfig (axes helper visibility, invisibility) and overlaid with the given
// type-specific options. Type-specific options that touch the same fields take
// precedence over the universal defaults.
func (c *DrawConfig) BuildMetadata(opts ...DrawMetadataOption) Metadata {
	return NewMetadata(append(c.metadataOptions(), opts...)...)
}

// NewDrawConfig resolves the given options into a DrawConfig.
//
// Defaults applied when options omit a field:
//   - Parent: referenceframe.World
//   - Pose: identity pose
//   - Center: identity pose
//   - ShowAxesHelper: true
//   - Invisible: false
//
// If neither WithUUID nor WithID is supplied, UUID is derived deterministically
// from the "name:parent" pair using UUID v5 so that the same name and parent always
// produce the same UUID.
func NewDrawConfig(name string, options ...DrawableOption) *DrawConfig {
	config := &drawableConfig{
		parent:         referenceframe.World,
		pose:           spatialmath.NewZeroPose(),
		center:         spatialmath.NewZeroPose(),
		showAxesHelper: true,
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
		UUID:           config.uuid,
		Name:           name,
		Parent:         config.parent,
		Pose:           config.pose,
		Center:         config.center,
		ShowAxesHelper: config.showAxesHelper,
		Invisible:      config.invisible,
	}
}
