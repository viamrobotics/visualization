package draw

import (
	drawv1 "github.com/viam-labs/motion-tools/draw/v1"
	commonv1 "go.viam.com/api/common/v1"
	"go.viam.com/rdk/spatialmath"
)

// Shape represents a drawable non-physical geometric shape or object in 3D space. A
// Shape carries exactly one geometry positioned at Center and identified by Label.
//
// Use NewShape to construct a Shape; that path guarantees only one geometry pointer
// is non-nil. If multiple are set manually, ToProto serializes the first non-nil
// pointer in the order Arrows, Line, Points, Model, Nurbs.
type Shape struct {
	// Center is the pose of the shape within the parent Drawing's local frame.
	Center spatialmath.Pose
	// Label is a human-readable name for the shape; surfaced in the visualizer UI.
	Label string
	// Arrows, when set, identifies the shape as an Arrows geometry.
	Arrows *Arrows
	// Line, when set, identifies the shape as a Line geometry.
	Line *Line
	// Points, when set, identifies the shape as a Points geometry.
	Points *Points
	// Model, when set, identifies the shape as a 3D Model geometry.
	Model *Model
	// Nurbs, when set, identifies the shape as a NURBS curve geometry.
	Nurbs *Nurbs
}

// drawShapeConfig is a configuration for drawing a shape
type drawShapeConfig struct {
	arrows *Arrows
	line   *Line
	points *Points
	model  *Model
	nurbs  *Nurbs
}

// newDrawShapeConfig creates a new draw shape configuration
func newDrawShapeConfig() *drawShapeConfig {
	return &drawShapeConfig{
		arrows: nil,
		line:   nil,
		points: nil,
		model:  nil,
		nurbs:  nil,
	}
}

// drawShapeOption is a function that configures a draw shape configuration
type drawShapeOption func(*drawShapeConfig)

func (config *drawShapeConfig) clear() {
	config.arrows = nil
	config.line = nil
	config.points = nil
	config.model = nil
	config.nurbs = nil
}

// WithArrows creates a shape option that configures the shape as an Arrows geometry.
func WithArrows(arrows Arrows) drawShapeOption {
	return func(config *drawShapeConfig) {
		config.clear()
		config.arrows = &arrows
	}
}

// WithLine creates a shape option that configures the shape as a Line geometry.
func WithLine(line Line) drawShapeOption {
	return func(config *drawShapeConfig) {
		config.clear()
		config.line = &line
	}
}

// WithPoints creates a shape option that configures the shape as a Points geometry.
func WithPoints(points Points) drawShapeOption {
	return func(config *drawShapeConfig) {
		config.clear()
		config.points = &points
	}
}

// WithModel creates a shape option that configures the shape as a 3D Model geometry.
func WithModel(model Model) drawShapeOption {
	return func(config *drawShapeConfig) {
		config.clear()
		config.model = &model
	}
}

// WithNurbs creates a shape option that configures the shape as a NURBS curve geometry.
func WithNurbs(nurbs Nurbs) drawShapeOption {
	return func(config *drawShapeConfig) {
		config.clear()
		config.nurbs = &nurbs
	}
}

// NewShape creates a new Shape with the given center pose, label, and geometry option.
// The option must be one of WithArrows, WithLine, WithPoints, WithModel, or WithNurbs.
func NewShape(center spatialmath.Pose, label string, option drawShapeOption) Shape {
	config := newDrawShapeConfig()
	option(config)

	return Shape{
		Center: center,
		Label:  label,
		Arrows: config.arrows,
		Line:   config.line,
		Points: config.points,
		Model:  config.model,
		Nurbs:  config.nurbs,
	}
}

// ToProto converts the Shape to a drawv1.Shape proto message. Returns nil if no
// geometry is set, or for a Model shape if any of its assets has neither URLContent
// nor DataContent populated.
func (shape Shape) ToProto() *drawv1.Shape {
	switch {
	case shape.Arrows != nil:
		return &drawv1.Shape{
			Label:  shape.Label,
			Center: poseToProtobuf(shape.Center),
			GeometryType: &drawv1.Shape_Arrows{
				Arrows: &drawv1.Arrows{
					Poses: packPoses(shape.Arrows.Poses, false),
				},
			},
		}
	case shape.Line != nil:
		lineWidth := shape.Line.LineWidth
		dotSize := shape.Line.DotSize
		return &drawv1.Shape{
			Label:  shape.Label,
			Center: poseToProtobuf(shape.Center),
			GeometryType: &drawv1.Shape_Line{
				Line: &drawv1.Line{
					Positions: packPoints(shape.Line.Positions),
					LineWidth: &lineWidth,
					DotSize:   &dotSize,
					DotColors: packColors(shape.Line.DotColors),
				},
			},
		}
	case shape.Points != nil:
		pointSize := shape.Points.PointSize
		return &drawv1.Shape{
			Label:  shape.Label,
			Center: poseToProtobuf(shape.Center),
			GeometryType: &drawv1.Shape_Points{
				Points: &drawv1.Points{
					Positions: packPoints(shape.Points.Positions),
					PointSize: &pointSize,
				},
			},
		}
	case shape.Model != nil:
		proto := &drawv1.Model{
			Assets: []*drawv1.ModelAsset{},
			Scale: &commonv1.Vector3{
				X: shape.Model.Scale.X,
				Y: shape.Model.Scale.Y,
				Z: shape.Model.Scale.Z,
			},
			AnimationName: &shape.Model.AnimationName,
		}

		for _, asset := range shape.Model.Assets {
			switch {
			case asset.URLContent != nil:
				proto.Assets = append(proto.Assets, &drawv1.ModelAsset{
					MimeType:  asset.MimeType,
					SizeBytes: asset.SizeBytes,
					Content: &drawv1.ModelAsset_Url{
						Url: *asset.URLContent,
					},
				})
			case asset.DataContent != nil:
				proto.Assets = append(proto.Assets, &drawv1.ModelAsset{
					MimeType:  asset.MimeType,
					SizeBytes: asset.SizeBytes,
					Content: &drawv1.ModelAsset_Data{
						Data: *asset.DataContent,
					},
				})
			default:
				return nil
			}
		}

		return &drawv1.Shape{
			Label:  shape.Label,
			Center: poseToProtobuf(shape.Center),
			GeometryType: &drawv1.Shape_Model{
				Model: proto,
			},
		}
	case shape.Nurbs != nil:
		return &drawv1.Shape{
			Label:  shape.Label,
			Center: poseToProtobuf(shape.Center),
			GeometryType: &drawv1.Shape_Nurbs{
				Nurbs: &drawv1.Nurbs{
					ControlPoints: packPoses(shape.Nurbs.ControlPoints, true),
					Degree:        &shape.Nurbs.Degree,
					Weights:       packFloats(shape.Nurbs.Weights),
					Knots:         packFloats(shape.Nurbs.Knots),
				},
			},
		}
	default:
		return nil
	}
}

// Drawing represents a non-physical visualization in 3D space: a Shape positioned at
// a Pose within a parent reference frame, plus rendering Metadata such as colors.
// Drawings are purely visual and do not participate in the frame system as physical
// geometries.
type Drawing struct {
	// UUID is the stable identifier for this drawing.
	UUID []byte
	// Name is the reference-frame name used to identify this drawing.
	Name string
	// Parent is the name of the reference frame this drawing is attached to.
	Parent string
	// Pose is the pose of this drawing expressed in the parent frame.
	Pose spatialmath.Pose
	// Shape is the geometry rendered by this drawing.
	Shape Shape
	// Metadata carries rendering settings such as colors and visibility.
	Metadata Metadata
}

// NewDrawing returns a Drawing whose identity, placement, and universal metadata
// fields are taken from config. Type-specific metadata can be overlaid via
// metadataOpts; see DrawConfig.BuildMetadata for the precedence rules.
func NewDrawing(config *DrawConfig, shape Shape, metadataOpts ...DrawMetadataOption) *Drawing {
	return &Drawing{
		UUID:     config.UUID,
		Name:     config.Name,
		Parent:   config.Parent,
		Pose:     config.Pose,
		Shape:    shape,
		Metadata: config.BuildMetadata(metadataOpts...),
	}
}

// ToProto converts the Drawing to a drawv1.Drawing proto message. The Shape is
// serialized via Shape.ToProto, which may be nil if the shape carries no geometry.
func (drawing Drawing) ToProto() *drawv1.Drawing {
	pose := poseInFrameToProtobuf(drawing.Pose, drawing.Parent)
	return &drawv1.Drawing{
		ReferenceFrame:      drawing.Name,
		PoseInObserverFrame: pose,
		PhysicalObject:      drawing.Shape.ToProto(),
		Uuid:                drawing.UUID,
		Metadata:            drawing.Metadata.ToProto(),
	}
}

// Metadata carries the auxiliary rendering information attached to a Drawing or
// Transform, including per-component colors, axes-helper visibility, default
// visibility, and inter-entity relationships.
type Metadata struct {
	// Colors holds either a single fill color or one color per geometry component.
	// The exact interpretation depends on the geometry type; see each primitive's
	// documentation.
	Colors []Color
	// ShowAxesHelper controls whether the visualizer renders an RGB XYZ axes helper
	// at the entity's origin.
	ShowAxesHelper bool
	// Invisible hides the entity from rendering by default; the user can still
	// toggle visibility on in the visualizer.
	Invisible bool
	// Relationships expresses links to other entities (such as parent/child
	// references) consumed by the visualizer's relationship inspector.
	Relationships []*drawv1.Relationship
}

// SetColors replaces the Colors field on the metadata.
func (metadata *Metadata) SetColors(colors []Color) {
	metadata.Colors = colors
}

// SetShowAxesHelper replaces the ShowAxesHelper field on the metadata.
func (metadata *Metadata) SetShowAxesHelper(show bool) {
	metadata.ShowAxesHelper = show
}

// SetInvisible replaces the Invisible field on the metadata.
func (metadata *Metadata) SetInvisible(invisible bool) {
	metadata.Invisible = invisible
}

// SetRelationships replaces the Relationships field on the metadata.
func (metadata *Metadata) SetRelationships(relationships []*drawv1.Relationship) {
	metadata.Relationships = relationships
}

// drawMetadataConfig is a configuration for drawing metadata
type drawMetadataConfig struct {
	drawColorsConfig
	showAxesHelper bool
	invisible      bool
	relationships  []*drawv1.Relationship
}

// DrawMetadataOption configures a Metadata. Options accumulate; later options that
// set the same field overwrite earlier ones. Used by NewMetadata, NewDrawing, and
// NewTransform (via DrawConfig.BuildMetadata).
type DrawMetadataOption func(*drawMetadataConfig)

// newDrawMetadataConfig creates a new draw metadata configuration
func newDrawMetadataConfig() *drawMetadataConfig {
	return &drawMetadataConfig{
		drawColorsConfig: newDrawColorsConfig(),
	}
}

// WithMetadataColors sets the Colors field on the resulting Metadata. Pass either
// a single color (applied to all components) or one color per component; the
// component-count interpretation is geometry-specific.
func WithMetadataColors(colors ...Color) DrawMetadataOption {
	return withColors[*drawMetadataConfig](colors)
}

// WithMetadataAxesHelper toggles the RGB XYZ axes helper at the entity's origin.
func WithMetadataAxesHelper(show bool) DrawMetadataOption {
	return func(config *drawMetadataConfig) {
		config.showAxesHelper = show
	}
}

// WithMetadataInvisible hides the entity from rendering by default when set to true;
// the user can still toggle visibility on in the visualizer.
func WithMetadataInvisible(invisible bool) DrawMetadataOption {
	return func(config *drawMetadataConfig) {
		config.invisible = invisible
	}
}

// WithMetadataRelationships attaches links to other entities (such as parent/child
// references) used by the visualizer's relationship inspector.
func WithMetadataRelationships(relationships []*drawv1.Relationship) DrawMetadataOption {
	return func(config *drawMetadataConfig) {
		config.relationships = relationships
	}
}

// MetadataOptionsFromProto converts a *drawv1.Metadata proto into a slice of DrawMetadataOption.
// Nil input returns nil options. Fields that are unset in the proto are skipped.
func MetadataOptionsFromProto(md *drawv1.Metadata) []DrawMetadataOption {
	if md == nil {
		return nil
	}
	var opts []DrawMetadataOption
	if md.Colors != nil {
		opts = append(opts, WithMetadataColors(unpackColors(md.Colors, md.Opacities)...))
	}
	if md.ShowAxesHelper != nil {
		opts = append(opts, WithMetadataAxesHelper(*md.ShowAxesHelper))
	}
	if md.Invisible != nil {
		opts = append(opts, WithMetadataInvisible(*md.Invisible))
	}
	if md.Relationships != nil {
		opts = append(opts, WithMetadataRelationships(md.Relationships))
	}
	return opts
}

// NewMetadata returns a Metadata configured by the given options. With no options,
// the result is the zero-value Metadata: empty Colors, ShowAxesHelper false,
// Invisible false, and nil Relationships.
func NewMetadata(options ...DrawMetadataOption) Metadata {
	config := newDrawMetadataConfig()
	for _, option := range options {
		option(config)
	}

	return Metadata{
		Colors:         config.colors,
		ShowAxesHelper: config.showAxesHelper,
		Invisible:      config.invisible,
		Relationships:  config.relationships,
	}
}

// ToProto converts the Metadata to a drawv1.Metadata proto message. When every
// color shares the same alpha channel, the opacity is stored as a single byte;
// otherwise, one opacity byte per color is stored.
func (metadata Metadata) ToProto() *drawv1.Metadata {
	proto := &drawv1.Metadata{
		Colors:         packColors(metadata.Colors),
		ColorFormat:    drawv1.ColorFormat_COLOR_FORMAT_RGB,
		ShowAxesHelper: &metadata.ShowAxesHelper,
		Invisible:      &metadata.Invisible,
		Relationships:  metadata.Relationships,
	}
	if opacity, uniform := metadata.opacitySummary(); uniform {
		proto.Opacities = []byte{opacity}
	} else {
		proto.Opacities = packOpacities(metadata.Colors)
	}
	return proto
}

// opacitySummary returns the shared opacity and true if all colors have the same alpha,
// or (0, false) if opacities differ across colors.
func (metadata *Metadata) opacitySummary() (uint8, bool) {
	if len(metadata.Colors) == 0 {
		return DefaultOpacity, true
	}
	first := metadata.Colors[0].A
	for _, c := range metadata.Colors[1:] {
		if c.A != first {
			return 0, false
		}
	}
	return first, true
}
