package draw

import (
	"log"

	"github.com/google/uuid"

	drawv1 "github.com/viamrobotics/visualization/draw/v1"
)

// Bytes per element in each packed buffer, matching the packers in buffer_packer.go.
const (
	pointStrideBytes    = 3 * 4 // x, y, z as float32
	arrowPoseStride     = 6 * 4 // x, y, z, ox, oy, oz as float32
	nurbsPoseStride     = 7 * 4 // the arrow fields plus theta
	colorStrideBytes    = 3     // r, g, b as uint8
	opacityStrideBytes  = 1     // a as uint8
	sharedAttributeSize = 1     // a single color or opacity applies to every element
)

// shapeElementCount returns how many elements a shape's packed buffer holds, and whether the
// shape is one whose element count is knowable (a Model is not).
func shapeElementCount(shape *drawv1.Shape) (int, bool) {
	switch geometry := shape.GetGeometryType().(type) {
	case *drawv1.Shape_Points:
		return len(geometry.Points.GetPositions()) / pointStrideBytes, true
	case *drawv1.Shape_Line:
		return len(geometry.Line.GetPositions()) / pointStrideBytes, true
	case *drawv1.Shape_Arrows:
		return len(geometry.Arrows.GetPoses()) / arrowPoseStride, true
	case *drawv1.Shape_Nurbs:
		return len(geometry.Nurbs.GetControlPoints()) / nurbsPoseStride, true
	default:
		return 0, false
	}
}

// warnOnAttributeCountMismatch logs when a drawing's per-element colors or opacities no longer
// describe every element.
//
// A partial update can change a shape's elements without touching metadata, or the reverse. That
// is deliberate: not resending a large per-vertex color buffer just to move some points is the
// whole point of a partial update. The cost is that the two can drift apart, and the service does
// not reconcile them. Fewer colors than elements renders the extras black. More colors than
// elements leaves the tail unused. Keeping them consistent is the caller's job, so this only
// warns.
//
// A single shared color or opacity applies to every element and never mismatches.
func warnOnAttributeCountMismatch(id uuid.UUID, drawing *drawv1.Drawing) {
	elements, ok := shapeElementCount(drawing.GetPhysicalObject())
	if !ok || elements == 0 {
		return
	}

	metadata := drawing.GetMetadata()
	if colors := len(metadata.GetColors()) / colorStrideBytes; colors > sharedAttributeSize && colors != elements {
		log.Printf("draw: entity %s has %d per-element colors for %d elements; "+
			"resend colors alongside the elements to keep them in step", id, colors, elements)
	}
	if opacities := len(metadata.GetOpacities()) / opacityStrideBytes; opacities > sharedAttributeSize && opacities != elements {
		log.Printf("draw: entity %s has %d per-element opacities for %d elements; "+
			"resend opacities alongside the elements to keep them in step", id, opacities, elements)
	}
}
