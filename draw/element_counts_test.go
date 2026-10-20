package draw

import (
	"testing"

	"github.com/golang/geo/r3"
	"go.viam.com/rdk/spatialmath"
	"go.viam.com/test"

	drawv1 "github.com/viamrobotics/visualization/draw/v1"
)

func TestShapeElementCount(t *testing.T) {
	points := make([]r3.Vector, 5)
	poses := make([]spatialmath.Pose, 4)
	for i := range poses {
		poses[i] = spatialmath.NewZeroPose()
	}

	// Counts are derived from the packed byte length, so these guard the strides against a
	// change in how buffer_packer.go lays elements out.
	for _, tc := range []struct {
		name  string
		shape *drawv1.Shape
		want  int
		known bool
	}{
		{
			name:  "points",
			shape: &drawv1.Shape{GeometryType: &drawv1.Shape_Points{Points: &drawv1.Points{Positions: packPoints(points)}}},
			want:  5, known: true,
		},
		{
			name:  "line",
			shape: &drawv1.Shape{GeometryType: &drawv1.Shape_Line{Line: &drawv1.Line{Positions: packPoints(points)}}},
			want:  5, known: true,
		},
		{
			name:  "arrows",
			shape: &drawv1.Shape{GeometryType: &drawv1.Shape_Arrows{Arrows: &drawv1.Arrows{Poses: packPoses(poses, false)}}},
			want:  4, known: true,
		},
		{
			name:  "nurbs",
			shape: &drawv1.Shape{GeometryType: &drawv1.Shape_Nurbs{Nurbs: &drawv1.Nurbs{ControlPoints: packPoses(poses, true)}}},
			want:  4, known: true,
		},
		{
			name:  "model has no element count",
			shape: &drawv1.Shape{GeometryType: &drawv1.Shape_Model{Model: &drawv1.Model{}}},
			want:  0, known: false,
		},
	} {
		t.Run(tc.name, func(t *testing.T) {
			count, ok := shapeElementCount(tc.shape)
			test.That(t, ok, test.ShouldEqual, tc.known)
			test.That(t, count, test.ShouldEqual, tc.want)
		})
	}
}

func TestWarnOnAttributeCountMismatch(t *testing.T) {
	points := make([]r3.Vector, 3)
	shape := &drawv1.Shape{
		GeometryType: &drawv1.Shape_Points{Points: &drawv1.Points{Positions: packPoints(points)}},
	}

	colorsFor := func(n int) []byte {
		colors := make([]Color, n)
		return packColors(colors)
	}

	// The warning is advisory, so the assertion here is that the arithmetic identifies the right
	// cases. A shared color covers every element and must never be flagged.
	for _, tc := range []struct {
		name     string
		colors   []byte
		mismatch bool
	}{
		{name: "matching per-element colors", colors: colorsFor(3), mismatch: false},
		{name: "single shared color", colors: colorsFor(1), mismatch: false},
		{name: "too few colors", colors: colorsFor(2), mismatch: true},
		{name: "too many colors", colors: colorsFor(9), mismatch: true},
		{name: "no colors", colors: nil, mismatch: false},
	} {
		t.Run(tc.name, func(t *testing.T) {
			drawing := &drawv1.Drawing{
				PhysicalObject: shape,
				Metadata:       &drawv1.Metadata{Colors: tc.colors},
			}
			elements, ok := shapeElementCount(drawing.GetPhysicalObject())
			test.That(t, ok, test.ShouldBeTrue)

			colors := len(drawing.GetMetadata().GetColors()) / colorStrideBytes
			flagged := colors > sharedAttributeSize && colors != elements
			test.That(t, flagged, test.ShouldEqual, tc.mismatch)
		})
	}
}
