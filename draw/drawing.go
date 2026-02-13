package draw

import (
	drawv1 "github.com/viam-labs/motion-tools/draw/v1"
	commonv1 "go.viam.com/api/common/v1"
	"go.viam.com/rdk/spatialmath"
)

// Shape represents a drawable geometric shape or object in 3D space. A Shape contains
// exactly one geometry type (Arrows, Line, Points, Model, or Nurbs), positioned at Center with a Label.
type Shape struct {
	drawShapeConfig
	Center spatialmath.Pose
	Label  string
	Arrows *Arrows
	Line   *Line
	Points *Points
	Model  *Model
	Nurbs  *Nurbs
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

// ToProto converts the shape to a drawv1.Shape message
//
// Returns the drawv1.Shape message
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
		pointSize := shape.Line.PointSize
		return &drawv1.Shape{
			Label:  shape.Label,
			Center: poseToProtobuf(shape.Center),
			GeometryType: &drawv1.Shape_Line{
				Line: &drawv1.Line{
					Positions: packPoints(shape.Line.Positions),
					LineWidth: &lineWidth,
					PointSize: &pointSize,
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

// Drawing represents a complete drawable object in 3D space, consisting of a Shape positioned
// at a Pose within a reference frame (Parent), along with associated Metadata like colors.
type Drawing struct {
	UUID     []byte
	Name     string
	Parent   string
	Pose     spatialmath.Pose
	Shape    Shape
	Metadata Metadata
}

// NewDrawing creates a new Drawing representing a non-physical object in 3D space.
func NewDrawing(
	name string,
	parent string,
	pose spatialmath.Pose,
	shape Shape,
	metadata Metadata,
	options ...UuidOption,
) *Drawing {
	config := newUuidConfig(name, parent)
	for _, option := range options {
		option(config)
	}

	return &Drawing{
		UUID:     config.uuid,
		Name:     name,
		Parent:   parent,
		Pose:     pose,
		Shape:    shape,
		Metadata: metadata,
	}
}

// ToProto converts the Drawing to a Protocol Buffer drawv1.Drawing message for serialization.
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

// Metadata stores additional rendering information for a Drawing, such as colors for the shape's components.
type Metadata struct {
	Colors []Color
}

func (metadata *Metadata) SetColors(colors []Color) {
	metadata.Colors = colors
}

// drawMetadataConfig is a configuration for drawing metadata
type drawMetadataConfig struct {
	DrawColorsConfig
}

// drawMetadataOption is a function that configures a draw metadata configuration
type drawMetadataOption func(*drawMetadataConfig)

// newDrawMetadataConfig creates a new draw metadata configuration
func newDrawMetadataConfig() *drawMetadataConfig {
	return &drawMetadataConfig{
		DrawColorsConfig: NewDrawColorsConfig(),
	}
}

// WithMetadataColors creates a metadata option that sets the color list for the metadata.
func WithMetadataColors(colors ...Color) drawMetadataOption {
	return withColors[*drawMetadataConfig](colors)
}

// NewMetadata creates a new Metadata with the given options. If no options are provided, returns empty metadata.
func NewMetadata(options ...drawMetadataOption) Metadata {
	config := newDrawMetadataConfig()
	for _, option := range options {
		option(config)
	}

	return Metadata{Colors: config.colors}
}

// ToProto converts the Metadata to a Protocol Buffer drawv1.Metadata message for serialization.
func (metadata Metadata) ToProto() *drawv1.Metadata {
	return &drawv1.Metadata{Colors: packColors(metadata.Colors)}
}
