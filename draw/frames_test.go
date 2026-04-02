package draw

import (
	"testing"

	"github.com/golang/geo/r3"
	"go.viam.com/rdk/referenceframe"
	"go.viam.com/rdk/spatialmath"
	"go.viam.com/test"
)

func TestDrawnFrames_ToTransforms(t *testing.T) {
	axesFrame, err := referenceframe.NewStaticFrame("Axes", spatialmath.NewPose(
		r3.Vector{X: 100, Y: 0, Z: 0},
		&spatialmath.OrientationVectorDegrees{OZ: 1},
	))
	test.That(t, err, test.ShouldBeNil)

	unlabeledSphere, err := spatialmath.NewSphere(spatialmath.NewZeroPose(), 50, "")
	test.That(t, err, test.ShouldBeNil)
	sphereFrame, err := referenceframe.NewStaticFrameWithGeometry("Sphere", spatialmath.NewZeroPose(), unlabeledSphere)
	test.That(t, err, test.ShouldBeNil)

	labeledBox, err := spatialmath.NewBox(spatialmath.NewZeroPose(), r3.Vector{X: 100, Y: 100, Z: 100}, "Box")
	test.That(t, err, test.ShouldBeNil)
	boxFrame, err := referenceframe.NewStaticFrameWithGeometry("BoxFrame", spatialmath.NewZeroPose(), labeledBox)
	test.That(t, err, test.ShouldBeNil)

	t.Run("ToTransforms_NoGeometryFrame", func(t *testing.T) {
		drawn := NewDrawnFrames([]referenceframe.Frame{axesFrame})
		transforms, err := drawn.ToTransforms()
		test.That(t, err, test.ShouldBeNil)
		test.That(t, len(transforms), test.ShouldEqual, 1)
		test.That(t, transforms[0].ReferenceFrame, test.ShouldEqual, "Axes")
		test.That(t, transforms[0].PhysicalObject, test.ShouldBeNil)
	})

	t.Run("ToTransforms_GeometryWithEmptyLabel", func(t *testing.T) {
		drawn := NewDrawnFrames([]referenceframe.Frame{sphereFrame})
		transforms, err := drawn.ToTransforms()
		test.That(t, err, test.ShouldBeNil)
		test.That(t, len(transforms), test.ShouldEqual, 1)
		// RDK assigns the frame name as the geometry label when the original label was empty,
		// so ReferenceFrame and PhysicalObject.Label are both the frame name.
		test.That(t, transforms[0].ReferenceFrame, test.ShouldEqual, "Sphere")
		test.That(t, transforms[0].PhysicalObject.Label, test.ShouldEqual, "Sphere")
	})

	t.Run("ToTransforms_GeometryWithLabel", func(t *testing.T) {
		drawn := NewDrawnFrames([]referenceframe.Frame{boxFrame})
		transforms, err := drawn.ToTransforms()
		test.That(t, err, test.ShouldBeNil)
		test.That(t, len(transforms), test.ShouldEqual, 1)
		test.That(t, transforms[0].ReferenceFrame, test.ShouldEqual, "BoxFrame:Box")
		test.That(t, transforms[0].PhysicalObject.Label, test.ShouldEqual, "Box")
	})

	t.Run("ToTransforms_MixedFrames", func(t *testing.T) {
		drawn := NewDrawnFrames([]referenceframe.Frame{axesFrame, sphereFrame, boxFrame})
		transforms, err := drawn.ToTransforms()
		test.That(t, err, test.ShouldBeNil)
		test.That(t, len(transforms), test.ShouldEqual, 3)
		test.That(t, transforms[0].ReferenceFrame, test.ShouldEqual, "Axes")
		test.That(t, transforms[1].ReferenceFrame, test.ShouldEqual, "Sphere")
		test.That(t, transforms[2].ReferenceFrame, test.ShouldEqual, "BoxFrame:Box")
	})

	t.Run("ToTransforms_WithColorsMap", func(t *testing.T) {
		blue := ColorFromName("blue")
		drawn := NewDrawnFrames(
			[]referenceframe.Frame{sphereFrame, boxFrame},
			WithFramesColors(map[string]Color{"Sphere": blue}),
		)
		transforms, err := drawn.ToTransforms()
		test.That(t, err, test.ShouldBeNil)
		test.That(t, len(transforms), test.ShouldEqual, 2)
		// Sphere has an explicit color — metadata should be present.
		test.That(t, transforms[0].Metadata, test.ShouldNotBeNil)
		// BoxFrame has no explicit color — falls back to magenta, metadata still set.
		test.That(t, transforms[1].Metadata, test.ShouldNotBeNil)
	})

	t.Run("ToTransforms_WithParent", func(t *testing.T) {
		drawn := NewDrawnFrames([]referenceframe.Frame{axesFrame, sphereFrame})
		transforms, err := drawn.ToTransforms(WithParent("robot-base"))
		test.That(t, err, test.ShouldBeNil)
		for _, transform := range transforms {
			test.That(t, transform.PoseInObserverFrame.ReferenceFrame, test.ShouldEqual, "robot-base")
		}
	})

	t.Run("ToTransforms_WithPose", func(t *testing.T) {
		offset := spatialmath.NewPose(r3.Vector{X: 10, Y: 0, Z: 0}, &spatialmath.OrientationVectorDegrees{OZ: 1})
		drawn := NewDrawnFrames([]referenceframe.Frame{axesFrame, sphereFrame})
		transforms, err := drawn.ToTransforms(WithPose(offset))
		test.That(t, err, test.ShouldBeNil)
		test.That(t, len(transforms), test.ShouldEqual, 2)
		for i, frame := range []referenceframe.Frame{axesFrame, sphereFrame} {
			framePose, err := frame.Transform(nil)
			test.That(t, err, test.ShouldBeNil)
			expected := spatialmath.PoseToProtobuf(spatialmath.Compose(offset, framePose))
			test.That(t, transforms[i].PoseInObserverFrame.Pose, test.ShouldResemble, expected)
		}
	})
}
