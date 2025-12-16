package client

import (
	"testing"

	"github.com/golang/geo/r3"
	"go.viam.com/rdk/referenceframe"
	"go.viam.com/rdk/spatialmath"
	"go.viam.com/test"
)

func TestDrawFrameSystem(t *testing.T) {
	t.Run("DrawFrameSystem", func(t *testing.T) {
		fs := referenceframe.NewEmptyFrameSystem("test")
		dims := r3.Vector{X: 100, Y: 100, Z: 100}

		// add a static frame with a box
		name0 := "frame0"
		box0, err := spatialmath.NewBox(spatialmath.NewZeroPose(), dims, name0)
		test.That(t, err, test.ShouldBeNil)
		frame0, err := referenceframe.NewStaticFrameWithGeometry(name0, spatialmath.NewZeroPose(), box0)
		test.That(t, err, test.ShouldBeNil)
		fs.AddFrame(frame0, fs.World())

		// add an arm model to the fs
		armName := "arm1"
		model, err := referenceframe.ParseModelJSONFile("../data/ur5e.json", armName)
		test.That(t, err, test.ShouldBeNil)
		fs.AddFrame(model, fs.World())

		// add a static frame as a child of the model
		name2 := "frame1"
		box2, err := spatialmath.NewBox(spatialmath.NewZeroPose(), dims, name2)
		test.That(t, err, test.ShouldBeNil)
		blockFrame, err := referenceframe.NewStaticFrameWithGeometry(name2, spatialmath.NewZeroPose(), box2)
		test.That(t, err, test.ShouldBeNil)
		fs.AddFrame(blockFrame, model)

		// draw the frame system
		inputs := referenceframe.NewZeroInputs(fs)
		test.That(t, DrawFrameSystem(fs, inputs), test.ShouldBeNil)
		inputs[armName] = []float64{1, 1, 1, 1, 1, 1}
		test.That(t, DrawFrameSystem(fs, inputs), test.ShouldBeNil)
	})
}
