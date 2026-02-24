package draw

import (
	"testing"

	"github.com/golang/geo/r3"
	fixtures "github.com/viam-labs/motion-tools/draw/fixtures"
	commonv1 "go.viam.com/api/common/v1"
	"go.viam.com/rdk/referenceframe"
	"go.viam.com/rdk/spatialmath"
	"go.viam.com/test"
)

// makeTestFrameSystem builds a three-frame system:
//
//	world → test → child
//	             → other_child
func makeTestFrameSystem(t *testing.T) *referenceframe.FrameSystem {
	t.Helper()
	box, err := spatialmath.NewBox(spatialmath.NewZeroPose(), r3.Vector{X: 100, Y: 100, Z: 100}, "box")
	test.That(t, err, test.ShouldBeNil)

	fs := referenceframe.NewEmptyFrameSystem("test")

	frame, err := referenceframe.NewStaticFrameWithGeometry("test", spatialmath.NewZeroPose(), box)
	test.That(t, err, test.ShouldBeNil)
	test.That(t, fs.AddFrame(frame, fs.World()), test.ShouldBeNil)

	childFrame, err := referenceframe.NewStaticFrameWithGeometry("child", spatialmath.NewZeroPose(), box)
	test.That(t, err, test.ShouldBeNil)
	test.That(t, fs.AddFrame(childFrame, frame), test.ShouldBeNil)

	otherChildFrame, err := referenceframe.NewStaticFrameWithGeometry("other_child", spatialmath.NewZeroPose(), box)
	test.That(t, err, test.ShouldBeNil)
	test.That(t, fs.AddFrame(otherChildFrame, frame), test.ShouldBeNil)

	return fs
}

func TestNewDrawnFrameSystem(t *testing.T) {
	fs := makeTestFrameSystem(t)

	t.Run("DefaultColorIsMagenta", func(t *testing.T) {
		drawn := NewDrawnFrameSystem(fs, referenceframe.NewZeroInputs(fs))
		magenta := NewColor(WithName("magenta"))
		for _, color := range drawn.Colors {
			test.That(t, color, test.ShouldResemble, magenta)
		}
	})

	t.Run("WithFrameSystemColors", func(t *testing.T) {
		red := NewColor(WithName("red"))
		blue := NewColor(WithName("blue"))
		drawn := NewDrawnFrameSystem(fs, referenceframe.NewZeroInputs(fs), WithFrameSystemColors(map[string]Color{
			"test":        red,
			"other_child": blue,
		}))
		test.That(t, drawn.Colors["test"], test.ShouldResemble, red)
		test.That(t, drawn.Colors["other_child"], test.ShouldResemble, blue)
	})

	t.Run("WithFrameSystemColor", func(t *testing.T) {
		green := NewColor(WithRGB(0, 255, 0))
		drawn := NewDrawnFrameSystem(fs, referenceframe.NewZeroInputs(fs), WithFrameSystemColor("test", green))
		test.That(t, drawn.Colors["test"], test.ShouldResemble, green)
		// Other frames should still be magenta
		test.That(t, drawn.Colors["child"], test.ShouldResemble, NewColor(WithName("magenta")))
	})
}

func TestDrawnFrameSystem_ToTransforms(t *testing.T) {
	fs := makeTestFrameSystem(t)

	t.Run("ProducesTransformPerGeometry", func(t *testing.T) {
		drawn := NewDrawnFrameSystem(fs, referenceframe.NewZeroInputs(fs), WithFrameSystemColors(map[string]Color{
			"test":        NewColor(WithName("red")),
			"other_child": NewColor(WithName("blue")),
		}))

		transforms, err := drawn.ToTransforms()
		test.That(t, err, test.ShouldBeNil)
		test.That(t, len(transforms), test.ShouldEqual, 3)

		// Transforms are sorted by frame name: child < other_child < test
		test.That(t, transforms[0].ReferenceFrame, test.ShouldEqual, "child:box")
		test.That(t, transforms[1].ReferenceFrame, test.ShouldEqual, "other_child:box")
		test.That(t, transforms[2].ReferenceFrame, test.ShouldEqual, "test:box")

		test.That(t, transforms[2].PhysicalObject.Label, test.ShouldEqual, "box")
		test.That(t, transforms[2].PoseInObserverFrame.GetPose(), test.ShouldResemble, &commonv1.Pose{
			X: 0, Y: 0, Z: 0, OX: 0, OY: 0, OZ: 1, Theta: 0,
		})
		test.That(t, transforms[2].PhysicalObject.GetBox(), test.ShouldResemble, &commonv1.RectangularPrism{
			DimsMm: &commonv1.Vector3{X: 100, Y: 100, Z: 100},
		})
		test.That(t, transforms[2].Metadata, test.ShouldNotBeNil)
	})

	t.Run("AppliesExplicitColors", func(t *testing.T) {
		drawn := NewDrawnFrameSystem(fs, referenceframe.NewZeroInputs(fs), WithFrameSystemColors(map[string]Color{
			"test":        NewColor(WithName("red")),
			"other_child": NewColor(WithName("blue")),
		}))

		transforms, err := drawn.ToTransforms()
		test.That(t, err, test.ShouldBeNil)

		// "other_child" explicitly set to blue
		test.That(t, transforms[1].ReferenceFrame, test.ShouldEqual, "other_child:box")
		test.That(t, fixtures.Byte64EncodedToString(transforms[1].Metadata.Fields["colors"].GetStringValue()), test.ShouldResemble, "\x00\x00\xff")

		// "test" explicitly set to red
		test.That(t, transforms[2].ReferenceFrame, test.ShouldEqual, "test:box")
		test.That(t, fixtures.Byte64EncodedToString(transforms[2].Metadata.Fields["colors"].GetStringValue()), test.ShouldResemble, "\xff\x00\x00")
	})

	t.Run("InheritsParentColor", func(t *testing.T) {
		// "child" has no explicit color; it should inherit red from its parent "test"
		drawn := NewDrawnFrameSystem(fs, referenceframe.NewZeroInputs(fs), WithFrameSystemColors(map[string]Color{
			"test": NewColor(WithName("red")),
		}))

		transforms, err := drawn.ToTransforms()
		test.That(t, err, test.ShouldBeNil)

		// "child" is first alphabetically
		test.That(t, transforms[0].ReferenceFrame, test.ShouldEqual, "child:box")
		test.That(t, fixtures.Byte64EncodedToString(transforms[0].Metadata.Fields["colors"].GetStringValue()), test.ShouldResemble, "\xff\x00\x00")
	})

	t.Run("FrameNamesUsedAsPrefix", func(t *testing.T) {
		drawn := NewDrawnFrameSystem(fs, referenceframe.NewZeroInputs(fs))

		// Frame names are always used as the prefix for geometry labels
		transforms, err := drawn.ToTransforms()
		test.That(t, err, test.ShouldBeNil)
		test.That(t, len(transforms), test.ShouldEqual, 3)
		test.That(t, transforms[0].ReferenceFrame, test.ShouldEqual, "child:box")
		test.That(t, transforms[1].ReferenceFrame, test.ShouldEqual, "other_child:box")
		test.That(t, transforms[2].ReferenceFrame, test.ShouldEqual, "test:box")
	})

	t.Run("WithParent_PropagatesParentToAllTransforms", func(t *testing.T) {
		drawn := NewDrawnFrameSystem(fs, referenceframe.NewZeroInputs(fs))

		transforms, err := drawn.ToTransforms(WithParent("robot-base"))
		test.That(t, err, test.ShouldBeNil)
		for _, transform := range transforms {
			test.That(t, transform.PoseInObserverFrame.ReferenceFrame, test.ShouldEqual, "robot-base")
		}
	})
}
