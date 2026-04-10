package api

import (
	"testing"

	"github.com/golang/geo/r3"
	"github.com/viam-labs/motion-tools/draw"
	"go.viam.com/rdk/spatialmath"
	"go.viam.com/test"
)

// world
// +-- zulu
// |   +-- tango
// |   |   +-- sierra
// |   |   +-- foxtrot  (sorts before sierra)
// |   +-- delta        (sorts before tango)
// +-- bravo            (sorts before zulu)
func TestDrawHierarchy(t *testing.T) {
	startTestServer(t)
	defer stopTestServer()

	t.Run("DrawHierarchy", func(t *testing.T) {
		dims := r3.Vector{X: 50, Y: 50, Z: 50}

		makeBox := func(name string, pos r3.Vector) spatialmath.Geometry {
			box, err := spatialmath.NewBox(spatialmath.NewPoseFromPoint(pos), dims, name)
			test.That(t, err, test.ShouldBeNil)
			return box
		}

		// Level 1: root nodes parented to "world"
		uuid, err := DrawGeometry(DrawGeometryOptions{
			Geometry: makeBox("zulu", r3.Vector{X: 200}),
			Color:    draw.ColorFromName("red"),
		})
		test.That(t, err, test.ShouldBeNil)
		test.That(t, uuid, test.ShouldNotBeNil)

		uuid, err = DrawGeometry(DrawGeometryOptions{
			Geometry: makeBox("bravo", r3.Vector{X: -200}),
			Color:    draw.ColorFromName("orange"),
		})
		test.That(t, err, test.ShouldBeNil)
		test.That(t, uuid, test.ShouldNotBeNil)

		// Level 2: children of "zulu"
		uuid, err = DrawGeometry(DrawGeometryOptions{
			Parent:   "zulu",
			Geometry: makeBox("tango", r3.Vector{X: 200, Y: 200}),
			Color:    draw.ColorFromName("yellow"),
		})
		test.That(t, err, test.ShouldBeNil)
		test.That(t, uuid, test.ShouldNotBeNil)

		uuid, err = DrawGeometry(DrawGeometryOptions{
			Parent:   "zulu",
			Geometry: makeBox("delta", r3.Vector{X: 200, Y: -200}),
			Color:    draw.ColorFromName("green"),
		})
		test.That(t, err, test.ShouldBeNil)
		test.That(t, uuid, test.ShouldNotBeNil)

		// Level 3: children of "tango"
		uuid, err = DrawGeometry(DrawGeometryOptions{
			Parent:   "tango",
			Geometry: makeBox("sierra", r3.Vector{X: 200, Y: 200, Z: 200}),
			Color:    draw.ColorFromName("blue"),
		})
		test.That(t, err, test.ShouldBeNil)
		test.That(t, uuid, test.ShouldNotBeNil)

		uuid, err = DrawGeometry(DrawGeometryOptions{
			Parent:   "tango",
			Geometry: makeBox("foxtrot", r3.Vector{X: 200, Y: 200, Z: -200}),
			Color:    draw.ColorFromName("purple"),
		})
		test.That(t, err, test.ShouldBeNil)
		test.That(t, uuid, test.ShouldNotBeNil)
	})
}
