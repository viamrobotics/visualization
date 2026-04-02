package client

import (
	"testing"

	"github.com/golang/geo/r3"
	"go.viam.com/rdk/referenceframe"
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
	t.Run("DrawHierarchy", func(t *testing.T) {
		dims := r3.Vector{X: 50, Y: 50, Z: 50}

		makeBox := func(name string, pos r3.Vector) spatialmath.Geometry {
			box, err := spatialmath.NewBox(spatialmath.NewPoseFromPoint(pos), dims, name)
			test.That(t, err, test.ShouldBeNil)
			return box
		}

		zulu := makeBox("zulu", r3.Vector{X: 200})
		bravo := makeBox("bravo", r3.Vector{X: -200})
		DrawGeometries(
			referenceframe.NewGeometriesInFrame("world", []spatialmath.Geometry{zulu, bravo}),
			[]string{"#ff0000", "#ff6600"},
		)

		tango := makeBox("tango", r3.Vector{X: 200, Y: 200})
		delta := makeBox("delta", r3.Vector{X: 200, Y: -200})
		DrawGeometries(
			referenceframe.NewGeometriesInFrame("zulu", []spatialmath.Geometry{tango, delta}),
			[]string{"#ffff00", "#00ff00"},
		)

		sierra := makeBox("sierra", r3.Vector{X: 200, Y: 200, Z: 200})
		foxtrot := makeBox("foxtrot", r3.Vector{X: 200, Y: 200, Z: -200})
		DrawGeometries(
			referenceframe.NewGeometriesInFrame("tango", []spatialmath.Geometry{sierra, foxtrot}),
			[]string{"#0000ff", "#9900ff"},
		)
	})
}
