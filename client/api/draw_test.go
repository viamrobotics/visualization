package api

import (
	"testing"
	"time"

	"github.com/golang/geo/r3"
	"github.com/viam-labs/motion-tools/draw"
	"go.viam.com/rdk/spatialmath"
	"go.viam.com/test"
)

func TestDrawServiceEvents(t *testing.T) {
	startTestServer(t)

	t.Run("AddTransformAndDrawing", func(t *testing.T) {
		box, err := spatialmath.NewBox(
			spatialmath.NewPose(
				r3.Vector{X: 0, Y: 0, Z: 300},
				&spatialmath.OrientationVectorDegrees{Theta: 0, OX: 0, OY: 0, OZ: 1},
			),
			r3.Vector{X: 400, Y: 400, Z: 400},
			"lifecycle-box",
		)
		test.That(t, err, test.ShouldBeNil)

		_, err = DrawGeometry(DrawGeometryOptions{
			ID:       "lifecycle-box",
			Geometry: box,
			Color:    draw.ColorFromName("red"),
		})
		test.That(t, err, test.ShouldBeNil)

		lineColor := draw.ColorFromName("yellow")
		_, err = DrawLine(DrawLineOptions{
			ID:   "lifecycle-line",
			Name: "lifecycle-line",
			Positions: []r3.Vector{
				{X: 0, Y: 0, Z: 0},
				{X: 1000, Y: 0, Z: 0},
				{X: 1000, Y: 1000, Z: 0},
				{X: 0, Y: 1000, Z: 0},
			},
			Colors:    []draw.Color{lineColor},
			LineWidth: 50.0,
			DotSize:   50.0,
		})
		test.That(t, err, test.ShouldBeNil)
	})

	t.Run("UpdateTransformAndDrawing", func(t *testing.T) {
		box, err := spatialmath.NewBox(
			spatialmath.NewPose(
				r3.Vector{X: 0, Y: 0, Z: 600},
				&spatialmath.OrientationVectorDegrees{Theta: 0, OX: 0, OY: 0, OZ: 1},
			),
			r3.Vector{X: 400, Y: 400, Z: 400},
			"lifecycle-box",
		)
		test.That(t, err, test.ShouldBeNil)

		_, err = DrawGeometry(DrawGeometryOptions{
			ID:       "lifecycle-box",
			Geometry: box,
			Color:    draw.ColorFromName("green"),
		})
		test.That(t, err, test.ShouldBeNil)

		lineColor := draw.ColorFromName("cyan")
		_, err = DrawLine(DrawLineOptions{
			ID:   "lifecycle-line",
			Name: "lifecycle-line",
			Positions: []r3.Vector{
				{X: 0, Y: 0, Z: 0},
				{X: 1000, Y: 0, Z: 0},
				{X: 1000, Y: 1000, Z: 0},
				{X: 0, Y: 1000, Z: 0},
			},
			Colors:    []draw.Color{lineColor},
			LineWidth: 50.0,
			DotSize:   50.0,
		})
		test.That(t, err, test.ShouldBeNil)
	})

	t.Run("RemoveAll", func(t *testing.T) {
		time.Sleep(500 * time.Millisecond)
		count, err := RemoveAll()
		test.That(t, err, test.ShouldBeNil)
		test.That(t, count, test.ShouldEqual, 2)
	})
}

func TestInvisible(t *testing.T) {
	startTestServer(t)

	box, err := spatialmath.NewBox(
		spatialmath.NewPose(
			r3.Vector{X: 0, Y: 0, Z: 300},
			&spatialmath.OrientationVectorDegrees{Theta: 0, OX: 0, OY: 0, OZ: 1},
		),
		r3.Vector{X: 400, Y: 400, Z: 400},
		"invisible-box",
	)
	test.That(t, err, test.ShouldBeNil)

	t.Run("DrawVisible", func(t *testing.T) {
		invisible := false
		_, err := DrawGeometry(DrawGeometryOptions{
			ID:        "invisible-box",
			Geometry:  box,
			Color:     draw.ColorFromName("cyan"),
			Invisible: &invisible,
		})
		test.That(t, err, test.ShouldBeNil)
	})

	t.Run("DrawInvisible", func(t *testing.T) {
		invisible := true
		_, err := DrawGeometry(DrawGeometryOptions{
			ID:        "invisible-box",
			Geometry:  box,
			Color:     draw.ColorFromName("cyan"),
			Invisible: &invisible,
		})
		test.That(t, err, test.ShouldBeNil)
	})
}

func TestShowAxesHelper(t *testing.T) {
	startTestServer(t)

	box, err := spatialmath.NewBox(
		spatialmath.NewPose(
			r3.Vector{X: 0, Y: 0, Z: 300},
			&spatialmath.OrientationVectorDegrees{Theta: 0, OX: 0, OY: 0, OZ: 1},
		),
		r3.Vector{X: 50, Y: 50, Z: 50},
		"show-axes-helper-box",
	)
	test.That(t, err, test.ShouldBeNil)

	t.Run("DrawWithoutAxesHelper", func(t *testing.T) {
		show := false
		_, err := DrawGeometry(DrawGeometryOptions{
			ID:             "show-axes-helper-box",
			Geometry:       box,
			Color:          draw.ColorFromName("purple").SetAlpha(128),
			ShowAxesHelper: &show,
		})
		test.That(t, err, test.ShouldBeNil)
	})

	t.Run("DrawWithAxesHelper", func(t *testing.T) {
		show := true
		_, err := DrawGeometry(DrawGeometryOptions{
			ID:             "show-axes-helper-box",
			Geometry:       box,
			Color:          draw.ColorFromName("purple"),
			ShowAxesHelper: &show,
		})
		test.That(t, err, test.ShouldBeNil)
	})
}
