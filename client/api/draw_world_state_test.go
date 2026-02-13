package api

import (
	"testing"

	"github.com/golang/geo/r3"
	"go.viam.com/rdk/referenceframe"
	"go.viam.com/rdk/spatialmath"
	"go.viam.com/test"
)

func TestDrawWorldState(t *testing.T) {
	t.Run("DrawWorldState", func(t *testing.T) {
		startTestServer(t)

		dims := r3.Vector{X: 100, Y: 100, Z: 100}

		// make a super simple frame system
		fs := referenceframe.NewEmptyFrameSystem("test")
		frameName := "frame0"
		frame0, err := referenceframe.NewStaticFrame(frameName, spatialmath.NewPoseFromPoint(r3.Vector{Z: 300}))
		test.That(t, err, test.ShouldBeNil)
		fs.AddFrame(frame0, fs.World())

		// make some boxes
		box0, err := spatialmath.NewBox(spatialmath.NewZeroPose(), dims, "box0")
		test.That(t, err, test.ShouldBeNil)
		box1, err := spatialmath.NewBox(spatialmath.NewPoseFromPoint(r3.Vector{X: 300}), dims, "box1")
		test.That(t, err, test.ShouldBeNil)
		box2, err := spatialmath.NewBox(spatialmath.NewPoseFromPoint(r3.Vector{Z: 300}), dims, "box2")
		test.That(t, err, test.ShouldBeNil)

		// make the worldstate and draw it
		ws, err := referenceframe.NewWorldState([]*referenceframe.GeometriesInFrame{
			referenceframe.NewGeometriesInFrame(frameName, []spatialmath.Geometry{box0, box1}),
			referenceframe.NewGeometriesInFrame(referenceframe.World, []spatialmath.Geometry{box2}),
		}, nil)
		test.That(t, err, test.ShouldBeNil)

		uuids, err := DrawWorldState(DrawWorldStateOptions{
			WorldState:  ws,
			FrameSystem: fs,
			Inputs:      referenceframe.NewZeroInputs(fs),
		})
		test.That(t, err, test.ShouldBeNil)
		test.That(t, len(uuids), test.ShouldBeGreaterThan, 0)
	})
}
