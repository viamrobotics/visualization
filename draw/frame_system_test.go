package draw

import (
	"fmt"
	"testing"

	"github.com/golang/geo/r3"
	fixtures "github.com/viam-labs/motion-tools/draw/fixtures"
	commonv1 "go.viam.com/api/common/v1"
	"go.viam.com/rdk/referenceframe"
	"go.viam.com/rdk/spatialmath"
	"go.viam.com/test"
)

func TestDrawFrameSystem(t *testing.T) {
	t.Run("DrawFrameSystem", func(t *testing.T) {
		fs := referenceframe.NewEmptyFrameSystem("test")
		box, err := spatialmath.NewBox(spatialmath.NewZeroPose(), r3.Vector{X: 100, Y: 100, Z: 100}, "box")
		test.That(t, err, test.ShouldBeNil)
		frame, err := referenceframe.NewStaticFrameWithGeometry("test", spatialmath.NewZeroPose(), box)
		test.That(t, err, test.ShouldBeNil)
		fs.AddFrame(frame, fs.World())

		childFrame, err := referenceframe.NewStaticFrameWithGeometry("child", spatialmath.NewZeroPose(), box)
		test.That(t, err, test.ShouldBeNil)
		fs.AddFrame(childFrame, frame)

		otherChildFrame, err := referenceframe.NewStaticFrameWithGeometry("other_child", spatialmath.NewZeroPose(), box)
		test.That(t, err, test.ShouldBeNil)
		fs.AddFrame(otherChildFrame, frame)

		transforms, err := NewDrawnFrameSystem(fs, referenceframe.NewZeroInputs(fs), WithFrameSystemColors(map[string]Color{
			"test":        NewColor(WithName("red")),
			"other_child": NewColor(WithName("blue")),
		})).Draw("")
		test.That(t, err, test.ShouldBeNil)
		test.That(t, transforms, test.ShouldNotBeNil)
		test.That(t, len(transforms.Transforms), test.ShouldEqual, 3)
		test.That(t, transforms.Transforms[2].PhysicalObject.Label, test.ShouldEqual, "box")
		test.That(t, transforms.Transforms[2].ReferenceFrame, test.ShouldEqual, "test:box")
		test.That(t, transforms.Transforms[2].PoseInObserverFrame.GetPose(), test.ShouldResemble, &commonv1.Pose{
			X:     0,
			Y:     0,
			Z:     0,
			OX:    0,
			OY:    0,
			OZ:    1,
			Theta: 0,
		})
		test.That(t, transforms.Transforms[2].PhysicalObject.GetBox(), test.ShouldResemble, &commonv1.RectangularPrism{
			DimsMm: &commonv1.Vector3{
				X: 100,
				Y: 100,
				Z: 100,
			},
		})
		test.That(t, transforms.Transforms[2].Metadata, test.ShouldNotBeNil)
		test.That(t, fixtures.Byte64EncodedToString(transforms.Transforms[0].Metadata.Fields["colors"].GetStringValue()), test.ShouldResemble, "\xff\x00\x00\xff")

		for _, transform := range transforms.Transforms {
			fmt.Println(transform.ReferenceFrame)
		}

		test.That(t, transforms.Transforms[0].ReferenceFrame, test.ShouldEqual, "child:box")
		test.That(t, fixtures.Byte64EncodedToString(transforms.Transforms[0].Metadata.Fields["colors"].GetStringValue()), test.ShouldResemble, "\xff\x00\x00\xff")

		test.That(t, transforms.Transforms[1].ReferenceFrame, test.ShouldEqual, "other_child:box")
		test.That(t, fixtures.Byte64EncodedToString(transforms.Transforms[1].Metadata.Fields["colors"].GetStringValue()), test.ShouldResemble, "\x00\x00\xff\xff")
	})
}
