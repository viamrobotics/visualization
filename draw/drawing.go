package draw

import (
	"github.com/google/uuid"
	drawv1 "github.com/viam-labs/motion-tools/draw/v1"
	commonv1 "go.viam.com/api/common/v1"
	"go.viam.com/rdk/spatialmath"
)

// Shape represents a Shape in 3D space
type Shape struct {
	Center spatialmath.Pose
	Label  string
	Arrows *Arrows
	Line   *Line
	Points *Points
	Model  *Model
	Nurbs  *Nurbs
}

type drawShapeConfig struct {
	arrows *Arrows
	line   *Line
	points *Points
	model  *Model
	nurbs  *Nurbs
}

func newDrawShapeConfig() *drawShapeConfig {
	return &drawShapeConfig{
		arrows: nil,
		line:   nil,
		points: nil,
		model:  nil,
		nurbs:  nil,
	}
}

type drawShapeOption func(*drawShapeConfig)

func WithArrows(arrows Arrows) drawShapeOption {
	return func(config *drawShapeConfig) {
		config.arrows = &arrows
	}
}

// WithLine adds a Line to the Shape
func WithLine(line Line) drawShapeOption {
	return func(config *drawShapeConfig) {
		config.line = &line
	}
}

// WithPoints adds a Points to the Shape
func WithPoints(points Points) drawShapeOption {
	return func(config *drawShapeConfig) {
		config.points = &points
	}
}

// WithModel adds a Model to the Shape
func WithModel(model Model) drawShapeOption {
	return func(config *drawShapeConfig) {
		config.model = &model
	}
}

// WithNurbs adds a Nurbs to the Shape
func WithNurbs(nurbs Nurbs) drawShapeOption {
	return func(config *drawShapeConfig) {
		config.nurbs = &nurbs
	}
}

// NewShape creates a new Shape message
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

// toProto converts the Shape to a drawv1.Shape message
func (shape Shape) toProto() *drawv1.Shape {
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
			case asset.BinaryContent != nil:
				proto.Assets = append(proto.Assets, &drawv1.ModelAsset{
					MimeType:  asset.MimeType,
					SizeBytes: asset.SizeBytes,
					Content: &drawv1.ModelAsset_Binary{
						Binary: *asset.BinaryContent,
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

// Drawing represents a drawing in 3D space
type Drawing struct {
	Name     string
	Parent   string
	Pose     spatialmath.Pose
	Shape    Shape
	Metadata Metadata
}

// Drawable represents a shape that can be drawn
type Drawable interface {
	Draw(name string, parent string, pose spatialmath.Pose) (*Drawing, error)
}

// NewDrawing creates a new Drawing message
func NewDrawing(
	name string,
	parent string,
	pose spatialmath.Pose,
	shape Shape,
	metadata Metadata,
) *Drawing {
	return &Drawing{Name: name, Parent: parent, Pose: pose, Shape: shape, Metadata: metadata}
}

// toProto converts the Drawing to a drawv1.Drawing message with unit conversion
func (drawing Drawing) toProto() *drawv1.Drawing {
	pose := poseInFrameToProtobuf(drawing.Pose, drawing.Parent)
	uuidBytes := uuid.New()
	return &drawv1.Drawing{
		ReferenceFrame:      drawing.Name,
		PoseInObserverFrame: pose,
		PhysicalObject:      drawing.Shape.toProto(),
		Uuid:                uuidBytes[:],
		Metadata:            drawing.Metadata.ToProto(),
	}
}

// Metadata represents the metadata of a drawing
type Metadata struct {
	Colors []Color
}

type drawMetadataConfig struct {
	DrawColorsConfig
}

type drawMetadataOption func(*drawMetadataConfig)

func newDrawMetadataConfig() *drawMetadataConfig {
	return &drawMetadataConfig{
		DrawColorsConfig: NewDrawColorsConfig(),
	}
}

func WithMetadataColors(colors ...Color) drawMetadataOption {
	return WithColors[*drawMetadataConfig](colors)
}

// NewMetadata creates a new Metadata message
func NewMetadata(options ...drawMetadataOption) Metadata {
	config := newDrawMetadataConfig()
	for _, option := range options {
		option(config)
	}

	return Metadata{Colors: config.colors}
}

// ToProto converts the Metadata to a drawv1.Metadata message
func (metadata Metadata) ToProto() *drawv1.Metadata {
	return &drawv1.Metadata{Colors: packColors(metadata.Colors)}
}
