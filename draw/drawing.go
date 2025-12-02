package draw

import (
	"github.com/google/uuid"
	drawv1 "github.com/viam-labs/motion-tools/gen/draw/v1"
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
	Units  Units
}

// NewShape creates a new Shape message
func NewShape(center spatialmath.Pose, label string, units Units) *Shape {
	return &Shape{Center: center, Label: label, Units: units}
}

// WithArrows adds an Arrows to the Shape
func (shape *Shape) WithArrows(arrows *Arrows) *Shape {
	shape.Arrows = arrows
	return shape
}

// WithLine adds a Line to the Shape
func (shape *Shape) WithLine(line *Line) *Shape {
	shape.Line = line
	return shape
}

// WithPoints adds a Points to the Shape
func (shape *Shape) WithPoints(points *Points) *Shape {
	shape.Points = points
	return shape
}

// WithModel adds a Model to the Shape
func (shape *Shape) WithModel(model *Model) *Shape {
	shape.Model = model
	return shape
}

// WithNurbs adds a Nurbs to the Shape
func (shape *Shape) WithNurbs(nurbs *Nurbs) *Shape {
	shape.Nurbs = nurbs
	return shape
}

// toProto converts the Shape to a drawv1.Shape message
func (shape *Shape) toProto() *drawv1.Shape {
	switch {
	case shape.Arrows != nil:
		return &drawv1.Shape{
			GeometryType: &drawv1.Shape_Arrows{
				Arrows: &drawv1.Arrows{
					Poses: packPoses(shape.Arrows.Poses, &shape.Units),
				},
			},
		}
	case shape.Line != nil:
		lineWidth := shape.Line.LineWidth
		pointSize := shape.Line.PointSize
		if shape.Units == UnitsM {
			lineWidth = float32ToMeters(lineWidth)
			pointSize = float32ToMeters(pointSize)
		}
		return &drawv1.Shape{
			GeometryType: &drawv1.Shape_Line{
				Line: &drawv1.Line{
					Points:    packPoints(shape.Line.Points, &shape.Units),
					LineWidth: &lineWidth,
					PointSize: &pointSize,
				},
			},
		}
	case shape.Points != nil:
		pointSize := shape.Points.PointSize
		if shape.Units == UnitsM {
			pointSize = float32ToMeters(pointSize)
		}
		return &drawv1.Shape{
			GeometryType: &drawv1.Shape_Points{
				Points: &drawv1.Points{
					Positions: packPoints(shape.Points.Positions, &shape.Units),
					PointSize: &pointSize,
				},
			},
		}
	case shape.Model != nil:
		switch {
		case shape.Model.URL != nil:
			return &drawv1.Shape{
				GeometryType: &drawv1.Shape_Model{
					Model: &drawv1.Model{
						CacheKey:  &shape.Model.CacheKey,
						SizeBytes: &shape.Model.SizeBytes,
						Scale:     &shape.Model.Scale,
						ModelType: &drawv1.Model_Url{
							Url: *shape.Model.URL,
						},
					},
				},
			}
		case shape.Model.GLB != nil:
			return &drawv1.Shape{
				GeometryType: &drawv1.Shape_Model{
					Model: &drawv1.Model{
						CacheKey:  &shape.Model.CacheKey,
						SizeBytes: &shape.Model.SizeBytes,
						Scale:     &shape.Model.Scale,
						ModelType: &drawv1.Model_Glb{
							Glb: *shape.Model.GLB,
						},
					},
				},
			}
		default:
			return nil
		}
	case shape.Nurbs != nil:
		return &drawv1.Shape{
			GeometryType: &drawv1.Shape_Nurbs{
				Nurbs: &drawv1.Nurbs{
					Poses:   packPoses(shape.Nurbs.ControlPoints, &shape.Units),
					Degree:  int32(shape.Nurbs.Degree),
					Weights: packFloats(shape.Nurbs.Weights),
					Knots:   packFloats(shape.Nurbs.Knots),
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
	Shape    *Shape
	Metadata *Metadata
}

// Drawable represents a shape that can be drawn
type Drawable interface {
	Draw(name string, parent string, pose spatialmath.Pose, units Units) (*Drawing, error)
}

// NewDrawing creates a new Drawing message
func NewDrawing(
	name string,
	parent string,
	pose spatialmath.Pose,
	shape *Shape,
	metadata *Metadata,
) *Drawing {
	return &Drawing{Name: name, Parent: parent, Pose: pose, Shape: shape, Metadata: metadata}
}

// toProto converts the Drawing to a drawv1.Drawing message with unit conversion
func (drawing *Drawing) toProto() *drawv1.Drawing {
	pose := poseInFrameToProtobuf(drawing.Pose, drawing.Parent, drawing.Shape.Units)
	uuidBytes := uuid.New()
	return &drawv1.Drawing{
		Name:                drawing.Name,
		PoseInObserverFrame: pose,
		PhysicalObject:      drawing.Shape.toProto(),
		Uuid:                uuidBytes[:],
		Metadata:            drawing.Metadata.ToProto(),
	}
}

// Metadata represents the metadata of a drawing
type Metadata struct {
	Colors []*Color
}

// NewMetadata creates a new Metadata message
func NewMetadata(colors []*Color) *Metadata {
	return &Metadata{colors}
}

// ToProto converts the Metadata to a drawv1.Metadata message
func (metadata *Metadata) ToProto() *drawv1.Metadata {
	return &drawv1.Metadata{Colors: packColors(metadata.Colors)}
}
